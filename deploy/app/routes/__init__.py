"""Blueprint registratie."""

from .pages import bp as pages_bp
from .api_calculatie import bp as calculatie_bp
from .mcp import bp as mcp_bp
from .mcp_oauth import bp as mcp_oauth_bp


def register_blueprints(app):
    app.register_blueprint(pages_bp)
    app.register_blueprint(calculatie_bp, url_prefix="/calculatie")
    # MCP-server top-level (connector-URL: <host>/mcp), geen prefix.
    app.register_blueprint(mcp_bp)
    # OAuth 2.1 voor de MCP-connector: discovery + /mcp/oauth/*, top-level.
    app.register_blueprint(mcp_oauth_bp)
    # Resultaten-module (geïsoleerd, achter feature flag) — verwijderen = dit blok weg
    from ..resultaten import is_enabled as _resultaten_enabled
    if _resultaten_enabled():
        from ..resultaten.routes import bp as resultaten_bp
        app.register_blueprint(resultaten_bp, url_prefix="/resultaten/api")
