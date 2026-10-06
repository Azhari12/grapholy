import { env } from "../config/env.js";
import { loadAIConfig } from "./aiConfigStore.js";

/** Panggil proxy lokal (Anthropic Messages API format) untuk ringkas commit jadi kalimat laporan.
 *
 * Prompt template diambil dari ai.local.json (bisa di-edit via UI /api/config/ai).
 * Fallback aman: kalau LLM gagal, return empty string → classifier pakai subject list.
 */
export async function summarizeCommits(
  groupLabel: string,
  subjects: string[],
  periodeLabel: string
): Promise<string> {
  const cfg = loadAIConfig();
  if (!env.proxyUrl || !env.proxyToken) return "";
  if (subjects.length === 0) return "";

  const prompt = cfg.promptTemplate
    .replace("{periode}", periodeLabel)
    .replace("{group}", groupLabel)
    .replace("{subjects}", subjects.map((s, i) => `${i + 1}. ${s}`).join("\n"));

  try {
    const res = await fetch(`${env.proxyUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.proxyToken,
        anthropic_version: "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 1000,
        temperature: cfg.temperature,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.warn(`[llm] proxy returned ${res.status}, skipping summary`);
      return "";
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((c) => c.type === "text")?.text;
    return (text ?? "").trim();
  } catch (e) {
    console.warn(`[llm] fetch failed: ${(e as Error).message}, skipping summary`);
    return "";
  }
}

