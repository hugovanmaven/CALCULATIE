"""
Reconciliatie: koppel geboekte Exact-regels aan calculatie-posten.

Twee lagen, in deze volgorde:
1. **Deterministisch** — bevestigde mappings uit ``res_mapping`` (leverancier →
   post). Geen LLM nodig.
2. **LLM** — voor wat overblijft vraagt Claude per regel de best passende
   calculatie-post + confidence + korte uitleg. Gestructureerde output
   (``messages.parse`` met een Pydantic-schema), zodat de LLM alléén een
   *mapping* teruggeeft; alle euro's/sommen/verschillen rekent Python hieronder.

Hoge-confidence LLM-matches worden als (nog onbevestigd) voorstel in
``res_mapping`` gezet — bevestig je 'm één keer, dan gaat het de volgende keer
deterministisch. Zo leert het systeem en heeft het steeds minder LLM nodig.
"""

from pydantic import BaseModel

from .models import KostenGeboekt, Mapping
from ..db import db

# Sonnet 4.6: goede balans prijs/kwaliteit voor dit afgebakende classificeren
# ($3/$15 per Mtok). Opus (claude-opus-4-8) kan voor lastigere gevallen.
MODEL = "claude-sonnet-4-6"


class LineMatch(BaseModel):
    exact_ref: str
    calculatie_post: str          # toegewezen post, of "overig" als niets past
    confidence: float             # 0..1
    reason: str                   # korte uitleg (NL)


class Reconciliation(BaseModel):
    matches: list[LineMatch]


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def build_prompt(calculatie_posten: list[str], regels: list[KostenGeboekt]) -> str:
    """Stel de prompt samen voor de LLM-matchstap (geen euro's te berekenen)."""
    posten = "\n".join(f"- {p}" for p in calculatie_posten)
    lines = "\n".join(
        f'- exact_ref={r.exact_ref} | grootboek="{r.grootboek}" | '
        f'leverancier="{r.relatie}" | omschrijving="{r.omschrijving}" | '
        f"bedrag={float(r.bedrag):.2f}"
        for r in regels
    )
    return (
        "Je koppelt geboekte kostenregels uit de boekhouding (Exact) aan de "
        "verwachte kostenposten uit een boekcalculatie. Kies per Exact-regel de "
        "best passende calculatie-post op basis van leverancier, grootboek en "
        "omschrijving. Past niets goed, kies dan \"overig\".\n\n"
        f"Mogelijke calculatie-posten:\n{posten}\n\n"
        f"Exact-regels:\n{lines}\n\n"
        "Geef voor elke exact_ref: de gekozen calculatie_post, een confidence "
        "(0-1), en een korte uitleg in het Nederlands. Verzin geen bedragen."
    )


def reconcile_titel(isbn: str, calculatie_posten: list[str],
                    *, model: str = MODEL, persist: bool = True,
                    dry_run: bool = False):
    """Reconcilieer de geboekte regels van één titel tegen de calculatie-posten.

    ``dry_run=True`` slaat de LLM-call over en geeft alleen de samengestelde
    prompt terug (voor testen zonder API-key).
    """
    regels = KostenGeboekt.query.filter_by(isbn=isbn).all()

    # ── Laag 1: deterministisch via bevestigde mappings ──
    bevestigd = {m.patroon: m for m in Mapping.query.filter_by(bevestigd=True).all()}
    todo = []
    for r in regels:
        m = bevestigd.get(_norm(r.relatie))
        if m:
            r.calculatie_post = m.calculatie_post
            r.match_bron = "regel"
            r.match_confidence = 1.0
        else:
            todo.append(r)

    if dry_run:
        return {"prompt": build_prompt(calculatie_posten, todo),
                "deterministisch": len(regels) - len(todo), "naar_llm": len(todo)}

    # ── Laag 2: LLM voor de rest ──
    if todo:
        import anthropic  # pas hier importeren: module laadt ook zonder SDK

        client = anthropic.Anthropic()
        resp = client.messages.parse(
            model=model,
            max_tokens=4000,
            messages=[{"role": "user", "content": build_prompt(calculatie_posten, todo)}],
            output_format=Reconciliation,
        )
        by_ref = {r.exact_ref: r for r in todo}
        for mt in (resp.parsed_output.matches if resp.parsed_output else []):
            r = by_ref.get(mt.exact_ref)
            if not r:
                continue
            r.calculatie_post = mt.calculatie_post
            r.match_bron = "llm"
            r.match_confidence = round(float(mt.confidence), 3)
            # leren: hoge confidence → voorstel-mapping (onbevestigd) opslaan
            if mt.confidence >= 0.8 and r.relatie:
                _leer_voorstel(_norm(r.relatie), mt.calculatie_post)

    if persist:
        db.session.commit()
    return regels


def _leer_voorstel(patroon: str, post: str):
    """Sla een LLM-voorstel op als (nog onbevestigde) mapping."""
    if not patroon or Mapping.query.filter_by(patroon=patroon).first():
        return
    db.session.add(Mapping(patroon=patroon, calculatie_post=post,
                           bron="llm", bevestigd=False))


def aggregeer(isbn: str) -> dict:
    """Per calculatie-post de geboekte som (uit de toegewezen posten).

    Python rekent — niet de LLM. Levert {post: geboekt_bedrag}.
    """
    uit = {}
    for r in KostenGeboekt.query.filter_by(isbn=isbn).all():
        post = r.calculatie_post or "(niet toegewezen)"
        uit[post] = uit.get(post, 0.0) + float(r.bedrag)
    return {k: round(v, 2) for k, v in uit.items()}
