"""
Flask Blueprint: Calculatie API
Alle endpoints voor het Maven Calculatiemodel.
"""

import csv
import io
from dataclasses import asdict
from flask import Blueprint, request, jsonify, Response, abort

from ..calculatie import (
    TitelInput, StaffelTrede, KostenPost,
    bereken_titel, bereken_kanaal, bereken_kostenposten_totalen,
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
            categorie=kp["categorie"], type=kp["type"],
            bedrag=kp.get("bedrag", 0.0),
        )
        for kp in items
    ]


def dict_to_titel_input(d: dict) -> TitelInput:
    """Converteer JSON dict → TitelInput dataclass."""
    return TitelInput(
        titel=d.get("titel", "Nieuwe titel"),
        isbn=d.get("isbn", ""),
        druknummer=d.get("druknummer", 1),
        verschijningsdatum=d.get("verschijningsdatum", ""),
        verschenen=d.get("verschenen", False),
        verkoopprijs_incl_btw=d.get("verkoopprijs_incl_btw", 20.0),
        btw_percentage=d.get("btw_percentage", 0.09),
        boekhandelskorting=d.get("boekhandelskorting", 0.48),
        oplage_1e_druk=d.get("oplage_1e_druk", 2000),
        drukkosten_1e_druk=d.get("drukkosten_1e_druk", 0.0),
        drukkosten_herdruk=d.get("drukkosten_herdruk", 0.0),
        # Productie
        vormgeving_omslag=d.get("vormgeving_omslag", 0.0),
        vormgeving_binnenwerk=d.get("vormgeving_binnenwerk", 0.0),
        dtp=d.get("dtp", 0.0),
        persklaarmaken=d.get("persklaarmaken", 0.0),
        correctie=d.get("correctie", 0.0),
        freelance_redactie=d.get("freelance_redactie", 0.0),
        ebook_productie=d.get("ebook_productie", 0.0),
        audiobook_productie=d.get("audiobook_productie", 0.0),
        overige_productie=d.get("overige_productie", 0.0),
        # Offline marketing
        evenement=d.get("evenement", 0.0),
        marketingmateriaal=d.get("marketingmateriaal", 0.0),
        offline_campagne=d.get("offline_campagne", 0.0),
        boekhandelsmateriaal=d.get("boekhandelsmateriaal", 0.0),
        marketing_fee=d.get("marketing_fee", 0.0),
        overige_offline_marketing=d.get("overige_offline_marketing", 0.0),
        # Online marketing
        online_ads=d.get("online_ads", 0.0),
        productfotografie=d.get("productfotografie", 0.0),
        productie_ads=d.get("productie_ads", 0.0),
        software_kosten=d.get("software_kosten", 0.0),
        # Webshop
        transactiekosten_pct=d.get("transactiekosten_pct", 0.02),
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
        # Kostenposten v2
        kostenposten=_kostenposten_list(d.get("kostenposten", [])),
        gebruik_kostenposten=d.get("gebruik_kostenposten", False),
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
        "webshop": ws,
        "retail": rt,
        "b2b": b2b,
        "gewogen_netto_winst": gewogen_winst,
        "gewogen_marge_pct": gewogen_marge,
    }


def run_calculation(data: dict) -> dict:
    """Voer de volledige calculatie uit vanuit een JSON request dict."""
    ti = data["titel_input"]
    t = dict_to_titel_input(ti)
    verd_ws = data.get("verdeling_webshop", 0.10)
    verd_rt = data.get("verdeling_retail", 0.85)
    verd_b2b = data.get("verdeling_b2b", 0.05)

    # ── Multi-druk pad: elke druk heeft eigen kostenposten ──
    drukken_config = ti.get("drukken", [])
    if drukken_config:
        res = CalculatieResultaat(titel=t.titel)
        cumulatief = 0
        totaal_productie = 0.0
        totaal_offline = 0.0
        totaal_online = 0.0

        for i, druk_cfg in enumerate(drukken_config):
            druknr = druk_cfg.get("druknummer", i + 1)
            oplage = druk_cfg.get("oplage", 2000)
            drukkosten_per_ex = druk_cfg.get("drukkosten_per_ex", 1.20)
            kp_list = _kostenposten_list(druk_cfg.get("kostenposten", []))
            is_first = (i == 0)

            # Override drukkosten in TitelInput for this druk
            t.drukkosten_1e_druk = drukkosten_per_ex
            t.drukkosten_herdruk = drukkosten_per_ex
            t.oplage_1e_druk = oplage

            # Calculate kostenposten for this druk
            if kp_list:
                t.gebruik_kostenposten = True
                t.kostenposten = kp_list
                totaal_eenmalig, totaal_terugkerend = bereken_kostenposten_totalen(kp_list)
                eenmalig_per_ex = totaal_eenmalig / oplage if oplage > 0 else 0
                terugkerend_per_ex = totaal_terugkerend / oplage if oplage > 0 else 0

                totaal_productie += sum(kp.bedrag for kp in kp_list if kp.categorie == "productie")
                totaal_offline += sum(kp.bedrag for kp in kp_list if kp.categorie == "offline_marketing")
                totaal_online += sum(kp.bedrag for kp in kp_list if kp.categorie == "online_marketing")
            else:
                eenmalig_per_ex = 0
                terugkerend_per_ex = 0

            druk = DrukResultaat(
                druk_type=f"{druknr}e druk",
                oplage=oplage,
                cumulatief_voor_druk=cumulatief,
            )
            for kanaal in ["webshop", "retail", "b2b"]:
                result = bereken_kanaal(
                    t, kanaal, is_herdruk=(not is_first),
                    productie_per_ex=0.0, offline_mkt_per_ex=0.0, online_mkt_per_ex=0.0,
                    cumulatief_verkocht=cumulatief, oplage=oplage,
                    eenmalig_per_ex=eenmalig_per_ex,
                    terugkerend_per_ex=terugkerend_per_ex,
                )
                setattr(druk, kanaal, result)
            res.drukken.append(druk)
            cumulatief += oplage

            if is_first:
                res.drukkosten_totaal_1e = drukkosten_per_ex * oplage

        res.totaal_productie = totaal_productie
        res.totaal_offline_marketing = totaal_offline
        res.totaal_online_marketing = totaal_online
    else:
        # Legacy: fallback to old engine path
        herdrukken = data.get("herdruk_oplages") or None
        res = bereken_titel(t, herdruk_oplages=herdrukken)

    return {
        "titel": res.titel,
        "drukken": [
            druk_to_dict(d, verd_ws, verd_rt, verd_b2b)
            for d in res.drukken
        ],
        "totaal_productie": res.totaal_productie,
        "totaal_offline_marketing": res.totaal_offline_marketing,
        "totaal_online_marketing": res.totaal_online_marketing,
        "drukkosten_totaal_1e": res.drukkosten_totaal_1e,
    }


# ──────────────────────────────────────────────────────────────────
#  API ENDPOINTS
# ──────────────────────────────────────────────────────────────────

@bp.route("/api/health")
def health():
    return jsonify(status="ok")


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
                "herdruk_oplages": tdata.get("herdruk_oplages", []),
                "verdeling_webshop": tdata.get("verdeling_webshop", 0.10),
                "verdeling_retail": tdata.get("verdeling_retail", 0.85),
                "verdeling_b2b": tdata.get("verdeling_b2b", 0.05),
            }
            res = run_calculation(calc_req)
            if res["drukken"]:
                gewogen_marge = res["drukken"][0]["gewogen_marge_pct"]
        except Exception:
            pass
        items.append({
            "id": tid,
            "titel": ti.get("titel", ""),
            "auteur": ti.get("auteur", ""),
            "isbn": ti.get("isbn", ""),
            "druknummer": ti.get("druknummer", 1),
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
                "druknummer": t["druknummer"],
                "verschijningsdatum": "",
                "verschenen": t["druknummer"] > 0,
                "verkoopprijs_incl_btw": 20.0,
                "btw_percentage": 0.09,
                "boekhandelskorting": 0.48,
                "oplage_1e_druk": 2000,
                "drukkosten_1e_druk": 1.20,
                "drukkosten_herdruk": 1.20,
                "auteur_winstdeling_pct": 0.50,
                "gebruik_kostenposten": True,
                "kostenposten": [],
                "extra_derden": [],
                "overige_kosten_items": [],
                "overige_kosten_pct": 0.0,
            },
            "herdruk_oplages": [],
            "verdeling_webshop": 0.10,
            "verdeling_retail": 0.85,
            "verdeling_b2b": 0.05,
            "archived": False,
        }
        # Zet alle overige numerieke velden op 0
        for field in [
            "vormgeving_omslag", "vormgeving_binnenwerk", "dtp", "persklaarmaken",
            "correctie", "freelance_redactie", "ebook_productie", "audiobook_productie",
            "overige_productie", "evenement", "marketingmateriaal", "offline_campagne",
            "boekhandelsmateriaal", "marketing_fee", "overige_offline_marketing",
            "online_ads", "productfotografie", "productie_ads", "software_kosten",
            "transactiekosten_pct", "cac_per_ex", "b2b_porto_per_ex", "b2b_korting_pct",
            "agent_pct", "vertaler_pct", "illustrator_pct",
        ]:
            titel_data["titel_input"][field] = 0.0
        titel_data["titel_input"]["fulfillment_per_ex"] = 4.50
        titel_data["titel_input"]["distributie_cb_per_ex"] = 1.10
        titel_data["titel_input"]["transactiekosten_pct"] = 0.02
        titel_data["titel_input"]["auteur_royalty_staffel"] = []
        titel_data["titel_input"]["agent_staffel"] = []
        titel_data["titel_input"]["vertaler_staffel"] = []
        titel_data["titel_input"]["illustrator_staffel"] = []
        titel_data["titel_input"]["heeft_partner"] = False
        titel_data["titel_input"]["partner_naam"] = ""

        storage.save_titel(tid, titel_data)
        count += 1

    return jsonify({"seeded": count})


# ── Oplage Simulatie ──

@bp.route("/api/simulate/oplage", methods=["POST"])
def simulate_oplage():
    """Simuleer P&L bij verschillende verkoopaantallen.
    Berekent netto resultaat incl. eenmalige kosten en voorschotten.
    Geeft 4 punten: huidige oplage, break-even, +5000, +10000.
    """
    data = request.get_json()
    ti = data.get("titel_input", {})
    verd_ws = data.get("verdeling_webshop", 0.10)
    verd_rt = data.get("verdeling_retail", 0.85)
    verd_b2b = data.get("verdeling_b2b", 0.05)

    # Get per-ex results from engine (for 1e druk = baseline)
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

    # The engine already amortizes eenmalige kosten into the per-ex result.
    # For the oplage sim, we want the result WITHOUT amortized eenmalige kosten,
    # then add them back as a fixed lump sum.
    eenmalige_per_ex = (
        ws["productie_per_ex"] * verd_ws + rt["productie_per_ex"] * verd_rt + b2b_k["productie_per_ex"] * verd_b2b
        + ws["offline_marketing_per_ex"] * verd_ws + rt["offline_marketing_per_ex"] * verd_rt + b2b_k["offline_marketing_per_ex"] * verd_b2b
    )
    # Variable winst per ex (without eenmalige kosten amortized)
    var_winst_per_ex = netto_winst_per_ex + eenmalige_per_ex

    # Fixed costs (eenmalige)
    totaal_eenmalig = calc.get("totaal_productie", 0) + calc.get("totaal_offline_marketing", 0)

    # Drukkosten for 1e druk (already in the per-ex figure, but we need total)
    drukken_config = ti.get("drukken", [])
    if not drukken_config:
        drukken_config = [{"druknummer": 1, "oplage": ti.get("oplage_1e_druk", 2000), "drukkosten_per_ex": ti.get("drukkosten_1e_druk", 1.20)}]

    # Total drukkosten as fixed investment
    totaal_drukkosten = sum(d.get("oplage", 0) * d.get("drukkosten_per_ex", 0) for d in drukken_config)
    totaal_oplage = sum(d.get("oplage", 0) for d in drukken_config)

    # Voorschotten (fixed upfront costs)
    auteur_voorschot = ti.get("auteur_voorschot", 0)
    agent_voorschot = ti.get("agent_voorschot", 0)
    vertaler_voorschot = ti.get("vertaler_voorschot", 0)
    illustrator_voorschot = ti.get("illustrator_voorschot", 0)
    extra_derden_voorschot = sum(d.get("voorschot", 0) for d in ti.get("extra_derden", []) if d.get("type") == "royalty")
    totaal_voorschotten = auteur_voorschot + agent_voorschot + vertaler_voorschot + illustrator_voorschot + extra_derden_voorschot

    # Fixed costs total
    totaal_fixed = totaal_eenmalig + totaal_voorschotten

    # Variable margin per ex (revenue - variable costs, excluding drukkosten which are per-druk)
    # We need: netto_omzet - (all variable costs except drukkosten and eenmalige) - royalties - winstdeling
    # Simplification: use var_winst_per_ex which already excludes eenmalige
    # But drukkosten ARE in the per-ex figure. We need to handle them separately for multi-druk.
    drukkosten_in_perex = ws["drukkosten"] * verd_ws + rt["drukkosten"] * verd_rt + b2b_k["drukkosten"] * verd_b2b
    pure_var_winst_per_ex = var_winst_per_ex + drukkosten_in_perex  # Add back drukkosten

    # Royalty per ex (from engine, already in netto_winst)
    royalty_per_ex = ws["auteur_royalty"] * verd_ws + rt["auteur_royalty"] * verd_rt + b2b_k["auteur_royalty"] * verd_b2b

    def calc_result_at_volume(vol):
        """Calculate net result at a given total volume sold."""
        # Revenue and variable costs (excluding drukkosten and eenmalige)
        var_result = vol * pure_var_winst_per_ex

        # Drukkosten: sum up per-druk, capped at the volume
        druk_costs = 0
        remaining = vol
        for d in sorted(drukken_config, key=lambda x: x.get("druknummer", 1)):
            druk_vol = min(remaining, d.get("oplage", 0))
            druk_costs += druk_vol * d.get("drukkosten_per_ex", 0)
            remaining -= druk_vol
            if remaining <= 0:
                break
        # If volume exceeds all configured drukken, use last druk's cost
        if remaining > 0 and drukken_config:
            last_druk = drukken_config[-1]
            druk_costs += remaining * last_druk.get("drukkosten_per_ex", 1.20)

        # Voorschot effect on royalty:
        # Total royalty owed = vol * royalty_per_ex
        # Effective royalty cost = max(voorschot, vol * royalty_per_ex) if royalty model
        # But the per-ex already includes royalty. We need to adjust.
        # Actually simpler: the engine's netto_winst already deducts royalty.
        # The voorschot is an additional fixed cost (paid upfront).
        # The royalty gets deducted from voorschot, so effective extra cost = max(0, voorschot - vol * royalty_per_ex)
        # Wait: voorschot IS paid. If royalty > voorschot, extra royalty flows.
        # Total royalty cost to Maven = max(voorschot, vol * royalty_per_ex)
        # In the per-ex, royalty is already counted. So engine gives: vol * (revenue - costs - royalty)
        # We need to add back the royalty and replace with: max(voorschot, vol * royalty_per_ex)
        # Net result = var_result - druk_costs - totaal_eenmalig - max(auteur_voorschot, vol * royalty_per_ex)
        # ... but this gets complex with multiple voorschotten per derde.

        # Simpler approach: fixed costs = eenmalige + voorschotten as paid-upfront.
        # The engine already deducts royalty per ex. The voorschot doesn't change per-ex royalty,
        # it's simply an advance that gets recouped. For the P&L sim:
        # If total royalty earned by author < voorschot: no extra royalty cost (voorschot covers it)
        #   Net result = vol * (omzet - var_costs_ex_royalty) - druk_costs - eenmalig - voorschot
        # If total royalty > voorschot: extra royalty = total_royalty - voorschot
        #   Net result = vol * (omzet - var_costs_ex_royalty) - druk_costs - eenmalig - total_royalty

        # Per-ex result WITH royalty deducted = pure_var_winst_per_ex - drukkosten_per_ex
        # Per-ex result WITHOUT royalty = above + royalty_per_ex
        # Total earned royalty at vol = vol * royalty_per_ex
        # Effective royalty payment = max(totaal_voorschotten, vol * royalty_per_ex)

        total_royalty_earned = vol * royalty_per_ex if royalty_per_ex > 0 else 0
        effective_royalty_cost = max(totaal_voorschotten, total_royalty_earned) if royalty_per_ex > 0 else totaal_voorschotten

        # Net result = vol * (per_ex_winst + royalty_per_ex) - druk_costs - eenmalig - effective_royalty
        winst_ex_royalty_per_ex = pure_var_winst_per_ex + royalty_per_ex  # add back royalty
        net_result = vol * winst_ex_royalty_per_ex - druk_costs - totaal_eenmalig - effective_royalty_cost

        total_omzet = vol * netto_omzet_per_ex
        marge = net_result / total_omzet if total_omzet > 0 else -10

        voorschot_ingelopen = total_royalty_earned >= totaal_voorschotten if totaal_voorschotten > 0 else True

        return {
            "oplage": vol,
            "omzet": round(total_omzet, 2),
            "kosten": round(total_omzet - net_result, 2),
            "netto_resultaat": round(net_result, 2),
            "marge_pct": round(marge, 4),
            "is_break_even": False,
            "voorschot_ingelopen": voorschot_ingelopen,
        }

    # Find break-even via binary search
    def find_break_even():
        # Check profitability at small and large volumes
        r_at_1 = calc_result_at_volume(1)
        r_high = calc_result_at_volume(200000)

        # If already profitable at 1 copy (no fixed costs), no meaningful break-even
        if r_at_1["netto_resultaat"] >= 0:
            return None

        # If still unprofitable at 200k, no break-even possible
        if r_high["netto_resultaat"] < 0:
            return None

        low, high = 1, 200000
        for _ in range(50):
            mid = (low + high) // 2
            r_mid = calc_result_at_volume(mid)
            if r_mid["netto_resultaat"] < 0:
                low = mid
            else:
                high = mid
            if high - low <= 10:
                break

        # Round to nearest 50
        be = ((high + 24) // 50) * 50
        return max(be, 50)

    break_even = find_break_even()

    # Build 4 simulation points
    volumes = set()
    volumes.add(totaal_oplage)  # Current total oplage
    if break_even is not None and break_even > 0:
        volumes.add(break_even)
    volumes.add(totaal_oplage + 5000)
    volumes.add(totaal_oplage + 10000)

    # If break-even equals one of the others, add another point
    if len(volumes) < 4:
        volumes.add(totaal_oplage + 20000)

    sorted_vols = sorted(volumes)[:4]

    rows = []
    for vol in sorted_vols:
        row = calc_result_at_volume(vol)
        if break_even is not None and vol == break_even:
            row["is_break_even"] = True
        rows.append(row)

    return jsonify({
        "rows": rows,
        "break_even_oplage": break_even,
    })


# ── CSV Import ──

@bp.route("/api/import/csv", methods=["POST"])
def import_csv_file():
    """Import titels vanuit een CSV-bestand.
    Verwacht kolommen: titel, auteur, isbn, druknummer
    Optioneel: verkoopprijs_incl_btw, oplage_1e_druk, drukkosten_1e_druk, boekhandelskorting, etc.
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
        fieldnames = reader.fieldnames or []

    count = 0
    for row in reader:
        # Normalize keys: strip whitespace, lowercase
        row = {k.strip().lower(): v.strip() for k, v in row.items() if k}

        titel = row.get("titel", "").strip()
        if not titel:
            continue

        auteur = row.get("auteur", "")
        isbn = row.get("isbn", "")

        # Parse druknummer
        druk_raw = row.get("druknummer", row.get("druk", "1"))
        try:
            druknummer = max(1, int(druk_raw))
        except (ValueError, TypeError):
            druknummer = 1

        # Optional numeric fields
        def parse_float(key, default=0.0):
            v = row.get(key, "")
            if not v:
                return default
            try:
                return float(v.replace(",", "."))
            except (ValueError, TypeError):
                return default

        tid = storage.new_id()
        titel_data = {
            "titel_input": {
                "titel": titel,
                "auteur": auteur,
                "isbn": isbn,
                "druknummer": druknummer,
                "verschijningsdatum": row.get("verschijningsdatum", ""),
                "verschenen": druknummer >= 1,
                "verkoopprijs_incl_btw": parse_float("verkoopprijs_incl_btw", 20.0),
                "btw_percentage": parse_float("btw_percentage", 0.09),
                "boekhandelskorting": parse_float("boekhandelskorting", 0.48),
                "oplage_1e_druk": int(parse_float("oplage_1e_druk", 2000)),
                "drukkosten_1e_druk": parse_float("drukkosten_1e_druk", 1.20),
                "drukkosten_herdruk": parse_float("drukkosten_herdruk", 1.20),
                "auteur_winstdeling_pct": parse_float("auteur_winstdeling_pct", 0.50),
                "gebruik_kostenposten": True,
                "kostenposten": [],
                "extra_derden": [],
                "overige_kosten_items": [],
                "overige_kosten_pct": 0.0,
                # Default zero fields
                "vormgeving_omslag": 0.0, "vormgeving_binnenwerk": 0.0,
                "dtp": 0.0, "persklaarmaken": 0.0, "correctie": 0.0,
                "freelance_redactie": 0.0, "ebook_productie": 0.0,
                "audiobook_productie": 0.0, "overige_productie": 0.0,
                "evenement": 0.0, "marketingmateriaal": 0.0,
                "offline_campagne": 0.0, "boekhandelsmateriaal": 0.0,
                "marketing_fee": 0.0, "overige_offline_marketing": 0.0,
                "online_ads": 0.0, "productfotografie": 0.0,
                "productie_ads": 0.0, "software_kosten": 0.0,
                "transactiekosten_pct": 0.02,
                "fulfillment_per_ex": 4.50,
                "cac_per_ex": 0.0,
                "distributie_cb_per_ex": 1.10,
                "b2b_porto_per_ex": 0.0, "b2b_korting_pct": 0.0,
                "agent_pct": 0.0, "vertaler_pct": 0.0, "illustrator_pct": 0.0,
                "auteur_royalty_staffel": [],
                "agent_staffel": [], "vertaler_staffel": [], "illustrator_staffel": [],
                "heeft_partner": False, "partner_naam": "",
            },
            "herdruk_oplages": [],
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

    writer.writerow(["EENMALIGE KOSTEN"])
    writer.writerow(["Productie", f"{res['totaal_productie']:.2f}"])
    writer.writerow(["Offline marketing", f"{res['totaal_offline_marketing']:.2f}"])
    writer.writerow(["Online marketing", f"{res['totaal_online_marketing']:.2f}"])
    writer.writerow(["Drukkosten 1e druk", f"{res['drukkosten_totaal_1e']:.2f}"])
    writer.writerow([])

    for druk in res["drukken"]:
        writer.writerow([druk["druk_type"].upper(), f"Oplage: {druk['oplage']}"])
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
