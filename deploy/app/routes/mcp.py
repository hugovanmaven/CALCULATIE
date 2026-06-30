"""MCP-server (read-only) voor de Maven calculatie-app.

Biedt de bestaande calculatie-API aan als MCP-tools, zodat Claude (Desktop,
Code of claude.ai-connector) in elke chat over titels en marges kan praten.

Transport: stateless Streamable-HTTP MCP — JSON-RPC 2.0 over één POST op
`/mcp`. Geen async/ASGI, geen MCP-SDK: kale Flask die de bestaande endpoints
in-process aanroept via `current_app.test_client()`. Daardoor zijn de
uitkomsten per definitie gelijk aan de webapp, zonder code te dupliceren.

Auth: gedeelde bearer-token in env-var `MCP_TOKEN` (fail-closed: zonder token
geconfigureerd is het endpoint dicht). OAuth is een latere upgrade.

Scope: alleen lezen + what-if. Geen enkele tool muteert de database.
"""

import hmac
import json
import os

from flask import Blueprint, current_app, jsonify, request

from .. import mcp_oauth

bp = Blueprint("mcp", __name__)

# Onderliggende web-API hangt onder dit prefix (zie routes/__init__.py).
API_PREFIX = "/calculatie"

# Protocolversie die we teruggeven als de client er geen meestuurt.
DEFAULT_PROTOCOL_VERSION = "2025-06-18"
SERVER_INFO = {"name": "maven-calculatie", "version": "1.0.0"}


# ──────────────────────────────────────────────────────────────────
#  Opmaak-helpers (Nederlands)
# ──────────────────────────────────────────────────────────────────

def _pct(x) -> str:
    if x is None:
        return "n.v.t."
    return f"{x * 100:.1f}%".replace(".", ",")


def _eur(x) -> str:
    if x is None:
        return "n.v.t."
    return f"€{x:,.2f}".replace(",", "~").replace(".", ",").replace("~", ".")


# ──────────────────────────────────────────────────────────────────
#  Interne API-aanroepen (hergebruik bestaande endpoints)
# ──────────────────────────────────────────────────────────────────

def _api_get(path: str):
    resp = current_app.test_client().get(API_PREFIX + path)
    return resp.status_code, resp.get_json(silent=True)


def _api_post(path: str, payload: dict):
    resp = current_app.test_client().post(API_PREFIX + path, json=payload)
    return resp.status_code, resp.get_json(silent=True)


def _resolve_titel_id(args: dict):
    """Vind een titel-id op basis van `titel_id` of (deel van) `naam`."""
    if args.get("titel_id"):
        return args["titel_id"]
    naam = (args.get("naam") or "").strip().lower()
    if not naam:
        return None
    _, items = _api_get("/api/titels?archived=true")
    items = items or []
    # Eerst exacte match, dan 'bevat'.
    for it in items:
        if (it.get("titel") or "").strip().lower() == naam:
            return it["id"]
    for it in items:
        if naam in (it.get("titel") or "").strip().lower():
            return it["id"]
    return None


def _calc_request_from_args(args: dict):
    """Bouw een {titel_input, verdeling_*}-payload voor calculate/simulate.

    Bron: een meegegeven `titel_input` (what-if), óf een opgeslagen titel
    via `titel_id`/`naam`. Retourneert (payload, foutmelding-of-None).
    """
    verdelingen = {
        "verdeling_webshop": args.get("verdeling_webshop", 0.10),
        "verdeling_retail": args.get("verdeling_retail", 0.85),
        "verdeling_b2b": args.get("verdeling_b2b", 0.05),
    }
    if args.get("titel_input") is not None:
        return {"titel_input": args["titel_input"], **verdelingen}, None

    tid = _resolve_titel_id(args)
    if not tid:
        return None, "Geen titel gevonden — geef een geldige `titel_id`, `naam` of een `titel_input`-object."
    status, data = _api_get(f"/api/titels/{tid}")
    if status != 200 or not data:
        return None, f"Titel '{tid}' niet gevonden."
    payload = {
        "titel_input": data.get("titel_input", {}),
        "verdeling_webshop": data.get("verdeling_webshop", verdelingen["verdeling_webshop"]),
        "verdeling_retail": data.get("verdeling_retail", verdelingen["verdeling_retail"]),
        "verdeling_b2b": data.get("verdeling_b2b", verdelingen["verdeling_b2b"]),
    }
    return payload, None


# ──────────────────────────────────────────────────────────────────
#  Tool-handlers (geven mensleesbare tekst terug)
# ──────────────────────────────────────────────────────────────────

def _tool_lijst_titels(args: dict) -> str:
    archived = "true" if args.get("inclusief_gearchiveerd") else "false"
    status, items = _api_get(f"/api/titels?archived={archived}")
    if status != 200:
        return f"Kon de titellijst niet ophalen (status {status})."
    items = items or []
    if not items:
        return "Er staan nog geen titels in de calculatie-app."
    regels = [f"{len(items)} titel(s):"]
    for it in items:
        auteur = f" ({it['auteur']})" if it.get("auteur") else ""
        regels.append(
            f"- {it.get('titel', '?')}{auteur} — gewogen marge {_pct(it.get('gewogen_marge_pct'))}"
            f" — {it.get('drukken_count', 0)} druk(ken)"
            f"{' — GEARCHIVEERD' if it.get('archived') else ''} [id: {it['id']}]"
        )
    return "\n".join(regels)


def _format_calc(titel_label: str, calc: dict) -> str:
    totaal_oplage = f"{calc.get('totaal_oplage', 0):,}".replace(",", ".")
    regels = [
        f"**{titel_label}**",
        f"Gewogen marge (alle drukken): {_pct(calc.get('gewogen_marge_pct_totaal'))}"
        f" — totale oplage {totaal_oplage}",
        "",
    ]
    for d in calc.get("drukken", []):
        oplage = f"{d.get('oplage', 0):,}".replace(",", ".")
        regels.append(
            f"• {d.get('druk_type', 'druk')} (oplage {oplage})"
            f" — gewogen marge {_pct(d.get('gewogen_marge_pct'))}"
        )
        for kanaal in ("webshop", "retail", "b2b"):
            k = d.get(kanaal, {})
            regels.append(
                f"    {kanaal}: marge {_pct(k.get('marge_pct'))},"
                f" netto winst/ex {_eur(k.get('netto_winst_maven'))}"
            )
    return "\n".join(regels)


def _tool_titel_detail(args: dict) -> str:
    payload, err = _calc_request_from_args(args)
    if err:
        return err
    status, calc = _api_post("/api/calculate", payload)
    if status != 200 or not calc:
        return f"Kon de calculatie niet uitvoeren (status {status})."
    ti = payload["titel_input"]
    label = ti.get("titel", "Titel")
    tekst = _format_calc(label, calc)
    # Ruwe titel_input eronder, zodat een what-if eenvoudig te maken is door
    # velden aan te passen en `bereken` aan te roepen.
    tekst += "\n\nRuwe titel_input (voor what-if via `bereken`):\n```json\n"
    tekst += json.dumps(ti, ensure_ascii=False, indent=2) + "\n```"
    return tekst


def _tool_bereken(args: dict) -> str:
    if args.get("titel_input") is None:
        return "`bereken` vereist een `titel_input`-object. Haal er eerst een op via `titel_detail`, pas velden aan en geef het hier mee."
    payload, err = _calc_request_from_args(args)
    if err:
        return err
    status, calc = _api_post("/api/calculate", payload)
    if status != 200 or not calc:
        return f"Kon de what-if niet doorrekenen (status {status})."
    return _format_calc(args["titel_input"].get("titel", "What-if"), calc)


def _tool_simuleer_oplage(args: dict) -> str:
    payload, err = _calc_request_from_args(args)
    if err:
        return err
    status, sim = _api_post("/api/simulate/oplage", payload)
    if status != 200 or not sim:
        return f"Kon de oplage-simulatie niet uitvoeren (status {status})."
    regels = [
        f"Break-even oplage: {sim.get('break_even_oplage') or 'n.v.t.'}",
        f"Voorschot ingelopen bij: {sim.get('voorschot_earn_out_oplage') or 'n.v.t.'}",
        "",
        "Scenario's:",
    ]
    for r in sim.get("rows", []):
        markers = []
        if r.get("is_break_even"):
            markers.append("break-even")
        if r.get("is_voorschot_earn_out"):
            markers.append("voorschot ingelopen")
        suffix = f" ({', '.join(markers)})" if markers else ""
        vol = r.get("oplage", r.get("volume", "?"))
        regels.append(
            f"- oplage {vol}: netto resultaat {_eur(r.get('netto_resultaat'))}{suffix}"
        )
    return "\n".join(regels)


def _tool_gevoeligheid(variable: str, path: str, args: dict) -> str:
    payload, err = _calc_request_from_args(args)
    if err:
        return err
    if args.get(f"{variable}_range") is not None:
        payload[f"{variable}_range" if variable == "cac" else "price_range"] = args[f"{variable}_range"]
    status, results = _api_post(path, payload)
    if status != 200 or results is None:
        return f"Kon de gevoeligheidsanalyse niet uitvoeren (status {status})."
    if not results:
        return "Geen resultaten — controleer of de titel drukken bevat."
    regels = []
    for entry in results:
        regels.append(f"Druk: {entry.get('druk_type', '?')} (variabele: {entry.get('variable_name')})")
        for row in entry.get("rows", []):
            regels.append(
                f"- {row.get('variable_value')}: gewogen marge {_pct(row.get('gewogen_marge_pct'))},"
                f" gewogen winst/ex {_eur(row.get('gewogen_winst'))}"
            )
        regels.append("")
    return "\n".join(regels).strip()


# ──────────────────────────────────────────────────────────────────
#  Tool-register (naam → schema + handler)
# ──────────────────────────────────────────────────────────────────

_TITEL_SELECTOR = {
    "titel_id": {"type": "string", "description": "Id van een opgeslagen titel."},
    "naam": {"type": "string", "description": "Titelnaam (of deel ervan); wordt opgezocht als geen titel_id is gegeven."},
    "verdeling_webshop": {"type": "number", "description": "Kanaalverdeling webshop (default 0.10)."},
    "verdeling_retail": {"type": "number", "description": "Kanaalverdeling retail (default 0.85)."},
    "verdeling_b2b": {"type": "number", "description": "Kanaalverdeling B2B (default 0.05)."},
}

TOOLS = [
    {
        "name": "lijst_titels",
        "description": "Geef alle titels in de calculatie-app met hun gewogen marge en id.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "inclusief_gearchiveerd": {"type": "boolean", "description": "Ook gearchiveerde titels tonen."},
            },
        },
        "handler": _tool_lijst_titels,
    },
    {
        "name": "titel_detail",
        "description": "Volledige calculatie van één opgeslagen titel: marge per kanaal (webshop/retail/b2b), gewogen marge per druk en totaal, plus de ruwe titel_input voor what-ifs. Identificeer met titel_id of naam.",
        "inputSchema": {
            "type": "object",
            "properties": {k: v for k, v in _TITEL_SELECTOR.items()},
        },
        "handler": _tool_titel_detail,
    },
    {
        "name": "bereken",
        "description": "Reken een what-if door op een volledig titel_input-object (bijv. uit titel_detail, met aangepaste velden zoals oplage, verkoopprijs of drukkosten). Slaat niets op.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "titel_input": {"type": "object", "description": "Volledig titel_input-object om door te rekenen."},
                "verdeling_webshop": _TITEL_SELECTOR["verdeling_webshop"],
                "verdeling_retail": _TITEL_SELECTOR["verdeling_retail"],
                "verdeling_b2b": _TITEL_SELECTOR["verdeling_b2b"],
            },
            "required": ["titel_input"],
        },
        "handler": _tool_bereken,
    },
    {
        "name": "simuleer_oplage",
        "description": "Simuleer het netto resultaat bij verschillende verkoopaantallen, met break-even en voorschot-earn-out. Identificeer met titel_id, naam of een titel_input.",
        "inputSchema": {
            "type": "object",
            "properties": {**_TITEL_SELECTOR, "titel_input": {"type": "object", "description": "Optioneel: what-if titel_input i.p.v. opgeslagen titel."}},
        },
        "handler": _tool_simuleer_oplage,
    },
    {
        "name": "gevoeligheid_cac",
        "description": "Toon hoe de marge meebeweegt met de CAC (klantacquisitiekosten per exemplaar). Identificeer met titel_id, naam of titel_input.",
        "inputSchema": {
            "type": "object",
            "properties": {
                **_TITEL_SELECTOR,
                "titel_input": {"type": "object", "description": "Optioneel: what-if titel_input."},
                "cac_range": {"type": "array", "items": {"type": "number"}, "description": "Optionele lijst CAC-waarden om door te rekenen."},
            },
        },
        "handler": lambda args: _tool_gevoeligheid("cac", "/api/sensitivity/cac", args),
    },
    {
        "name": "gevoeligheid_prijs",
        "description": "Toon hoe de marge meebeweegt met de verkoopprijs (incl. btw). Identificeer met titel_id, naam of titel_input.",
        "inputSchema": {
            "type": "object",
            "properties": {
                **_TITEL_SELECTOR,
                "titel_input": {"type": "object", "description": "Optioneel: what-if titel_input."},
                "price_range": {"type": "array", "items": {"type": "number"}, "description": "Optionele lijst verkoopprijzen (incl. btw)."},
            },
        },
        "handler": lambda args: _tool_gevoeligheid("price", "/api/sensitivity/price", args),
    },
]

_TOOLS_BY_NAME = {t["name"]: t for t in TOOLS}


def _public_tools() -> list[dict]:
    """tools/list-vorm: zonder de interne handler."""
    return [{k: v for k, v in t.items() if k != "handler"} for t in TOOLS]


# ──────────────────────────────────────────────────────────────────
#  JSON-RPC / MCP-transport
# ──────────────────────────────────────────────────────────────────

def _result(req_id, result):
    return jsonify({"jsonrpc": "2.0", "id": req_id, "result": result})


def _error(req_id, code, message):
    return jsonify({"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}})


def _bearer() -> str:
    """Token uit de Authorization-header, X-API-Key, of de URL-query
    (?token= / ?key=). De query-variant maakt het mogelijk een claude.ai
    custom connector zónder header-veld te koppelen."""
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:]
    api_key = request.headers.get("X-API-Key", "")
    if api_key:
        return api_key
    return request.args.get("token") or request.args.get("key") or ""


def _authorized() -> bool:
    """Geldig met een OAuth-accesstoken óf (optioneel) de statische token."""
    token = _bearer()
    if not token:
        return False
    if mcp_oauth.validate_access_token(token):
        return True
    static = os.environ.get("MCP_TOKEN", "")
    return bool(static) and hmac.compare_digest(token, static)


def _handle_rpc(msg: dict):
    """Verwerk één JSON-RPC-bericht. Retourneert een Flask-response of None
    (None = notification zonder antwoord)."""
    method = msg.get("method")
    req_id = msg.get("id")
    params = msg.get("params") or {}

    if method == "initialize":
        return _result(req_id, {
            "protocolVersion": params.get("protocolVersion", DEFAULT_PROTOCOL_VERSION),
            "capabilities": {"tools": {}},
            "serverInfo": SERVER_INFO,
        })

    if method == "notifications/initialized" or (method or "").startswith("notifications/"):
        return None  # notification: geen antwoord

    if method == "ping":
        return _result(req_id, {})

    if method == "tools/list":
        return _result(req_id, {"tools": _public_tools()})

    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        tool = _TOOLS_BY_NAME.get(name)
        if tool is None:
            return _result(req_id, {
                "content": [{"type": "text", "text": f"Onbekende tool: {name}"}],
                "isError": True,
            })
        try:
            text = tool["handler"](args)
            return _result(req_id, {"content": [{"type": "text", "text": text}]})
        except Exception as exc:  # tool-fout hoort in result, niet als JSON-RPC-error
            return _result(req_id, {
                "content": [{"type": "text", "text": f"Fout bij uitvoeren van {name}: {exc}"}],
                "isError": True,
            })

    return _error(req_id, -32601, f"Onbekende methode: {method}")


@bp.route("/mcp", methods=["POST"])
def mcp_endpoint():
    if not _authorized():
        # WWW-Authenticate met resource_metadata → claude.ai start de OAuth-flow.
        meta = f"{mcp_oauth.PUBLIC_BASE_URL}/.well-known/oauth-protected-resource"
        resp = jsonify({"error": "Unauthorized"})
        resp.headers["WWW-Authenticate"] = f'Bearer resource_metadata="{meta}"'
        return resp, 401

    msg = request.get_json(silent=True)
    if not isinstance(msg, dict):
        # JSON-RPC-batches (lijst) worden in MCP 2025-06-18 niet meer ondersteund.
        return _error(None, -32600, "Verwacht één JSON-RPC-object.")

    response = _handle_rpc(msg)
    if response is None:
        return "", 202  # notification
    return response


@bp.route("/mcp", methods=["GET", "DELETE"])
def mcp_no_stream():
    # We pushen geen server-side events en houden geen sessies bij.
    return jsonify({"error": "Alleen POST wordt ondersteund."}), 405
