"""Tests voor de MCP-server (read-only) op /mcp.

Verifieert het JSON-RPC/MCP-transport en de auth — niet de rekenlogica zelf
(die zit in test_calculatie.py).
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

TOKEN = "test-mcp-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture()
def client(tmp_path):
    # Geïsoleerde sqlite-DB + token vóór create_app (factory leest env in).
    os.environ["MCP_TOKEN"] = TOKEN
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_path}/test.sqlite"
    from app import create_app
    app = create_app()
    with app.test_client() as c:
        yield c
    os.environ.pop("DATABASE_URL", None)


def rpc(client, method, params=None, req_id=1, auth=True):
    body = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params is not None:
        body["params"] = params
    return client.post("/mcp", json=body, headers=AUTH if auth else {})


def test_initialize(client):
    r = rpc(client, "initialize", {"protocolVersion": "2025-06-18"})
    assert r.status_code == 200
    res = r.get_json()["result"]
    assert res["serverInfo"]["name"] == "maven-calculatie"
    assert "tools" in res["capabilities"]


def test_tools_list(client):
    r = rpc(client, "tools/list")
    tools = r.get_json()["result"]["tools"]
    names = {t["name"] for t in tools}
    assert names == {
        "lijst_titels", "titel_detail", "bereken",
        "simuleer_oplage", "gevoeligheid_cac", "gevoeligheid_prijs",
    }
    # Geen interne handler lekken naar de client.
    assert all("handler" not in t for t in tools)


def test_tools_call_lijst_titels(client):
    r = rpc(client, "tools/call", {"name": "lijst_titels", "arguments": {}})
    assert r.status_code == 200
    result = r.get_json()["result"]
    assert not result.get("isError")
    assert result["content"][0]["type"] == "text"


def test_unknown_tool_is_error(client):
    r = rpc(client, "tools/call", {"name": "bestaat_niet", "arguments": {}})
    result = r.get_json()["result"]
    assert result["isError"] is True


def test_notification_returns_202(client):
    r = client.post("/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"}, headers=AUTH)
    assert r.status_code == 202


def test_missing_token_is_401(client):
    r = rpc(client, "tools/list", auth=False)
    assert r.status_code == 401


def test_get_not_allowed(client):
    assert client.get("/mcp", headers=AUTH).status_code == 405
