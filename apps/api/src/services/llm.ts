import { env } from "../config/env.js";

/** Panggil proxy lokal (Anthropic Messages API format) untuk ringkas commit jadi kalimat laporan.
 *
 * Fallback aman: kalau LLM gagal, return empty string → classifier pakai subject list.
 */
export async function summarizeCommits(
  groupLabel: string,
  subjects: string[]
): Promise<string> {
  if (!env.proxyUrl || !env.proxyToken) return "";
  if (subjects.length === 0) return "";

  const prompt = `Ringkas commit-commit berikut menjadi 1-2 kalimat laporan formal bahasa Indonesia untuk laporan bulanan, tanpa istilah teknis berlebihan. Konteks grup: ${groupLabel}.

Commit:
${subjects.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Ringkasan:`;

  try {
    const res = await fetch(`${env.proxyUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.proxyToken,
        anthropic_version: "2023-06-01",
      },
      body: JSON.stringify({
        model: env.llmModel,
        max_tokens: 300,
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
