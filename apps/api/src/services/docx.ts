import { env } from "../config/env.js";

interface GeneratePayload {
  periode: string;
  tahun: string;
  tanggal_ttd: string;
  penanda: { nama: string; nip: string; jabatan: string; unit_kerja: string; instansi: string; nama_kepala: string; nip_kepala: string };
  ringkasan_per_project: Array<{ project: string; ringkasan: string }>;
  aktivitas_table: Array<{ no: number; project: string; aktivitas: string; status: string }>;
  template: string;
}

/** Panggil Python docgen service via HTTP, return .docx bytes. */
export async function generateDocx(payload: GeneratePayload): Promise<Buffer> {
  const res = await fetch(`${env.pythonServiceUrl}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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
  const res = await fetch(`${env.pythonServiceUrl}/parse-reference`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Docgen parse-reference ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as ReferenceDoc;
}
