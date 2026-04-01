"""Blueprint registratie."""

from .pages import bp as pages_bp
from .api_calculatie import bp as calculatie_bp


def register_blueprints(app):
    app.register_blueprint(pages_bp)
    app.register_blueprint(calculatie_bp, url_prefix="/calculatie")
