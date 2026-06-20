"""
API-blueprint voor de Resultaten-module (achter ``RESULTATEN_ENABLED``).

Geregistreerd onder ``/resultaten/api``. Read-endpoints voor de twee views
(overzicht alle titels + detail per titel) en — voor de kwartaal-flow —
import/reconcile van Exact-kosten met de zelflerende mapping.
"""

import os
import tempfile

from flask import Blueprint, jsonify, request

from datetime import datetime

from . import bereken, sales_sync
from .models import KostenGeboekt, Mapping, Verklaring, KwartaalStatus
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


# ── Calculatie-check: verklaringen + kwartaal afsluiten ────────────────────

@bp.post("/verklaring")
def verklaring_zetten():
    """Verklaar een verschil begroot↔geboekt per (periode, titel, stroom).

    Body: ``{recept_id, periode, stroom, status, notitie}``. ``status`` leeg →
    verklaring verwijderen (terug naar auto-classificatie).
    """
    b = request.get_json(silent=True) or {}
    recept_id, periode, stroom = b.get("recept_id"), b.get("periode"), b.get("stroom")
    if not (recept_id and periode and stroom):
        return jsonify({"error": "recept_id, periode en stroom vereist"}), 400
    v = Verklaring.query.filter_by(
        periode=periode, calculatie_titel_id=recept_id, stroom=stroom).first()
    status = (b.get("status") or "").strip()
    if not status:                                  # verklaring intrekken
        if v:
            db.session.delete(v)
            db.session.commit()
        return jsonify({"ok": True, "status": ""})
    if v is None:
        v = Verklaring(periode=periode, calculatie_titel_id=recept_id, stroom=stroom)
        db.session.add(v)
    v.status = status
    v.notitie = (b.get("notitie") or "").strip()
    v.door = "Hugo"
    db.session.commit()
    return jsonify({"ok": True, "status": v.status, "notitie": v.notitie})


@bp.post("/afsluiten")
def afsluiten():
    """Sluit een kwartaal af of heropen het. Body: ``{periode, afgesloten}``.

    Afgesloten → de app vraagt elk resterend gat te verklaren ('onverklaard').
    """
    b = request.get_json(silent=True) or {}
    periode = b.get("periode")
    if not periode:
        return jsonify({"error": "periode vereist"}), 400
    s = KwartaalStatus.query.filter_by(periode=periode).first()
    if s is None:
        s = KwartaalStatus(periode=periode)
        db.session.add(s)
    s.afgesloten = bool(b.get("afgesloten", True))
    s.afgesloten_at = datetime.utcnow()
    s.door = "Hugo"
    db.session.commit()
    return jsonify({"ok": True, "periode": periode, "afgesloten": s.afgesloten})


@bp.post("/zoek-kosten")
def zoek_kosten():
    """Scenario 2 — zoek overhead-regels die bij deze titel horen (LLM).

    Body: ``{recept_id, dry_run?}``. Zonder API-key automatisch dry-run.
    """
    from . import overhead
    b = request.get_json(silent=True) or {}
    recept_id = b.get("recept_id")
    if not recept_id or not bereken.get_titel(recept_id):
        return jsonify({"error": "onbekende titel"}), 404
    dry = bool(b.get("dry_run")) or not os.environ.get("ANTHROPIC_API_KEY")
    return jsonify(overhead.zoek_kandidaten(recept_id, dry_run=dry))


@bp.post("/herkoppel")
def herkoppel():
    """Koppel een overhead-regel alsnog aan een titel. Body: ``{exact_ref, recept_id}``."""
    from . import overhead
    b = request.get_json(silent=True) or {}
    rec = bereken.get_titel(b.get("recept_id"))
    if not rec:
        return jsonify({"error": "onbekende titel"}), 404
    isbn = rec.get("titel_input", {}).get("isbn", "")
    if not b.get("exact_ref") or not isbn:
        return jsonify({"error": "exact_ref en titel met ISBN vereist"}), 400
    return jsonify(overhead.herkoppel(b["exact_ref"], isbn))


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
