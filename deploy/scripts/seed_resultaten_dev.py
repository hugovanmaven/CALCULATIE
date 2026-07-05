"""
Dev-seed voor de Resultaten-module — **alleen voor lokaal testen**.

Vult de lokale DB met genoeg echte data om de nacalculatie end-to-end te draaien:

1. **Recepten**: haalt read-only 3 echte calculaties uit productie
   (Co-int, DRIVE, Full Body Thinking) en slaat ze lokaal op. Productie wordt
   niet gewijzigd (alleen GET).
2. **Sales**: een snapshot van de drie titelgroepen (alle vormen/edities,
   2025-2026, per kwartaal) uit het sales-dashboard, hieronder ingebakken zodat
   de seed offline reproduceerbaar is.

Draai vanuit ``deploy/``:  ``RESULTATEN_ENABLED=1 python3 scripts/seed_resultaten_dev.py``
"""

import sys
import ssl
import urllib.request
import json
from pathlib import Path

# Dev-tool: val terug op een ongeverifieerde SSL-context als de lokale
# certificate-store ontbreekt (bekende macOS-Python-kwestie). Alleen GET's
# naar onze eigen productie-API.
try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL_CTX = ssl._create_unverified_context()

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

PROD = "https://calculatie.maven-company.com/calculatie/api/titels"
RECEPT_IDS = {
    "222c23e4": "Co-intelligentie 2026 editie",
    "1257e72d": "DRIVE",
    "ec521544": "Full Body Thinking",
}

# titel_id (sales) → titel(groep)-naam zoals in het sales-dashboard
TITELS = {
    80: "Co-intelligentie – Slimmer werken met AI - 2026 editie",
    7: "DRIVE: Train je stoicijnse mindset",
    8: "Full Body Thinking",
}
BRON = {"C": "Centraal Boekhuis", "S": "Shopify", "M": "Moneybird B2B"}

# (isbn, titel_id, vorm, bron-code, jaar, kwartaal, stuks, omzet)
SALES = [
    # ── Co-intelligentie (groep, 3 paperback-edities + e-books) ──
    ("9789493213845", 80, "paperback", "C", 2025, 1, 17009, 224593.90),
    ("9789493213845", 80, "paperback", "S", 2025, 1, 2598, 63160.62),
    ("9789493213920", 80, "e-book", "C", 2025, 1, 590, 7300.39),
    ("9789493434134", 80, "e-book", "C", 2025, 1, 137, 1501.30),
    ("9789493434288", 80, "e-book", "C", 2025, 1, 0, 30.44),
    ("9789493434127", 80, "paperback", "C", 2025, 2, 11896, 156978.24),
    ("9789493213845", 80, "paperback", "S", 2025, 2, 4575, 111221.41),
    ("9789493434127", 80, "paperback", "S", 2025, 2, 4275, 103928.93),
    ("9789493213845", 80, "paperback", "C", 2025, 2, 4280, 56431.95),
    ("9789493213920", 80, "e-book", "C", 2025, 2, 559, 6920.16),
    ("9789493434134", 80, "e-book", "C", 2025, 2, 130, 1423.11),
    ("9789493213845", 80, "paperback", "M", 2025, 2, 56, 1337.16),
    ("9789493434288", 80, "e-book", "C", 2025, 2, 0, 28.86),
    ("9789493434127", 80, "paperback", "C", 2025, 3, 13522, 170568.50),
    ("9789493434127", 80, "paperback", "S", 2025, 3, 2547, 61917.79),
    ("9789493213920", 80, "e-book", "C", 2025, 3, 559, 6920.16),
    ("9789493434127", 80, "paperback", "M", 2025, 3, 245, 4570.65),
    ("9789493434134", 80, "e-book", "C", 2025, 3, 130, 1423.11),
    ("9789493213845", 80, "paperback", "C", 2025, 3, 4, 57.13),
    ("9789493434288", 80, "e-book", "C", 2025, 3, 0, 28.86),
    ("9789493434271", 80, "paperback", "C", 2025, 4, 5009, 66591.59),
    ("9789493434127", 80, "paperback", "C", 2025, 4, 1968, 26060.77),
    ("9789493434271", 80, "paperback", "S", 2025, 4, 608, 14780.55),
    ("9789493434127", 80, "paperback", "S", 2025, 4, 548, 13324.87),
    ("9789493213920", 80, "e-book", "C", 2025, 4, 516, 6387.84),
    ("9789493213845", 80, "paperback", "S", 2025, 4, 162, 3938.26),
    ("9789493434127", 80, "paperback", "M", 2025, 4, 125, 2613.53),
    ("9789493434134", 80, "e-book", "C", 2025, 4, 120, 1313.64),
    ("9789493434288", 80, "e-book", "C", 2025, 4, 0, 26.64),
    ("9789493213845", 80, "paperback", "C", 2025, 4, -124, -1624.77),
    ("9789493434271", 80, "paperback", "C", 2026, 1, 4153, 54272.67),
    ("9789493434271", 80, "paperback", "S", 2026, 1, 1690, 41083.96),
    ("9789493434288", 80, "e-book", "C", 2026, 1, 124, 1194.89),
    ("9789493213920", 80, "e-book", "C", 2026, 1, 37, 579.01),
    ("9789493434134", 80, "e-book", "C", 2026, 1, 34, 375.25),
    ("9789493213845", 80, "paperback", "C", 2026, 1, -6, -75.46),
    ("9789493434127", 80, "paperback", "C", 2026, 1, -378, -4927.65),
    ("9789493434271", 80, "paperback", "C", 2026, 2, 1741, 22616.98),
    ("9789493434271", 80, "paperback", "S", 2026, 2, 164, 3986.86),
    ("9789493434288", 80, "e-book", "C", 2026, 2, 67, 785.19),
    ("9789493213920", 80, "e-book", "C", 2026, 2, 29, 426.30),
    ("9789493434134", 80, "e-book", "C", 2026, 2, 13, 147.91),
    ("9789493434134", 80, "e-book", "S", 2026, 2, 5, 80.30),
    ("9789493434127", 80, "paperback", "C", 2026, 2, -12, -158.35),
    ("9789493434271", 80, "paperback", "C", 2026, 4, 226, 3007.07),
    ("9789493434271", 80, "paperback", "S", 2026, 4, 50, 1215.50),
    ("9789493213920", 80, "e-book", "C", 2026, 4, 6, 228.39),
    ("9789493434134", 80, "e-book", "C", 2026, 4, 10, 46.97),
    ("9789493434288", 80, "e-book", "C", 2026, 4, 11, 0.83),
    ("9789493213845", 80, "paperback", "C", 2026, 4, -8, -133.95),
    ("9789493434127", 80, "paperback", "C", 2026, 4, -21, -225.31),
    # ── DRIVE (hardcover + audiobook) ──
    ("9789493213166", 7, "hardcover", "S", 2025, 1, 721, 14881.46),
    ("9789493213166", 7, "hardcover", "C", 2025, 1, 533, 6140.14),
    ("9789493213227-A", 7, "audiobook", "C", 2025, 1, 0, 531.27),
    ("9789493213166", 7, "hardcover", "C", 2025, 2, 351, 4012.23),
    ("9789493213166", 7, "hardcover", "S", 2025, 2, 138, 2848.32),
    ("9789493213166", 7, "hardcover", "M", 2025, 2, 37, 712.16),
    ("9789493213227-A", 7, "audiobook", "C", 2025, 2, 0, 438.21),
    ("9789493213166", 7, "hardcover", "C", 2025, 3, 190, 2163.02),
    ("9789493213166", 7, "hardcover", "S", 2025, 3, 25, 516.00),
    ("9789493213227-A", 7, "audiobook", "C", 2025, 3, 0, 364.59),
    ("9789493213166", 7, "hardcover", "C", 2025, 4, 371, 4273.39),
    ("9789493213166", 7, "hardcover", "S", 2025, 4, 141, 2934.25),
    ("9789493213166", 7, "hardcover", "M", 2025, 4, 27, 479.31),
    ("9789493213227-A", 7, "audiobook", "C", 2025, 4, 0, 456.68),
    ("9789493213166", 7, "hardcover", "S", 2026, 1, 85, 1341.63),
    ("9789493213227-A", 7, "audiobook", "C", 2026, 1, 0, 790.71),
    ("9789493213166", 7, "hardcover", "C", 2026, 1, 63, 718.30),
    ("9789493213166", 7, "hardcover", "S", 2026, 2, 51, 1046.60),
    ("9789493213227-A", 7, "audiobook", "C", 2026, 2, 0, 526.37),
    ("9789493213166", 7, "hardcover", "M", 2026, 2, 20, 365.36),
    ("9789493213166", 7, "hardcover", "C", 2026, 4, 17, 167.23),
    ("9789493213227-A", 7, "audiobook", "C", 2026, 4, 0, 31.19),
    ("9789493213166", 7, "hardcover", "S", 2026, 4, 1, 20.64),
    # ── Full Body Thinking (paperback + audiobook) ──
    ("9789493434189", 8, "paperback", "C", 2025, 4, 5948, 74324.60),
    ("9789493434189", 8, "paperback", "S", 2025, 4, 1628, 37329.88),
    ("9789493434189", 8, "paperback", "M", 2025, 4, 150, 2441.68),
    ("9789493434189", 8, "paperback", "C", 2026, 1, 4053, 50974.09),
    ("9789493434189", 8, "paperback", "S", 2026, 1, 1318, 30221.71),
    ("9789493434189", 8, "paperback", "M", 2026, 1, 150, 2991.92),
    ("9789493434318-A", 8, "audiobook", "C", 2026, 1, 0, 439.07),
    ("9789493434189", 8, "paperback", "C", 2026, 2, 1219, 14754.55),
    ("9789493434189", 8, "paperback", "S", 2026, 2, 360, 8254.80),
    ("9789493434189", 8, "paperback", "M", 2026, 2, 34, 701.55),
    ("9789493434318-A", 8, "audiobook", "C", 2026, 2, 0, 421.92),
    ("9789493434189", 8, "paperback", "C", 2026, 4, 234, 2893.55),
    ("9789493434189", 8, "paperback", "S", 2026, 4, 21, 481.53),
    ("9789493434318-A", 8, "audiobook", "C", 2026, 4, 0, 14.64),
]


def _sales_rows():
    for isbn, tid, vorm, bron, jaar, kw, stuks, omzet in SALES:
        yield {
            "isbn": isbn, "titel_naam": TITELS[tid], "vorm": vorm,
            "bron": BRON[bron], "jaar": jaar, "kwartaal": kw,
            "stuks": stuks, "omzet": omzet,
        }


def main():
    from app import create_app
    from app import storage_calculatie as storage
    from app.resultaten.sales_sync import upsert_snapshot

    app = create_app()
    with app.app_context():
        # 1. Recepten read-only uit productie ophalen + lokaal opslaan
        for rid, naam in RECEPT_IDS.items():
            try:
                req = urllib.request.Request(
                    f"{PROD}/{rid}",
                    headers={"User-Agent": "Mozilla/5.0 (seed-resultaten-dev)"},
                )
                with urllib.request.urlopen(req, timeout=20, context=_SSL_CTX) as r:
                    payload = json.load(r)
                payload.pop("id", None)
                payload.pop("version", None)
                storage.save_titel(rid, payload)
                print(f"  recept opgeslagen: {naam} ({rid})")
            except Exception as e:
                print(f"  ! recept {naam} ({rid}) mislukt: {e}")

        # 2. Sales-snapshot vullen
        res = upsert_snapshot(list(_sales_rows()))
        print(f"  sales-snapshot: {res}")


if __name__ == "__main__":
    main()
