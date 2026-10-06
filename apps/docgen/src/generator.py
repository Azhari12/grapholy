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


def parse_reference_doc(path_str: str) -> dict:
    """Parse dokumen .docx referensi → struktur yang bisa dipakai AI sebagai few-shot.

    Return:
      - ringkasan_paragraf: list str (paragraf narasi per project dari BAB II)
      - tabel_aktivitas_contoh: list {project, aktivitas} (baris tabel contoh)
      - full_text: str (seluruh teks dokumen, untuk konteks penuh)
    """
    from docx import Document as DocxDocument  # type: ignore

    path = Path(path_str)
    if not path.exists():
        raise GenerationError(f"Reference doc not found: {path}")

    try:
        doc = DocxDocument(str(path))
    except Exception as e:
        raise GenerationError(f"Cannot open .docx: {e}") from e

    # ekstrak paragraf (ringkasan narasi)
    ringkasan = []
    capture = False
    for p in doc.paragraphs:
        t = p.text.strip()
        if t.startswith("BAB II") or t.startswith("2."):
            capture = True
        if t.startswith("BAB III"):
            capture = False
        if capture and t and not t.startswith("BAB") and not t.startswith("Berikut"):
            ringkasan.append(t)

    # ekstrak tabel aktivitas (tabel 2 kolom, ada header "Project"/"Aktivitas")
    tabel_contoh = []
    for table in doc.tables:
        if len(table.columns) != 2:
            continue
        header = [c.text.strip().lower() for c in table.rows[0].cells]
        if "project" in header[0] or "aktivitas" in header[1]:
            for row in table.rows[1:]:
                cells = [c.text.strip() for c in row.cells]
                if cells[0] and cells[1]:
                    tabel_contoh.append({"project": cells[0], "aktivitas": cells[1]})
            break

    # full text untuk konteks penuh
    full_text = "\n".join(p.text.strip() for p in doc.paragraphs if p.text.strip())

    return {
        "ringkasan_paragraf": ringkasan[:10],  # batasi biar tidak terlalu panjang
        "tabel_aktivitas_contoh": tabel_contoh[:15],
        "full_text": full_text[:8000],  # batasi ~8K char
        "total_paragraf": len(ringkasan),
        "total_tabel_rows": len(tabel_contoh),
    }


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
