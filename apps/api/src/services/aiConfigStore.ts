import { readFileSync, writeFileSync, existsSync } from "node:fs";
import * as path from "node:path";
import { CONFIG_DIR } from "../config/env.js";

const AI_CONFIG_PATH = path.join(CONFIG_DIR, "ai.local.json");

export type ProviderFormat = "openai" | "anthropic";

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
  /** Prompt template — pakai placeholder {subjects}, {periode}, {group}. */
  promptTemplate: string;
}

/** Default prompt — dirancang menghasilkan kalimat formal Indonesia seperti
 * format laporan RSUD (mis. "Penambahan...", "Penyempurnaan...", "Perbaikan...").
 * Lihat referensi: Laporan-Bulanan-Agustus-2026.docx */
export const DEFAULT_AI_CONFIG: AIConfig = {
  format: "anthropic",
  baseURL: "https://api.anthropic.com",
  apiKey: "",
  model: "claude-opus-5",
  temperature: 0.3,
  promptTemplate: `Anda adalah asisten penyusun laporan bulanan formal dalam Bahasa Indonesia. Tugas: rangkas daftar commit Git berikut menjadi kalimat laporan formal yang rapi, sesuai konteks grup.

Periode laporan: {periode}
Grup/konteks: {group}

Daftar commit:
{subjects}

Instruksi:
1. Untuk TABEL AKTIVITAS: ubah TIAP commit menjadi satu kalimat formal berawalan kata kerja benda (Penambahan/Penyempurnaan/Perbaikan/Implementasi/Pengembangan/Optimasi/Dokumentasi) + deskripsi singkat + kategori teknis dalam tanda kurung (Back-End/Front-End/DevOps/dll).
2. Hilangkan prefix konvensional (feat:, fix:, refactor:, dll) dan jargon teknis berlebihan.
3. Gunakan Bahasa Indonesia formal, bukan terjemahan harfiah.
4. Untuk RINGKASAN PARAGRAF: gabungkan commit-commit terkait jadi 1-2 kalimat narasi mengalir (mis. "Pada bulan {periode}, pengembangan {group} difokuskan pada...").
5. Jangan sebut nomor/sha commit. Jangan gunakan bullet point.

Output HANYA daftar kalimat (satu per baris untuk tabel) atau paragraf (untuk ringkasan), tanpa label atau penjelasan meta.`,
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
