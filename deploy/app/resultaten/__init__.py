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
De hele module hangt achter ``RESULTATEN_ENABLED`` (env-var, **default uit**).
Lokaal zet je 'm aan; op productie blijft hij uit tot de module af is — zo reist
de code mee in elke merge zonder zichtbaar/bereikbaar te zijn ("dark launch").
Met de flag uit worden de ``res_``-tabellen niet aangemaakt en geeft
``/resultaten/api/*`` een 404.
"""

import os

# Truthy: "1", "true", "yes", "on" (case-insensitief). Alles anders = uit.
_TRUTHY = {"1", "true", "yes", "on"}


def is_enabled() -> bool:
    """True als de Resultaten-module aan staat (env ``RESULTATEN_ENABLED``)."""
    return os.environ.get("RESULTATEN_ENABLED", "").strip().lower() in _TRUTHY
