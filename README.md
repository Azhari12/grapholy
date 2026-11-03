# Grapholy

> **Pembuat laporan otomatis dari aktivitas Git.**
> Open source, netral domain. Fetch commit dari repo GitHub per periode, ringkas dengan LLM, generate dokumen `.docx` dari template yang bisa di-custom.

![status](https://img.shields.io/badge/status-WIP-yellow) ![license](https://img.shields.io/badge/license-MIT-blue) ![stack](https://img.shields.io/badge/stack-React%20%7C%20Express%20%7C%20Python-green)

## Apa ini?

Grapholy mengubah commit-commit GitHub Anda jadi laporan periodik (bulanan / custom range) yang siap dipakai — tanpa menyusun manual. Cocok untuk laporan kerja bulanan, laporan kontraktor, laporan tim pengembangan, atau laporan aktivitas dev lainnya.

**Cara kerja:**
1. Pilih periode (bulan atau custom range) + centang repo
2. Grapholy fetch commit dari GitHub (pakai PAT Anda)
3. Commit dikelompokkan & diringkas jadi kalimat laporan natural (LLM via proxy lokal, opsional)
4. Generate `.docx` dari template generik — field penanda (nama, jabatan, instansi, dll) bisa di-custom via UI

## Stack

| Layer | Teknologi |
|---|---|
| Frontend | Vite + React + TypeScript + Tailwind + shadcn/ui + TanStack Query |
| Backend | Express + TypeScript + Zod |
| Document Generator | Python + FastAPI + python-docx + docxtpl |
| LLM | proxy lokal Anthropic-compatible (`localhost:1930`) |
| Database | Tidak ada (stateless — config di file lokal) |

## Struktur

```
grapholy/
├── apps/
│   ├── web/        # React FE (port 5174)
│   ├── api/        # Express BE (port 3001)
│   └── docgen/     # Python FastAPI (port 8787)
├── profiles/       # contoh profile (e.g. rsud-arifin-achmad.example.yaml)
├── config/         # local config user (gitignored)
├── docs/           # dokumentasi
├── .env.example
└── grapholy.code-workspace
```

> **Bukan monorepo formal** — tiap sub-project di `apps/` independen, masing-masing punya dependency sendiri, tanpa saling import. Dibuka lewat `grapholy.code-workspace` di VS Code.

## Quick start

### 1. Clone & env
```bash
git clone <repo-url> grapholy
cd grapholy
cp .env.example .env
# isi GITHUB_PAT, PROXY_TOKEN, dll di .env
```

### 2. Install dependency (sekali)
```bash
# Python docgen
cd apps/docgen
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ../..

# Node (root + api + web)
npm install
npm run install:all
```

### 3. Jalankan semua service — satu command
```bash
npm run dev
```

Jalankan **docgen + api + web sekaligus** dari root. Ctrl+C sekali mematikan semua.
Buka http://localhost:5174.

<details>
<summary>Cara lama: jalankan per service (3 terminal)</summary>

```bash
# Terminal 1 — Python docgen
cd apps/docgen && .venv/Scripts/python.exe -m uvicorn main:app --port 8787 --app-dir src --reload
# Terminal 2 — Express API
cd apps/api && npm run dev
# Terminal 3 — React web
cd apps/web && npm run dev
```
</details>

## Profile (contoh)

Aplikasi generic. RSUD Arifin Achmad disertakan sebagai contoh profile di `profiles/rsud-arifin-achmad.example.yaml`. Untuk pakai sendiri, salin jadi `config/repos.local.yaml` lalu edit repo Anda.

Lihat `docs/` untuk panduan custom template, tambah source adapter, dll.

## License

MIT — lihat [LICENSE](./LICENSE).
