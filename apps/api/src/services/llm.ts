import { loadAIConfig } from "./aiConfigStore.js";
import { parseReferenceDoc } from "./docx.js";

/** Konten terstruktur dari AI untuk template RSUD. */
export interface StructuredContent {
  latar_belakang: string;
  ruang_lingkup: string[];
  ringkasan_per_project: Array<{
    project: string;
    narasi: string;
    fitur: string;
    perbaikan: string;
  }>;
  aktivitas: Array<{ project: string; aktivitas: string }>;
  ringkasan_penutup: string[];
}

const STRUCTURED_PROMPT = `Anda adalah asisten penyusun laporan bulanan formal Bahasa Indonesia untuk laporan pengembangan sistem. Tugas: buat konten laporan dari daftar commit Git berikut, return HANYA JSON valid (tanpa markdown code fence, tanpa penjelasan).

Periode laporan: {periode}
Daftar commit (grouped per proyek):
{subjects}

Aturan konten (WAJIB):
- Bahasa Indonesia formal, tidak ada markdown (*, **, \`, dll), tidak ada prefix git (feat:, fix:).
- latar_belakang: 1 paragraf narasi pengantar, sebut periode & proyek yang dikerjakan.
- ruang_lingkup: array string, 1 bullet per proyek, format "Nama Proyek — mencakup [kegiatan]".
- ringkasan_per_project: array, 1 objek per proyek. narasi = "Pada bulan {periode}, pengembangan {project} difokuskan pada [kegiatan utama]". fitur = "Fitur yang diselesaikan: [daftar fitur]". perbaikan = "Perbaikan teknis: [daftar perbaikan]".
- aktivitas: array, 1 objek per commit. aktivitas = kalimat formal berawalan "Penambahan/Penyempurnaan/Perbaikan/Implementasi/Pengembangan" + deskripsi + kategori teknis dalam kurung (Back-End)/(Front-End)/(DevOps).
- ringkasan_penutup: array, 1 bullet per proyek, format "{project}: [ringkasan singkat]".

Return JSON dengan struktur persis:
{
  "latar_belakang": "...",
  "ruang_lingkup": ["...", "..."],
  "ringkasan_per_project": [
    {"project": "...", "narasi": "...", "fitur": "...", "perbaikan": "..."}
  ],
  "aktivitas": [
    {"project": "...", "aktivitas": "..."}
  ],
  "ringkasan_penutup": ["...", "..."]
}`;

/** Panggil AI untuk generate konten terstruktur (JSON). Satu panggil untuk semua bagian.
 *
 * Provider-agnostic: openai (/chat/completions) atau anthropic (/v1/messages).
 * Fallback: kalau AI gagal / JSON invalid, return struktur minimal dari subject list.
 */
export async function generateStructuredContent(
  groupedCommits: Map<string, string[]>,
  periodeLabel: string
): Promise<StructuredContent> {
  const cfg = loadAIConfig();
  if (!cfg.apiKey && !cfg.baseURL) {
    return fallbackContent(groupedCommits, periodeLabel);
  }

  // Build subjects text: per group, list commit subjects
  const subjectsText = Array.from(groupedCommits.entries())
    .map(
      ([group, subjects]) =>
        `## ${group}\n${subjects.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    )
    .join("\n\n");

  const prompt = STRUCTURED_PROMPT
    .replace("{periode}", periodeLabel)
    .replace("{subjects}", subjectsText);

  // mode with-reference-doc: inject few-shot
  let fullPrompt = prompt;
  if (cfg.mode === "with-reference-doc" && cfg.referenceDocPath) {
    try {
      const ref = await parseReferenceDoc(cfg.referenceDocPath);
      const refBlock = [
        "\n\n=== CONTOH DARI DOKUMEN REFERENSI ===",
        "Contoh paragraf ringkasan:",
        ...ref.ringkasan_paragraf.map((p) => `- ${p}`),
        "",
        "Contoh baris tabel aktivitas:",
        ...ref.tabel_aktivitas_contoh.map((r) => `- [${r.project}] ${r.aktivitas}`),
        "=== AKHIR CONTOH ===\n",
        "Ikuti gaya kalimat dari contoh di atas.",
      ].join("\n");
      fullPrompt = prompt + refBlock;
    } catch (e) {
      console.warn(`[llm] parse reference failed: ${(e as Error).message}`);
    }
  }

  try {
    const text =
      cfg.format === "anthropic"
        ? await callAnthropic(cfg, fullPrompt)
        : await callOpenAI(cfg, fullPrompt);
    return parseStructuredJson(text, groupedCommits, periodeLabel);
  } catch (e) {
    console.warn(`[llm] structured call failed: ${(e as Error).message}, using fallback`);
    return fallbackContent(groupedCommits, periodeLabel);
  }
}

/** Parse JSON dari response AI. Handle markdown fence & text sebelum/sesudah JSON. */
function parseStructuredJson(
  text: string,
  groupedCommits: Map<string, string[]>,
  periodeLabel: string
): StructuredContent {
  let cleaned = text.trim();
  // strip markdown code fence ```json ... ```
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  // coba extract JSON object pertama
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  try {
    const parsed = JSON.parse(cleaned) as Partial<StructuredContent>;
    return {
      latar_belakang: parsed.latar_belakang ?? "",
      ruang_lingkup: Array.isArray(parsed.ruang_lingkup) ? parsed.ruang_lingkup : [],
      ringkasan_per_project: Array.isArray(parsed.ringkasan_per_project)
        ? parsed.ringkasan_per_project
        : [],
      aktivitas: Array.isArray(parsed.aktivitas) ? parsed.aktivitas : [],
      ringkasan_penutup: Array.isArray(parsed.ringkasan_penutup)
        ? parsed.ringkasan_penutup
        : [],
    };
  } catch (e) {
    console.warn(`[llm] JSON parse failed: ${(e as Error).message}, using fallback`);
    return fallbackContent(groupedCommits, periodeLabel);
  }
}

/** Fallback: struktur minimal dari subject list (tanpa AI). */
function fallbackContent(
  groupedCommits: Map<string, string[]>,
  periodeLabel: string
): StructuredContent {
  const projects = Array.from(groupedCommits.keys());
  return {
    latar_belakang: `Laporan ini disusun sebagai bentuk pertanggungjawaban pelaksanaan tugas pengembangan sistem informasi pada periode ${periodeLabel}. Pekerjaan dilakukan pada proyek ${projects.join(", ")}.`,
    ruang_lingkup: projects.map((p) => `${p} — mencakup kegiatan pengembangan pada periode ${periodeLabel}.`),
    ringkasan_per_project: projects.map((p) => ({
      project: p,
      narasi: `Pada bulan ${periodeLabel}, pengembangan ${p} dilakukan.`,
      fitur: "",
      perbaikan: "",
    })),
    aktivitas: Array.from(groupedCommits.entries()).flatMap(([project, subjects]) =>
      subjects.map((s) => ({
        project,
        aktivitas: s.replace(/^\w+(\(.+\))?:\s*/, ""),
      }))
    ),
    ringkasan_penutup: projects.map((p) => `${p}: kegiatan pengembangan periode ${periodeLabel}.`),
  };
}

/** Legacy: ringkas per group (untuk mode default/non-RSUD). Tetap dipakai untuk template default. */
export async function summarizeCommits(
  groupLabel: string,
  subjects: string[],
  periodeLabel: string
): Promise<string> {
  const cfg = loadAIConfig();
  if (!cfg.apiKey && !cfg.baseURL) return "";
  if (subjects.length === 0) return "";

  const prompt = cfg.promptTemplate
    .replace("{periode}", periodeLabel)
    .replace("{group}", groupLabel)
    .replace("{subjects}", subjects.map((s, i) => `${i + 1}. ${s}`).join("\n"))
    .replace("{referenceContent}", "");

  try {
    const text =
      cfg.format === "anthropic"
        ? await callAnthropic(cfg, prompt)
        : await callOpenAI(cfg, prompt);
    return text.trim();
  } catch (e) {
    console.warn(`[llm] call failed (${cfg.format}): ${(e as Error).message}`);
    return "";
  }
}

async function callOpenAI(cfg: Awaited<ReturnType<typeof loadAIConfig>>, prompt: string): Promise<string> {
  const url = `${cfg.baseURL.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: cfg.temperature,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(cfg: Awaited<ReturnType<typeof loadAIConfig>>, prompt: string): Promise<string> {
  const url = `${cfg.baseURL.replace(/\/$/, "")}/v1/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: cfg.temperature,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return data.content?.find((c) => c.type === "text")?.text ?? "";
}

/** Test koneksi LLM — kirim prompt test singkat. */
export async function testLLMConnection(): Promise<{
  ok: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  response: string;
  error?: string;
}> {
  const cfg = loadAIConfig();
  const start = Date.now();

  if (!cfg.baseURL) {
    return { ok: false, provider: cfg.format, model: cfg.model, latencyMs: 0, response: "", error: "baseURL kosong" };
  }
  if (!cfg.apiKey && cfg.format === "anthropic") {
    return { ok: false, provider: cfg.format, model: cfg.model, latencyMs: 0, response: "", error: "apiKey kosong (Anthropic butuh API key)" };
  }

  const testPrompt = "Balas dengan tepat satu kalimat: 'Koneksi AI Grapholy berhasil.' Jangan tambah apa-apa.";

  try {
    const text =
      cfg.format === "anthropic"
        ? await callAnthropic(cfg, testPrompt)
        : await callOpenAI(cfg, testPrompt);
    const latencyMs = Date.now() - start;
    if (!text.trim()) {
      return { ok: false, provider: cfg.format, model: cfg.model, latencyMs, response: "", error: "Response kosong" };
    }
    return {
      ok: true,
      provider: cfg.format,
      model: cfg.model,
      latencyMs,
      response: text.trim(),
    };
  } catch (e) {
    return {
      ok: false,
      provider: cfg.format,
      model: cfg.model,
      latencyMs: Date.now() - start,
      response: "",
      error: (e as Error).message,
    };
  }
}
