import { env } from "../config/env.js";

interface GeneratePayload {
  periode: string;
  tahun: string;
  tanggal_ttd: string;
  penanda: { nama: string; nip: string; jabatan: string; unit_kerja: string; instansi: string; nama_kepala: string; nip_kepala: string };
  template: string;
  // template default (lama) — ringkasan_per_project bisa berbagai shape (Python validasi)
  ringkasan_per_project?: unknown[];
  aktivitas_table?: Array<{ no: number; project: string; aktivitas: string; status: string }>;
  // template RSUD (JSON terstruktur dari AI)
  latar_belakang?: string;
  ruang_lingkup?: string[];
  aktivitas?: Array<{ project: string; aktivitas: string }>;
  rangkuman_narasi?: string;
  ringkasan_penutup?: string[];
}

/** URL kandidat untuk docgen: asli + varian localhost↔127.0.0.1 (atasis
 * masalah IPv4/IPv6 di Windows — Node fetch "localhost" bisa resolve ke ::1
 * padahal uvicorn listen di 127.0.0.1). */
function docgenUrls(path: string): string[] {
  const base = env.pythonServiceUrl;
  const candidates = new Set<string>([base]);
  if (base.includes("localhost")) candidates.add(base.replace("localhost", "127.0.0.1"));
  else if (base.includes("127.0.0.1")) candidates.add(base.replace("127.0.0.1", "localhost"));
  return [...candidates].map((b) => `${b.replace(/\/$/, "")}${path}`);
}

/** Panggil docgen dengan fallback host. Return Response (ok atau tidak). */
async function callDocgen(path: string, body: unknown, timeoutMs = 60_000): Promise<Response> {
  const urls = docgenUrls(path);
  let lastErr: unknown;
  for (const url of urls) {
    try {
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      lastErr = e; // coba URL berikutnya (IPv4/IPv6)
    }
  }
  throw new Error(
    `Python docgen service tidak bisa dijangkau di ${env.pythonServiceUrl}. ` +
      `Pastikan service docgen (port 8787) berjalan — cek terminal 'docgen' saat npm run dev. ` +
      `Detail: ${(lastErr as Error)?.message}`
  );
}

/** Panggil Python docgen service via HTTP, return .docx bytes. */
export async function generateDocx(payload: GeneratePayload): Promise<Buffer> {
  const res = await callDocgen("/generate", payload);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Docgen service ${res.status}: ${body.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

interface ReferenceDoc {
  ringkasan_paragraf: string[];
  tabel_aktivitas_contoh: Array<{ project: string; aktivitas: string }>;
  full_text: string;
  total_paragraf: number;
  total_tabel_rows: number;
}

/** Panggil Python docgen untuk parse dokumen referensi → struktur few-shot untuk AI. */
export async function parseReferenceDoc(path: string): Promise<ReferenceDoc> {
  const res = await callDocgen("/parse-reference", { path });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Docgen parse-reference ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as ReferenceDoc;
}
