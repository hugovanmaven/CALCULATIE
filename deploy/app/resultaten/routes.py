"""
API-blueprint voor de Resultaten-module (achter ``RESULTATEN_ENABLED``).

Geregistreerd onder ``/resultaten/api``. Read-endpoints voor de twee views
(overzicht alle titels + detail per titel) en — voor de kwartaal-flow —
import/reconcile van Exact-kosten met de zelflerende mapping.
"""

import os
import tempfile

from flask import Blueprint, jsonify, request

from . import bereken, sales_sync
from .models import KostenGeboekt, Mapping
from .exact_import import import_exact
from .storage_posten import calculatie_posten_voor
from ..db import db

bp = Blueprint("resultaten", __name__)


@bp.get("/ping")
def ping():
    """Healthcheck — bevestigt dat de module geladen en bereikbaar is."""
    return jsonify({"ok": True, "module": "resultaten"})


@bp.get("/periodes")
def periodes():
    """Beschikbare periodes (jaar + kwartalen) op basis van de sales-snapshot."""
    return jsonify({"periodes": sales_sync.beschikbare_periodes()})


@bp.get("/overzicht")
def overzicht():
    """View 1 — alle titels samen + Maven-totaal voor een periode."""
    periode = request.args.get("periode", "2026")
    return jsonify(bereken.bereken_overzicht(periode))


@bp.get("/titel/<recept_id>")
def titel(recept_id):
    """View 2 — detail per titel (stroom-uitsplitsing, kanalen, vormen)."""
    periode = request.args.get("periode", "2026")
    data = bereken.bereken_titel(recept_id, periode)
    if data is None:
        return jsonify({"error": "onbekende titel"}), 404
    return jsonify(data)


# ── Kwartaal-flow: Exact-import + reconcile + leren ────────────────────────

@bp.post("/import/exact")
def import_exact_route():
    """Upload een Exact FinTransactions-export (.xlsx) → res_kosten_geboekt.

    Idempotent op exact_ref, dus dezelfde export opnieuw uploaden is veilig.
    """
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "geen bestand"}), 400
    fd, path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    try:
        f.save(path)
        res = import_exact(path)
    finally:
        os.unlink(path)
    return jsonify(res)


@bp.get("/kosten/<isbn>")
def kosten(isbn):
    """Geboekte Exact-regels voor een ISBN (voor de reconcile-UI)."""
    periode = request.args.get("periode")
    q = KostenGeboekt.query.filter_by(isbn=isbn)
    if periode and "-" in periode:
        q = q.filter(KostenGeboekt.periode == periode)
    elif periode:
        q = q.filter(KostenGeboekt.periode.like(f"{periode}-%"))
    regels = [{
        "exact_ref": r.exact_ref, "datum": r.datum, "relatie": r.relatie,
        "grootboek": r.grootboek, "omschrijving": r.omschrijving,
        "stroom": r.stroom, "categorie": r.categorie, "bedrag": float(r.bedrag or 0),
        "calculatie_post": r.calculatie_post, "match_bron": r.match_bron,
        "match_confidence": float(r.match_confidence) if r.match_confidence is not None else None,
    } for r in q.order_by(KostenGeboekt.bedrag.desc()).all()]
    return jsonify({"isbn": isbn, "regels": regels})


@bp.post("/reconcile")
def reconcile_route():
    """Reconcilieer geboekte regels van een titel tegen de calculatie-posten.

    ``dry_run`` (of geen API-key) slaat de LLM-call over en geeft alleen de
    deterministische tellingen + de samengestelde prompt terug.
    """
    body = request.get_json(silent=True) or {}
    recept_id = body.get("recept_id")
    rec = bereken.get_titel(recept_id) if recept_id else None
    if not rec:
        return jsonify({"error": "onbekende titel"}), 404
    isbn = rec.get("titel_input", {}).get("isbn", "")
    posten = calculatie_posten_voor(rec)
    dry = bool(body.get("dry_run")) or not os.environ.get("ANTHROPIC_API_KEY")

    from .reconcile import reconcile_titel
    if dry:
        out = reconcile_titel(isbn, posten, dry_run=True)
        out["dry_run"] = True
        return jsonify(out)
    reconcile_titel(isbn, posten)
    return jsonify({"dry_run": False, "ok": True})


@bp.get("/mapping")
def mapping_list():
    """Geleerde mappings (leverancier/patroon → calculatie-post)."""
    rows = [{"patroon": m.patroon, "calculatie_post": m.calculatie_post,
             "bron": m.bron, "bevestigd": m.bevestigd} for m in Mapping.query.all()]
    return jsonify({"mappings": rows})


@bp.post("/mapping/bevestig")
def mapping_bevestig():
    """Bevestig (of corrigeer) een mapping → vanaf nu deterministisch.

    Body: ``{patroon, calculatie_post}``. Maakt aan of werkt bij, zet bevestigd.
    """
    body = request.get_json(silent=True) or {}
    patroon = (body.get("patroon") or "").strip().lower()
    post = (body.get("calculatie_post") or "").strip()
    if not patroon or not post:
        return jsonify({"error": "patroon en calculatie_post vereist"}), 400
    m = Mapping.query.filter_by(patroon=patroon).first()
    if m is None:
        m = Mapping(patroon=patroon)
        db.session.add(m)
    m.calculatie_post = post
    m.bron = "mens"
    m.bevestigd = True
    db.session.commit()
    return jsonify({"ok": True, "patroon": patroon, "calculatie_post": post})
