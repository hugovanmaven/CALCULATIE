"""Flask app factory voor Maven company platform."""

from flask import Flask


def create_app():
    app = Flask(__name__)

    from .routes import register_blueprints
    register_blueprints(app)

    return app


# Convenience: `gunicorn app:app`
app = create_app()
