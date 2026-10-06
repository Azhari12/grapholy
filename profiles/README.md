# Profiles

Folder berisi **contoh profile** untuk Grapholy. Aplikasi ini generic — profile adalah konfigurasi contoh, bukan keharusan.

## Pakai profile

1. Salin profile contoh ke config lokal:
   ```bash
   cp profiles/rsud-arifin-achmad.example.yaml ../config/repos.local.yaml
   ```
2. Edit `config/repos.local.yaml` — ganti owner, repo, label dengan milik Anda.
3. Buat `config/penanda.local.json` untuk identitas Anda (nama, NIP, jabatan, dll). Lihat template di `config/penanda.example.json`.

## Bikin profile sendiri

Profile adalah file YAML dengan struktur:

```yaml
profile:
  name: "Nama tim Anda"
  description: "Deskripsi singkat"

repos:
  - owner: username-or-org
    name: nama-repo
    label: "Label tampil di UI"
    category: "Kategori grouping"
    project_key: "Project key"

keyword_groups:        # opsional — clustering commit per fitur
  - group: "Nama grup fitur"
    keywords: ["kata1", "kata2"]

penanda_default:        # opsional — nilai default penanda
  instansi: "Nama instansi"
  nama_kepala: "Nama"
```

Anda bisa tambah profile lain di folder ini sebagai contoh untuk orang lain (mis. `startup.example.yaml`, `freelancer.example.yaml`).
