"""
JSON file storage for calculatie titels.
On Railway: /data/calculatie_titels.json
Locally: ./data/calculatie_titels.json
"""

import json
import os
import uuid
from pathlib import Path

# Railway volume mount or local fallback
_volume = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH", "")
if _volume:
    DATA_DIR = Path(_volume)
else:
    DATA_DIR = Path(__file__).parent.parent / "data"

TITELS_FILE = DATA_DIR / "calculatie_titels.json"


def _ensure_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_all() -> dict:
    _ensure_dir()
    if not TITELS_FILE.exists():
        return {}
    try:
        with open(TITELS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def save_all(data: dict):
    _ensure_dir()
    with open(TITELS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


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
