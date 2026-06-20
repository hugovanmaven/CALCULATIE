"""
Reken-laag van de Resultaten-module — de nacalculatie.

Voegt **werkelijkheid** (sales + geboekte Exact-kosten) samen met het **recept**
(de calculatie) tot een gerealiseerde marge per titel(groep) en voor Maven als
geheel. Hergebruikt de tarief-/staffellogica uit ``calculatie.py``; de calculatie
blijft de enige bron van waarheid voor tarieven en deals (Resultaten leest alleen).

Model (vastgesteld met Hugo):
- **Omzet** = echte netto-omzet uit sales (niet de recept-prijs).
- Per **stroom** ``max(begroot, geboekt)``: begroot uit het recept × werkelijk
  verkochte stuks; geboekt uit Exact (``res_kosten_geboekt``). Nooit geflatteerd
  door late facturen; een overschrijding telt direct mee.
- **Productie = kostprijs/ex × verkochte stuks** (COGS), excl. marketing.
- **Campagne** komt uit Exact (per ISBN geboekt); recept-marketing als begroting.
- **Royalty** via de staffel op het **groep-cumulatief** (SFP-opening uit
  ``res_historie`` + sales vóór de periode), tarief × verkochte stuks.
- Afgezet tegen streef **35 %** / ondergrens **30 %** (brutowinst/netto-omzet,
  vóór winstdeling); 'resultaat' = ná winstdeling.
- Huidig kwartaal zonder definitieve kosten: geboekt ≈ 0 → valt vanzelf terug op
  begroot.
"""

from ..calculatie import TitelInput, StaffelTrede, bereken_gemiddeld_staffel_percentage
from ..storage_calculatie import get_titel, load_all
from .models import KostenGeboekt, Historie
from . import sales_sync

STREEF_PCT = 0.35
ONDERGRENS_PCT = 0.30

# Exact-stroom/categorie → resultaten-stroom (de 5 zichtbare stromen)
STROOM_LABELS = {
    "productie": "Productie (COGS)",
    "vast": "Vaste / kanaalkosten",
    "campagne": "Campagne",
    "royalty": "Royalty & derden",
    "overig": "Overig",
}


# ── Recept → TitelInput (zelfstandig, hangt niet aan routes/) ────────────

def _staffel(rows) -> list[StaffelTrede]:
    return [StaffelTrede(tot_exemplaren=int(s.get("tot_exemplaren", 0)),
                         percentage=float(s.get("percentage", 0))) for s in (rows or [])]


def _titel_input(ti: dict) -> TitelInput:
    """Bouw een TitelInput uit het opgeslagen recept-dict (subset die we nodig
    hebben voor de nacalculatie)."""
    return TitelInput(
        titel=ti.get("titel", ""),
        isbn=ti.get("isbn", ""),
        verkoopprijs_incl_btw=float(ti.get("verkoopprijs_incl_btw", 0) or 0),
        btw_percentage=float(ti.get("btw_percentage", 0.09) or 0.09),
        boekhandelskorting=float(ti.get("boekhandelskorting", 0.48) or 0),
        transactiekosten_pct=float(ti.get("transactiekosten_pct", 0.002) or 0),
        fulfillment_per_ex=float(ti.get("fulfillment_per_ex", 0) or 0),
        cac_per_ex=float(ti.get("cac_per_ex", 0) or 0),
        distributie_cb_per_ex=float(ti.get("distributie_cb_per_ex", 0) or 0),
        b2b_porto_per_ex=float(ti.get("b2b_porto_per_ex", 0) or 0),
        b2b_korting_pct=float(ti.get("b2b_korting_pct", 0) or 0),
        auteur_winstdeling_pct=float(ti.get("auteur_winstdeling_pct", 0) or 0),
        auteur_royalty_staffel=_staffel(ti.get("auteur_royalty_staffel")),
        agent_staffel=_staffel(ti.get("agent_staffel")),
        agent_pct=float(ti.get("agent_pct", 0) or 0),
        agent_winstdeling_pct=float(ti.get("agent_winstdeling_pct", 0) or 0),
        vertaler_staffel=_staffel(ti.get("vertaler_staffel")),
        vertaler_pct=float(ti.get("vertaler_pct", 0) or 0),
        vertaler_winstdeling_pct=float(ti.get("vertaler_winstdeling_pct", 0) or 0),
        overige_kosten_pct=float(ti.get("overige_kosten_pct", 0) or 0),
    )


def _laatste_druk(ti: dict) -> dict:
    drukken = ti.get("drukken") or []
    if not drukken:
        return {"oplage": 0, "drukkosten_per_ex": 0.0, "kostenposten": []}
    return max(drukken, key=lambda d: d.get("druknummer", 0))


def _staffel_pct(staffel, start, aantal) -> float:
    if not staffel or aantal <= 0:
        return 0.0
    return bereken_gemiddeld_staffel_percentage(staffel, start + 1, aantal)


# ── Geboekt (Exact) ──────────────────────────────────────────────────────

def _geboekt_per_stroom(isbn: str, periode: str | None) -> dict:
    """Som geboekte Exact-kosten per resultaten-stroom voor een ISBN."""
    uit = {k: 0.0 for k in STROOM_LABELS}
    if not isbn:
        return uit
    q = KostenGeboekt.query.filter_by(isbn=isbn)
    if periode:
        q = q.filter(KostenGeboekt.periode == periode)
    for r in q.all():
        if r.categorie == "campagne":
            stroom = "campagne"
        elif r.stroom in ("kosten_per_ex",) and r.categorie == "productie":
            stroom = "productie"
        elif r.stroom == "vast":
            stroom = "vast"
        elif r.stroom in ("royalty", "winstdeling"):
            stroom = "royalty"
        else:
            stroom = "overig"
        uit[stroom] += float(r.bedrag or 0)
    return {k: round(v, 2) for k, v in uit.items()}


# ── Kern: één titel(groep) ────────────────────────────────────────────────

def bereken_titel(recept_id: str, periode: str | None = "2026") -> dict | None:
    """Nacalculatie voor één titel(groep) over een periode (jaar of '2026-Q2')."""
    rec = get_titel(recept_id)
    if not rec:
        return None
    ti = rec.get("titel_input", {})
    t = _titel_input(ti)

    titel_naam = sales_sync.titel_naam_voor_isbn(t.isbn) or t.titel
    agg = sales_sync.aggregeer_titel(titel_naam, periode)
    per_kanaal = agg["per_kanaal"]
    totaal_stuks = sum(k["stuks"] for k in per_kanaal.values())
    netto_omzet = round(sum(k["omzet"] for k in per_kanaal.values()), 2)

    # Royalty-staffel op groep-cumulatief: SFP-opening + sales vóór periode
    sfp_opening = sum(int(h.cumulatief_stuks or 0)
                      for h in Historie.query.filter_by(titel_naam=titel_naam).all())
    opening = sfp_opening + sales_sync.cumulatief_voor_periode(titel_naam, periode)

    vkp_ex = t.verkoopprijs_incl_btw / (1 + t.btw_percentage) if t.btw_percentage else t.verkoopprijs_incl_btw

    # ── Begroot per stroom (recept × werkelijk verkocht) ──
    druk = _laatste_druk(ti)
    oplage = int(druk.get("oplage") or 0) or 1
    posten = druk.get("kostenposten") or []
    productie_post = sum(float(p.get("bedrag", 0) or 0) for p in posten if p.get("categorie") == "productie")
    marketing_post = sum(float(p.get("bedrag", 0) or 0) for p in posten
                         if p.get("categorie") in ("offline_marketing", "online_marketing"))
    productie_cogs_ex = float(druk.get("drukkosten_per_ex") or 0) + productie_post / oplage

    # Vaste/kanaalkosten op de werkelijke kanaalmix
    vast = 0.0
    for kanaal, d in per_kanaal.items():
        stuks = d["stuks"]
        if kanaal == "retail":
            vast += t.distributie_cb_per_ex * stuks
        elif kanaal == "webshop":
            vast += (t.fulfillment_per_ex + t.verkoopprijs_incl_btw * t.transactiekosten_pct
                     + t.cac_per_ex) * stuks
        elif kanaal == "b2b":
            vast += t.b2b_porto_per_ex * stuks

    # Royalty & derden in royalty-mode (per ex × VKP ex BTW), staffel @ cumulatief
    roy_pct = 0.0
    if t.auteur_royalty_staffel:
        roy_pct += _staffel_pct(t.auteur_royalty_staffel, opening, totaal_stuks)
    if t.agent_staffel:
        roy_pct += _staffel_pct(t.agent_staffel, opening, totaal_stuks)
    elif t.agent_pct:
        roy_pct += t.agent_pct
    if t.vertaler_staffel:
        roy_pct += _staffel_pct(t.vertaler_staffel, opening, totaal_stuks)
    elif t.vertaler_pct:
        roy_pct += t.vertaler_pct
    royalty_begroot = vkp_ex * roy_pct * totaal_stuks

    begroot = {
        "productie": round(productie_cogs_ex * totaal_stuks, 2),
        "vast": round(vast, 2),
        "campagne": round(marketing_post / oplage * totaal_stuks, 2),
        "royalty": round(royalty_begroot, 2),
        "overig": round(netto_omzet * t.overige_kosten_pct, 2),
    }
    geboekt = _geboekt_per_stroom(t.isbn, periode if periode and "-" in str(periode) else None)

    # ── max(begroot, geboekt) per stroom ──
    stromen = []
    kosten_totaal = 0.0
    for key, label in STROOM_LABELS.items():
        b = begroot.get(key, 0.0)
        g = geboekt.get(key, 0.0)
        gebruikt = max(b, g)
        kosten_totaal += gebruikt
        stromen.append({
            "key": key, "label": label,
            "begroot": round(b, 2), "geboekt": round(g, 2), "gebruikt": round(gebruikt, 2),
            "overschrijding": g > b + 0.005,
        })

    brutowinst = round(netto_omzet - kosten_totaal, 2)
    marge_pct = round(brutowinst / netto_omzet, 4) if netto_omzet else 0.0

    # Winstdeling (% van brutowinst) → resultaat
    wd_pct = (t.auteur_winstdeling_pct + t.agent_winstdeling_pct
              + t.vertaler_winstdeling_pct)
    winstdeling = round(max(brutowinst, 0) * wd_pct, 2)
    resultaat = round(brutowinst - winstdeling, 2)
    resultaat_marge = round(resultaat / netto_omzet, 4) if netto_omzet else 0.0

    geboekt_totaal = sum(geboekt.values())
    dekkingsgraad = round(geboekt_totaal / kosten_totaal, 4) if kosten_totaal else 0.0

    return {
        "recept_id": recept_id,
        "titel": t.titel,
        "isbn": t.isbn,
        "titel_naam": titel_naam,
        "periode": periode,
        "verkocht": {"totaal": totaal_stuks,
                     "per_kanaal": {k: v["stuks"] for k, v in per_kanaal.items()}},
        "netto_omzet": netto_omzet,
        "kanalen": per_kanaal,
        "vormen": agg["per_vorm"],
        "stromen": stromen,
        "kosten_totaal": round(kosten_totaal, 2),
        "brutowinst": brutowinst,
        "marge_pct": marge_pct,
        "winstdeling": winstdeling,
        "resultaat": resultaat,
        "resultaat_marge_pct": resultaat_marge,
        "royalty_staffel_pct": round(roy_pct, 4),
        "cumulatief_opening": opening,
        "dekkingsgraad_pct": dekkingsgraad,
        "streef_pct": STREEF_PCT,
        "ondergrens_pct": ONDERGRENS_PCT,
        "status": _status(marge_pct),
    }


def _status(marge_pct: float) -> str:
    if marge_pct >= STREEF_PCT:
        return "groen"
    if marge_pct >= ONDERGRENS_PCT:
        return "oranje"
    return "rood"


# ── Overzicht: alle titels + Maven-totaal ─────────────────────────────────

def bereken_overzicht(periode: str | None = "2026") -> dict:
    """Alle recepten met sales + een Maven-totaalregel."""
    titels = []
    som = {"netto_omzet": 0.0, "kosten_totaal": 0.0, "brutowinst": 0.0,
           "winstdeling": 0.0, "resultaat": 0.0, "stuks": 0}
    for rid, rec in load_all().items():
        r = bereken_titel(rid, periode)
        if not r or r["netto_omzet"] == 0:
            continue
        titels.append(r)
        som["netto_omzet"] += r["netto_omzet"]
        som["kosten_totaal"] += r["kosten_totaal"]
        som["brutowinst"] += r["brutowinst"]
        som["winstdeling"] += r["winstdeling"]
        som["resultaat"] += r["resultaat"]
        som["stuks"] += r["verkocht"]["totaal"]

    titels.sort(key=lambda x: x["netto_omzet"], reverse=True)
    omzet = som["netto_omzet"]
    marge = round(som["brutowinst"] / omzet, 4) if omzet else 0.0
    maven = {
        "netto_omzet": round(omzet, 2),
        "kosten_totaal": round(som["kosten_totaal"], 2),
        "brutowinst": round(som["brutowinst"], 2),
        "winstdeling": round(som["winstdeling"], 2),
        "resultaat": round(som["resultaat"], 2),
        "stuks": som["stuks"],
        "marge_pct": marge,
        "resultaat_marge_pct": round((som["resultaat"]) / omzet, 4) if omzet else 0.0,
        "streef_pct": STREEF_PCT,
        "ondergrens_pct": ONDERGRENS_PCT,
        "status": _status(marge),
        "aantal_titels": len(titels),
    }
    return {"periode": periode, "maven_totaal": maven, "titels": titels}
