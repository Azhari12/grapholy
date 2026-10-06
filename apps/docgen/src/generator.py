"""Grapholy — .docx renderer using docxtpl (Jinja2 for docx).

Templates: apps/docgen/templates/
- default.docx — generic template (placeholder sederhana)
- rsud.docx — template RSUD Arifin Achmad (meniru Laporan-Bulanan-September-2026.docx)

Placeholders: {{ nama }}, {{ nip }}, {{ periode }}, {% for row in aktivitas_table %}, {% for p in ringkasan_per_project %}, dll.
"""
from __future__ import annotations

from pathlib import Path

from docx import Document  # type: ignore
from docxtpl import DocxTemplate  # type: ignore
from fastapi.responses import Response

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
TEMPLATE_PATH = TEMPLATES_DIR / "default.docx"
RSUD_TEMPLATE_PATH = TEMPLATES_DIR / "rsud.docx"


class GenerationError(Exception):
    """Raised when template rendering fails."""


def ensure_template_exists(template_name: str = "default") -> Path:
    """Build a template if none exists yet (idempotent). Returns its path."""
    if template_name == "rsud":
        if not RSUD_TEMPLATE_PATH.exists():
            _build_rsud_template(RSUD_TEMPLATE_PATH)
        return RSUD_TEMPLATE_PATH
    # default
    if not TEMPLATE_PATH.exists():
        _build_default_template(TEMPLATE_PATH)
    return TEMPLATE_PATH


def render_docx(context: dict, template_name: str = "default") -> Response:
    """Render the docx template with Jinja2 context → Response with bytes.

    Note: loop template {%tr %}/{%p %} di docxtpl 0.20.2 tidak reliable di
    template yang kita generate programmatically (text ter-split jadi multi-run
    sehingga regex docxtpl tidak match). Solusi: pre-join ringkasan jadi string
    placeholder {{ ringkasan_text }}, dan isi baris tabel aktivitas MANUAL
    setelah render, sebelum save.
    """
    tpl_path = ensure_template_exists(template_name)
    if not tpl_path.exists():
        raise GenerationError(f"Template not found at {tpl_path}")

    # Pre-process context: join ringkasan per project jadi teks paragraf
    # dan flatten penanda ke top-level agar {{ nama }} dll. accessible di template.
    ctx = dict(context)
    penanda = ctx.get("penanda", {})
    if isinstance(penanda, dict):
        for k, v in penanda.items():
            ctx.setdefault(k, v)
    projects = ctx.get("ringkasan_per_project", [])
    # ringkasan_text: gabungan paragraf (untuk placeholder sederhana)
    ctx["ringkasan_text"] = "\n".join(f"{p['project']}: {p['ringkasan']}" for p in projects)
    # ringkasan_bullets: text untuk List Bullet
    ctx["ringkasan_bullets_text"] = "\n".join(f"{p['project']}: {p['ringkasan']}" for p in projects)

    try:
        tpl = DocxTemplate(str(tpl_path))
        tpl.render(ctx)
        # Setelah render, isi tabel aktivitas manual (cari tabel 2-kolom dengan header Project|Aktivitas)
        aktivitas = ctx.get("aktivitas_table", [])
        for table in tpl.docx.tables:
            if len(table.columns) != 2:
                continue
            header = [c.text.strip().lower() for c in table.rows[0].cells]
            if "project" in header[0] or "aktivitas" in header[1]:
                # hapus baris template (baris ke-1 jika ada), tambah baris per aktivitas
                while len(table.rows) > 1:
                    table._tbl.remove(table.rows[1]._tr)
                for row_data in aktivitas:
                    row = table.add_row()
                    row.cells[0].text = str(row_data.get("project", ""))
                    row.cells[1].text = str(row_data.get("aktivitas", ""))
                break
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
    doc.add_paragraph("{%p for p in ringkasan_per_project %}")
    doc.add_paragraph("{{ p.project }}: {{ p.ringkasan }}")
    doc.add_paragraph("{%p endfor %}")

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


def _build_rsud_template(path: Path) -> None:
    """Create rsud.docx template — meniru struktur Laporan-Bulanan-September-2026.docx.

    Struktur: Header tabel → BAB I PENDAHULUAN → BAB II RINGKASAN →
    BAB III LAPORAN BULANAN (tabel aktivitas + rangkuman) → BAB IV PENUTUP → TTD.
    """
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Pt, Inches
    from docx.enum.table import WD_TABLE_ALIGNMENT

    doc = Document()

    # --- Header (tabel 1x1, meniru dokumen asli) ---
    header_table = doc.add_table(rows=1, cols=1)
    header_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = header_table.rows[0].cells[0]
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("L A P O R A N   B U L A N A N")
    r.bold = True
    r.font.size = Pt(14)
    p2 = cell.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.add_run("Laporan Kegiatan Pengembangan Sistem").italic = True
    p3 = cell.add_paragraph()
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p3.add_run("Periode: {{ periode }}")

    doc.add_paragraph()

    # --- BAB I PENDAHULUAN ---
    doc.add_heading("BAB I  PENDAHULUAN", level=1)
    doc.add_heading("1.1  Latar Belakang", level=2)
    doc.add_paragraph(
        "Laporan ini disusun sebagai bentuk pertanggungjawaban pelaksanaan tugas "
        "pengembangan sistem informasi pada periode {{ periode }}. Laporan ini bertujuan "
        "untuk memberikan gambaran yang jelas mengenai kegiatan yang telah dilaksanakan, "
        "sehingga dapat menjadi bahan evaluasi dan dokumentasi pekerjaan."
    )
    doc.add_heading("1.2  Tujuan", level=2)
    for t in [
        "Melaporkan progres kegiatan pengembangan sistem secara berkala (per bulan).",
        "Mendokumentasikan setiap pekerjaan yang telah diselesaikan di setiap proyek.",
        "Memberikan gambaran ringkas yang mudah dipahami mengenai hasil pekerjaan di setiap bulan.",
    ]:
        doc.add_paragraph(t, style="List Bullet")
    doc.add_heading("1.3  Ruang Lingkup", level=2)
    doc.add_paragraph("Laporan ini mencakup seluruh kegiatan pengembangan sistem yang dilaksanakan pada periode {{ periode }}, meliputi:")
    doc.add_paragraph("{{ ringkasan_bullets_text }}")

    # --- BAB II RINGKASAN ---
    doc.add_heading("BAB II  RINGKASAN", level=1)
    doc.add_paragraph("Berikut adalah ringkasan kegiatan yang telah dilaksanakan selama periode {{ periode }}:")
    # ringkasan per project sebagai paragraf (pre-joined, newline-separated)
    doc.add_paragraph("{{ ringkasan_text }}")

    # --- BAB III LAPORAN BULANAN ---
    doc.add_heading("BAB III  LAPORAN BULANAN", level=1)
    doc.add_paragraph(
        "Berikut adalah rincian kegiatan yang dilaksanakan setiap bulan selama periode pelaporan. "
        "Sesuai dengan kerangka laporan bulanan, rincian aktivitas disajikan dalam tabel berikut."
    )
    doc.add_heading("{{ periode }}", level=2)
    doc.add_heading("Daftar Aktivitas", level=3)

    # Tabel aktivitas 2 kolom (Project | Aktivitas). Header saja — baris data
    # diisi MANUAL oleh render_docx() setelah render (loop docxtpl tidak reliable).
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].text = "Project"
    table.rows[0].cells[1].text = "Aktivitas"

    doc.add_paragraph()
    p_rangkuman = doc.add_paragraph()
    p_rangkuman.add_run("Rangkuman: ").bold = True
    p_rangkuman.add_run("{{ ringkasan_text }}")

    # --- BAB IV PENUTUP ---
    doc.add_heading("BAB IV  PENUTUP", level=1)
    doc.add_heading("4.1  Ringkasan", level=2)
    doc.add_paragraph("{{ ringkasan_bullets_text }}")

    # --- Tanda tangan (tabel 3x3) ---
    doc.add_paragraph()
    ttd = doc.add_table(rows=3, cols=3)
    ttd.alignment = WD_TABLE_ALIGNMENT.CENTER
    # kiri atas: kepala
    kiri = ttd.rows[0].cells[0]
    kiri.paragraphs[0].add_run("Kepala Instalasi Electronic Data Processing\n").bold = True
    kiri.paragraphs[0].add_run("{{ instansi }}")
    # kanan atas: tanggal + programmer
    kanan = ttd.rows[0].cells[2]
    kanan.paragraphs[0].add_run("Pekanbaru, {{ tanggal_ttd }}\n").bold = True
    kanan.paragraphs[0].add_run("PROGRAMMER")
    # baris bawah: nama kepala (kiri) + nama programmer (kanan)
    kiri_bawah = ttd.rows[2].cells[0]
    kiri_bawah.paragraphs[0].add_run("{{ nama_kepala }}\n").bold = True
    kiri_bawah.paragraphs[0].add_run("NIP. {{ nip_kepala }}")
    kanan_bawah = ttd.rows[2].cells[2]
    kanan_bawah.paragraphs[0].add_run("{{ nama }}").bold = True

    doc.save(str(path))
