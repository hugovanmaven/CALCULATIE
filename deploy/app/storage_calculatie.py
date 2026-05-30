"""
JSON file storage for calculatie titels — met vangrails:

1. Atomic writes (write-to-tmp + rename) zodat een crash midden in save
   niet een half-bestand achterlaat.
2. Versioned backups: bij elke save wordt het oude bestand bewaard in
   backups/. Laatste 30 versies blijven staan.
3. Veilig laden: bij een corrupt JSON-bestand wordt het hernoemd
   (niet weggegooid) zodat het later teruggezet kan worden.
4. Schema-migratie: nieuwe velden krijgen automatisch defaults bij load.

Storage paden:
- Railway: $RAILWAY_VOLUME_MOUNT_PATH (persistent volume)
- Lokaal:  ./deploy/data/
"""

import json
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path

# Railway volume mount or local fallback
_volume = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH", "")
if _volume:
    DATA_DIR = Path(_volume)
else:
    DATA_DIR = Path(__file__).parent.parent / "data"

TITELS_FILE = DATA_DIR / "calculatie_titels.json"
BACKUP_DIR = DATA_DIR / "backups"
MAX_BACKUPS = 30  # houd laatste 30 versies


def _ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)


# ──────────────────────────────────────────────────────────────────────
#  SCHEMA MIGRATIE
# ──────────────────────────────────────────────────────────────────────

def _migrate_titel(titel: dict) -> dict:
    """Pas schema-migraties toe op één titel.

    Veilig om herhaaldelijk aan te roepen — alleen ontbrekende velden
    krijgen defaults. Hernoemde velden worden hier opgevangen.
    """
    if not isinstance(titel, dict):
        return titel

    ti = titel.get("titel_input")
    if not isinstance(ti, dict):
        return titel

    # ── Nieuwe velden met defaults ──
    ti.setdefault("auteur", "")
    ti.setdefault("isbn", "")
    ti.setdefault("verschijningsdatum", "")
    ti.setdefault("verschenen", False)
    ti.setdefault("btw_percentage", 0.09)
    ti.setdefault("boekhandelskorting", 0.48)
    ti.setdefault("transactiekosten_pct", 0.02)
    ti.setdefault("fulfillment_per_ex", 4.50)
    ti.setdefault("cac_per_ex", 0.0)
    ti.setdefault("distributie_cb_per_ex", 1.10)
    ti.setdefault("b2b_porto_per_ex", 0.0)
    ti.setdefault("b2b_korting_pct", 0.0)
    ti.setdefault("auteur_winstdeling_pct", 0.0)
    ti.setdefault("auteur_royalty_staffel", [])
    ti.setdefault("auteur_voorschot", 0)
    for partij in ("agent", "vertaler", "illustrator"):
        ti.setdefault(f"{partij}_pct", 0.0)
        ti.setdefault(f"{partij}_staffel", [])
        ti.setdefault(f"{partij}_winstdeling_pct", 0.0)
        ti.setdefault(f"{partij}_voorschot", 0)
    ti.setdefault("heeft_partner", False)
    ti.setdefault("partner_naam", "")
    ti.setdefault("partner_winstdeling_pct", 0.5)
    ti.setdefault("overige_kosten_pct", 0.0)
    ti.setdefault("overige_kosten_items", [])
    ti.setdefault("extra_derden", [])
    ti.setdefault("drukken", [])

    # Top-level velden
    titel.setdefault("verdeling_webshop", 0.10)
    titel.setdefault("verdeling_retail", 0.85)
    titel.setdefault("verdeling_b2b", 0.05)
    titel.setdefault("archived", False)

    titel["titel_input"] = ti
    return titel


def _migrate_all(raw: dict) -> dict:
    if not isinstance(raw, dict):
        return {}
    return {tid: _migrate_titel(t) for tid, t in raw.items()}


# ──────────────────────────────────────────────────────────────────────
#  LOAD & SAVE
# ──────────────────────────────────────────────────────────────────────

def load_all() -> dict:
    """Laad alle titels met automatische schema-migratie.

    Bij een corrupt JSON-bestand: hernoem naar .corrupt-<timestamp>
    in plaats van weggooien, zodat de data herstelbaar blijft.
    """
    _ensure_dirs()
    if not TITELS_FILE.exists():
        return {}
    try:
        with open(TITELS_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except (json.JSONDecodeError, IOError) as exc:
        # NIET stilletjes overschrijven — bewaar het kapotte bestand
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        corrupt_path = DATA_DIR / f"calculatie_titels.corrupt-{ts}.json"
        try:
            shutil.move(str(TITELS_FILE), str(corrupt_path))
            print(f"[storage] WARNING: corrupt JSON, bewaard als {corrupt_path}: {exc}")
        except OSError:
            pass
        return {}

    return _migrate_all(raw)


def _backup_current():
    """Maak een timestamped backup van het huidige bestand."""
    if not TITELS_FILE.exists():
        return
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"calculatie_titels_{ts}.json"
    try:
        shutil.copy2(TITELS_FILE, backup_path)
    except OSError as exc:
        print(f"[storage] WARNING: backup mislukt: {exc}")
        return
    # Houd alleen de laatste MAX_BACKUPS
    backups = sorted(BACKUP_DIR.glob("calculatie_titels_*.json"))
    for old in backups[:-MAX_BACKUPS]:
        try:
            old.unlink()
        except OSError:
            pass


def save_all(data: dict):
    """Atomic write + backup van vorige versie."""
    _ensure_dirs()
    _backup_current()

    # Atomic: schrijf naar tmp, dan rename
    tmp = TITELS_FILE.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(str(tmp), str(TITELS_FILE))


def get_titel(titel_id: str) -> dict | None:
    return load_all().get(titel_id)


def save_titel(titel_id: str, titel_data: dict) -> dict:
    all_data = load_all()
    all_data[titel_id] = titel_data
    save_all(all_data)
    return titel_data


def delete_titel(titel_id: str) -> bool:
    all_data = load_all()
    if titel_id in all_data:
        del all_data[titel_id]
        save_all(all_data)
        return True
    return False


def new_id() -> str:
    return str(uuid.uuid4())[:8]


# ──────────────────────────────────────────────────────────────────────
#  BACKUP / RESTORE HELPERS
# ──────────────────────────────────────────────────────────────────────

def list_backups() -> list[dict]:
    """Lijst van beschikbare backups (nieuwste eerst)."""
    _ensure_dirs()
    backups = sorted(BACKUP_DIR.glob("calculatie_titels_*.json"), reverse=True)
    out = []
    for b in backups:
        try:
            stat = b.stat()
            out.append({
                "name": b.name,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
        except OSError:
            continue
    return out


def restore_backup(name: str) -> bool:
    """Restore een specifieke backup over de huidige data."""
    path = BACKUP_DIR / name
    if not path.exists() or not path.name.startswith("calculatie_titels_"):
        return False
    _backup_current()  # bewaar de huidige als backup voor we 'm overschrijven
    shutil.copy2(path, TITELS_FILE)
    return True
