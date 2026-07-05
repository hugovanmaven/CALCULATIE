"""
Resultaten-module — geïsoleerde nacalculatie/marge-tile.

Volledig zelfstandig binnen de calculatie-app (optie A):
- Eigen DB-tabellen, allemaal met prefix ``res_`` → schoon te verwijderen.
- Raakt de calculatie-app op precies twee plekken aan: de blueprint-registratie
  in ``routes/__init__.py`` en het importeren van de modellen in de app-factory.

Verwijderen = deze map weg + die twee regels weg. De calculatie-app blijft
verder onaangeroerd.

Feature flag
------------
De hele module hangt achter ``RESULTATEN_ENABLED`` (env-var, sinds v1-livegang
**default aan**). ``RESULTATEN_ENABLED=0`` is de kill switch: dan worden de
``res_``-tabellen niet aangemaakt en geeft ``/resultaten/api/*`` een 404 — de
calculatie-app ziet er dan uit alsof de module niet bestaat.
"""

import os

# Truthy: "1", "true", "yes", "on" (case-insensitief). Alles anders = uit.
_TRUTHY = {"1", "true", "yes", "on"}


def is_enabled() -> bool:
    """True als de Resultaten-module aan staat.

    Sinds v1-livegang standaard AAN; uitzetten kan met ``RESULTATEN_ENABLED=0``
    (kill switch — de module verdwijnt dan volledig uit app én API)."""
    return os.environ.get("RESULTATEN_ENABLED", "1").strip().lower() in _TRUTHY


def ensure_schema():
    """Lichte, idempotente migratie voor de ``res_``-tabellen.

    ``create_all`` maakt nieuwe tabellen maar muteert bestaande niet — kolommen
    die ná de eerste deploy zijn toegevoegd zetten we hier alsnog neer. Werkt op
    SQLite én Postgres. Blijft binnen de module (verwijderen = map weg)."""
    from sqlalchemy import inspect, text
    from ..db import db

    insp = inspect(db.engine)
    if "res_kosten_geboekt" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("res_kosten_geboekt")}
    if "dispositie" not in cols:
        with db.engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE res_kosten_geboekt ADD COLUMN dispositie VARCHAR(12) DEFAULT ''"
            ))
