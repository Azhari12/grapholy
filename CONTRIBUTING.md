# Contributing to Grapholy

Terima kasih tertarik kontribusi! Grapholy adalah project open source untuk membuat laporan otomatis dari aktivitas Git.

## Cara kontribusi

### 1. Bug fix / improvement kecil
- Fork repo, buat branch, kirim PR ke `main`.
- Jelaskan masalah dan solusi di deskripsi PR.

### 2. Tambah source adapter baru
Grapholy dirancang extendable — adapter baru (GitLab, Jira, Linear, dll) sangat diterima.
- Lihat `docs/source-adapters.md` untuk panduan implementasi.
- Sertakan profile contoh di `profiles/` yang pakai adapter baru.

### 3. Tambah template `.docx`
- Template custom dengan placeholder Jinja2 yang berbeda diterima.
- Lihat `docs/templates.md` untuk placeholder yang tersedia.

### 4. Profile contoh baru
- Tambah file YAML di `profiles/` (mis. `startup.example.yaml`, `freelancer.example.yaml`) dengan repo dan keyword_groups Anda.

## Setup development

```bash
git clone <repo-url> grapholy
cd grapholy
cp .env.example .env  # isi PAT, token, dll

# 3 terminal
cd apps/docgen && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd src && uvicorn main:app --reload --port 8787

cd apps/api && npm install && npm run dev

cd apps/web && npm install && npm run dev
```

Atau buka `grapholy.code-workspace` di VS Code untuk multi-root workspace.

## Konvensi

- **TypeScript** untuk FE & BE. Typecheck harus bersih: `npm run typecheck` di `apps/api` dan `npx tsc --noEmit` di `apps/web`.
- **Python 3.10+** untuk docgen. Format: Black default.
- **YAGNI** — jangan tambah abstraction/dependency yang tidak perlu. Lihat prinsip ponytail: stdlib first, reuse yang ada, minimum code that works.
- **Tanpa database** untuk MVP. Jika butuh persist state, diskusi dulu via issue.
- **Tidak mengakses database** langsung dari aplikasi — query ditulis manual oleh user.

## License

MIT — kontribusi Anda di-license di bawah MIT juga.
