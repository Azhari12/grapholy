import { readFileSync, writeFileSync, existsSync } from "node:fs";
import * as path from "node:path";
import { CONFIG_DIR } from "../config/env.js";

const AI_CONFIG_PATH = path.join(CONFIG_DIR, "ai.local.json");

export type ProviderFormat = "openai" | "anthropic";
export type GenerateMode = "default" | "with-reference-doc" | "structure-only";

export interface AIConfig {
  /** Format API yang dipakai. openai = /v1/chat/completions, anthropic = /v1/messages */
  format: ProviderFormat;
  /** Base URL provider, mis. https://api.anthropic.com, https://api.openai.com/v1, http://localhost:11434/v1 */
  baseURL: string;
  /** API key / token provider. Disimpan di config local (gitignored). */
  apiKey: string;
  /** Model, mis. claude-opus-5, gpt-4o, llama3.1, dll */
  model: string;
  temperature: number;
  /** Mode generate:
   * - default: pakai promptTemplate saja (hemat token). Prompt sudah dirancang ikuti format RSUD.
   * - with-reference-doc: baca dokumen referensi (referenceDocPath), kirim konten sebagai few-shot. Boros token (~5-8K).
   * - structure-only: prompt struktur hemat, AI tidak baca dokumen & tidak tiru gaya spesifik. */
  mode: GenerateMode;
  /** Path absolut dokumen .docx referensi (untuk mode "with-reference-doc"). */
  referenceDocPath: string;
  /** Prompt template — pakai placeholder {subjects}, {periode}, {group}, {referenceContent}. */
  promptTemplate: string;
}

/** Default prompt — dirancang mengikuti format Laporan-Bulanan-Agustus-2026.docx
 * tanpa perlu baca dokumen (hemat token). Pola kalimat di ekstrak dari dokumen:
 * - Tabel aktivitas: "Penambahan/Penyempurnaan/Perbaikan ... (Back-End/Front-End/DevOps)"
 * - Ringkasan: "Pada bulan {periode}, pengembangan {group} difokuskan pada ..." */
export const DEFAULT_AI_CONFIG: AIConfig = {
  format: "anthropic",
  baseURL: "https://api.anthropic.com",
  apiKey: "",
  model: "claude-opus-5",
  temperature: 0.3,
  mode: "default",
  referenceDocPath: "D:/Azhari/RSUD Arifin Achmad/Laporan/LAPORAN LENGKAP/Laporan-Bulanan-Agustus-2026.docx",
  promptTemplate: `Anda adalah asisten penyusun laporan bulanan formal Bahasa Indonesia untuk laporan pengembangan sistem. Tugas: ubah daftar commit Git berikut menjadi kalimat laporan formal yang rapi.

Periode laporan: {periode}
Grup/konteks: {group}

Daftar commit:
{subjects}

Aturan format (WAJIB diikuti):

UNTUK TABEL AKTIVITAS (tiap commit = 1 baris kalimat):
- Awali dengan kata benda aksi: "Penambahan" / "Penyempurnaan" / "Perbaikan" / "Implementasi" / "Pengembangan" / "Optimasi" / "Dokumentasi" / "Konfigurasi" / "Integrasi"
- Lanjutkan deskripsi singkat fitur/pekerjaan (bukan terjemahan subject git mentah)
- Akhiri dengan kategori teknis dalam tanda kurung: (Back-End) / (Front-End) / (DevOps) / (Konfigurasi) / (Integrasi) / (Database)
- Contoh: "Penambahan opsi variabel baru dan approval gates pada manajemen template dokumen (Back-End)"
- Contoh: "Penyempurnaan kontrol akses dokumen dan alur persetujuan dengan role-based permission (Front-End)"
- Contoh: "Perbaikan retrieval nama dokumen: penggunaan field 'nama' sebagai pengganti 'deskripsi' pada GwDokumen (Back-End)"

UNTUK RINGKASAN PARAGRAF (gabung commit terkait jadi narasi):
- Format: "Pada bulan {periode}, pengembangan {group} difokuskan pada [kegiatan utama], serta [kegiatan sekunder]."
- Sebut kata kunci fitur, bukan SHA/angka commit
- 1-2 kalimat mengalir per project

LARANGAN:
- JANGAN sebut SHA commit, nomor, atau prefix git (feat:, fix:, refactor:)
- JANGAN gunakan bullet point atau numbering
- JANGAN tambah label "Tabel Aktivitas:" / "Ringkasan:" di output
- Output HANYA daftar kalimat (satu per baris) — tidak ada penjelasan meta`,
};

export function loadAIConfig(): AIConfig {
  if (existsSync(AI_CONFIG_PATH)) {
    const stored = JSON.parse(readFileSync(AI_CONFIG_PATH, "utf8"));
    return { ...DEFAULT_AI_CONFIG, ...stored } as AIConfig;
  }
  // fallback ke env (untuk default user)
  return {
    ...DEFAULT_AI_CONFIG,
    baseURL: process.env.LLM_BASE_URL || DEFAULT_AI_CONFIG.baseURL,
    apiKey: process.env.LLM_API_KEY || DEFAULT_AI_CONFIG.apiKey,
    model: process.env.LLM_MODEL || DEFAULT_AI_CONFIG.model,
    format: (process.env.LLM_FORMAT as ProviderFormat) || DEFAULT_AI_CONFIG.format,
  };
}

export function saveAIConfig(c: AIConfig): void {
  writeFileSync(AI_CONFIG_PATH, JSON.stringify(c, null, 2), "utf8");
}
