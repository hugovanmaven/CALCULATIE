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

    from .db import db
    db.init_app(app)

    with app.app_context():
        db.create_all()
        # Eenmalige migratie: als de DB leeg is maar er een JSON-bestand staat,
        # zet die over. Veilig om herhaaldelijk aan te roepen.
        from . import storage_calculatie as storage
        storage.migrate_from_json_if_needed()

    from .routes import register_blueprints
    register_blueprints(app)

    return app


# Convenience: `gunicorn app:app`
app = create_app()
