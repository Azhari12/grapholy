# CLAUDE.md — Project Guidelines for Grapholy

> File ini dibaca otomatis Claude di setiap sesi. Patuhi aturan di sini.

## Aturan mutlak

### Proses & server — JANGAN bunuh global
- **JANGAN `taskkill //F //IM node.exe` / `python.exe` / `bun.exe`.** User menjalankan proxy AI lokal via `bun run dev`, dan taskkill global ikut membunuh proxy-nya.
- Untuk mematikan server Grapholy, matikan **berdasarkan port PID saja**: `netstat -ano | grep ":3001.*LISTENING"` lalu `taskkill //F //PID <pid>`. Port Grapholy: 3001 (api), 8787 (docgen), 5174 (web).
- Proxy AI user jalan di `localhost:1930` (Anthropic-compatible). **Jangan pernah ganggu.**

### Git & commit
- **JANGAN PERNAH auto-commit atau auto-push.** Hanya commit/push kalau user explicit minta.
- Setelah selesai kode, boleh kasih tau user "perubahan siap di-commit" lalu tunggu instruksi.
- Kalau user minta commit: commit dulu (jangan langsung push), tanya konfirmasi sebelum push.
- Jangan pakai `--no-verify`, jangan amend tanpa instruksi user.
- Pesan commit: konvensional + akhiri `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Database
- **Aplikasi TIDAK mengakses database.** User yang nulis query manual kalau butuh.
- Jangan tambah ORM, query builder, atau koneksi DB di codebase.

## Konfigurasi — utamanya dari UI Settings
Semua diatur dari halaman **Settings** di app (bukan edit .env manual):
- **GitHub PAT** → `config/github.local.json` (fallback ke `.env` GITHUB_PAT kalau belum di-set di UI)
- **AI/LLM** → `config/ai.local.json` (format, baseURL, apiKey, model, temperature, mode, prompt template)
- **Penanda** → `config/penanda.local.json`

Semua `*.local.json` gitignored. `.env` hanya for fallback/default (PAT, port).

## Konteks proyek

Grapholy = pembuat laporan otomatis dari aktivitas Git (open source, generic).
Versi 1.0 fokus GitHub. Netral domain — RSUD hanya contoh profile.

## Stack
- **FE:** Vite + React + TypeScript + Tailwind 3.4 + shadcn-style + TanStack Query (port 5174)
- **BE:** Express + TypeScript + Zod (port 3001)
- **Docgen:** Python 3.10 + FastAPI + python-docx + docxtpl (port 8787)
- **DB:** Tidak ada (stateless, config di file lokal)
- **LLM:** provider-agnostic (OpenAI-compat & Anthropic-compat), config di `config/ai.local.json`

## Struktur
```
grapholy/
├── apps/{web,api,docgen}/   # 3 sub-project independen, BUKAN monorepo formal
├── profiles/                # contoh profile (rsud-arifin-achmad.example.yaml)
├── config/                  # local config (gitignored: *.local.json/yaml)
├── docs/
└── CLAUDE.md
```

## Template dokumen
- `apps/docgen/templates/rsud.docx` = **file statis** (tidak auto-generate). User boleh edit di Word.
- `apps/docgen/templates/default.docx` = auto-generate kalau absent.
- Placeholder camelCase (`{{ rangkumanNarasi }}`, `{{ latarBelakang }}`) — snake_case bermasalah di DocxTemplate run kedua.
- Bagian list (ruang lingkup, ringkasan per project, tabel aktivitas, ringkasan penutup) diisi MANUAL oleh Python setelah render (loop docxtpl tidak reliable).

## Cara menjalankan

### Satu command (semua service)
```bash
npm run dev
```
Dari root `grapholy/` — jalankan docgen + api + web sekaligus via `concurrently`.
Butuh `npm install` sekali di root dulu (untuk `concurrently`).
Buka http://localhost:5174. Ctrl+C sekali mematikan semua.

### Per service (kalau perlu terpisah)
```bash
# Python docgen (port 8787)
cd apps/docgen && .venv/Scripts/python.exe -m uvicorn main:app --port 8787 --app-dir src --reload
# Express BE (port 3001)
cd apps/api && npm run dev
# React FE (port 5174)
cd apps/web && npm run dev
```

## Typecheck (wajib bersih sebelum bilang "selesai")
- BE: `cd apps/api && npm run typecheck`
- FE: `cd apps/web && npx tsc --noEmit -p tsconfig.app.json`

## Catatan teknis penting
- docxtpl 0.20.2: `{%tr %}`/`{%p %}` loop tidak reliable di template programmatically generated (text ter-split jadi multi-run). Pakai manual fill via `_insert_paragraph_after` (OxmlElement).
- Path Windows: `process.cwd()` resolve dari `apps/api/`, root = `../../`.
- PAT GitHub di `.env` (gitignored). Token proxy/AI di `config/ai.local.json` (gitignored).
- Template RSUD meniru `D:/Azhari/RSUD Arifin Achmad/Laporan/LAPORAN LENGKAP/Laporan-Bulanan-September-2026.docx` (di mesin user, bukan di repo).

## Saat bingung / ada pertanyaan
- Tanya user, jangan asumsi.
- Khususnya soal: format laporan, konten AI, template, keputusan arsitektur.
