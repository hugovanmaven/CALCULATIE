"""
Sales-sync — verkoopdata in eigen DB (``res_sales_snapshot``) + aggregatie.

De gedeployede app kan de sales-MCP (een chat-tool) niet zelf aanroepen, dus
houden we een eigen snapshot. ``upsert_snapshot`` is **bron-onafhankelijk**: voed
het rijen — uit de MCP, een export, of een latere HTTP-sync — en het schrijft ze
idempotent weg. De aggregatie-helpers lezen die snapshot terug voor de reken-laag
(``bereken.py``) en de API.

Grain (v1): per editie (ISBN) × kanaal × bron × jaar × **kwartaal**. Het kwartaal
bewaren we in ``weeknummer`` als marker (Q1→1, Q2→14, Q3→27, Q4→40), zodat de
bestaande (isbn, kanaal, bron, jaar, weeknummer)-uniciteit per kwartaal idempotent
is én een week-range-filter het kwartaal vangt. Een latere week-fijne sync kan
dezelfde tabel vullen (met echte weeknummers) zonder schema-wijziging.
"""

from datetime import datetime

from .models import SalesSnapshot
from ..db import db


# bron (sales-dashboard) → engine-kanaal. calculatie.py rekent met retail/webshop/b2b.
# Al-genormaliseerde waarden (retail/webshop/b2b) worden ook geaccepteerd, zodat
# een export die zelf al kanalen benoemt bij een handmatige import net zo werkt.
BRON_KANAAL = {
    "centraal boekhuis": "retail",
    "shopify": "webshop",
    "moneybird b2b": "b2b",
    "retail": "retail", "webshop": "webshop", "b2b": "b2b",
}

# kwartaal → marker-weeknummer (startweek van het kwartaal)
KWARTAAL_MARKER = {1: 1, 2: 14, 3: 27, 4: 40}


def normaliseer_kanaal(bron: str) -> str:
    """'Centraal Boekhuis' → 'retail', 'retail' → 'retail'. Onbekend → 'overig'."""
    return BRON_KANAAL.get((bron or "").strip().lower(), "overig")


def _kwartaal_weken(kw: int) -> tuple[int, int]:
    lo = KWARTAAL_MARKER[kw]
    return lo, (53 if kw == 4 else lo + 12)


def _parse_periode(periode: str | None) -> tuple[int | None, int | None]:
    """'2026' → (2026, None); '2026-Q2' → (2026, 2); leeg → (None, None)."""
    if not periode:
        return None, None
    jaar, _, q = str(periode).partition("-")
    return int(jaar), (int(q.lstrip("Qq")) if q else None)


# ── Schrijven ──────────────────────────────────────────────────────────

def upsert_snapshot(rows, *, batch: str | None = None) -> dict:
    """Schrijf verkooprijen idempotent naar ``res_sales_snapshot``.

    ``rows``: dicts met ``isbn, titel_naam, vorm, bron, jaar, kwartaal, stuks,
    omzet``. Idempotent op (isbn, kanaal, bron, jaar, kwartaal-marker).
    """
    n_new = n_upd = 0
    now = datetime.utcnow()
    for r in rows:
        kanaal = normaliseer_kanaal(r["bron"])
        wk = KWARTAAL_MARKER[int(r["kwartaal"])]
        rec = SalesSnapshot.query.filter_by(
            isbn=r["isbn"], kanaal=kanaal, bron=r["bron"],
            jaar=int(r["jaar"]), weeknummer=wk,
        ).first()
        if rec is None:
            rec = SalesSnapshot(
                isbn=r["isbn"], kanaal=kanaal, bron=r["bron"],
                jaar=int(r["jaar"]), weeknummer=wk,
            )
            db.session.add(rec)
            n_new += 1
        else:
            n_upd += 1
        rec.titel_naam = r.get("titel_naam", "")
        rec.verschijningsvorm = r.get("vorm", "")
        rec.stuks = int(r.get("stuks") or 0)
        rec.omzet = round(float(r.get("omzet") or 0), 2)
        rec.snapshot_at = now
    db.session.commit()
    return {"nieuw": n_new, "bijgewerkt": n_upd, "rijen": len(rows)}


# ── Lezen / aggregeren ─────────────────────────────────────────────────

def _periode_query(periode: str | None):
    jaar, kw = _parse_periode(periode)
    q = SalesSnapshot.query
    if jaar:
        q = q.filter(SalesSnapshot.jaar == jaar)
    if kw:
        lo, hi = _kwartaal_weken(kw)
        q = q.filter(SalesSnapshot.weeknummer >= lo, SalesSnapshot.weeknummer <= hi)
    return q


def _jaren_met_data() -> set[int]:
    """Jaren waarvoor er íets is — verkoop (sales) óf geboekte Exact-kosten.

    Zo verschijnen er al kwartalen zodra je de Exact-export hebt geüpload, ook
    als de sales-snapshot nog leeg is."""
    from .models import KostenGeboekt
    jaren = {j for (j,) in SalesSnapshot.query.with_entities(SalesSnapshot.jaar).distinct().all() if j}
    for (p,) in KostenGeboekt.query.with_entities(KostenGeboekt.periode).distinct().all():
        if p and str(p)[:4].isdigit():
            jaren.add(int(str(p)[:4]))
    return jaren


def beschikbare_periodes() -> list[str]:
    """Periodes nieuw→oud: per jaar met data het jaartotaal + álle 4 kwartalen.

    We tonen alle kwartalen (ook lege), zodat Q3 niet 'ontbreekt' als er toevallig
    nog geen verkoop op staat — een leeg kwartaal is een geldig antwoord ('nog
    niets verkocht'), geen gat in de keuzelijst.
    """
    uit = []
    for j in sorted(_jaren_met_data(), reverse=True):
        uit.append(str(j))
        for kw in (4, 3, 2, 1):
            uit.append(f"{j}-Q{kw}")
    return uit


def _kwartalen_met_data() -> set[str]:
    """Kwartalen ('2026-Q2') met verkoop óf geboekte kosten."""
    from .models import KostenGeboekt
    uit = {str(p) for (p,) in KostenGeboekt.query.with_entities(KostenGeboekt.periode).distinct().all()
           if p and "-Q" in str(p)}
    for jaar, wk in SalesSnapshot.query.with_entities(SalesSnapshot.jaar, SalesSnapshot.weeknummer).distinct().all():
        kw = next((k for k, m in KWARTAAL_MARKER.items() if m == wk), None)
        if jaar and kw:
            uit.add(f"{jaar}-Q{kw}")
    return uit


def default_periode() -> str:
    """Kwartaal om standaard te openen: het meest recente **afgesloten** kwartaal,
    anders het nieuwste kwartaal met data, anders het nieuwste jaartotaal."""
    from .models import KwartaalStatus

    afgesloten = [s.periode for s in KwartaalStatus.query.filter_by(afgesloten=True).all()
                  if "-Q" in (s.periode or "")]
    if afgesloten:
        return sorted(afgesloten, reverse=True)[0]
    met_data = _kwartalen_met_data()
    if met_data:
        return sorted(met_data, reverse=True)[0]
    periodes = beschikbare_periodes()
    return periodes[0] if periodes else ""


def laatste_sync() -> str | None:
    """Tijdstip (ISO) van de meest recente sales-snapshot, of None als er nog
    geen sales geladen is."""
    from sqlalchemy import func
    ts = SalesSnapshot.query.with_entities(func.max(SalesSnapshot.snapshot_at)).scalar()
    return ts.isoformat() if ts else None


def titel_namen(periode: str | None = None) -> list[str]:
    """Alle titel(groep)-namen met verkoop in de periode (voor het overzicht)."""
    return sorted({r.titel_naam for r in _periode_query(periode).all() if r.titel_naam})


def totale_omzet(periode: str | None = None) -> float:
    """Totale netto-omzet over alle titels in de periode — verdeelsleutel voor
    de overige verkoopkosten (naar rato van omzet toerekenen)."""
    from sqlalchemy import func
    som = _periode_query(periode).with_entities(func.sum(SalesSnapshot.omzet)).scalar()
    return round(float(som or 0), 2)


def titel_naam_voor_isbn(isbn: str) -> str:
    """Vind de titel(groep)-naam waar een ISBN onder valt (recept → snapshot-link)."""
    r = SalesSnapshot.query.filter_by(isbn=(isbn or "")).first()
    return r.titel_naam if r else ""


def cumulatief_voor_periode(titel_naam: str, periode: str | None) -> int:
    """Som verkochte stuks van een titel(groep) strikt vóór de periode.

    Dient als opening voor de royalty-staffel (waar in de staffel de titel staat
    als de periode begint). Wordt opgeteld bij de SFP-opening uit ``res_historie``
    voor het volledige groep-cumulatief.
    """
    jaar, kw = _parse_periode(periode)
    if not jaar:
        return 0
    rows = SalesSnapshot.query.filter(SalesSnapshot.titel_naam == titel_naam).all()
    tot = 0
    for r in rows:
        r_kw = next((k for k, wk in KWARTAAL_MARKER.items() if wk == r.weeknummer), 1)
        voor = r.jaar < jaar or (kw and r.jaar == jaar and r_kw < kw)
        if voor:
            tot += int(r.stuks or 0)
    return tot


def aggregeer_titel(titel_naam: str, periode: str | None = None) -> dict:
    """Aggregeer een titel(groep) — alle vormen + edities samen.

    Geeft ``{"per_kanaal": {kanaal: {stuks, omzet, prijs_ex_btw}}, "per_vorm":
    {vorm: {stuks, omzet}}, "totaal": {stuks, omzet}}``. ``prijs_ex_btw`` is de
    werkelijke gemiddelde netto-prijs per ex (omzet/stuks) — de echte prijs uit
    sales, niet de recept-prijs.
    """
    per_kanaal: dict = {}
    per_vorm: dict = {}
    tot_stuks = 0
    tot_omzet = 0.0
    for r in _periode_query(periode).filter(SalesSnapshot.titel_naam == titel_naam).all():
        stuks = int(r.stuks or 0)
        omzet = float(r.omzet or 0)
        k = per_kanaal.setdefault(r.kanaal, {"stuks": 0, "omzet": 0.0})
        k["stuks"] += stuks
        k["omzet"] += omzet
        v = per_vorm.setdefault(r.verschijningsvorm or "overig", {"stuks": 0, "omzet": 0.0})
        v["stuks"] += stuks
        v["omzet"] += omzet
        tot_stuks += stuks
        tot_omzet += omzet

    for k in per_kanaal.values():
        k["omzet"] = round(k["omzet"], 2)
        k["prijs_ex_btw"] = round(k["omzet"] / k["stuks"], 4) if k["stuks"] else 0.0
    for v in per_vorm.values():
        v["omzet"] = round(v["omzet"], 2)

    return {
        "per_kanaal": per_kanaal,
        "per_vorm": per_vorm,
        "totaal": {"stuks": tot_stuks, "omzet": round(tot_omzet, 2)},
    }
