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
BRON_KANAAL = {
    "centraal boekhuis": "retail",
    "shopify": "webshop",
    "moneybird b2b": "b2b",
}

# kwartaal → marker-weeknummer (startweek van het kwartaal)
KWARTAAL_MARKER = {1: 1, 2: 14, 3: 27, 4: 40}


def normaliseer_kanaal(bron: str) -> str:
    """'Centraal Boekhuis' → 'retail', enz. Onbekend → 'overig'."""
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


def beschikbare_periodes() -> list[str]:
    """Periodes met verkoop, nieuw→oud: per jaar het jaar + de kwartalen."""
    paren = {(r.jaar, next((k for k, wk in KWARTAAL_MARKER.items() if wk == r.weeknummer), 1))
             for r in SalesSnapshot.query.all() if r.jaar}
    jaren = sorted({j for j, _ in paren}, reverse=True)
    uit = []
    for j in jaren:
        uit.append(str(j))
        for kw in sorted({k for jj, k in paren if jj == j}, reverse=True):
            uit.append(f"{j}-Q{kw}")
    return uit


def titel_namen(periode: str | None = None) -> list[str]:
    """Alle titel(groep)-namen met verkoop in de periode (voor het overzicht)."""
    return sorted({r.titel_naam for r in _periode_query(periode).all() if r.titel_naam})


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
