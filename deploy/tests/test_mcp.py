"""Tests voor de MCP-server op /mcp (transport, auth, OAuth).

Verifieert het JSON-RPC/MCP-transport, de dubbele auth (statische token +
OAuth) en de OAuth 2.1-flow — niet de rekenlogica (die zit in
test_calculatie.py).
"""

import base64
import hashlib
import os
import secrets
import sys
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

TOKEN = "test-mcp-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
REDIRECT = "https://claude.ai/api/mcp/auth_callback"


@pytest.fixture()
def client(tmp_path):
    # Geïsoleerde sqlite-DB + token vóór create_app (factory leest env in).
    os.environ["MCP_TOKEN"] = TOKEN
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_path}/test.sqlite"
    from app import create_app
    import app.mcp_oauth as oauth
    # OAuth-store isoleren naar de test-tmp (anders schrijft hij in deploy/data).
    oauth._DATA_DIR = str(tmp_path)
    oauth.OAUTH_DB_PATH = str(tmp_path / "mcp_oauth.db")
    app = create_app()
    with app.test_client() as c:
        yield c
    os.environ.pop("DATABASE_URL", None)


def rpc(client, method, params=None, req_id=1, auth=True):
    body = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params is not None:
        body["params"] = params
    return client.post("/mcp", json=body, headers=AUTH if auth else {})


# ── Transport + statische-token auth ──────────────────────────────────────

def test_initialize(client):
    r = rpc(client, "initialize", {"protocolVersion": "2025-06-18"})
    assert r.status_code == 200
    res = r.get_json()["result"]
    assert res["serverInfo"]["name"] == "maven-calculatie"
    assert "tools" in res["capabilities"]


def test_tools_list(client):
    tools = rpc(client, "tools/list").get_json()["result"]["tools"]
    names = {t["name"] for t in tools}
    assert names == {
        "lijst_titels", "titel_detail", "bereken",
        "simuleer_oplage", "gevoeligheid_cac", "gevoeligheid_prijs",
    }
    assert all("handler" not in t for t in tools)


def test_tools_call_lijst_titels(client):
    result = rpc(client, "tools/call", {"name": "lijst_titels", "arguments": {}}).get_json()["result"]
    assert not result.get("isError")
    assert result["content"][0]["type"] == "text"


def test_unknown_tool_is_error(client):
    result = rpc(client, "tools/call", {"name": "bestaat_niet", "arguments": {}}).get_json()["result"]
    assert result["isError"] is True


def test_notification_returns_202(client):
    r = client.post("/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"}, headers=AUTH)
    assert r.status_code == 202


def test_missing_token_is_401_with_resource_metadata(client):
    r = rpc(client, "tools/list", auth=False)
    assert r.status_code == 401
    assert "resource_metadata" in r.headers.get("WWW-Authenticate", "")


def test_query_token_auth(client):
    # claude.ai zonder header-veld: token in de URL.
    r = client.post(f"/mcp?token={TOKEN}", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    assert r.status_code == 200
    assert "result" in r.get_json()


def test_get_not_allowed(client):
    assert client.get("/mcp", headers=AUTH).status_code == 405


# ── OAuth 2.1 ─────────────────────────────────────────────────────────────

def test_discovery_documents(client):
    asm = client.get("/.well-known/oauth-authorization-server").get_json()
    assert asm["issuer"]
    assert asm["registration_endpoint"].endswith("/mcp/oauth/register")
    assert "S256" in asm["code_challenge_methods_supported"]
    prm = client.get("/.well-known/oauth-protected-resource").get_json()
    assert prm["resource"].endswith("/mcp")


def test_dynamic_client_registration(client):
    r = client.post("/mcp/oauth/register", json={"client_name": "verify", "redirect_uris": [REDIRECT]})
    assert r.status_code == 201
    assert r.get_json()["client_id"].startswith("mcp-")


def test_oauth_end_to_end(client):
    # 1. Dynamic client registration
    cid = client.post(
        "/mcp/oauth/register", json={"client_name": "t", "redirect_uris": [REDIRECT]}
    ).get_json()["client_id"]

    # 2. PKCE-paar
    verifier = secrets.token_urlsafe(32)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()

    # 3. Authorize (simuleer een Cloudflare-geverifieerde browser)
    r = client.get("/mcp/oauth/authorize", query_string={
        "response_type": "code", "client_id": cid, "redirect_uri": REDIRECT,
        "code_challenge": challenge, "code_challenge_method": "S256",
        "state": "xyz", "scope": "mcp",
    }, headers={"Cf-Access-Authenticated-User-Email": "hugo@mavenpublishing.nl"})
    assert r.status_code == 302
    code = parse_qs(urlparse(r.headers["Location"]).query)["code"][0]

    # 4. Token-exchange
    tok = client.post("/mcp/oauth/token", data={
        "grant_type": "authorization_code", "code": code, "client_id": cid,
        "redirect_uri": REDIRECT, "code_verifier": verifier,
    })
    assert tok.status_code == 200
    access = tok.get_json()["access_token"]

    # 5. Het OAuth-token werkt op /mcp
    r = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
                    headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200
    assert "result" in r.get_json()


def test_pkce_mismatch_rejected(client):
    cid = client.post(
        "/mcp/oauth/register", json={"client_name": "t", "redirect_uris": [REDIRECT]}
    ).get_json()["client_id"]
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(b"correct-verifier").digest()
    ).rstrip(b"=").decode()
    r = client.get("/mcp/oauth/authorize", query_string={
        "response_type": "code", "client_id": cid, "redirect_uri": REDIRECT,
        "code_challenge": challenge, "code_challenge_method": "S256", "scope": "mcp",
    }, headers={"Cf-Access-Authenticated-User-Email": "hugo@mavenpublishing.nl"})
    code = parse_qs(urlparse(r.headers["Location"]).query)["code"][0]
    # Verkeerde verifier → invalid_grant
    tok = client.post("/mcp/oauth/token", data={
        "grant_type": "authorization_code", "code": code, "client_id": cid,
        "redirect_uri": REDIRECT, "code_verifier": "wrong-verifier",
    })
    assert tok.status_code == 400
    assert tok.get_json()["error"] == "invalid_grant"
