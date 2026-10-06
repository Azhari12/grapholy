import { loadAIConfig } from "./aiConfigStore.js";

/** Provider-agnostic LLM client. Support dua format:
 * - openai:    POST {baseURL}/chat/completions  (header Authorization: Bearer)
 * - anthropic: POST {baseURL}/v1/messages       (header x-api-key, anthropic-version)
 *
 * baseURL dari config — user isi sendiri (mis. https://api.openai.com/v1,
 * https://api.anthropic.com, http://localhost:11434/v1 untuk Ollama).
 *
 * Fallback aman: kalau LLM gagal, return empty string → classifier pakai subject list.
 */
export async function summarizeCommits(
  groupLabel: string,
  subjects: string[],
  periodeLabel: string
): Promise<string> {
  const cfg = loadAIConfig();
  if (!cfg.apiKey || !cfg.baseURL) {
    console.warn("[llm] apiKey/baseURL kosong, skipping summary");
    return "";
  }
  if (subjects.length === 0) return "";

  const prompt = cfg.promptTemplate
    .replace("{periode}", periodeLabel)
    .replace("{group}", groupLabel)
    .replace("{subjects}", subjects.map((s, i) => `${i + 1}. ${s}`).join("\n"));

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
      max_tokens: 1000,
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
      max_tokens: 1000,
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

/** Test koneksi LLM — kirim prompt singkat, return status + response + metadata.
 * Dipakai endpoint /api/config/ai/test untuk verifikasi config AI sebelum generate. */
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
  // Ollama/local boleh tanpa key, jadi tidak block apiKey kosong untuk openai

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
