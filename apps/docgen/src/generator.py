"""Grapholy — .docx renderer using docxtpl (Jinja2 for docx).

Templates: apps/docgen/templates/
- default.docx — generic template (auto-generated if absent)
- rsud.docx — template RSUD Arifin Achmad (STATIC FILE, edit langsung di Word;
  tidak auto-generate agar edit user tidak tertimpa. Build manual via
  _build_rsud_template() kalau perlu re-create dari awal.)

Placeholders: {{ nama }}, {{ nip }}, {{ periode }}, {{ latarBelakang }}, dll.
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
    """Return path to template. rsud.docx is STATIC (not auto-generated) — user
    may edit it directly in Word without fear of being overwritten. If missing,
    raise clear error. default.docx still auto-generates if absent."""
    if template_name == "rsud":
        if not RSUD_TEMPLATE_PATH.exists():
            raise GenerationError(
                f"Template rsud.docx not found at {RSUD_TEMPLATE_PATH}. "
                "This is a static file — restore it from git or rebuild manually "
                "via _build_rsud_template()."
            )
        return RSUD_TEMPLATE_PATH
    # default
    if not TEMPLATE_PATH.exists():
        _build_default_template(TEMPLATE_PATH)
    return TEMPLATE_PATH


def render_docx(context: dict, template_name: str = "default") -> Response:
    """Render the docx template with Jinja2 context → Response with bytes.

    Untuk template RSUD: context berisi JSON terstruktur dari AI:
    - latar_belakang: str (paragraf)
    - ruang_lingkup: list[str] (bullet per proyek)
    - ringkasan_per_project: list[{project, narasi, fitur, perbaikan}]
    - aktivitas: list[{project, aktivitas}]
    - ringkasan_penutup: list[str] (bullet per proyek)
    - penanda: {nama, nip, ...}

    Placeholder sederhana di-render DocxTemplate. Bagian list (ruang lingkup,
    ringkasan per project, tabel aktivitas, ringkasan penutup) diisi MANUAL
    setelah render karena loop docxtpl tidak reliable.
    """
    tpl_path = ensure_template_exists(template_name)
    if not tpl_path.exists():
        raise GenerationError(f"Template not found at {tpl_path}")

    # Flatten penanda ke top-level + siapkan ctx
    ctx = dict(context)
    penanda = ctx.get("penanda", {})
    if isinstance(penanda, dict):
        for k, v in penanda.items():
            ctx.setdefault(k, v)
    # RANGKUMAN BAB III: 1 paragraf narasi. Prioritaskan rangkuman_narasi dari AI
    # (AI generate paragraf utuh). Kalau kosong, fallback gabungan narasi per project.
    projects = ctx.get("ringkasan_per_project", [])
    if ctx.get("rangkuman_narasi"):
        ctx["rangkumanNarasi"] = ctx["rangkuman_narasi"]
    else:
        narrations = []
        for p in projects:
            if isinstance(p, dict):
                n = p.get("narasi") or p.get("ringkasan", "")
                if n:
                    narrations.append(n)
        ctx["rangkumanNarasi"] = " ".join(narrations)
    # ringkasanPenutupPembuka: paragraf pembuka BAB IV (sebelum bullet)
    periode = ctx.get("periode", "")
    project_names = [
        p.get("project", "") for p in projects if isinstance(p, dict) and p.get("project")
    ]
    ctx["ringkasanPenutupPembuka"] = (
        f"Selama periode {periode}, telah dilaksanakan kegiatan pengembangan "
        f"sistem informasi pada proyek {', '.join(project_names)}. "
        f"Berikut adalah ringkasan pekerjaan yang telah diselesaikan:"
    )
    # alias: latarBelakang dari latar_belakang
    if "latar_belakang" in ctx:
        ctx["latarBelakang"] = ctx["latar_belakang"]

    try:
        tpl = DocxTemplate(str(tpl_path))
        tpl.render(ctx)
        docx = tpl.docx

        # Isi bagian list MANUAL (cari marker paragraf, sisipkan setelahnya)
        if template_name == "rsud" or template_name == "default":
            _fill_ruang_lingkup(docx, ctx.get("ruang_lingkup", []))
            _fill_ringkasan_per_project(docx, ctx.get("ringkasan_per_project", []))
            _fill_ringkasan_penutup(docx, ctx.get("ringkasan_penutup", []))
            _fill_tabel_aktivitas(docx, ctx.get("aktivitas", ctx.get("aktivitas_table", [])))

        import io
        out = io.BytesIO()
        docx.save(out)
        data = out.getvalue()
    except Exception as e:
        raise GenerationError(f"docxtpl render failed: {e}") from e

    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="laporan.docx"'},
    )


def _find_paragraph_index(docx, predicate):
    """Cari index paragraf pertama yang match predicate(text). -1 kalau tidak ada."""
    for i, p in enumerate(docx.paragraphs):
        if predicate(p.text):
            return i
    return -1


def _insert_paragraph_after(paragraph, text="", style=None):
    """Sisipkan paragraf baru setelah paragraf yang diberikan. Return paragraf baru."""
    from docx.oxml import OxmlElement
    from docx.text.paragraph import Paragraph
    # buat element <w:p> baru
    new_p = OxmlElement("w:p")
    paragraph._p.addnext(new_p)
    new_para = Paragraph(new_p, paragraph._parent)
    if text:
        new_para.add_run(text)
    if style:
        try:
            new_para.style = style
        except Exception:
            pass
    return new_para


def _fill_ruang_lingkup(docx, items: list) -> None:
    """Isi bullet ruang lingkup setelah paragraf 'meliputi:'."""
    if not items:
        return
    idx = _find_paragraph_index(
        docx, lambda t: "meliputi:" in t.lower() or "meliputi" in t.lower()
    )
    if idx < 0:
        return
    anchor = docx.paragraphs[idx]
    # sisipkan bullet setelah anchor, urutan terbalik karena addnext
    for item in reversed(items):
        _insert_paragraph_after(anchor, item, style="List Bullet")


def _fill_ringkasan_per_project(docx, projects: list) -> None:
    """Isi BAB II: heading + 3 bullet (narasi/fitur/perbaikan) per proyek.
    Sisipkan setelah paragraf 'Berikut adalah ringkasan'."""
    if not projects:
        return
    idx = _find_paragraph_index(
        docx, lambda t: "berikut adalah ringkasan" in t.lower()
    )
    if idx < 0:
        return
    anchor = docx.paragraphs[idx]
    # balik urutan karena addnext menambah di atas
    for p in reversed(projects):
        # 3 bullet dulu (urutan terbalik: perbaikan, fitur, narasi)
        if p.get("perbaikan"):
            _insert_paragraph_after(anchor, p["perbaikan"], style="List Bullet")
        if p.get("fitur"):
            _insert_paragraph_after(anchor, p["fitur"], style="List Bullet")
        if p.get("narasi"):
            _insert_paragraph_after(anchor, p["narasi"], style="List Bullet")
        # heading proyek
        _insert_paragraph_after(anchor, p.get("project", ""), style="Heading 2")


def _fill_ringkasan_penutup(docx, items: list) -> None:
    """Isi BAB IV 4.1 Ringkasan: bullet per proyek. Sisipkan setelah paragraf
    pembuka ('telah dilaksanakan ... Berikut adalah ringkasan')."""
    if not items:
        return
    # cari paragraf pembuka (anchor untuk bullet)
    idx = _find_paragraph_index(
        docx, lambda t: "berikut adalah ringkasan pekerjaan" in t.lower()
    )
    if idx < 0:
        # fallback: cari heading 4.1
        idx = _find_paragraph_index(docx, lambda t: "4.1" in t and "ringkasan" in t.lower())
    if idx < 0:
        return
    anchor = docx.paragraphs[idx]
    for item in reversed(items):
        _insert_paragraph_after(anchor, item, style="List Bullet")


def _fill_tabel_aktivitas(docx, aktivitas: list) -> None:
    """Isi tabel aktivitas 2-kolom (Project|Aktivitas) — cari tabel, hapus baris
    template, tambah baris per item."""
    if not aktivitas:
        return
    for table in docx.tables:
        if len(table.columns) != 2:
            continue
        header = [c.text.strip().lower() for c in table.rows[0].cells]
        if "project" in header[0] or "aktivitas" in header[1]:
            while len(table.rows) > 1:
                table._tbl.remove(table.rows[1]._tr)
            for row_data in aktivitas:
                row = table.add_row()
                row.cells[0].text = str(row_data.get("project", ""))
                row.cells[1].text = str(row_data.get("aktivitas", ""))
            break


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

    Struktur: Header tabel → BAB I PENDAHULUAN (latar belakang/tujuan/ruang lingkup)
    → BAB II RINGKASAN (heading + 3 bullet per proyek) → BAB III LAPORAN BULANAN
    (tabel aktivitas + rangkuman) → BAB IV PENUTUP (bullet per proyek) → TTD.

    Placeholder sederhana (di-render DocxTemplate). Bagian list diisi MANUAL
    oleh render_docx() setelah render, berdasarkan anchor paragraf.
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
    doc.add_paragraph("{{ latarBelakang }}")
    doc.add_heading("1.2  Tujuan", level=2)
    for t in [
        "Melaporkan progres kegiatan pengembangan sistem secara berkala (per bulan).",
        "Mendokumentasikan setiap pekerjaan yang telah diselesaikan di setiap proyek.",
        "Memberikan gambaran ringkas yang mudah dipahami mengenai hasil pekerjaan di setiap bulan.",
    ]:
        doc.add_paragraph(t, style="List Bullet")
    doc.add_heading("1.3  Ruang Lingkup", level=2)
    doc.add_paragraph("Laporan ini mencakup seluruh kegiatan pengembangan sistem yang dilaksanakan pada periode {{ periode }}, meliputi:")

    # --- BAB II RINGKASAN ---
    doc.add_heading("BAB II  RINGKASAN", level=1)
    doc.add_paragraph("Berikut adalah ringkasan kegiatan yang telah dilaksanakan selama periode {{ periode }}:")

    # --- BAB III LAPORAN BULANAN ---
    doc.add_heading("BAB III  LAPORAN BULANAN", level=1)
    doc.add_paragraph(
        "Berikut adalah rincian kegiatan yang dilaksanakan setiap bulan selama periode pelaporan. "
        "Sesuai dengan kerangka laporan bulanan, rincian aktivitas disajikan dalam tabel berikut."
    )
    doc.add_heading("{{ periode }}", level=2)
    doc.add_heading("Daftar Aktivitas", level=3)

    # Tabel aktivitas 2 kolom. Header saja — baris data diisi MANUAL oleh render_docx().
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].text = "Project"
    table.rows[0].cells[1].text = "Aktivitas"

    doc.add_paragraph()
    # Rangkuman: 1 paragraf narasi. Gabung label+placeholder di 1 run agar
    # DocxTemplate render dengan benar (placeholder di run kedua tidak ter-render).
    doc.add_paragraph("Rangkuman: {{ rangkumanNarasi }}")

    # --- BAB IV PENUTUP ---
    doc.add_heading("BAB IV  PENUTUP", level=1)
    doc.add_heading("4.1  Ringkasan", level=2)
    # Paragraf pembuka + bullet per proyek diisi MANUAL oleh _fill_ringkasan_penutup.
    # Anchor: heading "4.1  Ringkasan" — _fill_ringkasan_penutup cari ini lalu
    # sisipkan paragraf pembuka + bullet setelahnya.
    doc.add_paragraph("{{ ringkasanPenutupPembuka }}")

    # --- Tanda tangan (tabel 3x3) ---
    doc.add_paragraph()
    ttd = doc.add_table(rows=3, cols=3)
    ttd.alignment = WD_TABLE_ALIGNMENT.CENTER
    kiri = ttd.rows[0].cells[0]
    kiri.paragraphs[0].add_run("Kepala Instalasi Electronic Data Processing\n").bold = True
    kiri.paragraphs[0].add_run("{{ instansi }}")
    kanan = ttd.rows[0].cells[2]
    kanan.paragraphs[0].add_run("Pekanbaru, {{ tanggal_ttd }}\n").bold = True
    kanan.paragraphs[0].add_run("PROGRAMMER")
    kiri_bawah = ttd.rows[2].cells[0]
    kiri_bawah.paragraphs[0].add_run("{{ nama_kepala }}\n").bold = True
    kiri_bawah.paragraphs[0].add_run("NIP. {{ nip_kepala }}")
    kanan_bawah = ttd.rows[2].cells[2]
    kanan_bawah.paragraphs[0].add_run("{{ nama }}").bold = True

    doc.save(str(path))
