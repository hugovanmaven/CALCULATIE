"""
Storage-laag voor calculatie-titels.

Implementatie: Postgres via SQLAlchemy (lokaal: SQLite fallback).

Interface ongewijzigd ten opzichte van de oude JSON-versie:
- load_all() -> dict[str, dict]
- get_titel(id) -> dict | None
- save_titel(id, data) -> dict
- delete_titel(id) -> bool
- new_id() -> str

Plus extra's voor migratie en backup-management.

Backups (vangrails): bij elke save schrijven we een volledige JSON-dump
naar /data/backups/. Dat is een extra safety net naast Railway's eigen
Postgres-backups en handig bij debugging.
"""

import json
import os
import shutil
import uuid
from datetime import datetime
from decimal import Decimal
from pathlib import Path

# Railway volume mount or local fallback
_volume = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH", "")
if _volume:
    DATA_DIR = Path(_volume)
else:
    DATA_DIR = Path(__file__).parent.parent / "data"

TITELS_FILE = DATA_DIR / "calculatie_titels.json"  # legacy + migratie-bron
BACKUP_DIR = DATA_DIR / "backups"
MAX_BACKUPS = 30


def _ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)


# ──────────────────────────────────────────────────────────────────────
#  DB ↔ dict CONVERSIE
# ──────────────────────────────────────────────────────────────────────

# Scalar velden die in titel_input zitten (kolommen op de Titel-tabel)
_SCALAR_FIELDS = [
    "titel", "auteur", "isbn", "verschijningsdatum", "verschenen",
    "verkoopprijs_incl_btw", "btw_percentage", "boekhandelskorting",
    "transactiekosten_pct", "fulfillment_per_ex", "cac_per_ex",
    "distributie_cb_per_ex",
    "b2b_porto_per_ex", "b2b_korting_pct",
    "auteur_winstdeling_pct", "auteur_voorschot",
    "agent_pct", "agent_winstdeling_pct", "agent_voorschot",
    "vertaler_pct", "vertaler_winstdeling_pct", "vertaler_voorschot",
    "illustrator_pct", "illustrator_winstdeling_pct", "illustrator_voorschot",
    "heeft_partner", "partner_naam", "partner_winstdeling_pct",
    "overige_kosten_pct",
]

# JSON-velden in titel_input
_JSON_FIELDS = [
    "drukken",
    "auteur_royalty_staffel",
    "agent_staffel",
    "vertaler_staffel",
    "illustrator_staffel",
    "extra_derden",
    "overige_kosten_items",
]


def _decimal_to_float(v):
    """SQLAlchemy retourneert Decimal voor Numeric-kolommen; converteer naar float."""
    if isinstance(v, Decimal):
        return float(v)
    return v


def titel_to_dict(t) -> dict:
    """Converteer Titel-row naar de dict-vorm die de Flask-routes verwachten."""
    titel_input = {}
    for f in _SCALAR_FIELDS:
        titel_input[f] = _decimal_to_float(getattr(t, f))
    for f in _JSON_FIELDS:
        titel_input[f] = getattr(t, f) or []

    return {
        "titel_input": titel_input,
        "verdeling_webshop": _decimal_to_float(t.verdeling_webshop),
        "verdeling_retail": _decimal_to_float(t.verdeling_retail),
        "verdeling_b2b": _decimal_to_float(t.verdeling_b2b),
        "archived": bool(t.archived),
        "titelgroep_id": t.titelgroep_id,
    }


def _apply_dict_to_titel(t, data: dict):
    """Vul Titel-row met data uit de dict-vorm. Wijzigt t in-place."""
    ti = data.get("titel_input", {}) or {}
    for f in _SCALAR_FIELDS:
        if f in ti:
            setattr(t, f, ti[f])
    for f in _JSON_FIELDS:
        if f in ti:
            setattr(t, f, ti[f])

    # Top-level velden
    if "verdeling_webshop" in data:
        t.verdeling_webshop = data["verdeling_webshop"]
    if "verdeling_retail" in data:
        t.verdeling_retail = data["verdeling_retail"]
    if "verdeling_b2b" in data:
        t.verdeling_b2b = data["verdeling_b2b"]
    if "archived" in data:
        t.archived = bool(data["archived"])
    if "titelgroep_id" in data:
        # None of "" → null
        v = data["titelgroep_id"]
        t.titelgroep_id = v if v else None


# ──────────────────────────────────────────────────────────────────────
#  STORAGE-API
# ──────────────────────────────────────────────────────────────────────

def load_all() -> dict:
    """Laad alle titels als {id: dict, ...}."""
    from .db import db, Titel
    out = {}
    for t in db.session.query(Titel).all():
        out[t.id] = titel_to_dict(t)
    return out


def get_titel(titel_id: str) -> dict | None:
    from .db import db, Titel
    t = db.session.get(Titel, titel_id)
    return titel_to_dict(t) if t else None


def save_titel(titel_id: str, titel_data: dict) -> dict:
    """Maak nieuw of update bestaande titel. Backupt vóór de write."""
    from .db import db, Titel
    _backup_current_to_json()

    t = db.session.get(Titel, titel_id)
    if t is None:
        t = Titel(id=titel_id, titel="")
        db.session.add(t)

    _apply_dict_to_titel(t, titel_data)
    db.session.commit()
    return titel_to_dict(t)


def delete_titel(titel_id: str) -> bool:
    from .db import db, Titel
    _backup_current_to_json()
    t = db.session.get(Titel, titel_id)
    if t is None:
        return False
    db.session.delete(t)
    db.session.commit()
    return True


def new_id() -> str:
    return str(uuid.uuid4())[:8]


# ──────────────────────────────────────────────────────────────────────
#  MIGRATIE: JSON → DB
# ──────────────────────────────────────────────────────────────────────

def migrate_from_json_if_needed():
    """Als de DB leeg is én er staat een JSON-bestand, neem die mee over.

    Veilig om herhaaldelijk aan te roepen — doet alleen iets als DB leeg is.
    Na succesvolle migratie wordt het JSON-bestand hernoemd naar
    .migrated zodat er geen verwarring ontstaat.
    """
    from .db import db, Titel
    _ensure_dirs()

    # Check: DB al gevuld?
    if db.session.query(Titel).count() > 0:
        return

    # Check: JSON-bestand aanwezig?
    if not TITELS_FILE.exists():
        return

    try:
        with open(TITELS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, IOError) as exc:
        print(f"[storage] WARNING: migratie overgeslagen, JSON onleesbaar: {exc}")
        return

    if not isinstance(data, dict) or not data:
        return

    print(f"[storage] Migratie: {len(data)} titels overzetten uit {TITELS_FILE}")
    count = 0
    for tid, titel_data in data.items():
        if not isinstance(titel_data, dict):
            continue
        try:
            t = Titel(id=tid)
            _apply_dict_to_titel(t, titel_data)
            db.session.add(t)
            count += 1
        except Exception as exc:
            print(f"[storage] WARNING: titel {tid} skip ({exc})")

    db.session.commit()
    print(f"[storage] Migratie klaar: {count} titels in DB")

    # Hernoem JSON zodat het niet nog een keer wordt geprobeerd
    try:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        TITELS_FILE.rename(DATA_DIR / f"calculatie_titels.migrated-{ts}.json")
    except OSError as exc:
        print(f"[storage] WARNING: hernoemen JSON mislukt: {exc}")


# ──────────────────────────────────────────────────────────────────────
#  BACKUP / RESTORE
# ──────────────────────────────────────────────────────────────────────

def _backup_current_to_json():
    """Dump huidige DB-state als JSON-bestand. Houd laatste 30 versies."""
    try:
        _ensure_dirs()
        from .db import db, Titel

        snapshot = {}
        for t in db.session.query(Titel).all():
            snapshot[t.id] = titel_to_dict(t)

        if not snapshot:
            return  # niets om te backuppen

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = BACKUP_DIR / f"calculatie_titels_{ts}.json"
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(snapshot, f, ensure_ascii=False, indent=2)

        # Houd alleen laatste MAX_BACKUPS
        backups = sorted(BACKUP_DIR.glob("calculatie_titels_*.json"))
        for old in backups[:-MAX_BACKUPS]:
            try:
                old.unlink()
            except OSError:
                pass
    except Exception as exc:
        # Backup-fout mag de save niet stuk maken
        print(f"[storage] WARNING: backup mislukt: {exc}")


def list_backups() -> list[dict]:
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
    """Restore een eerdere JSON-backup over de huidige DB heen.

    Maakt eerst een backup van de huidige state.
    """
    from .db import db, Titel
    path = BACKUP_DIR / name
    if not path.exists() or not path.name.startswith("calculatie_titels_"):
        return False

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, IOError):
        return False
    if not isinstance(data, dict):
        return False

    _backup_current_to_json()

    # Volledig vervangen: delete + insert
    db.session.query(Titel).delete()
    for tid, titel_data in data.items():
        if not isinstance(titel_data, dict):
            continue
        t = Titel(id=tid)
        _apply_dict_to_titel(t, titel_data)
        db.session.add(t)
    db.session.commit()
    return True


# ──────────────────────────────────────────────────────────────────────
#  TITELGROEPEN
# ──────────────────────────────────────────────────────────────────────

def titelgroep_to_dict(g, with_titels: bool = False) -> dict:
    out = {
        "id": g.id,
        "naam": g.naam,
        "beschrijving": g.beschrijving or "",
        "titel_count": len(g.titels) if g.titels is not None else 0,
    }
    if with_titels:
        out["titels"] = [titel_to_dict(t) | {"id": t.id} for t in (g.titels or [])]
    return out


def list_titelgroepen() -> list[dict]:
    from .db import db, Titelgroep
    return [titelgroep_to_dict(g) for g in db.session.query(Titelgroep).order_by(Titelgroep.naam).all()]


def get_titelgroep(groep_id: str, with_titels: bool = False) -> dict | None:
    from .db import db, Titelgroep
    g = db.session.get(Titelgroep, groep_id)
    return titelgroep_to_dict(g, with_titels=with_titels) if g else None


def save_titelgroep(groep_id: str | None, data: dict) -> dict:
    from .db import db, Titelgroep
    _backup_current_to_json()

    if groep_id:
        g = db.session.get(Titelgroep, groep_id)
        if g is None:
            g = Titelgroep(id=groep_id)
            db.session.add(g)
    else:
        g = Titelgroep(id=new_id())
        db.session.add(g)

    if "naam" in data:
        g.naam = data["naam"]
    if "beschrijving" in data:
        g.beschrijving = data["beschrijving"]

    db.session.commit()
    return titelgroep_to_dict(g)


def delete_titelgroep(groep_id: str) -> bool:
    """Verwijder een groep. Titels in die groep krijgen titelgroep_id = NULL."""
    from .db import db, Titelgroep, Titel
    _backup_current_to_json()
    g = db.session.get(Titelgroep, groep_id)
    if g is None:
        return False
    # Loskoppel alle titels eerst (ondelete=SET NULL doet dit ook, maar
    # expliciet is veiliger op SQLite)
    for t in db.session.query(Titel).filter_by(titelgroep_id=groep_id).all():
        t.titelgroep_id = None
    db.session.delete(g)
    db.session.commit()
    return True


# ──────────────────────────────────────────────────────────────────────
#  IMPORT
# ──────────────────────────────────────────────────────────────────────

def import_data(new_data: dict, mode: str = "merge") -> int:
    """Importeer titels uit een dict. Retourneert aantal geïmporteerd."""
    from .db import db, Titel
    _backup_current_to_json()

    if mode == "replace":
        db.session.query(Titel).delete()

    count = 0
    for tid, titel_data in new_data.items():
        if not isinstance(titel_data, dict):
            continue
        t = db.session.get(Titel, tid)
        if t is None:
            t = Titel(id=tid)
            db.session.add(t)
        _apply_dict_to_titel(t, titel_data)
        count += 1

    db.session.commit()
    return count
