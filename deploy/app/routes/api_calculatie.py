"""
Flask Blueprint: Calculatie API
Alle endpoints voor het Maven Calculatiemodel.
"""

import csv
import io
import json
from dataclasses import asdict
from flask import Blueprint, request, jsonify, Response, abort

from ..calculatie import (
    TitelInput, StaffelTrede, KostenPost, DrukConfig,
    bereken_titel,
    KanaalResultaat, DrukResultaat, CalculatieResultaat,
)
from .. import storage_calculatie as storage

bp = Blueprint("api_calculatie", __name__)


# ──────────────────────────────────────────────────────────────────
#  BRIDGE: dict → dataclass (vervangt Pydantic + bridge.py)
# ──────────────────────────────────────────────────────────────────

def _staffel_list(items: list[dict]) -> list[StaffelTrede]:
    return [StaffelTrede(s["tot_exemplaren"], s["percentage"]) for s in items]


def _kostenposten_list(items: list[dict]) -> list[KostenPost]:
    return [
        KostenPost(
            id=kp["id"], naam=kp["naam"],
            categorie=kp["categorie"],
            bedrag=kp.get("bedrag", 0.0),
        )
        for kp in items
    ]


def _drukken_list(items: list[dict]) -> list[DrukConfig]:
    result = []
    for i, d in enumerate(items):
        result.append(DrukConfig(
            druknummer=d.get("druknummer", i + 1),
            oplage=d.get("oplage", 2000),
            drukkosten_per_ex=d.get("drukkosten_per_ex", 1.20),
            kostenposten=_kostenposten_list(d.get("kostenposten", [])),
        ))
    return result


def dict_to_titel_input(d: dict) -> TitelInput:
    """Converteer JSON dict → TitelInput dataclass."""
    return TitelInput(
        titel=d.get("titel", "Nieuwe titel"),
        auteur=d.get("auteur", ""),
        isbn=d.get("isbn", ""),
        verschijningsdatum=d.get("verschijningsdatum", ""),
        verschenen=d.get("verschenen", False),
        verkoopprijs_incl_btw=d.get("verkoopprijs_incl_btw", 20.0),
        btw_percentage=d.get("btw_percentage", 0.09),
        boekhandelskorting=d.get("boekhandelskorting", 0.48),
        drukken=_drukken_list(d.get("drukken", [])),
        # Webshop
        transactiekosten_pct=d.get("transactiekosten_pct", 0.002),
        fulfillment_per_ex=d.get("fulfillment_per_ex", 4.50),
        cac_per_ex=d.get("cac_per_ex", 0.0),
        # Retail
        distributie_cb_per_ex=d.get("distributie_cb_per_ex", 1.10),
        # B2B
        b2b_porto_per_ex=d.get("b2b_porto_per_ex", 0.0),
        b2b_korting_pct=d.get("b2b_korting_pct", 0.0),
        # Auteur
        auteur_winstdeling_pct=d.get("auteur_winstdeling_pct", 0.0),
        auteur_royalty_staffel=_staffel_list(d.get("auteur_royalty_staffel", [])),
        auteur_voorschot=d.get("auteur_voorschot", 0.0),
        # Derden
        agent_staffel=_staffel_list(d.get("agent_staffel", [])),
        agent_pct=d.get("agent_pct", 0.0),
        agent_winstdeling_pct=d.get("agent_winstdeling_pct", 0.0),
        agent_voorschot=d.get("agent_voorschot", 0.0),
        vertaler_pct=d.get("vertaler_pct", 0.0),
        vertaler_staffel=_staffel_list(d.get("vertaler_staffel", [])),
        vertaler_winstdeling_pct=d.get("vertaler_winstdeling_pct", 0.0),
        vertaler_voorschot=d.get("vertaler_voorschot", 0.0),
        illustrator_pct=d.get("illustrator_pct", 0.0),
        illustrator_staffel=_staffel_list(d.get("illustrator_staffel", [])),
        illustrator_winstdeling_pct=d.get("illustrator_winstdeling_pct", 0.0),
        illustrator_voorschot=d.get("illustrator_voorschot", 0.0),
        # Partnership
        heeft_partner=d.get("heeft_partner", False),
        partner_naam=d.get("partner_naam", ""),
        partner_winstdeling_pct=d.get("partner_winstdeling_pct", 0.5),
        # Overig
        overige_kosten_pct=d.get("overige_kosten_pct", 0.0),
    )


def kanaal_to_dict(k: KanaalResultaat) -> dict:
    return asdict(k)


def druk_to_dict(d: DrukResultaat, verd_ws: float, verd_rt: float, verd_b2b: float) -> dict:
    """Converteer DrukResultaat → dict met gewogen marge."""
    ws = kanaal_to_dict(d.webshop)
    rt = kanaal_to_dict(d.retail)
    b2b = kanaal_to_dict(d.b2b)

    gewogen_winst = (
        ws["netto_winst_maven"] * verd_ws
        + rt["netto_winst_maven"] * verd_rt
        + b2b["netto_winst_maven"] * verd_b2b
    )
    gewogen_omzet = (
        ws["netto_omzet"] * verd_ws
        + rt["netto_omzet"] * verd_rt
        + b2b["netto_omzet"] * verd_b2b
    )
    gewogen_marge = gewogen_winst / gewogen_omzet if gewogen_omzet > 0 else 0

    return {
        "druk_type": d.druk_type,
        "oplage": d.oplage,
        "cumulatief_voor_druk": d.cumulatief_voor_druk,
        "kosten_totaal": d.kosten_totaal,
        "webshop": ws,
        "retail": rt,
        "b2b": b2b,
        "gewogen_netto_winst": gewogen_winst,
        "gewogen_netto_omzet": gewogen_omzet,
        "gewogen_marge_pct": gewogen_marge,
    }


def run_calculation(data: dict) -> dict:
    """Voer de volledige calculatie uit vanuit een JSON request dict."""
    ti = data["titel_input"]
    t = dict_to_titel_input(ti)
    verd_ws = data.get("verdeling_webshop", 0.10)
    verd_rt = data.get("verdeling_retail", 0.85)
    verd_b2b = data.get("verdeling_b2b", 0.05)

    res = bereken_titel(t)

    drukken_out = [
        {
            **druk_to_dict(d, verd_ws, verd_rt, verd_b2b),
            "kosten_totaal": d.kosten_totaal,
            "drukkosten_totaal": d.drukkosten_totaal,
        }
        for d in res.drukken
    ]

    # Gewogen marge over ALLE drukken: som euro-winst / som euro-omzet,
    # gewogen met oplage per druk.
    total_winst = sum(d["gewogen_netto_winst"] * d["oplage"] for d in drukken_out)
    total_omzet = sum(d["gewogen_netto_omzet"] * d["oplage"] for d in drukken_out)
    marge_totaal = total_winst / total_omzet if total_omzet > 0 else 0

    return {
        "titel": res.titel,
        "drukken": drukken_out,
        "gewogen_marge_pct_totaal": marge_totaal,
        "totaal_oplage": sum(d["oplage"] for d in drukken_out),
    }


# ──────────────────────────────────────────────────────────────────
#  API ENDPOINTS
# ──────────────────────────────────────────────────────────────────

@bp.route("/api/health")
def health():
    return jsonify(status="ok")


@bp.route("/api/health/storage")
def health_storage():
    """Diagnose-endpoint voor storage-gezondheid.

    Antwoord op: zit er een persistent volume? Hoeveel titels en backups?
    Wanneer was de laatste write? Zo kan een wipe sneller worden opgemerkt.
    """
    import os as _os
    from datetime import datetime as _dt
    db_url = _os.environ.get("DATABASE_URL", "")
    # Maskeer wachtwoord uit DATABASE_URL voor de respons
    db_url_safe = db_url
    if "@" in db_url and "://" in db_url:
        scheme, rest = db_url.split("://", 1)
        if "@" in rest:
            creds, host = rest.split("@", 1)
            db_url_safe = f"{scheme}://***:***@{host}"

    info: dict = {
        "volume_mount_path_env": _os.environ.get("RAILWAY_VOLUME_MOUNT_PATH") or None,
        "data_dir": str(storage.DATA_DIR),
        "titels_file": str(storage.TITELS_FILE),
        "titels_file_exists": storage.TITELS_FILE.exists(),
        "railway_env_vars": {k: v for k, v in _os.environ.items() if k.startswith("RAILWAY_")},
        "data_mount_exists": _os.path.exists("/data"),
        "data_mount_writable": _os.access("/data", _os.W_OK) if _os.path.exists("/data") else False,
        "database_url_set": bool(db_url),
        "database_url_safe": db_url_safe or None,
    }
    try:
        all_data = storage.load_all()
        info["titels_count"] = len(all_data)
        info["titel_names"] = sorted({
            v.get("titel_input", {}).get("titel", "?") for v in all_data.values()
        })
    except Exception as exc:
        info["load_error"] = str(exc)

    if storage.TITELS_FILE.exists():
        try:
            stat = storage.TITELS_FILE.stat()
            info["titels_file_size"] = stat.st_size
            info["titels_file_modified"] = _dt.fromtimestamp(stat.st_mtime).isoformat()
        except OSError as exc:
            info["stat_error"] = str(exc)

    try:
        backups = storage.list_backups()
        info["backups_count"] = len(backups)
        if backups:
            info["latest_backup"] = backups[0]
            info["oldest_backup"] = backups[-1]
            info["max_backup_size"] = max(b["size"] for b in backups)
    except Exception as exc:
        info["backup_error"] = str(exc)

    # Eventuele .corrupt-bestanden tonen (geeft signaal dat er ooit
    # iets fout ging en data via die fallback is gered)
    try:
        corrupt = sorted(storage.DATA_DIR.glob("*.corrupt-*"))
        info["corrupt_files"] = [c.name for c in corrupt]
    except Exception:
        info["corrupt_files"] = []

    return jsonify(info)


@bp.route("/api/calculate", methods=["POST"])
def calculate():
    data = request.get_json()
    result = run_calculation(data)
    return jsonify(result)


@bp.route("/api/sensitivity/cac", methods=["POST"])
def sensitivity_cac():
    data = request.get_json()
    cac_range = data.get("cac_range", [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15])
    results = []

    for cac_val in cac_range:
        data["titel_input"]["cac_per_ex"] = cac_val
        calc = run_calculation(data)

        for druk in calc["drukken"]:
            # Find or create entry for this druk_type
            entry = None
            for r in results:
                if r["druk_type"] == druk["druk_type"]:
                    entry = r
                    break
            if entry is None:
                entry = {
                    "variable_name": "cac_per_ex",
                    "druk_type": druk["druk_type"],
                    "rows": [],
                }
                results.append(entry)

            entry["rows"].append({
                "variable_value": cac_val,
                "webshop_winst": druk["webshop"]["netto_winst_maven"],
                "webshop_marge_pct": druk["webshop"]["marge_pct"],
                "retail_winst": druk["retail"]["netto_winst_maven"],
                "retail_marge_pct": druk["retail"]["marge_pct"],
                "b2b_winst": druk["b2b"]["netto_winst_maven"],
                "b2b_marge_pct": druk["b2b"]["marge_pct"],
                "gewogen_winst": druk["gewogen_netto_winst"],
                "gewogen_marge_pct": druk["gewogen_marge_pct"],
            })

    return jsonify(results)


@bp.route("/api/sensitivity/price", methods=["POST"])
def sensitivity_price():
    data = request.get_json()
    current_price = data["titel_input"].get("verkoopprijs_incl_btw", 20.0)
    # Generate retail-friendly prices in ±€3 range
    retail_prices = []
    for p in [
        # Common Dutch retail price points
        9.99, 10.99, 11.99, 12.50, 12.99, 13.99, 14.99, 15.99,
        16.99, 17.50, 17.99, 18.99, 19.99, 20.99, 21.99, 22.50,
        22.99, 24.99, 25.99, 27.50, 27.99, 29.99, 32.50, 34.99,
    ]:
        if current_price - 3.5 <= p <= current_price + 3.5:
            retail_prices.append(p)
    # Ensure current price is included
    if not any(abs(p - current_price) < 0.01 for p in retail_prices):
        retail_prices.append(current_price)
        retail_prices.sort()
    price_range = data.get("price_range", retail_prices)
    results = []

    for price_val in price_range:
        data["titel_input"]["verkoopprijs_incl_btw"] = price_val
        calc = run_calculation(data)

        for druk in calc["drukken"]:
            entry = None
            for r in results:
                if r["druk_type"] == druk["druk_type"]:
                    entry = r
                    break
            if entry is None:
                entry = {
                    "variable_name": "verkoopprijs_incl_btw",
                    "druk_type": druk["druk_type"],
                    "rows": [],
                }
                results.append(entry)

            entry["rows"].append({
                "variable_value": price_val,
                "webshop_winst": druk["webshop"]["netto_winst_maven"],
                "webshop_marge_pct": druk["webshop"]["marge_pct"],
                "retail_winst": druk["retail"]["netto_winst_maven"],
                "retail_marge_pct": druk["retail"]["marge_pct"],
                "b2b_winst": druk["b2b"]["netto_winst_maven"],
                "b2b_marge_pct": druk["b2b"]["marge_pct"],
                "gewogen_winst": druk["gewogen_netto_winst"],
                "gewogen_marge_pct": druk["gewogen_marge_pct"],
            })

    return jsonify(results)


# ── Titels CRUD ──

@bp.route("/api/titels")
def list_titels():
    include_archived = request.args.get("archived") == "true"
    all_data = storage.load_all()
    items = []
    for tid, tdata in all_data.items():
        archived = tdata.get("archived", False)
        if not include_archived and archived:
            continue
        ti = tdata.get("titel_input", {})
        # Bereken gewogen marge als er genoeg data is
        gewogen_marge = None
        try:
            calc_req = {
                "titel_input": ti,
                "verdeling_webshop": tdata.get("verdeling_webshop", 0.10),
                "verdeling_retail": tdata.get("verdeling_retail", 0.85),
                "verdeling_b2b": tdata.get("verdeling_b2b", 0.05),
            }
            res = run_calculation(calc_req)
            gewogen_marge = res.get("gewogen_marge_pct_totaal")
        except Exception:
            pass
        items.append({
            "id": tid,
            "titel": ti.get("titel", ""),
            "auteur": ti.get("auteur", ""),
            "isbn": ti.get("isbn", ""),
            "drukken_count": len(ti.get("drukken", [])),
            "gewogen_marge_pct": gewogen_marge,
            "archived": archived,
        })
    return jsonify(items)


@bp.route("/api/titels/<titel_id>")
def get_titel(titel_id):
    data = storage.get_titel(titel_id)
    if data is None:
        abort(404, description="Titel niet gevonden")
    return jsonify({"id": titel_id, **data})


@bp.route("/api/titels", methods=["POST"])
def save_titel():
    data = request.get_json()
    titel_id = data.get("id") or storage.new_id()

    titel_data = {
        "titel_input": data["titel_input"],
        "herdruk_oplages": data.get("herdruk_oplages", []),
        "verdeling_webshop": data.get("verdeling_webshop", 0.10),
        "verdeling_retail": data.get("verdeling_retail", 0.85),
        "verdeling_b2b": data.get("verdeling_b2b", 0.05),
    }

    storage.save_titel(titel_id, titel_data)
    return jsonify({"id": titel_id, **titel_data})


@bp.route("/api/titels/<titel_id>", methods=["DELETE"])
def delete_titel(titel_id):
    if storage.delete_titel(titel_id):
        return jsonify(ok=True)
    abort(404, description="Titel niet gevonden")


@bp.route("/api/titels/<titel_id>/archive", methods=["PATCH"])
def archive_titel(titel_id):
    data = storage.get_titel(titel_id)
    if data is None:
        abort(404, description="Titel niet gevonden")
    data["archived"] = True
    storage.save_titel(titel_id, data)
    return jsonify(ok=True)


@bp.route("/api/titels/<titel_id>/unarchive", methods=["PATCH"])
def unarchive_titel(titel_id):
    data = storage.get_titel(titel_id)
    if data is None:
        abort(404, description="Titel niet gevonden")
    data["archived"] = False
    storage.save_titel(titel_id, data)
    return jsonify(ok=True)


@bp.route("/api/backup/export", methods=["GET"])
def backup_export():
    """Download alle titels als JSON-bestand voor handmatige backup."""
    from io import BytesIO
    from datetime import datetime as _dt
    from flask import send_file
    all_data = storage.load_all()
    buf = BytesIO(json.dumps(all_data, ensure_ascii=False, indent=2).encode("utf-8"))
    buf.seek(0)
    ts = _dt.now().strftime("%Y%m%d_%H%M%S")
    return send_file(
        buf,
        as_attachment=True,
        download_name=f"calculatie_backup_{ts}.json",
        mimetype="application/json",
    )


@bp.route("/api/backup/list", methods=["GET"])
def backup_list():
    """Lijst beschikbare automatische backups."""
    return jsonify({"backups": storage.list_backups()})


@bp.route("/api/backup/restore", methods=["POST"])
def backup_restore():
    """Restore een eerdere backup over de huidige data heen.

    Body: {"name": "calculatie_titels_20260530_120000.json"}
    De huidige data wordt eerst nog als backup bewaard.
    """
    data = request.get_json() or {}
    name = data.get("name", "")
    if not name:
        abort(400, description="Geen backup-naam meegegeven")
    if storage.restore_backup(name):
        return jsonify({"restored": True, "name": name})
    abort(404, description="Backup niet gevonden")


@bp.route("/api/backup/import", methods=["POST"])
def backup_import():
    """Upload een JSON-backup en merge in de database.

    Body: {"data": {...}, "mode": "merge"|"replace"}
    - merge (default): voeg titels toe, overschrijf bestaande met dezelfde id
    - replace: vervang de hele database (huidige data wordt eerst gebackupt)
    """
    body = request.get_json() or {}
    new_data = body.get("data")
    mode = body.get("mode", "merge")
    if not isinstance(new_data, dict):
        abort(400, description="data moet een object zijn met titel-id's als sleutels")

    if mode == "replace":
        storage.save_all(new_data)
        return jsonify({"imported": len(new_data), "mode": "replace"})

    # merge
    current = storage.load_all()
    current.update(new_data)
    storage.save_all(current)
    return jsonify({"imported": len(new_data), "total": len(current), "mode": "merge"})


@bp.route("/api/seed", methods=["POST"])
def seed_database():
    """Seed de database met Maven-titels als deze leeg is."""
    from ..seed_data import MAVEN_TITELS
    all_data = storage.load_all()
    if len(all_data) > 0:
        return jsonify({"seeded": 0, "message": "Database is niet leeg"})

    count = 0
    for t in MAVEN_TITELS:
        tid = storage.new_id()
        titel_data = {
            "titel_input": {
                "titel": t["titel"],
                "auteur": t["auteur"],
                "isbn": t["isbn"],
                "verschijningsdatum": "",
                "verschenen": t["druknummer"] > 0,
                "verkoopprijs_incl_btw": 20.0,
                "btw_percentage": 0.09,
                "boekhandelskorting": 0.48,
                "drukken": [{
                    "druknummer": t["druknummer"],
                    "oplage": 2000,
                    "drukkosten_per_ex": 1.20,
                    "kostenposten": [],
                }],
                "transactiekosten_pct": 0.002,
                "fulfillment_per_ex": 4.50,
                "cac_per_ex": 0.0,
                "distributie_cb_per_ex": 1.10,
                "b2b_porto_per_ex": 0.0,
                "b2b_korting_pct": 0.0,
                "auteur_winstdeling_pct": 0.50,
                "auteur_royalty_staffel": [],
                "auteur_voorschot": 0,
                "agent_pct": 0.0, "agent_staffel": [], "agent_winstdeling_pct": 0.0, "agent_voorschot": 0,
                "vertaler_pct": 0.0, "vertaler_staffel": [], "vertaler_winstdeling_pct": 0.0, "vertaler_voorschot": 0,
                "illustrator_pct": 0.0, "illustrator_staffel": [], "illustrator_winstdeling_pct": 0.0, "illustrator_voorschot": 0,
                "heeft_partner": False,
                "partner_naam": "",
                "partner_winstdeling_pct": 0.5,
                "overige_kosten_pct": 0.0,
                "overige_kosten_items": [],
                "extra_derden": [],
            },
            "verdeling_webshop": 0.10,
            "verdeling_retail": 0.85,
            "verdeling_b2b": 0.05,
            "archived": False,
        }
        storage.save_titel(tid, titel_data)
        count += 1

    return jsonify({"seeded": count})


# ── Oplage Simulatie ──

@bp.route("/api/simulate/oplage", methods=["POST"])
def simulate_oplage():
    """Simuleer P&L bij verschillende verkoopaantallen.

    Berekent netto resultaat incl. kostenposten van 1e druk en voorschotten.
    Geeft 4 punten: huidige oplage, break-even, +5000, +10000.
    """
    data = request.get_json()
    ti = data.get("titel_input", {})
    verd_ws = data.get("verdeling_webshop", 0.10)
    verd_rt = data.get("verdeling_retail", 0.85)
    verd_b2b = data.get("verdeling_b2b", 0.05)

    try:
        calc = run_calculation(data)
    except Exception:
        return jsonify({"rows": [], "break_even_oplage": None})

    if not calc["drukken"]:
        return jsonify({"rows": [], "break_even_oplage": None})

    druk = calc["drukken"][0]
    ws, rt, b2b_k = druk["webshop"], druk["retail"], druk["b2b"]

    # Gewogen per-exemplaar values
    netto_omzet_per_ex = ws["netto_omzet"] * verd_ws + rt["netto_omzet"] * verd_rt + b2b_k["netto_omzet"] * verd_b2b
    netto_winst_per_ex = ws["netto_winst_maven"] * verd_ws + rt["netto_winst_maven"] * verd_rt + b2b_k["netto_winst_maven"] * verd_b2b

    # The engine amortizes kostenposten into the per-ex result (kosten_per_ex).
    # For the oplage sim, strip that out and add them back as a fixed lump sum,
    # so the sim can model volumes different from the druk oplage.
    kosten_per_ex_gewogen = (
        ws["kosten_per_ex"] * verd_ws + rt["kosten_per_ex"] * verd_rt + b2b_k["kosten_per_ex"] * verd_b2b
    )
    var_winst_per_ex = netto_winst_per_ex + kosten_per_ex_gewogen

    # Fixed costs: kostenposten van de 1e druk
    totaal_eenmalig = druk.get("kosten_totaal", 0)

    drukken_config = ti.get("drukken", [])
    if not drukken_config:
        drukken_config = [{"druknummer": 1, "oplage": 2000, "drukkosten_per_ex": 1.20}]

    # Total drukkosten as fixed investment
    totaal_drukkosten = sum(d.get("oplage", 0) * d.get("drukkosten_per_ex", 0) for d in drukken_config)
    totaal_oplage = sum(d.get("oplage", 0) for d in drukken_config)

    # Voorschotten per partij (advance payments — recouped against ongoing royalties/commissions)
    auteur_voorschot = ti.get("auteur_voorschot", 0)
    agent_voorschot = ti.get("agent_voorschot", 0)
    vertaler_voorschot = ti.get("vertaler_voorschot", 0)
    illustrator_voorschot = ti.get("illustrator_voorschot", 0)
    extra_derden_voorschot = sum(
        d.get("voorschot", 0) for d in ti.get("extra_derden", [])
    )
    totaal_voorschotten = (
        auteur_voorschot + agent_voorschot + vertaler_voorschot
        + illustrator_voorschot + extra_derden_voorschot
    )

    # Per-ex royalty/commission per partij (already deducted in netto_winst_maven)
    drukkosten_in_perex = ws["drukkosten"] * verd_ws + rt["drukkosten"] * verd_rt + b2b_k["drukkosten"] * verd_b2b
    pure_var_winst_per_ex = var_winst_per_ex + drukkosten_in_perex  # add back drukkosten

    royalty_per_ex = ws["auteur_royalty"] * verd_ws + rt["auteur_royalty"] * verd_rt + b2b_k["auteur_royalty"] * verd_b2b
    agent_per_ex = ws["agent"] * verd_ws + rt["agent"] * verd_rt + b2b_k["agent"] * verd_b2b
    vertaler_per_ex = ws["vertaler"] * verd_ws + rt["vertaler"] * verd_rt + b2b_k["vertaler"] * verd_b2b
    illustrator_per_ex = ws["illustrator"] * verd_ws + rt["illustrator"] * verd_rt + b2b_k["illustrator"] * verd_b2b

    # Correct per-ex margin: add back the per-ex royalty/commission for each party
    # that has a voorschot (those will be deducted as effective fixed costs instead).
    # Parties WITHOUT a voorschot keep their per-ex cost as an ongoing variable cost.
    adjusted_per_ex = pure_var_winst_per_ex
    if auteur_voorschot > 0:
        adjusted_per_ex += royalty_per_ex
    if agent_voorschot > 0 and agent_per_ex > 0:
        adjusted_per_ex += agent_per_ex
    if vertaler_voorschot > 0 and vertaler_per_ex > 0:
        adjusted_per_ex += vertaler_per_ex
    if illustrator_voorschot > 0 and illustrator_per_ex > 0:
        adjusted_per_ex += illustrator_per_ex

    def calc_result_at_volume(vol):
        """Calculate net result at a given total volume sold."""
        # Drukkosten: sum up per-druk, capped at the volume
        druk_costs = 0
        remaining = vol
        for d in sorted(drukken_config, key=lambda x: x.get("druknummer", 1)):
            druk_vol = min(remaining, d.get("oplage", 0))
            druk_costs += druk_vol * d.get("drukkosten_per_ex", 0)
            remaining -= druk_vol
            if remaining <= 0:
                break
        if remaining > 0 and drukken_config:
            last_druk = drukken_config[-1]
            druk_costs += remaining * last_druk.get("drukkosten_per_ex", 1.20)

        # Effective cost per partij met voorschot:
        #   If earned royalties < voorschot: Maven pays exactly the voorschot (advance not yet recouped).
        #   If earned royalties > voorschot: Maven pays ongoing royalties (advance fully recouped).
        # For parties WITHOUT voorschot: per-ex cost already in adjusted_per_ex (variable).
        effective_fixed = totaal_eenmalig

        if auteur_voorschot > 0:
            auteur_earned = vol * royalty_per_ex
            effective_fixed += max(auteur_voorschot, auteur_earned) if royalty_per_ex > 0 else auteur_voorschot
        if agent_voorschot > 0:
            agent_earned = vol * agent_per_ex
            effective_fixed += max(agent_voorschot, agent_earned) if agent_per_ex > 0 else agent_voorschot
        if vertaler_voorschot > 0:
            vertaler_earned = vol * vertaler_per_ex
            effective_fixed += max(vertaler_voorschot, vertaler_earned) if vertaler_per_ex > 0 else vertaler_voorschot
        if illustrator_voorschot > 0:
            illustrator_earned = vol * illustrator_per_ex
            effective_fixed += max(illustrator_voorschot, illustrator_earned) if illustrator_per_ex > 0 else illustrator_voorschot
        # extra_derden voorschotten: treat as pure fixed costs (no per-ex recoupment tracked)
        effective_fixed += extra_derden_voorschot

        net_result = vol * adjusted_per_ex - druk_costs - effective_fixed

        total_omzet = vol * netto_omzet_per_ex
        marge = net_result / total_omzet if total_omzet > 0 else -10

        # voorschot_ingelopen: are all royalties/commissions >= their respective voorschotten?
        totaal_earned = (
            (vol * royalty_per_ex if auteur_voorschot > 0 else 0)
            + (vol * agent_per_ex if agent_voorschot > 0 else 0)
            + (vol * vertaler_per_ex if vertaler_voorschot > 0 else 0)
            + (vol * illustrator_per_ex if illustrator_voorschot > 0 else 0)
        )
        voorschot_ingelopen = totaal_earned >= totaal_voorschotten if totaal_voorschotten > 0 else True

        return {
            "oplage": vol,
            "omzet": round(total_omzet, 2),
            "kosten": round(total_omzet - net_result, 2),
            "netto_resultaat": round(net_result, 2),
            "marge_pct": round(marge, 4),
            "is_break_even": False,
            "is_voorschot_earn_out": False,
            "voorschot_ingelopen": voorschot_ingelopen,
        }

    # P&L break-even (Maven's netto resultaat = 0, inclusief voorschot als investering)
    def find_break_even():
        r_at_1 = calc_result_at_volume(1)
        r_high = calc_result_at_volume(200000)
        if r_at_1["netto_resultaat"] >= 0:
            return None
        if r_high["netto_resultaat"] < 0:
            return None
        low, high = 1, 200000
        for _ in range(50):
            mid = (low + high) // 2
            if calc_result_at_volume(mid)["netto_resultaat"] < 0:
                low = mid
            else:
                high = mid
            if high - low <= 10:
                break
        return max(((high + 24) // 50) * 50, 50)

    # Voorschot earn-out: oplage waarop de royalty's het voorschot dekken
    def find_earn_out():
        total_recoup_per_ex = (
            (royalty_per_ex if auteur_voorschot > 0 else 0)
            + (agent_per_ex if agent_voorschot > 0 else 0)
            + (vertaler_per_ex if vertaler_voorschot > 0 else 0)
            + (illustrator_per_ex if illustrator_voorschot > 0 else 0)
        )
        active_vs = (
            (auteur_voorschot if auteur_voorschot > 0 else 0)
            + (agent_voorschot if agent_voorschot > 0 else 0)
            + (vertaler_voorschot if vertaler_voorschot > 0 else 0)
            + (illustrator_voorschot if illustrator_voorschot > 0 else 0)
        )
        if active_vs <= 0 or total_recoup_per_ex <= 0:
            return None
        eo = int(active_vs / total_recoup_per_ex) + 1
        return ((eo + 49) // 50) * 50

    break_even = find_break_even()
    voorschot_earn_out = find_earn_out()

    # Build simulation points: break-even, voorschot-earn-out, huidige oplage, +5k, +10k
    volumes = set()
    volumes.add(totaal_oplage)
    if break_even is not None and break_even > 0:
        volumes.add(break_even)
    if voorschot_earn_out is not None and voorschot_earn_out > 0:
        volumes.add(voorschot_earn_out)
    volumes.add(totaal_oplage + 5000)
    volumes.add(totaal_oplage + 10000)

    # Beperken tot maximaal 5 punten (anders te druk)
    sorted_vols = sorted(volumes)[:5]

    rows = []
    for vol in sorted_vols:
        row = calc_result_at_volume(vol)
        if break_even is not None and vol == break_even:
            row["is_break_even"] = True
        if voorschot_earn_out is not None and vol == voorschot_earn_out:
            row["is_voorschot_earn_out"] = True
        rows.append(row)

    return jsonify({
        "rows": rows,
        "break_even_oplage": break_even,
        "voorschot_earn_out_oplage": voorschot_earn_out,
    })


# ── Excel Export ──

@bp.route("/api/export/excel", methods=["POST"])
def export_excel():
    """Exporteer calculatie naar een leesbaar Excel-bestand.

    Bevat: invoer, per-kanaal berekeningen, en een oplage-simulatietabel
    met eenvoudige Excel-formules.
    """
    from io import BytesIO
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, numbers
    from openpyxl.utils import get_column_letter

    data = request.get_json()
    if not data:
        abort(400, description="Geen data meegegeven")

    ti = data.get("titel_input", {})
    verd_ws = data.get("verdeling_webshop", 0.10)
    verd_rt = data.get("verdeling_retail", 0.85)
    verd_b2b = data.get("verdeling_b2b", 0.05)

    try:
        calc = run_calculation(data)
    except Exception as e:
        abort(400, description=f"Berekening mislukt: {e}")

    wb = openpyxl.Workbook()
    ws_sheet = wb.active
    ws_sheet.title = "Calculatie"

    # ── Styles ──
    GROEN = "FF1B5E20"
    LICHTGROEN = "FFE8F5E9"
    GRIJS_HEADER = "FF37474F"
    LICHT_GRIJS = "FFF5F5F5"
    WIT = "FFFFFFFF"

    def h1(cell, text):
        cell.value = text
        cell.font = Font(bold=True, size=13, color=WIT)
        cell.fill = PatternFill("solid", fgColor=GRIJS_HEADER)
        cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)

    def h2(cell, text):
        cell.value = text
        cell.font = Font(bold=True, size=10, color="FF1B5E20")
        cell.fill = PatternFill("solid", fgColor=LICHTGROEN)

    def label(cell, text):
        cell.value = text
        cell.font = Font(size=10)
        cell.alignment = Alignment(horizontal="left", indent=1)

    def val(cell, v, fmt=None):
        cell.value = v
        cell.font = Font(size=10)
        if fmt:
            cell.number_format = fmt
        cell.alignment = Alignment(horizontal="right")

    def pct(cell, v):
        val(cell, v, "0.0%")

    def eur(cell, v):
        val(cell, v, '€ #,##0.00')

    def thin_border():
        s = Side(style="thin", color="FFE0E0E0")
        return Border(left=s, right=s, top=s, bottom=s)

    # Column widths
    ws_sheet.column_dimensions["A"].width = 32
    ws_sheet.column_dimensions["B"].width = 14
    ws_sheet.column_dimensions["C"].width = 14
    ws_sheet.column_dimensions["D"].width = 14
    ws_sheet.column_dimensions["E"].width = 14
    ws_sheet.column_dimensions["F"].width = 14
    ws_sheet.column_dimensions["G"].width = 14
    ws_sheet.column_dimensions["H"].width = 14

    r = 1

    # ── HEADER ──
    ws_sheet.merge_cells(f"A{r}:H{r}")
    h1(ws_sheet[f"A{r}"], f"Maven Publishing — Calculatie: {ti.get('titel', '?')}")
    ws_sheet.row_dimensions[r].height = 22
    r += 1

    ws_sheet.merge_cells(f"A{r}:H{r}")
    ws_sheet[f"A{r}"].value = f"Auteur: {ti.get('auteur','')}  |  ISBN: {ti.get('isbn','')}  |  Gegenereerd: {__import__('datetime').date.today()}"
    ws_sheet[f"A{r}"].font = Font(size=9, italic=True, color="FF666666")
    r += 2

    # ── BASISGEGEVENS ──
    ws_sheet.merge_cells(f"A{r}:H{r}")
    h2(ws_sheet[f"A{r}"], "BASISGEGEVENS")
    r += 1

    drukken_cfg = ti.get("drukken", [{"druknummer": 1, "oplage": 2000, "drukkosten_per_ex": 1.20}])
    vkp_incl = ti.get("verkoopprijs_incl_btw", 0)
    btw_pct = ti.get("btw_percentage", 0.09)
    bh_korting = ti.get("boekhandelskorting", 0.48)
    vkp_ex = vkp_incl / (1 + btw_pct) if btw_pct > -1 else vkp_incl

    basis = [
        ("Verkoopprijs incl. BTW", vkp_incl, "€ #,##0.00"),
        ("BTW", btw_pct, "0%"),
        ("Verkoopprijs excl. BTW", vkp_ex, "€ #,##0.00"),
        ("Boekhandelskorting", bh_korting, "0%"),
        ("Netto omzet retail/CB (per ex.)", vkp_ex * (1 - bh_korting), "€ #,##0.00"),
    ]
    for row_label, row_val, row_fmt in basis:
        label(ws_sheet[f"A{r}"], row_label)
        val(ws_sheet[f"B{r}"], row_val, row_fmt)
        r += 1

    r += 1

    # ── DRUKKEN ──
    ws_sheet.merge_cells(f"A{r}:H{r}")
    h2(ws_sheet[f"A{r}"], "DRUKKEN & OPLAGE")
    r += 1

    # Header row
    for col, hdr in enumerate(["Druk", "Oplage", "Drukkosten/ex", "Drukkosten totaal"], 1):
        ws_sheet.cell(r, col).value = hdr
        ws_sheet.cell(r, col).font = Font(bold=True, size=9)
        ws_sheet.cell(r, col).fill = PatternFill("solid", fgColor="FFEEEEEe")
    r += 1

    for dk in drukken_cfg:
        ws_sheet.cell(r, 1).value = f"{dk.get('druknummer', 1)}e druk"
        val(ws_sheet.cell(r, 2), dk.get("oplage", 0), "#,##0")
        val(ws_sheet.cell(r, 3), dk.get("drukkosten_per_ex", 0), "€ #,##0.00")
        val(ws_sheet.cell(r, 4), dk.get("oplage", 0) * dk.get("drukkosten_per_ex", 0), "€ #,##0")
        r += 1

    r += 1

    # ── KOSTENPOSTEN ──
    alle_kosten = []
    for dk in drukken_cfg:
        for kp in dk.get("kostenposten", []):
            alle_kosten.append((f"  {kp.get('naam', kp.get('id', '?'))} ({dk.get('druknummer',1)}e druk)", kp.get("bedrag", 0)))

    if alle_kosten:
        ws_sheet.merge_cells(f"A{r}:H{r}")
        h2(ws_sheet[f"A{r}"], "KOSTENPOSTEN")
        r += 1
        for kp_label, kp_bedrag in alle_kosten:
            label(ws_sheet[f"A{r}"], kp_label)
            eur(ws_sheet[f"B{r}"], kp_bedrag)
            r += 1
        r += 1

    # ── MARGE PER KANAAL ──
    if calc.get("drukken"):
        druk0 = calc["drukken"][0]
        ws_sheet.merge_cells(f"A{r}:H{r}")
        h2(ws_sheet[f"A{r}"], f"MARGE PER KANAAL — 1e druk ({druk0.get('oplage', 0):,} ex.)")
        r += 1

        # Header
        headers = ["Kostenregel", "Retail/CB", "Webshop", "B2B", "Gewogen"]
        for ci, hdr in enumerate(headers, 1):
            c = ws_sheet.cell(r, ci)
            c.value = hdr
            c.font = Font(bold=True, size=9)
            c.fill = PatternFill("solid", fgColor="FFEEEEEe")
            c.alignment = Alignment(horizontal="right" if ci > 1 else "left")
        r += 1

        ws_r = druk0["webshop"]
        rt_r = druk0["retail"]
        b2b_r = druk0["b2b"]

        def gewogen(field):
            return ws_r.get(field, 0)*verd_ws + rt_r.get(field, 0)*verd_rt + b2b_r.get(field, 0)*verd_b2b

        kanaal_rows = [
            ("Netto omzet", "netto_omzet"),
            ("Drukkosten", "drukkosten"),
            ("Fulfillment / distributie / porto", None),  # combined
            ("CAC", "cac"),
            ("Transactiekosten", "transactiekosten"),
            ("Auteur royalty / winstdeling", "auteur_royalty"),
            ("Agent", "agent"),
            ("Vertaler", "vertaler"),
            ("Overige kosten", "overige_kosten"),
            ("Netto winst Maven", "netto_winst_maven"),
            ("Marge %", "__marge__"),
        ]

        for row_label, field in kanaal_rows:
            c_a = ws_sheet.cell(r, 1)
            c_a.value = f"  {row_label}" if field not in (None, "__marge__") else row_label
            c_a.font = Font(size=9, bold=(field in (None, "__marge__", "netto_winst_maven", "netto_omzet")))
            if field == "netto_winst_maven":
                c_a.fill = PatternFill("solid", fgColor=LICHTGROEN)

            for ci, (kanaal_data, verd) in enumerate([(rt_r, verd_rt), (ws_r, verd_ws), (b2b_r, verd_b2b)], 2):
                c = ws_sheet.cell(r, ci)
                if field == "__marge__":
                    v = kanaal_data.get("marge_pct", 0)
                    pct(c, v)
                elif field is None:
                    v = kanaal_data.get("fulfillment", 0) + kanaal_data.get("distributie_cb", 0) + kanaal_data.get("b2b_porto", 0)
                    eur(c, v)
                else:
                    v = kanaal_data.get(field, 0)
                    eur(c, v)
                if field == "netto_winst_maven":
                    c.fill = PatternFill("solid", fgColor=LICHTGROEN)

            # Gewogen column
            gew_cell = ws_sheet.cell(r, 5)
            if field == "__marge__":
                gew_v = gewogen("netto_winst_maven") / gewogen("netto_omzet") if gewogen("netto_omzet") > 0 else 0
                pct(gew_cell, gew_v)
            elif field is None:
                gew_v = gewogen("fulfillment") + gewogen("distributie_cb") + gewogen("b2b_porto")
                eur(gew_cell, gew_v)
            else:
                eur(gew_cell, gewogen(field))
            if field == "netto_winst_maven":
                gew_cell.fill = PatternFill("solid", fgColor=LICHTGROEN)
                gew_cell.font = Font(bold=True, size=9)
            r += 1

    r += 1

    # ── OPLAGE SIMULATIE ──
    ws_sheet.merge_cells(f"A{r}:H{r}")
    h2(ws_sheet[f"A{r}"], "OPLAGE SIMULATIE")
    r += 1

    sim_headers = ["Oplage", "Netto omzet", "Drukkosten", "Kostenposten", "Voorschot", "Royalty boven voorschot", "Netto resultaat", "Marge %"]
    for ci, hdr in enumerate(sim_headers, 1):
        c = ws_sheet.cell(r, ci)
        c.value = hdr
        c.font = Font(bold=True, size=9)
        c.fill = PatternFill("solid", fgColor="FFEEEEEe")
        c.alignment = Alignment(horizontal="right" if ci > 1 else "left")
    r += 1

    # Compute simulation manually for 6 oplage points
    totaal_oplage = sum(d.get("oplage", 0) for d in drukken_cfg)
    auteur_vs = ti.get("auteur_voorschot", 0)
    agent_vs = ti.get("agent_voorschot", 0)
    vertaler_vs = ti.get("vertaler_voorschot", 0)
    illustrator_vs = ti.get("illustrator_voorschot", 0)
    extra_vs = sum(d.get("voorschot", 0) for d in ti.get("extra_derden", []))
    totaal_vs = auteur_vs + agent_vs + vertaler_vs + illustrator_vs + extra_vs

    druk0 = calc["drukken"][0] if calc.get("drukken") else {}
    ws_k = druk0.get("webshop", {})
    rt_k = druk0.get("retail", {})
    b2b_k_d = druk0.get("b2b", {})

    def gew(field):
        return ws_k.get(field, 0)*verd_ws + rt_k.get(field, 0)*verd_rt + b2b_k_d.get(field, 0)*verd_b2b

    netto_omzet_pex = gew("netto_omzet")
    netto_winst_pex = gew("netto_winst_maven")
    kosten_pex = gew("kosten_per_ex")
    druk_pex = gew("drukkosten")
    royalty_pex = gew("auteur_royalty")
    agent_pex = gew("agent")
    vertaler_pex = gew("vertaler")
    illustrator_pex = gew("illustrator")

    var_w = netto_winst_pex + kosten_pex
    pure_v = var_w + druk_pex

    adj_pex = pure_v
    if auteur_vs > 0:
        adj_pex += royalty_pex
    if agent_vs > 0 and agent_pex > 0:
        adj_pex += agent_pex
    if vertaler_vs > 0 and vertaler_pex > 0:
        adj_pex += vertaler_pex
    if illustrator_vs > 0 and illustrator_pex > 0:
        adj_pex += illustrator_pex

    totaal_eenmalig_sim = druk0.get("kosten_totaal", 0)

    def sim_at(vol):
        # Drukkosten
        dk = 0
        rem = vol
        for d in sorted(drukken_cfg, key=lambda x: x.get("druknummer", 1)):
            dv = min(rem, d.get("oplage", 0))
            dk += dv * d.get("drukkosten_per_ex", 0)
            rem -= dv
            if rem <= 0:
                break
        if rem > 0 and drukken_cfg:
            dk += rem * drukken_cfg[-1].get("drukkosten_per_ex", 1.20)

        # Effectieve cost per partij = max(voorschot, verdiende royalty/commissie)
        # Splits dit op in: voorschot (vast) + royalty boven voorschot (= max(0, earned - voorschot))
        royalty_boven_voorschot = 0.0
        eff = totaal_eenmalig_sim

        if auteur_vs > 0:
            auteur_earned = vol * royalty_pex
            eff += max(auteur_vs, auteur_earned) if royalty_pex > 0 else auteur_vs
            royalty_boven_voorschot += max(0.0, auteur_earned - auteur_vs) if royalty_pex > 0 else 0
        if agent_vs > 0:
            agent_earned = vol * agent_pex
            eff += max(agent_vs, agent_earned) if agent_pex > 0 else agent_vs
            royalty_boven_voorschot += max(0.0, agent_earned - agent_vs) if agent_pex > 0 else 0
        if vertaler_vs > 0:
            vertaler_earned = vol * vertaler_pex
            eff += max(vertaler_vs, vertaler_earned) if vertaler_pex > 0 else vertaler_vs
            royalty_boven_voorschot += max(0.0, vertaler_earned - vertaler_vs) if vertaler_pex > 0 else 0
        if illustrator_vs > 0:
            illustrator_earned = vol * illustrator_pex
            eff += max(illustrator_vs, vol * illustrator_pex) if illustrator_pex > 0 else illustrator_vs
            royalty_boven_voorschot += max(0.0, vol * illustrator_pex - illustrator_vs) if illustrator_pex > 0 else 0
        eff += extra_vs

        omzet = vol * netto_omzet_pex
        net = vol * adj_pex - dk - eff
        marge = net / omzet if omzet > 0 else 0
        return {
            "vol": vol, "omzet": omzet, "drukkosten": dk, "kostenposten": totaal_eenmalig_sim,
            "voorschot": totaal_vs,
            "royalty_boven_voorschot": royalty_boven_voorschot,
            "net": net, "marge": marge,
        }

    # Find break-even: hoogste van (P&L positief, voorschotten ingelopen via royalty's)
    def find_be():
        if sim_at(200000)["net"] < 0:
            return None
        if sim_at(1)["net"] >= 0:
            pl_be = 0
        else:
            lo, hi = 1, 200000
            for _ in range(50):
                mid = (lo + hi) // 2
                if sim_at(mid)["net"] < 0:
                    lo = mid
                else:
                    hi = mid
                if hi - lo <= 10:
                    break
            pl_be = hi

        # Voorschot-ingelopen volume
        total_recoup_per_ex = (
            (royalty_pex if auteur_vs > 0 else 0)
            + (agent_pex if agent_vs > 0 else 0)
            + (vertaler_pex if vertaler_vs > 0 else 0)
            + (illustrator_pex if illustrator_vs > 0 else 0)
        )
        active_vs = (
            (auteur_vs if auteur_vs > 0 else 0)
            + (agent_vs if agent_vs > 0 else 0)
            + (vertaler_vs if vertaler_vs > 0 else 0)
            + (illustrator_vs if illustrator_vs > 0 else 0)
        )
        earn_out = int(active_vs / total_recoup_per_ex) + 1 if (active_vs > 0 and total_recoup_per_ex > 0) else 0

        be = max(pl_be, earn_out)
        return ((be + 49) // 50) * 50

    be_vol = find_be()

    sim_vols = sorted(set(filter(None, [
        be_vol,
        totaal_oplage,
        totaal_oplage + 2500,
        totaal_oplage + 5000,
        totaal_oplage + 10000,
        totaal_oplage + 20000,
    ])))[:7]

    for sv in sim_vols:
        sd = sim_at(sv)
        is_be = (be_vol is not None and sv == be_vol)
        bg = LICHTGROEN if is_be else WIT

        def sc(ci, v, fmt):
            c = ws_sheet.cell(r, ci)
            c.value = v
            c.number_format = fmt
            c.font = Font(size=9, bold=is_be)
            c.fill = PatternFill("solid", fgColor=bg)
            c.alignment = Alignment(horizontal="right" if ci > 1 else "left")

        label_text = f"{sv:,}{'  ← break-even' if is_be else ''}"
        c0 = ws_sheet.cell(r, 1)
        c0.value = label_text
        c0.font = Font(size=9, bold=is_be)
        c0.fill = PatternFill("solid", fgColor=bg)

        sc(2, sd["omzet"], "€ #,##0")
        sc(3, sd["drukkosten"], "€ #,##0")
        sc(4, sd["kostenposten"], "€ #,##0")
        sc(5, sd["voorschot"], "€ #,##0")
        sc(6, sd["royalty_boven_voorschot"], "€ #,##0")
        sc(7, sd["net"], "€ #,##0")
        marg_c = ws_sheet.cell(r, 8)
        marg_c.value = sd["marge"]
        marg_c.number_format = "0.0%"
        marg_c.font = Font(size=9, bold=is_be,
                           color="FF1B5E20" if sd["marge"] >= 0.35 else ("FFE65100" if sd["marge"] >= 0 else "FFC62828"))
        marg_c.fill = PatternFill("solid", fgColor=bg)
        marg_c.alignment = Alignment(horizontal="right")
        r += 1

    # Toelichting onder de tabel
    r += 1
    ws_sheet.merge_cells(f"A{r}:H{r}")
    note_cell = ws_sheet[f"A{r}"]
    note_cell.value = (
        "Voorschot = wat Maven upfront betaalt (vast). Royalty boven voorschot = "
        "pas uitgekeerd nadat het voorschot via royalty's is ingelopen. "
        "Overige variabele kosten (CAC, fulfillment, CB-distributie, transactiekosten, "
        "royalty zonder voorschot) zijn al verwerkt in het netto resultaat."
    )
    note_cell.font = Font(size=8, italic=True, color="FF666666")
    note_cell.alignment = Alignment(wrap_text=True, vertical="top")
    ws_sheet.row_dimensions[r].height = 30
    r += 2

    # ── DEALS ──
    deals = []
    if ti.get("auteur_voorschot", 0) > 0 or ti.get("auteur_winstdeling_pct", 0) > 0 or ti.get("auteur_royalty_staffel"):
        deals.append(("Auteur", {
            "Royalty %": f"{ti.get('auteur_royalty_staffel', [{}])[0].get('percentage', 0)*100:.1f}%" if ti.get("auteur_royalty_staffel") else "—",
            "Winstdeling %": f"{ti.get('auteur_winstdeling_pct',0)*100:.1f}%" if ti.get("auteur_winstdeling_pct") else "—",
            "Voorschot": ti.get("auteur_voorschot", 0),
        }))
    if ti.get("agent_voorschot", 0) > 0 or ti.get("agent_pct", 0) > 0:
        deals.append(("Agent", {
            "Royalty %": f"{ti.get('agent_pct',0)*100:.1f}%",
            "Voorschot": ti.get("agent_voorschot", 0),
        }))

    if deals:
        ws_sheet.merge_cells(f"A{r}:H{r}")
        h2(ws_sheet[f"A{r}"], "DEALS & VOORSCHOTTEN")
        r += 1
        for dname, dfields in deals:
            ws_sheet.cell(r, 1).value = dname
            ws_sheet.cell(r, 1).font = Font(bold=True, size=9)
            col = 2
            for k, v in dfields.items():
                ws_sheet.cell(r, col).value = f"{k}: {v if isinstance(v, str) else f'€ {v:,.0f}'}"
                ws_sheet.cell(r, col).font = Font(size=9)
                col += 1
            r += 1

    # Output
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    titel_slug = (ti.get("titel", "calculatie") or "calculatie").replace(" ", "_")[:30]
    filename = f"calculatie_{titel_slug}.xlsx"

    from flask import send_file
    return send_file(
        buf,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# ── CSV Import ──

@bp.route("/api/import/csv", methods=["POST"])
def import_csv_file():
    """Import titels vanuit een CSV-bestand.

    Meerdere rijen met hetzelfde ISBN (of dezelfde titel+auteur) worden
    samengevoegd tot één titel met meerdere drukken.

    Verplicht: titel
    Aanbevolen: auteur, isbn, druknummer, oplage, drukkosten_per_ex,
                verkoopprijs_incl_btw, boekhandelskorting, auteur_winstdeling_pct
    """
    if "file" not in request.files:
        abort(400, description="Geen bestand meegegeven")

    file = request.files["file"]
    if not file.filename or not file.filename.endswith(".csv"):
        abort(400, description="Alleen .csv-bestanden toegestaan")

    raw = file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw), delimiter=";")

    # Also try comma delimiter if semicolon yields no columns
    fieldnames = reader.fieldnames or []
    if len(fieldnames) <= 1:
        reader = csv.DictReader(io.StringIO(raw), delimiter=",")

    def parse_float(row, key, default=0.0, *aliases):
        for k in [key] + list(aliases):
            v = row.get(k, "")
            if v:
                try:
                    return float(v.replace(",", "."))
                except (ValueError, TypeError):
                    pass
        return default

    # Group rows by ISBN (or titel+auteur if no ISBN) to support multiple drukken
    from collections import OrderedDict
    groups = OrderedDict()  # key -> (first_row, [druk_rows])

    for row in reader:
        row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        titel = row.get("titel", "").strip()
        if not titel:
            continue

        isbn = row.get("isbn", "").strip()
        group_key = isbn if isbn else f"{titel}|{row.get('auteur', '')}"

        if group_key not in groups:
            groups[group_key] = (row, [])
        groups[group_key][1].append(row)

    count = 0
    for group_key, (first_row, druk_rows) in groups.items():
        titel = first_row.get("titel", "").strip()
        auteur = first_row.get("auteur", "")
        isbn = first_row.get("isbn", "")

        # Build drukken list from all rows in group, sorted by druknummer
        drukken = []
        for row in druk_rows:
            druk_raw = row.get("druknummer", row.get("druk", "1"))
            try:
                druknummer = max(1, int(druk_raw))
            except (ValueError, TypeError):
                druknummer = 1

            oplage = int(parse_float(row, "oplage", 2000, "oplage_1e_druk"))
            drukkosten = parse_float(row, "drukkosten_per_ex", 1.20, "drukkosten_1e_druk", "drukkosten")

            drukken.append({
                "druknummer": druknummer,
                "oplage": oplage,
                "drukkosten_per_ex": drukkosten,
                "kostenposten": [],
            })

        drukken.sort(key=lambda d: d["druknummer"])

        tid = storage.new_id()
        titel_data = {
            "titel_input": {
                "titel": titel,
                "auteur": auteur,
                "isbn": isbn,
                "verschijningsdatum": first_row.get("verschijningsdatum", ""),
                "verschenen": True,
                "verkoopprijs_incl_btw": parse_float(first_row, "verkoopprijs_incl_btw", 20.0),
                "btw_percentage": parse_float(first_row, "btw_percentage", 0.09),
                "boekhandelskorting": parse_float(first_row, "boekhandelskorting", 0.48),
                "drukken": drukken,
                "transactiekosten_pct": 0.002,
                "fulfillment_per_ex": 4.50,
                "cac_per_ex": 0.0,
                "distributie_cb_per_ex": 1.10,
                "b2b_porto_per_ex": 0.0,
                "b2b_korting_pct": 0.0,
                "auteur_winstdeling_pct": parse_float(first_row, "auteur_winstdeling_pct", 0.50),
                "auteur_royalty_staffel": [],
                "auteur_voorschot": 0,
                "agent_pct": 0.0, "agent_staffel": [], "agent_winstdeling_pct": 0.0, "agent_voorschot": 0,
                "vertaler_pct": 0.0, "vertaler_staffel": [], "vertaler_winstdeling_pct": 0.0, "vertaler_voorschot": 0,
                "illustrator_pct": 0.0, "illustrator_staffel": [], "illustrator_winstdeling_pct": 0.0, "illustrator_voorschot": 0,
                "heeft_partner": False,
                "partner_naam": "",
                "partner_winstdeling_pct": 0.5,
                "overige_kosten_pct": 0.0,
                "overige_kosten_items": [],
                "extra_derden": [],
            },
            "verdeling_webshop": 0.10,
            "verdeling_retail": 0.85,
            "verdeling_b2b": 0.05,
            "archived": False,
        }
        storage.save_titel(tid, titel_data)
        count += 1

    return jsonify({"imported": count})


# ── CSV Export ──

@bp.route("/api/export/csv", methods=["POST"])
def export_csv():
    data = request.get_json()
    res = run_calculation(data)

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")

    writer.writerow(["Maven Calculatie", res["titel"]])
    writer.writerow([])

    for druk in res["drukken"]:
        writer.writerow([druk["druk_type"].upper(), f"Oplage: {druk['oplage']}"])
        writer.writerow(["Kostenposten totaal", f"{druk.get('kosten_totaal', 0):.2f}"])
        writer.writerow(["Drukkosten totaal", f"{druk.get('drukkosten_totaal', 0):.2f}"])
        writer.writerow(["", "Webshop", "", "Retail (CB)", "", "B2B", ""])
        writer.writerow(["", "Bedrag", "Marge%", "Bedrag", "Marge%", "Bedrag", "Marge%"])

        writer.writerow([
            "Netto omzet",
            f"{druk['webshop']['netto_omzet']:.2f}", "",
            f"{druk['retail']['netto_omzet']:.2f}", "",
            f"{druk['b2b']['netto_omzet']:.2f}", "",
        ])

        writer.writerow([
            "Netto winst Maven",
            f"{druk['webshop']['netto_winst_maven']:.2f}",
            f"{druk['webshop']['marge_pct']:.1%}",
            f"{druk['retail']['netto_winst_maven']:.2f}",
            f"{druk['retail']['marge_pct']:.1%}",
            f"{druk['b2b']['netto_winst_maven']:.2f}",
            f"{druk['b2b']['marge_pct']:.1%}",
        ])

        writer.writerow([
            "Gewogen marge",
            f"{druk['gewogen_netto_winst']:.2f}",
            f"{druk['gewogen_marge_pct']:.1%}",
        ])
        writer.writerow([])

    output.seek(0)
    filename = f"calculatie_{res['titel'].replace(' ', '_')}.csv"

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
