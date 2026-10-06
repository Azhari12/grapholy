"""Grapholy — Document Generator Service.

FastAPI microservice that renders a .docx template (Jinja2 via docxtpl)
from structured JSON payload received from the Express BE.

Run:
    cd apps/docgen/src
    uvicorn main:app --reload --port 8787
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from generator import render_docx, GenerationError

app = FastAPI(title="Grapholy DocGen", version="0.1.0")


# ---------------------------------------------------------------------------
# Schemas — mirror the contract the Express BE sends. Kept minimal & explicit.
# ---------------------------------------------------------------------------

class AktivitasRow(BaseModel):
    no: int
    project: str
    aktivitas: str
    status: str = "Selesai"


class RingkasanProject(BaseModel):
    project: str
    ringkasan: str


class Penanda(BaseModel):
    nama: str = ""
    nip: str = ""
    jabatan: str = ""
    unit_kerja: str = ""
    instansi: str = ""
    nama_kepala: str = ""
    nip_kepala: str = ""


class GenerateRequest(BaseModel):
    periode: str  # e.g. "September 2026"
    tahun: str  # e.g. "2026"
    tanggal_ttd: str  # e.g. "30 September 2026"
    penanda: Penanda = Field(default_factory=Penanda)
    ringkasan_per_project: list[RingkasanProject] = Field(default_factory=list)
    aktivitas_table: list[AktivitasRow] = Field(default_factory=list)


# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "grapholy-docgen"}


@app.post("/generate")
def generate(req: GenerateRequest):
    """Render template .docx and return file bytes."""
    try:
        content = render_docx(req.model_dump())
    except GenerationError as e:
        return JSONResponse(
            status_code=500,
            content={"error": "generation_failed", "detail": str(e)},
        )
    return content
