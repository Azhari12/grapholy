"""Grapholy — .docx renderer using docxtpl (Jinja2 for docx).

Template: apps/docgen/templates/default.docx
Placeholders: {{ nama }}, {{ nip }}, {{ periode }}, {% for row in aktivitas_table %}, {% for p in ringkasan_per_project %}, dll.
"""
from __future__ import annotations

from pathlib import Path

from docx import Document  # type: ignore
from docxtpl import DocxTemplate  # type: ignore
from fastapi.responses import Response

TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "templates" / "default.docx"


class GenerationError(Exception):
    """Raised when template rendering fails."""


def ensure_template_exists() -> None:
    """Build a default template if none exists yet (idempotent)."""
    if TEMPLATE_PATH.exists():
        return
    TEMPLATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _build_default_template(TEMPLATE_PATH)


def render_docx(context: dict) -> Response:
    """Render the docx template with Jinja2 context → Response with bytes."""
    ensure_template_exists()
    if not TEMPLATE_PATH.exists():
        raise GenerationError(f"Template not found at {TEMPLATE_PATH}")

    try:
        tpl = DocxTemplate(str(TEMPLATE_PATH))
        tpl.render(context)
        buf = tpl.docx.core_properties  # touch to force render side-effects
        import io

        out = io.BytesIO()
        tpl.docx.save(out)
        data = out.getvalue()
    except Exception as e:
        raise GenerationError(f"docxtpl render failed: {e}") from e

    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="laporan.docx"'},
    )


def _build_default_template(path: Path) -> None:
    """Create default.docx with Jinja2 placeholders + a table for aktivitas.

    The table uses docxtpl row-cloning syntax: {%tr for row in aktivitas_table %}.
    """
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Pt

    doc = Document()

    # --- Title ---
    title = doc.add_heading("LAPORAN KEGIATAN PENGEMBANGAN SISTEM", level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run("Periode: {{ periode }}")
    run.bold = True
    run.font.size = Pt(12)

    # --- Penanda block ---
    doc.add_paragraph()
    doc.add_paragraph(
        "Yang bertanda tangan di bawah ini:"
    )
    p = doc.add_paragraph()
    p.add_run("Nama          : ").bold = True
    p.add_run("{{ nama }}")
    p = doc.add_paragraph()
    p.add_run("NIP           : ").bold = True
    p.add_run("{{ nip }}")
    p = doc.add_paragraph()
    p.add_run("Jabatan       : ").bold = True
    p.add_run("{{ jabatan }}")
    p = doc.add_paragraph()
    p.add_run("Unit Kerja    : ").bold = True
    p.add_run("{{ unit_kerja }}")
    p = doc.add_paragraph()
    p.add_run("Instansi      : ").bold = True
    p.add_run("{{ instansi }}")

    # --- Ringkasan per project ---
    doc.add_paragraph()
    doc.add_heading("A. Ringkasan Kegiatan", level=1)
    doc.add_paragraph("{% for p in ringkasan_per_project %}")
    doc.add_paragraph("{{ p.project }}: {{ p.ringkasan }}")
    doc.add_paragraph("{% endfor %}")

    # --- Tabel aktivitas ---
    doc.add_paragraph()
    doc.add_heading("B. Rincian Aktivitas", level=1)

    table = doc.add_table(rows=1, cols=4)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    hdr[0].text = "No"
    hdr[1].text = "Project"
    hdr[2].text = "Aktivitas"
    hdr[3].text = "Status"

    # docxtpl row-cloning: repeat this row for each entry in aktivitas_table
    row_tpl = table.add_row()
    cells = row_tpl.cells
    cells[0].text = "{%tr for row in aktivitas_table %}"
    cells[1].text = "{{ row.no }}"
    cells[2].text = "{{ row.aktivitas }}"
    cells[3].text = "{{ row.status }}"
    # close the row loop in the last cell
    table.add_row().cells[0].text = "{%tr endfor %}"

    # --- Tanda tangan ---
    doc.add_paragraph()
    doc.add_paragraph()
    ttd = doc.add_paragraph()
    ttd.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    ttd.add_run("{{ instansi }}, {{ tanggal_ttd }}")
    doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.add_run("Mengetahui,")
    p = doc.add_paragraph()
    p.add_run("Kepala {{ unit_kerja }}")
    for _ in range(3):
        doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.add_run("{{ nama_kepala }}").bold = True
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.add_run("NIP. {{ nip_kepala }}")

    doc.save(str(path))
