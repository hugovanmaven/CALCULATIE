from fastapi import APIRouter
from ..models import CalculateRequest, CalculateResponse
from ..bridge import run_calculation

router = APIRouter()


@router.post("/calculate", response_model=CalculateResponse)
def calculate(req: CalculateRequest):
    """Hoofdberekening: alle kanalen + drukken + gewogen marge."""
    return run_calculation(req)
