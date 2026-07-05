"""
Ontbrekende-kosten-opsporing (scenario 2: 'verkeerd/elders geboekt').

Veel kosten staan in Exact zónder kostenplaats (lege ISBN = overhead-pool, ~37%
van de regels). Sommige daarvan horen eigenlijk bij een titel. Deze module laat
de LLM, gegeven een titel + z'n verwachte posten/leveranciers, kandidaten uit de
overhead-pool aanwijzen. Jij bevestigt → de regel wordt **herkoppeld** aan de
titel (telt vanaf dan als geboekt → kost niet gemist).

Zelfde patroon als ``reconcile.py``: "LLM matcht, code rekent/herkoppelt". De
LLM geeft alléén een oordeel (hoort-erbij + confidence + reden), nooit bedragen.
``dry_run`` (of geen API-key) bouwt enkel de prompt + telt de pool.
"""

from pydantic import BaseModel

from .models import KostenGeboekt
from .storage_posten import calculatie_posten_voor
from ..storage_calculatie import get_titel
from ..db import db

MODEL = "claude-sonnet-4-6"


class Kandidaat(BaseModel):
    exact_ref: str
    hoort_erbij: bool
    confidence: float
    reden: str


class Resultaat(BaseModel):
    kandidaten: list[Kandidaat]


def _titel_context(rec: dict) -> dict:
    ti = rec.get("titel_input", {})
    isbn = ti.get("isbn", "")
    # leveranciers die al op deze titel geboekt staan = sterke signalen
    leveranciers = sorted({r.relatie for r in KostenGeboekt.query.filter_by(isbn=isbn).all() if r.relatie})
    return {
        "titel": ti.get("titel", ""),
        "auteur": ti.get("auteur", ""),
        "isbn": isbn,
        "posten": calculatie_posten_voor(rec),
        "leveranciers": leveranciers,
    }


def overhead_pool():
    """Geboekte Exact-regels zonder titel-koppeling (lege ISBN)."""
    return KostenGeboekt.query.filter_by(isbn="").all()


def build_prompt(ctx: dict, pool) -> str:
    lines = "\n".join(
        f'- exact_ref={r.exact_ref} | grootboek="{r.grootboek}" | leverancier="{r.relatie}" | '
        f'omschrijving="{r.omschrijving}" | bedrag={float(r.bedrag):.2f}'
        for r in pool
    )
    return (
        "Je zoekt geboekte kostenregels die zonder kostenplaats (overhead) in de "
        "boekhouding staan, maar eigenlijk bij een specifieke boektitel horen.\n\n"
        f"Titel: {ctx['titel']} ({ctx['auteur']}), ISBN {ctx['isbn']}.\n"
        f"Verwachte kostenposten: {', '.join(ctx['posten'])}.\n"
        f"Leveranciers die al op deze titel geboekt staan: {', '.join(ctx['leveranciers']) or '(geen)'}.\n\n"
        f"Overhead-regels om te beoordelen:\n{lines}\n\n"
        "Geef per exact_ref: hoort_erbij (true/false), confidence (0-1) en een "
        "korte reden in het Nederlands. Wees streng: alleen true als leverancier, "
        "grootboek of omschrijving duidelijk naar deze titel wijst. Verzin geen bedragen."
    )


def zoek_kandidaten(recept_id: str, *, model: str = MODEL, dry_run: bool = False) -> dict:
    """Vind overhead-regels die mogelijk bij deze titel horen."""
    rec = get_titel(recept_id)
    if not rec:
        return {"error": "onbekende titel"}
    ctx = _titel_context(rec)
    pool = overhead_pool()

    if dry_run:
        return {"dry_run": True, "pool": len(pool), "prompt": build_prompt(ctx, pool)}

    import anthropic  # pas hier importeren: module laadt ook zonder SDK

    client = anthropic.Anthropic()
    resp = client.messages.parse(
        model=model,
        max_tokens=4000,
        messages=[{"role": "user", "content": build_prompt(ctx, pool)}],
        output_format=Resultaat,
    )
    by_ref = {r.exact_ref: r for r in pool}
    kandidaten = []
    for k in (resp.parsed_output.kandidaten if resp.parsed_output else []):
        r = by_ref.get(k.exact_ref)
        if not r or not k.hoort_erbij:
            continue
        kandidaten.append({
            "exact_ref": r.exact_ref, "relatie": r.relatie, "grootboek": r.grootboek,
            "omschrijving": r.omschrijving, "bedrag": float(r.bedrag or 0),
            "confidence": round(float(k.confidence), 3), "reden": k.reden,
        })
    kandidaten.sort(key=lambda x: x["confidence"], reverse=True)
    return {"dry_run": False, "pool": len(pool), "kandidaten": kandidaten}


def herkoppel(exact_ref: str, isbn: str, *, periode: str | None = None) -> dict:
    """Koppel een overhead-regel alsnog aan een titel (zet de ISBN).

    De regel telt vanaf nu mee als geboekt op die titel. Idempotent op exact_ref.
    """
    r = KostenGeboekt.query.filter_by(exact_ref=exact_ref).first()
    if not r:
        return {"error": "regel niet gevonden"}
    r.isbn = isbn
    r.dispositie = ""      # gekoppeld aan titel → eerdere verdeeld/genegeerd-keuze vervalt
    r.match_bron = "mens"
    db.session.commit()
    return {"ok": True, "exact_ref": exact_ref, "isbn": isbn, "bedrag": float(r.bedrag or 0)}
