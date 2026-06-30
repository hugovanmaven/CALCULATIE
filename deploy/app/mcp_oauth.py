"""OAuth 2.1 storage + helpers voor de MCP-endpoint (MCP authorization spec).

Geport van Sanders maven-sales MCP (sandermaven/maven-company-main) en
aangepast voor de calculatie-app: connector-pad `/mcp` i.p.v.
`/sales/api/mcp`, eigen base-url en resource-naam.

Stdlib-only. Persisteert clients/codes/tokens in een aparte SQLite-DB op
het Railway-volume (of `deploy/data` lokaal) zodat connectors een redeploy
overleven — los van de hoofd-DB (Postgres).

Public clients + PKCE (S256), dynamic client registration (RFC 7591),
AS metadata (RFC 8414) en protected-resource metadata (RFC 9728).
Tokens worden gehasht opgeslagen (sha256), nooit in plaintext.
"""

import base64
import hashlib
import json
import os
import secrets
import sqlite3
import time
from pathlib import Path

# Zelfde volume-conventie als storage_calculatie: Railway-volume of deploy/data.
_DATA_DIR = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH") or str(
    Path(__file__).parent.parent / "data"
)
OAUTH_DB_PATH = os.path.join(_DATA_DIR, "mcp_oauth.db")

PUBLIC_BASE_URL = os.environ.get(
    "MCP_PUBLIC_BASE_URL", "https://calculatie.maven-company.com"
).rstrip("/")

AUTH_CODE_TTL = 300          # 5 min
ACCESS_TOKEN_TTL = 3600      # 1 uur
REFRESH_TOKEN_TTL = 90 * 24 * 3600  # 90 dagen

_SCHEMA = """
CREATE TABLE IF NOT EXISTS clients (
    client_id TEXT PRIMARY KEY,
    client_name TEXT DEFAULT '',
    redirect_uris TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_codes (
    code_hash TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    scope TEXT DEFAULT 'mcp',
    user_email TEXT DEFAULT '',
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    resource TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS tokens (
    token_hash TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    scope TEXT DEFAULT 'mcp',
    user_email TEXT DEFAULT '',
    expires_at INTEGER NOT NULL,
    refresh_hash TEXT,
    refresh_expires_at INTEGER,
    resource TEXT DEFAULT ''
);
"""


_initialized: set[str] = set()


def _conn():
    os.makedirs(_DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(OAUTH_DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    # Schema één keer per DB-bestand aanmaken i.p.v. bij elke connectie.
    if OAUTH_DB_PATH not in _initialized:
        conn.executescript(_SCHEMA)
        _initialized.add(OAUTH_DB_PATH)
    return conn


def _hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


def _now():
    return int(time.time())


# --- Dynamic Client Registration ------------------------------------------- #

def register_client(metadata):
    redirect_uris = metadata.get("redirect_uris") or []
    if not isinstance(redirect_uris, list) or not redirect_uris:
        return None
    client_id = "mcp-" + secrets.token_urlsafe(16)
    name = str(metadata.get("client_name", ""))[:200]
    with _conn() as c:
        c.execute(
            "INSERT INTO clients (client_id, client_name, redirect_uris, created_at) "
            "VALUES (?,?,?,?)",
            (client_id, name, json.dumps(redirect_uris), _now()),
        )
    return {
        "client_id": client_id,
        "client_name": name,
        "redirect_uris": redirect_uris,
        "token_endpoint_auth_method": "none",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "client_id_issued_at": _now(),
    }


def get_client(client_id):
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM clients WHERE client_id = ?", (client_id,)
        ).fetchone()
    if not row:
        return None
    return {
        "client_id": row["client_id"],
        "client_name": row["client_name"],
        "redirect_uris": json.loads(row["redirect_uris"]),
    }


# --- Authorization codes --------------------------------------------------- #

def create_auth_code(client_id, redirect_uri, code_challenge, user_email,
                     scope="mcp", resource=""):
    code = secrets.token_urlsafe(32)
    with _conn() as c:
        # Opschonen: verlopen of al gebruikte codes hebben geen waarde meer.
        c.execute("DELETE FROM auth_codes WHERE used = 1 OR expires_at < ?", (_now(),))
        c.execute(
            "INSERT INTO auth_codes (code_hash, client_id, redirect_uri, "
            "code_challenge, scope, user_email, expires_at, resource) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (
                _hash(code),
                client_id,
                redirect_uri,
                code_challenge,
                scope,
                user_email or "",
                _now() + AUTH_CODE_TTL,
                resource or "",
            ),
        )
    return code


def consume_auth_code(code, client_id, redirect_uri):
    """Eenmalig verbruiken; bindt aan client_id + redirect_uri."""
    h = _hash(code)
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM auth_codes WHERE code_hash = ?", (h,)
        ).fetchone()
        if not row or row["used"] or row["expires_at"] < _now():
            return None
        if row["client_id"] != client_id or row["redirect_uri"] != redirect_uri:
            return None
        # Race-veilig: alleen de request die used 0→1 flipt wint de code.
        cur = c.execute(
            "UPDATE auth_codes SET used = 1 WHERE code_hash = ? AND used = 0", (h,)
        )
        if cur.rowcount != 1:
            return None
    return dict(row)


def verify_pkce(code_challenge, code_verifier):
    if not code_verifier:
        return False
    digest = hashlib.sha256(code_verifier.encode()).digest()
    expected = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return secrets.compare_digest(expected, code_challenge or "")


# --- Tokens ---------------------------------------------------------------- #

def _issue(client_id, user_email, scope, resource=""):
    access = secrets.token_urlsafe(32)
    refresh = secrets.token_urlsafe(32)
    now = _now()
    with _conn() as c:
        # Opschonen: rijen waarvan zowel access- als refresh-token verlopen zijn.
        c.execute(
            "DELETE FROM tokens WHERE expires_at < ? "
            "AND (refresh_expires_at IS NULL OR refresh_expires_at < ?)",
            (now, now),
        )
        c.execute(
            "INSERT INTO tokens (token_hash, client_id, scope, user_email, "
            "expires_at, refresh_hash, refresh_expires_at, resource) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (
                _hash(access),
                client_id,
                scope,
                user_email or "",
                now + ACCESS_TOKEN_TTL,
                _hash(refresh),
                now + REFRESH_TOKEN_TTL,
                resource or "",
            ),
        )
    return {
        "access_token": access,
        "token_type": "Bearer",
        "expires_in": ACCESS_TOKEN_TTL,
        "refresh_token": refresh,
        "scope": scope,
    }


def issue_tokens(client_id, user_email, scope="mcp", resource=""):
    return _issue(client_id, user_email, scope, resource)


def refresh_tokens(refresh_token, client_id):
    h = _hash(refresh_token)
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM tokens WHERE refresh_hash = ?", (h,)
        ).fetchone()
        if not row or row["client_id"] != client_id:
            return None
        if not row["refresh_expires_at"] or row["refresh_expires_at"] < _now():
            return None
        # Rotatie: oude record verwijderen.
        c.execute("DELETE FROM tokens WHERE refresh_hash = ?", (h,))
        email, scope, resource = row["user_email"], row["scope"], row["resource"]
    return _issue(client_id, email, scope, resource or "")


def validate_access_token(token):
    if not token:
        return None
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM tokens WHERE token_hash = ?", (_hash(token),)
        ).fetchone()
    if not row or row["expires_at"] < _now():
        return None
    return {
        "client_id": row["client_id"],
        "user_email": row["user_email"],
        "scope": row["scope"],
        "resource": row["resource"] or "",
    }


# --- Discovery documents --------------------------------------------------- #

def authorization_server_metadata():
    base = PUBLIC_BASE_URL
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/mcp/oauth/authorize",
        "token_endpoint": f"{base}/mcp/oauth/token",
        "registration_endpoint": f"{base}/mcp/oauth/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": ["mcp"],
        # RFC 9207: we geven het issuer-`iss` mee in de authorize-response.
        "authorization_response_iss_parameter_supported": True,
    }


def protected_resource_metadata():
    base = PUBLIC_BASE_URL
    return {
        "resource": f"{base}/mcp",
        "authorization_servers": [base],
        "scopes_supported": ["mcp"],
        "bearer_methods_supported": ["header"],
        "resource_name": "Maven Calculatie",
    }
