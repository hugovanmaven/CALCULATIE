"""Flask app factory voor Maven company platform."""

import os

from flask import Flask


def create_app():
    app = Flask(__name__)

    # ── Database configuratie ──
    # DATABASE_URL komt van Railway; lokaal valt het terug op SQLite zodat
    # de app ook werkt zonder Postgres draaiend.
    db_url = os.environ.get("DATABASE_URL", "")
    if db_url.startswith("postgres://"):
        # SQLAlchemy verwacht "postgresql://", oude Heroku/Railway-stijl was "postgres://"
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if not db_url:
        # Lokale fallback — SQLite in het data-dir
        from . import storage_calculatie as _storage
        _storage._ensure_dirs()
        db_url = f"sqlite:///{_storage.DATA_DIR}/calculatie.sqlite"

    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Connection-pool hygiëne voor een altijd-aan, multi-user/multi-thread setup:
    # - pool_pre_ping: detecteert door Railway/Postgres verbroken idle-verbindingen
    #   en vervangt ze, i.p.v. een harde error op het eerste verzoek.
    # - pool_recycle: ververs verbindingen ruim binnen de server-timeout.
    # (SQLite-fallback negeert deze opties grotendeels — onschadelijk.)
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }

    from .db import db
    db.init_app(app)

    # Resultaten-module (geïsoleerd, achter feature flag) — modellen importeren
    # zodat create_all() de res_-tabellen aanmaakt. Met de flag uit raakt de
    # module de app niet aan. Verwijderen = dit blok weg.
    from .resultaten import is_enabled as _resultaten_enabled
    if _resultaten_enabled():
        from .resultaten import models as _resultaten_models  # noqa: F401

    with app.app_context():
        db.create_all()
        from . import storage_calculatie as storage
        # Lichte schema-migratie (kolommen die create_all niet toevoegt aan
        # bestaande tabellen, bv. 'version' voor optimistic locking).
        storage.ensure_schema()
        # Eenmalige migratie: als de DB leeg is maar er een JSON-bestand staat,
        # zet die over. Veilig om herhaaldelijk aan te roepen.
        storage.migrate_from_json_if_needed()

    from .routes import register_blueprints
    register_blueprints(app)

    return app


# Convenience: `gunicorn app:app`
app = create_app()
