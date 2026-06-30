"""OAuth 2.1 endpoints voor de MCP-connector (Claude.ai custom connector).

Geport van Sanders maven-sales MCP en aangepast naar de calculatie-paden.
Implementeert de MCP authorization spec zodat de connector vanaf elke
Claude-app (web, desktop, iPhone) kan koppelen:

  - GET  /.well-known/oauth-protected-resource     (RFC 9728)
  - GET  /.well-known/oauth-authorization-server   (RFC 8414)
  - POST /mcp/oauth/register                        (RFC 7591 DCR)
  - GET  /mcp/oauth/authorize                       (PKCE, browser)
  - POST /mcp/oauth/token                           (code + refresh)

Het authorize-endpoint is browser-facing en MOET achter Cloudflare Access
blijven (de e-mail-OTP bewijst de identiteit). De overige endpoints zijn
machine-to-machine en moeten in Cloudflare gebypassed worden; ze zijn
beveiligd via PKCE + gehashte tokens.
"""

import os

from flask import Blueprint, request, jsonify, redirect, Response
from urllib.parse import urlencode

from .. import mcp_oauth

bp = Blueprint("mcp_oauth", __name__)

_ALLOWED_DOMAINS = [
    d.strip().lower()
    for d in os.environ.get("MCP_OAUTH_ALLOWED_EMAIL_DOMAINS", "").split(",")
    if d.strip()
]


def _no_store(resp):
    resp.headers["Cache-Control"] = "no-store"
    return resp


# --- Discovery ------------------------------------------------------------- #

@bp.route("/.well-known/oauth-authorization-server", methods=["GET"])
@bp.route("/.well-known/oauth-authorization-server/<path:_rest>", methods=["GET"])
def as_metadata(_rest=None):
    return _no_store(jsonify(mcp_oauth.authorization_server_metadata()))


@bp.route("/.well-known/oauth-protected-resource", methods=["GET"])
@bp.route("/.well-known/oauth-protected-resource/<path:_rest>", methods=["GET"])
def pr_metadata(_rest=None):
    return _no_store(jsonify(mcp_oauth.protected_resource_metadata()))


# --- Dynamic Client Registration ------------------------------------------- #

@bp.route("/mcp/oauth/register", methods=["POST"])
def register():
    metadata = request.get_json(silent=True) or {}
    client = mcp_oauth.register_client(metadata)
    if not client:
        return jsonify({"error": "invalid_client_metadata"}), 400
    return _no_store(jsonify(client)), 201


# --- Authorization (browser, achter Cloudflare Access) --------------------- #

@bp.route("/mcp/oauth/authorize", methods=["GET"])
def authorize():
    p = request.args
    client_id = p.get("client_id", "")
    redirect_uri = p.get("redirect_uri", "")
    state = p.get("state", "")
    code_challenge = p.get("code_challenge", "")
    method = p.get("code_challenge_method", "")
    scope = p.get("scope", "mcp")
    resource = p.get("resource", "")

    client = mcp_oauth.get_client(client_id)
    # Fouten in client/redirect_uri NIET terugsturen naar een onbetrouwbare
    # redirect — toon ze direct.
    if not client:
        return Response("invalid client_id", status=400)
    if redirect_uri not in client["redirect_uris"]:
        return Response("invalid redirect_uri", status=400)

    def _back(params):
        # RFC 9207: issuer-identificatie in elke authorization response
        # (mix-up-bescherming; strenge clients zoals Claude verwachten dit).
        params = dict(params, iss=mcp_oauth.PUBLIC_BASE_URL)
        sep = "&" if "?" in redirect_uri else "?"
        return redirect(redirect_uri + sep + urlencode(params), code=302)

    if p.get("response_type") != "code":
        return _back({"error": "unsupported_response_type", "state": state})
    if method != "S256" or not code_challenge:
        return _back({"error": "invalid_request", "state": state})

    # Identiteit komt van Cloudflare Access (endpoint blijft achter Access).
    user_email = request.headers.get("Cf-Access-Authenticated-User-Email", "")
    if _ALLOWED_DOMAINS:
        dom = user_email.split("@")[-1].lower() if "@" in user_email else ""
        if dom not in _ALLOWED_DOMAINS:
            return Response("forbidden: e-mail niet toegestaan", status=403)

    code = mcp_oauth.create_auth_code(
        client_id, redirect_uri, code_challenge, user_email, scope, resource
    )
    return _back({"code": code, "state": state})


# --- Token ----------------------------------------------------------------- #

@bp.route("/mcp/oauth/token", methods=["POST"])
def token():
    f = request.form
    grant = f.get("grant_type", "")
    client_id = f.get("client_id", "")

    if grant == "authorization_code":
        code = f.get("code", "")
        redirect_uri = f.get("redirect_uri", "")
        verifier = f.get("code_verifier", "")
        rec = mcp_oauth.consume_auth_code(code, client_id, redirect_uri)
        if not rec:
            return jsonify({"error": "invalid_grant"}), 400
        if not mcp_oauth.verify_pkce(rec["code_challenge"], verifier):
            return jsonify({"error": "invalid_grant"}), 400
        out = mcp_oauth.issue_tokens(
            client_id, rec["user_email"], rec["scope"], rec.get("resource", "")
        )
        return _no_store(jsonify(out))

    if grant == "refresh_token":
        out = mcp_oauth.refresh_tokens(f.get("refresh_token", ""), client_id)
        if not out:
            return jsonify({"error": "invalid_grant"}), 400
        return _no_store(jsonify(out))

    return jsonify({"error": "unsupported_grant_type"}), 400
