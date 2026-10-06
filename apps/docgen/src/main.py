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

from generator import render_docx, GenerationError, parse_reference_doc

app = FastAPI(title="Grapholy DocGen", version="0.1.0")


# ---------------------------------------------------------------------------
# Schemas — mirror the contract the Express BE sends. Kept minimal & explicit.
# ---------------------------------------------------------------------------

class AktivitasRow(BaseModel):
    project: str
    aktivitas: str
    status: str = "Selesai"


class RingkasanProject(BaseModel):
    project: str
    narasi: str = ""
    fitur: str = ""
    perbaikan: str = ""
    ringkasan: str = ""


class Penanda(BaseModel):
    nama: str = ""
    nip: str = ""
    jabatan: str = ""
    unit_kerja: str = ""
    instansi: str = ""
    nama_kepala: str = ""
    nip_kepala: str = ""


class GenerateRequest(BaseModel):
    periode: str
    tahun: str
    tanggal_ttd: str
    penanda: Penanda = Field(default_factory=Penanda)
    # JSON terstruktur dari AI (template RSUD)
    latar_belakang: str = ""
    ruang_lingkup: list[str] = Field(default_factory=list)
    ringkasan_per_project: list[RingkasanProject] = Field(default_factory=list)
    aktivitas: list[AktivitasRow] = Field(default_factory=list)
    ringkasan_penutup: list[str] = Field(default_factory=list)
    # backward-compat (template default)
    aktivitas_table: list[AktivitasRow] = Field(default_factory=list)
    template: str = "default"


# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "grapholy-docgen"}


class ParseReferenceRequest(BaseModel):
    path: str


@app.post("/parse-reference")
def parse_reference(req: ParseReferenceRequest):
    """Parse dokumen .docx referensi → return struktur (ringkasan + contoh tabel)
    untuk dipakai AI sebagai few-shot example."""
    try:
        result = parse_reference_doc(req.path)
    except GenerationError as e:
        return JSONResponse(
            status_code=500,
            content={"error": "parse_failed", "detail": str(e)},
        )
    return result


@app.post("/generate")
def generate(req: GenerateRequest):
    """Render template .docx and return file bytes."""
    try:
        content = render_docx(req.model_dump(), req.template)
    except GenerationError as e:
        return JSONResponse(
            status_code=500,
            content={"error": "generation_failed", "detail": str(e)},
        )
    return content
