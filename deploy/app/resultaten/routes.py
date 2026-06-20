"""
API-blueprint voor de Resultaten-module.

Geregistreerd onder ``/resultaten/api`` (zie ``routes/__init__.py``). Voorlopig
alleen een ping-endpoint om te bevestigen dat de module netjes ingeprikt is;
de echte endpoints (sales-import, marge-berekening, Exact-import) komen later.
"""

from flask import Blueprint, jsonify

bp = Blueprint("resultaten", __name__)


@bp.get("/ping")
def ping():
    """Healthcheck — bevestigt dat de module geladen en bereikbaar is."""
    return jsonify({"ok": True, "module": "resultaten"})
