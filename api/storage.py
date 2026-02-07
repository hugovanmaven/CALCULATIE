"""
JSON file storage for multi-title persistence.
Stores all titles in data/titels.json.
"""

import json
import os
import uuid
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent.parent / "data"
TITELS_FILE = DATA_DIR / "titels.json"


def _ensure_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_all() -> dict[str, Any]:
    """Load all stored titels. Returns {id: titel_data, ...}"""
    _ensure_dir()
    if not TITELS_FILE.exists():
        return {}
    try:
        with open(TITELS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def save_all(data: dict[str, Any]):
    """Save all titels to disk."""
    _ensure_dir()
    with open(TITELS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_titel(titel_id: str) -> dict[str, Any] | None:
    """Get a single titel by id."""
    all_data = load_all()
    return all_data.get(titel_id)


def save_titel(titel_id: str, titel_data: dict[str, Any]) -> dict[str, Any]:
    """Save or update a single titel. Returns the saved data."""
    all_data = load_all()
    all_data[titel_id] = titel_data
    save_all(all_data)
    return titel_data


def delete_titel(titel_id: str) -> bool:
    """Delete a titel. Returns True if found and deleted."""
    all_data = load_all()
    if titel_id in all_data:
        del all_data[titel_id]
        save_all(all_data)
        return True
    return False


def new_id() -> str:
    """Generate a new unique titel id."""
    return str(uuid.uuid4())[:8]
