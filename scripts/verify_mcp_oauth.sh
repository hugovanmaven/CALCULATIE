#!/usr/bin/env bash
# Verifieert de live MCP/OAuth-deploy van de calculatie-app (read-only,
# muteert niets). Draai NA de Railway-deploy + Cloudflare-config.
#
# Checkt de machine-verifieerbare stappen:
#   1. Discovery-documenten (RFC 8414 / 9728) bereikbaar zonder login
#   2. /mcp zonder token -> 401 met WWW-Authenticate resource_metadata
#   3. Dynamic Client Registration (RFC 7591)
#   4. (optioneel) tools/call met een handmatig verkregen access token
#
# De authorize-stap vereist een browser + Cloudflare-login en kan niet
# geautomatiseerd worden; die test je één keer met de echte Claude-client.
#
# Gebruik:
#   scripts/verify_mcp_oauth.sh
#   BASE=https://calculatie.maven-company.com scripts/verify_mcp_oauth.sh
#   ACCESS_TOKEN=xxxxx scripts/verify_mcp_oauth.sh   # ook de tools/call test
set -euo pipefail
BASE="${BASE:-https://calculatie.maven-company.com}"
pass(){ echo "  PASS: $1"; }
fail(){ echo "  FAIL: $1" >&2; exit 1; }

echo "== 1. Discovery =="
asm=$(curl -fsS "$BASE/.well-known/oauth-authorization-server")
echo "$asm" | jq -e '.issuer and .authorization_endpoint and .token_endpoint and .registration_endpoint' >/dev/null \
  && pass "oauth-authorization-server metadata" || fail "AS metadata onvolledig/onbereikbaar"
echo "$asm" | jq -e '.code_challenge_methods_supported|index("S256")' >/dev/null \
  && pass "PKCE S256 geadverteerd" || fail "S256 ontbreekt"
curl -fsS "$BASE/.well-known/oauth-protected-resource" \
  | jq -e --arg b "$BASE" '.resource==($b+"/mcp") and (.authorization_servers|index($b))' >/dev/null \
  && pass "protected-resource metadata" || fail "PR metadata onjuist"

echo "== 2. /mcp zonder token -> 401 + WWW-Authenticate =="
hdrs=$(curl -s -D - -o /dev/null -X POST "$BASE/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}')
echo "$hdrs" | grep -qi '^HTTP/.* 401' && pass "401 zonder token" || fail "verwachtte 401 (krijgt Cloudflare-login? -> /mcp niet gebypassed)"
echo "$hdrs" | grep -qi 'WWW-Authenticate:.*resource_metadata' && pass "WWW-Authenticate aanwezig" || fail "WWW-Authenticate ontbreekt"

echo "== 3. Dynamic Client Registration =="
reg=$(curl -fsS -X POST "$BASE/mcp/oauth/register" \
  -H 'Content-Type: application/json' \
  -d '{"client_name":"verify-script","redirect_uris":["https://claude.ai/api/mcp/auth_callback"]}')
echo "$reg" | jq -e '.client_id|startswith("mcp-")' >/dev/null \
  && pass "client geregistreerd: $(echo "$reg" | jq -r .client_id)" || fail "DCR mislukt"

if [ -n "${ACCESS_TOKEN:-}" ]; then
  echo "== 4. tools/call met access token =="
  res=$(curl -fsS -X POST "$BASE/mcp" \
    -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"lijst_titels","arguments":{}}}')
  echo "$res" | jq -e '.result.content[0].text' >/dev/null \
    && pass "lijst_titels werkt met token" || fail "tools/call faalde"
else
  echo "== 4. (overgeslagen: geen ACCESS_TOKEN gezet) =="
fi

echo
echo "Klaar. Resterende handmatige test: connector toevoegen in Claude en"
echo "de Cloudflare-login doorlopen op het authorize-endpoint."
