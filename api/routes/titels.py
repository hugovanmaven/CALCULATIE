"""CRUD routes voor multi-title persistence."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

from ..storage import load_all, save_titel, delete_titel, new_id, get_titel
from ..models import TitelInputSchema

router = APIRouter()


class StoredTitel(BaseModel):
    """A complete stored titel with all settings."""
    id: str
    titel_input: TitelInputSchema
    herdruk_oplages: list[int] = []
    verdeling_webshop: float = 0.10
    verdeling_retail: float = 0.90
    verdeling_b2b: float = 0.00


class TitelListItem(BaseModel):
    """Summary for the tab list."""
    id: str
    titel: str
    isbn: str
    druknummer: int


class SaveTitelRequest(BaseModel):
    """Request to save a titel (id optional for new)."""
    id: str | None = None
    titel_input: TitelInputSchema
    herdruk_oplages: list[int] = []
    verdeling_webshop: float = 0.10
    verdeling_retail: float = 0.90
    verdeling_b2b: float = 0.00


# ── LIST ──

@router.get("/titels", response_model=list[TitelListItem])
def list_titels():
    """Lijst alle opgeslagen titels (voor tabs)."""
    all_data = load_all()
    items = []
    for tid, data in all_data.items():
        ti = data.get("titel_input", {})
        items.append(TitelListItem(
            id=tid,
            titel=ti.get("titel", "Naamloos"),
            isbn=ti.get("isbn", ""),
            druknummer=ti.get("druknummer", 1),
        ))
    return items


# ── GET ──

@router.get("/titels/{titel_id}", response_model=StoredTitel)
def get_titel_route(titel_id: str):
    """Haal een complete titel op."""
    data = get_titel(titel_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Titel niet gevonden")
    return StoredTitel(id=titel_id, **data)


# ── SAVE (create or update) ──

@router.post("/titels", response_model=StoredTitel)
def save_titel_route(req: SaveTitelRequest):
    """Sla een titel op (nieuw of update)."""
    tid = req.id or new_id()
    data = {
        "titel_input": req.titel_input.model_dump(),
        "herdruk_oplages": req.herdruk_oplages,
        "verdeling_webshop": req.verdeling_webshop,
        "verdeling_retail": req.verdeling_retail,
        "verdeling_b2b": req.verdeling_b2b,
    }
    save_titel(tid, data)
    return StoredTitel(id=tid, **data)


# ── DELETE ──

@router.delete("/titels/{titel_id}")
def delete_titel_route(titel_id: str):
    """Verwijder een titel."""
    if not delete_titel(titel_id):
        raise HTTPException(status_code=404, detail="Titel niet gevonden")
    return {"ok": True}
