"""Lokale development server."""

import os

# Lokaal dev: Resultaten-module standaard aan zodat je 'm meteen ziet. Productie
# draait via gunicorn (app:app), niet via run.py, en blijft dus puur door de
# Railway-env-var RESULTATEN_ENABLED bepaald (default uit).
os.environ.setdefault("RESULTATEN_ENABLED", "1")

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(port=5001, debug=True)
