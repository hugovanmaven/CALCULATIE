"""
API-blueprint voor de Resultaten-module (achter ``RESULTATEN_ENABLED``).

Geregistreerd onder ``/resultaten/api``. Read-endpoints voor de twee views
(overzicht alle titels + detail per titel) en — voor de kwartaal-flow —
import/reconcile van Exact-kosten.
"""

from flask import Blueprint, jsonify, request

from . import bereken, sales_sync

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
