"""
Reken-laag van de Resultaten-module — de nacalculatie.

Voegt **werkelijkheid** (sales + geboekte Exact-kosten) samen met het **recept**
(de calculatie) tot een gerealiseerde marge per titel(groep) en voor Maven als
geheel. Hergebruikt de tarief-/staffellogica uit ``calculatie.py``; de calculatie
blijft de enige bron van waarheid voor tarieven en deals (Resultaten leest alleen).

Model (vastgesteld met Hugo):
- **Omzet** = echte netto-omzet uit sales (niet de recept-prijs).
- Twee soorten stromen:
  - **Boekbaar** (productie, campagne, overig): per stroom ``max(begroot,
    geboekt)`` — begroot uit het recept × werkelijk verkochte stuks; geboekt
    uit Exact (``res_kosten_geboekt``). Nooit geflatteerd door late facturen;
    een overschrijding telt direct mee.
  - **Berekend** (kanaalkosten, royalty & derden): worden niet per titel in
    Exact geboekt — de app rekent ze zelf uit het recept × verkochte stuks.
    Geen begroot/geboekt-vergelijking; wat er tóch in Exact op staat (bv. een
    royalty-voorschot) tonen we informatief maar tellen we niet dubbel.
- **Productie = kostprijs/ex × verkochte stuks**, gewogen over alle drukken
  (totale drukkosten + productie-posten / totale oplage), excl. marketing.
- **Kanaalkosten per verkocht exemplaar** op de werkelijke kanaalmix.
- **Royalty** via de staffel op het **groep-cumulatief** (SFP-opening uit
  ``res_historie`` + sales vóór de periode), tarief × verkochte stuks. Per
  partij (auteur/agent/vertaler/illustrator/extra derden) óf royalty óf
  winstdeling — zelfde semantiek als de engine.
- **Winstdeling** = % van brutowinst (netto-omzet − alle kosten, dus inclusief
  royalty's: bij een winstdelingstitel mét royalty drukt de royalty op de te
  verdelen pot).
- Status groen/oranje/rood op **resultaat ná winstdeling / netto-omzet**,
  afgezet tegen streef **35 %** / ondergrens **30 %** (alle kosten, inclusief
  winstdelingen, eraf — finance-definitie).
- Huidig kwartaal zonder definitieve kosten: geboekt ≈ 0 → valt vanzelf terug op
  begroot.
"""

from ..calculatie import ExtraDerde, TitelInput, StaffelTrede, bereken_gemiddeld_staffel_percentage
from ..storage_calculatie import get_titel, load_all
from .models import KostenGeboekt, Historie, Verklaring, KwartaalStatus
from . import sales_sync

STREEF_PCT = 0.35
ONDERGRENS_PCT = 0.30

# Exact-stroom/categorie → resultaten-stroom (de 5 zichtbare stromen).
# Terminologie volgt de calculatie-app (geen COGS).
STROOM_LABELS = {
    "productie": "Drukkosten & productie",
    "vast": "Kanaalkosten",
    "campagne": "Marketing & campagne",
    "royalty": "Royalty & derden",
    "overig": "Overige kosten",
}

# Stromen die de app zelf berekent (recept × verkochte stuks) en die niet per
# titel in Exact geboekt worden — geen begroot/geboekt-vergelijking.
BEREKENDE_STROMEN = {"vast", "royalty"}


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
        illustrator_staffel=_staffel(ti.get("illustrator_staffel")),
        illustrator_pct=float(ti.get("illustrator_pct", 0) or 0),
        illustrator_winstdeling_pct=float(ti.get("illustrator_winstdeling_pct", 0) or 0),
        extra_derden=[ExtraDerde(
            id=d.get("id", ""), naam=d.get("naam", ""),
            type=d.get("type", "royalty"),
            percentage=float(d.get("percentage", 0) or 0),
            staffel=_staffel(d.get("staffel")),
            voorschot=float(d.get("voorschot", 0) or 0),
        ) for d in (ti.get("extra_derden") or [])],
        auteur_voorschot=float(ti.get("auteur_voorschot", 0) or 0),
        agent_voorschot=float(ti.get("agent_voorschot", 0) or 0),
        vertaler_voorschot=float(ti.get("vertaler_voorschot", 0) or 0),
        illustrator_voorschot=float(ti.get("illustrator_voorschot", 0) or 0),
        overige_kosten_pct=float(ti.get("overige_kosten_pct", 0) or 0),
    )


def _voorschotten(t: TitelInput, vkp_ex: float, cum_einde: int) -> list[dict]:
    """Voorschot-inloopstatus per partij — informatief, telt niet in de marge.

    Verdiend = cumulatieve royalty over het hele leven van de titel(groep)
    (staffel of vast % × VKP ex BTW × cumulatief verkocht t/m einde periode,
    incl. SFP-opening). Ingelopen = min(voorschot, verdiend); niet-terugvorderbaar,
    dus nooit een claw-back. Alleen partijen met voorschot én actieve royalty-deal
    (zelfde regel als de engine: zonder royalty-stroom valt er niets in te lopen).
    """
    uit = []

    def _partij(naam, voorschot, staffel, pct):
        if voorschot <= 0 or (not staffel and pct <= 0):
            return
        gem = _staffel_pct(staffel, 0, cum_einde) if staffel else pct
        verdiend = round(vkp_ex * gem * cum_einde, 2)
        ingelopen = round(min(voorschot, verdiend), 2)
        uit.append({"partij": naam, "voorschot": round(voorschot, 2),
                    "verdiend": verdiend, "ingelopen": ingelopen,
                    "open": round(voorschot - ingelopen, 2)})

    _partij("Auteur", t.auteur_voorschot, t.auteur_royalty_staffel, 0.0)
    _partij("Agent", t.agent_voorschot, t.agent_staffel, t.agent_pct)
    _partij("Vertaler", t.vertaler_voorschot, t.vertaler_staffel, t.vertaler_pct)
    _partij("Illustrator", t.illustrator_voorschot, t.illustrator_staffel, t.illustrator_pct)
    for ed in t.extra_derden:
        if ed.type == "royalty":
            _partij(ed.naam or "Extra derde", ed.voorschot or 0.0, ed.staffel, ed.percentage or 0.0)
    return uit


def _productie_per_ex(ti: dict) -> float:
    """Gewogen productie-kostprijs per exemplaar over álle drukken.

    (Σ drukkosten + Σ productie-kostenposten) / totale oplage — verkochte
    exemplaren komen uit meerdere drukken; sales kent geen druknummer, dus
    wegen is eerlijker dan alles tegen de laatste druk rekenen.
    """
    drukken = ti.get("drukken") or []
    if not drukken:
        return 0.0
    tot_kosten = 0.0
    tot_oplage = 0
    for d in drukken:
        oplage = int(d.get("oplage") or 0)
        tot_oplage += oplage
        tot_kosten += float(d.get("drukkosten_per_ex") or 0) * oplage
        tot_kosten += sum(float(p.get("bedrag", 0) or 0)
                          for p in (d.get("kostenposten") or [])
                          if p.get("categorie") == "productie")
    return tot_kosten / tot_oplage if tot_oplage else 0.0


def _marketing_per_ex(ti: dict) -> float:
    """Begrote marketing per exemplaar, gewogen over alle drukken."""
    drukken = ti.get("drukken") or []
    tot = 0.0
    tot_oplage = 0
    for d in drukken:
        tot_oplage += int(d.get("oplage") or 0)
        tot += sum(float(p.get("bedrag", 0) or 0)
                   for p in (d.get("kostenposten") or [])
                   if p.get("categorie") in ("offline_marketing", "online_marketing"))
    return tot / tot_oplage if tot_oplage else 0.0


def _staffel_pct(staffel, start, aantal) -> float:
    if not staffel or aantal <= 0:
        return 0.0
    return bereken_gemiddeld_staffel_percentage(staffel, start + 1, aantal)


# ── Periode-filter (één definitie voor alle KostenGeboekt-queries) ────────

def filter_periode(q, kolom, periode: str | None):
    """'2026-Q2' → exact kwartaal; '2026' → heel jaar; leeg → geen filter."""
    if periode and "-" in str(periode):
        return q.filter(kolom == periode)
    if periode:
        return q.filter(kolom.like(f"{periode}-%"))
    return q


# ── Overige verkoopkosten (verdeel-pool) ──────────────────────────────────

def pool_verdeeld(periode: str | None) -> float:
    """Som Exact-regels zonder titel met dispositie 'verdeeld' — de overige
    verkoopkosten die naar rato van omzet over de titels worden toegerekend."""
    q = filter_periode(KostenGeboekt.query.filter_by(isbn="", dispositie="verdeeld"),
                       KostenGeboekt.periode, periode)
    return round(sum(float(r.bedrag or 0) for r in q.all()), 2)


def _toegerekend(omzet: float, pool: float, totale_omzet: float) -> float:
    """Aandeel van de verdeel-pool voor een titel, naar rato van omzet."""
    if pool <= 0 or totale_omzet <= 0 or omzet <= 0:
        return 0.0
    return round(pool * omzet / totale_omzet, 2)


# ── Geboekt (Exact) ──────────────────────────────────────────────────────

def stroom_key(r) -> str:
    """Exact-regel → resultaten-stroom. Eén mapping voor backend én API-output
    (de frontend groepeert op deze key — geen gedupliceerde regels daar)."""
    if r.categorie == "campagne":
        return "campagne"
    if r.stroom == "kosten_per_ex" and r.categorie == "productie":
        return "productie"
    if r.stroom == "vast":
        return "vast"
    if r.stroom in ("royalty", "winstdeling"):
        return "royalty"
    return "overig"


def _geboekt_per_stroom(isbns, periode: str | None) -> dict:
    """Som geboekte Exact-kosten per resultaten-stroom voor één of meer ISBN's."""
    uit = {k: 0.0 for k in STROOM_LABELS}
    isbns = [i for i in ([isbns] if isinstance(isbns, str) else isbns) if i]
    if not isbns:
        return uit
    q = filter_periode(KostenGeboekt.query.filter(KostenGeboekt.isbn.in_(isbns)),
                       KostenGeboekt.periode, periode)
    for r in q.all():
        uit[stroom_key(r)] += float(r.bedrag or 0)
    return {k: round(v, 2) for k, v in uit.items()}


# ── Kern: één titel(groep) ────────────────────────────────────────────────

def bereken_titel(recept_id: str, periode: str | None = "2026",
                  *, pool: float | None = None, totale: float | None = None) -> dict | None:
    """Nacalculatie voor één titel(groep) over een periode (jaar of '2026-Q2').

    ``pool``/``totale`` (verdeel-pool + totale omzet) kunnen door de caller
    worden meegegeven zodat het overzicht ze niet per titel herberekent.
    """
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

    # Royalty-staffel op groep-cumulatief: SFP-opening + sales vóór periode.
    # SFP-historie matchen op titelnaam OF op deze ISBN — de SFP-titelnaam wijkt
    # soms af van de sales-naam, dan vangt de ISBN het losse-editie-deel nog.
    # (De volledige titelgroep-optelling over álle edities is een aparte, bewust
    # uitgestelde stap — zie de SFP↔sales-naammapping.)
    hist_rows = Historie.query.filter_by(titel_naam=titel_naam).all()
    if not hist_rows and t.isbn:
        hist_rows = Historie.query.filter_by(isbn=t.isbn).all()
    sfp_opening = sum(int(h.cumulatief_stuks or 0) for h in hist_rows)
    opening = sfp_opening + sales_sync.cumulatief_voor_periode(titel_naam, periode)

    vkp_ex = t.verkoopprijs_incl_btw / (1 + t.btw_percentage) if t.btw_percentage else t.verkoopprijs_incl_btw

    # ── Begroot per stroom (recept × werkelijk verkocht) ──
    # Productie & marketing per ex gewogen over alle drukken (sales kent geen
    # druknummer — wegen is eerlijker dan alles tegen de laatste druk).
    productie_ex = _productie_per_ex(ti)
    marketing_ex = _marketing_per_ex(ti)

    # Kanaalkosten per verkocht exemplaar, op de werkelijke kanaalmix.
    # Kanaal "overig" (onbekende bron) heeft geen kostenmodel → geen kosten,
    # wel zichtbaar in de kanalen-tabel.
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

    # Royalty & derden — engine-semantiek: per partij óf royalty óf winstdeling.
    # Royalty-mode telt hier (per ex × VKP ex BTW, staffel @ groep-cumulatief);
    # winstdeling-mode volgt verderop als % van brutowinst.
    roy_pct = 0.0
    if t.auteur_royalty_staffel:
        roy_pct += _staffel_pct(t.auteur_royalty_staffel, opening, totaal_stuks)
    if t.agent_winstdeling_pct <= 0:
        if t.agent_staffel:
            roy_pct += _staffel_pct(t.agent_staffel, opening, totaal_stuks)
        elif t.agent_pct:
            roy_pct += t.agent_pct
    if t.vertaler_winstdeling_pct <= 0:
        if t.vertaler_staffel:
            roy_pct += _staffel_pct(t.vertaler_staffel, opening, totaal_stuks)
        elif t.vertaler_pct:
            roy_pct += t.vertaler_pct
    if t.illustrator_winstdeling_pct <= 0:
        if t.illustrator_staffel:
            roy_pct += _staffel_pct(t.illustrator_staffel, opening, totaal_stuks)
        elif t.illustrator_pct:
            roy_pct += t.illustrator_pct
    for ed in t.extra_derden:
        if ed.type == "royalty":
            if ed.staffel:
                roy_pct += _staffel_pct(ed.staffel, opening, totaal_stuks)
            elif ed.percentage:
                roy_pct += ed.percentage
    royalty_begroot = vkp_ex * roy_pct * totaal_stuks

    begroot = {
        "productie": round(productie_ex * totaal_stuks, 2),
        "vast": round(vast, 2),
        "campagne": round(marketing_ex * totaal_stuks, 2),
        "royalty": round(royalty_begroot, 2),
        "overig": round(netto_omzet * t.overige_kosten_pct, 2),
    }
    geboekt = _geboekt_per_stroom(t.isbn, periode)

    # ── Verklaarlaag (calculatie-check): periode-status + bestaande verklaringen ──
    afgesloten = _periode_afgesloten(periode)
    verklaringen = {v.stroom: v for v in Verklaring.query.filter_by(
        periode=periode, calculatie_titel_id=recept_id).all()}

    # ── Per stroom: berekend gebruikt de app-berekening; boekbaar max(begroot,
    #    geboekt) + classificatie van het verschil (calculatie-check) ──
    stromen = []
    kosten_totaal = 0.0
    for key, label in STROOM_LABELS.items():
        b = begroot.get(key, 0.0)
        g = geboekt.get(key, 0.0)
        berekend = key in BEREKENDE_STROMEN
        # Berekende stromen: de app-berekening telt; wat er tóch in Exact op
        # staat (bv. royalty-voorschot) is informatief, nooit dubbel geteld.
        gebruikt = b if berekend else max(b, g)
        kosten_totaal += gebruikt
        v = verklaringen.get(key)
        st = "berekend" if berekend else _classificeer_stroom(b, g, v, afgesloten)
        stromen.append({
            "key": key, "label": label, "berekend": berekend,
            "begroot": round(b, 2), "geboekt": round(g, 2), "gebruikt": round(gebruikt, 2),
            "verschil": 0.0 if berekend else round(b - g, 2),
            "overschrijding": (not berekend) and g > b + 0.005,
            "status": st,
            "verklaring_status": v.status if v else "",
            "notitie": v.notitie if v else "",
        })

    accuratesse = _accuratesse(stromen)

    brutowinst = round(netto_omzet - kosten_totaal, 2)
    marge_pct = round(brutowinst / netto_omzet, 4) if netto_omzet else 0.0

    # Winstdeling (% van brutowinst) — engine-semantiek: auteur alleen zonder
    # royalty-staffel; plus agent/vertaler/illustrator/extra derden in
    # winstdeling-mode. Royalty's zitten al in brutowinst → drukken op de pot.
    wd_pct = (t.agent_winstdeling_pct + t.vertaler_winstdeling_pct
              + t.illustrator_winstdeling_pct)
    if not t.auteur_royalty_staffel:
        wd_pct += t.auteur_winstdeling_pct
    wd_pct += sum(ed.percentage or 0 for ed in t.extra_derden
                  if ed.type == "winstdeling")
    winstdeling = round(max(brutowinst, 0) * wd_pct, 2)
    resultaat = round(brutowinst - winstdeling, 2)
    resultaat_marge = round(resultaat / netto_omzet, 4) if netto_omzet else 0.0

    # Toegerekende overige verkoopkosten: aandeel van de verdeel-pool naar rato
    # van omzet. Verlaagt het titel-resultaat verder (na winstdeling).
    if pool is None:
        pool = pool_verdeeld(periode)
    if totale is None:
        totale = sales_sync.totale_omzet(periode)
    overige_verkoopkosten = _toegerekend(netto_omzet, pool, totale)
    resultaat_na_verdeling = round(resultaat - overige_verkoopkosten, 2)
    resultaat_na_verdeling_marge = round(resultaat_na_verdeling / netto_omzet, 4) if netto_omzet else 0.0

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
        "winstdeling_pct": round(wd_pct, 4),
        "resultaat": resultaat,
        "resultaat_marge_pct": resultaat_marge,
        "overige_verkoopkosten": overige_verkoopkosten,
        "resultaat_na_verdeling": resultaat_na_verdeling,
        "resultaat_na_verdeling_marge_pct": resultaat_na_verdeling_marge,
        "royalty_staffel_pct": round(roy_pct, 4),
        "cumulatief_opening": opening,
        "voorschotten": _voorschotten(t, vkp_ex, opening + totaal_stuks),
        "streef_pct": STREEF_PCT,
        "ondergrens_pct": ONDERGRENS_PCT,
        "status": _status(resultaat_marge),
        "afgesloten": afgesloten,
        "accuratesse": accuratesse,
    }


def _periode_afgesloten(periode: str | None) -> bool:
    if not periode:
        return False
    s = KwartaalStatus.query.filter_by(periode=periode).first()
    return bool(s and s.afgesloten)


def _classificeer_stroom(b: float, g: float, verklaring, afgesloten: bool) -> str:
    """Status van het verschil begroot↔geboekt (de calculatie-check)."""
    if b <= 0.005 and g <= 0.005:
        return "leeg"                       # geen post
    if g > b + 0.5:
        return "overschrijding"             # calc was te laag
    if g >= b - 0.5:
        return "geboekt"                    # geboekt ≈ begroot → klopt
    # gap: begroot > geboekt
    if verklaring and verklaring.status:
        return verklaring.status            # verwacht_nog | niet_gemaakt | verkeerd_geboekt | akkoord
    return "verwacht_nog" if not afgesloten else "onverklaard"


def _accuratesse(stromen: list[dict]) -> dict:
    """Samenvatting 'hoe goed was de calculatie' over de posten met inhoud."""
    from collections import Counter
    rel = [s for s in stromen if s["status"] not in ("leeg", "berekend")]
    c = Counter(s["status"] for s in rel)
    return {
        "posten": len(rel),
        "geboekt": c.get("geboekt", 0),
        "overschrijding": c.get("overschrijding", 0),
        "verwacht_nog": c.get("verwacht_nog", 0),
        "niet_gemaakt": c.get("niet_gemaakt", 0),
        "verkeerd_geboekt": c.get("verkeerd_geboekt", 0),
        "onverklaard": c.get("onverklaard", 0),
        "te_verklaren": c.get("onverklaard", 0),   # open punten voor de reminder
    }


def _status(resultaat_marge_pct: float) -> str:
    """Groen/oranje/rood op de marge ná winstdeling (alle kosten eraf)."""
    if resultaat_marge_pct >= STREEF_PCT:
        return "groen"
    if resultaat_marge_pct >= ONDERGRENS_PCT:
        return "oranje"
    return "rood"


# ── Overzicht: top-25 + backlist + Maven-totaal ───────────────────────────

TOP_N = 25


def _sales_only_titel(titel_naam: str, periode: str | None,
                      *, pool: float = 0.0, totale: float = 0.0) -> dict | None:
    """Nacalculatie-light voor een titel(groep) zónder calculatie-recept.

    Alleen wat we zeker weten: omzet/stuks uit sales + geboekte Exact-kosten
    op de ISBN's van deze naam. Geen recept → geen begrote royalty/kanaal-
    kosten; de UI markeert dit als 'zonder calculatie'.
    """
    from .models import SalesSnapshot

    agg = sales_sync.aggregeer_titel(titel_naam, periode)
    stuks = agg["totaal"]["stuks"]
    omzet = agg["totaal"]["omzet"]
    if not omzet and not stuks:
        return None
    isbns = {r.isbn for r in SalesSnapshot.query.filter_by(titel_naam=titel_naam).all()
             if r.isbn}
    kosten = round(sum(_geboekt_per_stroom(isbns, periode).values()), 2)
    brutowinst = round(omzet - kosten, 2)
    overige = _toegerekend(omzet, pool, totale)
    return {
        "recept_id": None,
        "titel": titel_naam,
        "isbn": sorted(isbns)[0] if isbns else "",
        "titel_naam": titel_naam,
        "periode": periode,
        "zonder_calculatie": True,
        "verkocht": {"totaal": stuks,
                     "per_kanaal": {k: v["stuks"] for k, v in agg["per_kanaal"].items()}},
        "netto_omzet": omzet,
        "kanalen": agg["per_kanaal"],
        "vormen": agg["per_vorm"],
        "stromen": [],
        "kosten_totaal": kosten,
        "brutowinst": brutowinst,
        "marge_pct": round(brutowinst / omzet, 4) if omzet else 0.0,
        "winstdeling": 0.0,
        "winstdeling_pct": 0.0,
        "resultaat": brutowinst,
        "resultaat_marge_pct": round(brutowinst / omzet, 4) if omzet else 0.0,
        "overige_verkoopkosten": overige,
        "resultaat_na_verdeling": round(brutowinst - overige, 2),
        "voorschotten": [],
        "status": "onbekend",
        "accuratesse": {"te_verklaren": 0},
    }


def bereken_overzicht(periode: str | None = "2026") -> dict:
    """Top-25 titels op omzet + backlist-bucket + Maven-totaal.

    Alle omzet telt mee in het Maven-totaal: recept-titels volledig
    nagecalculeerd, sales-only titels (geen recept) met omzet + geboekte
    kosten. De top-25 staat individueel in de tabel; de rest rolt op in
    één backlist-regel zodat het overzicht leesbaar blijft.
    """
    # Verdeel-pool + totale omzet één keer berekenen — bereken_titel zou ze
    # anders per titel opnieuw uit de DB halen.
    pool = pool_verdeeld(periode)
    totale = sales_sync.totale_omzet(periode)

    titels = []
    gedekte_namen = set()
    for rid, rec in load_all().items():
        r = bereken_titel(rid, periode, pool=pool, totale=totale)
        if not r:
            continue
        gedekte_namen.add(r["titel_naam"])
        if r["netto_omzet"] == 0:
            continue
        titels.append(r)

    # Sales-titels zonder recept (bv. oudere backlist) — omzet mag niet
    # onzichtbaar zijn in het Maven-totaal.
    for naam in sales_sync.titel_namen(periode):
        if naam in gedekte_namen:
            continue
        r = _sales_only_titel(naam, periode, pool=pool, totale=totale)
        if r:
            titels.append(r)

    titels.sort(key=lambda x: x["netto_omzet"], reverse=True)
    top = titels[:TOP_N]
    rest = titels[TOP_N:]

    def _som(items):
        s = {"netto_omzet": 0.0, "kosten_totaal": 0.0, "brutowinst": 0.0,
             "winstdeling": 0.0, "resultaat": 0.0, "stuks": 0, "te_verklaren": 0}
        for r in items:
            s["netto_omzet"] += r["netto_omzet"]
            s["kosten_totaal"] += r["kosten_totaal"]
            s["brutowinst"] += r["brutowinst"]
            s["winstdeling"] += r["winstdeling"]
            s["resultaat"] += r["resultaat"]
            s["stuks"] += r["verkocht"]["totaal"]
            s["te_verklaren"] += r["accuratesse"]["te_verklaren"]
        return s

    def _pool_aandeel(items):
        # Elk titel-dict draagt zijn toegerekende deel al bij zich.
        return round(sum(r["overige_verkoopkosten"] for r in items), 2)

    som = _som(titels)
    backlist = None
    if rest:
        b = _som(rest)
        omzet_b = b["netto_omzet"]
        overige_b = _pool_aandeel(rest)
        backlist = {
            "aantal_titels": len(rest),
            "zonder_calculatie": sum(1 for r in rest if r.get("zonder_calculatie")),
            "stuks": b["stuks"],
            "netto_omzet": round(omzet_b, 2),
            "kosten_totaal": round(b["kosten_totaal"], 2),
            "brutowinst": round(b["brutowinst"], 2),
            "winstdeling": round(b["winstdeling"], 2),
            "resultaat": round(b["resultaat"], 2),
            "overige_verkoopkosten": overige_b,
            "resultaat_na_verdeling": round(b["resultaat"] - overige_b, 2),
            "resultaat_marge_pct": round(b["resultaat"] / omzet_b, 4) if omzet_b else 0.0,
        }

    omzet = som["netto_omzet"]
    overige_totaal = _pool_aandeel(titels)   # ~= pool (afrondingsrest)
    resultaat_na_verdeling = round(som["resultaat"] - overige_totaal, 2)
    marge = round(som["brutowinst"] / omzet, 4) if omzet else 0.0
    resultaat_marge = round(som["resultaat"] / omzet, 4) if omzet else 0.0
    na_verdeling_marge = round(resultaat_na_verdeling / omzet, 4) if omzet else 0.0
    maven = {
        "netto_omzet": round(omzet, 2),
        "kosten_totaal": round(som["kosten_totaal"], 2),
        "brutowinst": round(som["brutowinst"], 2),
        "winstdeling": round(som["winstdeling"], 2),
        "resultaat": round(som["resultaat"], 2),
        "overige_verkoopkosten": overige_totaal,
        "resultaat_na_verdeling": resultaat_na_verdeling,
        "resultaat_na_verdeling_marge_pct": na_verdeling_marge,
        "stuks": som["stuks"],
        "marge_pct": marge,
        "resultaat_marge_pct": resultaat_marge,
        "streef_pct": STREEF_PCT,
        "ondergrens_pct": ONDERGRENS_PCT,
        "status": _status(resultaat_marge),
        "aantal_titels": len(titels),
        "te_verklaren": som["te_verklaren"],
        "afgesloten": _periode_afgesloten(periode),
    }
    return {"periode": periode, "maven_totaal": maven,
            "titels": top, "backlist": backlist,
            "overige_verkoopkosten_pool": pool}
