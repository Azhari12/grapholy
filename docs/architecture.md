# Arsitektur Grapholy

## Komponen

```
grapholy/
├── apps/
│   ├── web/        # React SPA (port 5174)
│   ├── api/        # Express REST API (port 3001)
│   └── docgen/     # Python FastAPI microservice (port 8787)
├── profiles/       # contoh profile
├── config/         # local config user (gitignored)
└── docs/           # dokumentasi
```

## Data flow

1. User pilih periode + repo + (opsional) edit penanda → FE POST `/api/laporan/generate`
2. Express BE fetch commit via `GithubAdapter` (GitHub REST API + PAT)
3. BE dedupe merge commit, group per repo + per keyword group (dari profile)
4. (Opsional) BE kirim commit subjects ke LLM proxy untuk ringkasan natural
5. BE kirim payload terstruktur ke Python docgen service via HTTP
6. Python render template `.docx` pakai `docxtpl` (Jinja2) → return bytes
7. BE stream `.docx` ke FE → browser download

## Extendability — SourceAdapter

Layer `apps/api/src/adapters/` berisi interface `SourceAdapter`:

```ts
interface SourceAdapter {
  readonly source: "github" | "gitlab" | "jira" | "linear";
  fetchCommits(periode: Periode, repo: RepoConfig): Promise<CommitItem[]>;
}
```

Saat ini hanya `GithubAdapter`. Untuk tambah sumber baru, implementasi interface ini — lihat `docs/source-adapters.md`.

## Stateless — tanpa database

Semua config disimpan di file lokal:
- `config/penanda.local.json` — identitas user (nama, NIP, jabatan, dll)
- `config/repos.local.yaml` — override repo user (atau pakai profile contoh)
- `.env` — PAT GitHub, token proxy, port

Tidak ada state yang perlu persist — sumber data = GitHub API realtime.

## LLM — opsional & graceful fallback

LLM dipanggil via proxy lokal (`localhost:1930`, format Anthropic Messages API). Jika proxy gagal/token kosong, classifier pakai subject list sebagai ringkasan — generate tetap jalan.
