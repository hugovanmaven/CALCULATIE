"""Maven Calculatie — FastAPI backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import calculate, sensitivity, validate, export

app = FastAPI(
    title="Maven Calculatie",
    version="2.0",
    description="Calculatiemodel voor uitgeverij Maven Publishing",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(calculate.router, prefix="/api", tags=["calculate"])
app.include_router(sensitivity.router, prefix="/api", tags=["sensitivity"])
app.include_router(validate.router, prefix="/api", tags=["validate"])
app.include_router(export.router, prefix="/api", tags=["export"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
