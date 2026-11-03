import { Router } from "express";
import { z } from "zod";
import { loadProfile, loadPenanda, savePenanda } from "../services/configStore.js";
import { loadAIConfig, saveAIConfig } from "../services/aiConfigStore.js";
import { loadGithubPat, saveGithubPat, loadGithubPatFromConfig } from "../services/githubConfigStore.js";
import { testLLMConnection } from "../services/llm.js";
import { penandaSchema } from "../schemas/index.js";

const router = Router();

// GET /api/config/github — status PAT (masked, tidak expose nilai penuh)
router.get("/github", (_req, res) => {
  const pat = loadGithubPat();
  const fromUi = loadGithubPatFromConfig();
  res.json({
    hasPat: pat.length > 0,
    source: fromUi ? "ui" : pat ? "env" : "none",
    masked: pat ? `${pat.slice(0, 4)}…${pat.slice(-4)}` : "",
  });
});

// PUT /api/config/github — simpan PAT dari UI
router.put("/github", (req, res) => {
  const parsed = z.object({ pat: z.string() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", detail: parsed.error.flatten() });
  }
  saveGithubPat(parsed.data.pat.trim());
  res.json({ ok: true });
});

// POST /api/config/github/test — test PAT ke GitHub (validasi + login username)
router.post("/github/test", async (_req, res) => {
  const pat = loadGithubPat();
  if (!pat) return res.json({ ok: false, error: "PAT kosong" });
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${pat}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      return res.json({ ok: false, status: r.status, error: r.status === 401 ? "PAT invalid/expired" : `GitHub ${r.status}` });
    }
    const data = (await r.json()) as { login?: string; name?: string };
    res.json({ ok: true, login: data.login, name: data.name });
  } catch (e) {
    res.json({ ok: false, error: (e as Error).message });
  }
});

// GET /api/config/penanda
router.get("/penanda", (_req, res) => {
  res.json(loadPenanda());
});

// PUT /api/config/penanda
router.put("/penanda", (req, res) => {
  const parsed = penandaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", detail: parsed.error.flatten() });
  }
  savePenanda(parsed.data);
  res.json(parsed.data);
});

// GET /api/config/ai
router.get("/ai", (_req, res) => {
  res.json(loadAIConfig());
});

// PUT /api/config/ai
router.put("/ai", (req, res) => {
  const parsed = z
    .object({
      format: z.enum(["openai", "anthropic"]),
      baseURL: z.string().url().or(z.literal("")),
      apiKey: z.string(),
      model: z.string().min(1),
      temperature: z.number().min(0).max(1),
      mode: z.enum(["default", "with-reference-doc", "structure-only"]),
      referenceDocPath: z.string(),
      promptTemplate: z.string().min(10),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", detail: parsed.error.flatten() });
  }
  saveAIConfig(parsed.data);
  res.json(parsed.data);
});

// GET /api/config/profile
router.get("/profile", (_req, res) => {
  const profile = loadProfile();
  if (!profile) return res.status(404).json({ error: "no_profile" });
  res.json(profile);
});

// POST /api/config/ai/test — test koneksi LLM dengan prompt singkat
router.post("/ai/test", async (_req, res) => {
  const result = await testLLMConnection();
  res.json(result);
});

export default router;
