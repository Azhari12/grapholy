# Custom Template `.docx`

Grapholy pakai **docxtpl** (Jinja2 untuk `.docx`) untuk render template. Anda bisa custom template sendiri.

## Template default

Lokasi: `apps/docgen/templates/default.docx`

Template ini berisi placeholder Jinja2 yang otomatis ter-render saat generate.

## Placeholder yang tersedia

### Penanda (field identitas)
| Placeholder | Isi |
|---|---|
| `{{ nama }}` | Nama pembuat laporan |
| `{{ nip }}` | NIP pembuat laporan |
| `{{ jabatan }}` | Jabatan |
| `{{ unit_kerja }}` | Unit kerja |
| `{{ instansi }}` | Nama instansi |
| `{{ nama_kepala }}` | Nama kepala (untuk TTD) |
| `{{ nip_kepala }}` | NIP kepala |

### Periode
| Placeholder | Isi |
|---|---|
| `{{ periode }}` | Label periode, mis. "September 2026" |
| `{{ tahun }}` | Tahun, mis. "2026" |
| `{{ tanggal_ttd }}` | Tanggal TTD, mis. "30 September 2026" |

### Dinamis (loop)

**Ringkasan per project:**
```jinja2
{% for p in ringkasan_per_project %}
{{ p.project }}: {{ p.ringkasan }}
{% endfor %}
```

**Tabel aktivitas (dengan row-cloning docxtpl):**
```jinja2
{%tr for row in aktivitas_table %}
{{ row.no }} | {{ row.project }} | {{ row.aktivitas }} | {{ row.status }}
{%tr endfor %}
```

`{%tr %}` adalah sintaks khusus docxtpl untuk meng-clone baris tabel. Tiap iterasi membuat baris baru.

## Bikin template sendiri

1. Buka Microsoft Word (atau LibreOffice Writer).
2. Ketik layout laporan seperti biasa.
3. Sisipkan placeholder di posisi yang diinginkan. Contoh:
   ```
   Nama: {{ nama }}
   NIP: {{ nip }}
   ```
4. Untuk tabel aktivitas: buat tabel 1 baris (header) + 1 baris data, lalu di baris data tulis `{%tr for row in aktivitas_table %}` di cell pertama dan `{%tr endfor %}` di cell terakhir (atau gabung).
5. Simpan sebagai `.docx` di `apps/docgen/templates/default.docx` (overwrite), atau simpan sebagai file lain dan set path di env.

## Conditional

docxtpl support `{% if %}`:
```jinja2
{% if ringkasan_per_project %}
Bagian ringkasan:
{% for p in ringkasan_per_project %}
- {{ p.project }}: {{ p.ringkasan }}
{% endfor %}
{% endif %}
```

## Referensi

- docxtpl docs: <https://docxtpl.readthedocs.io/>
- Jinja2 sintaks: <https://jinja.palletsprojects.com/>
