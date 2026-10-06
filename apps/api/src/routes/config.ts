import { Router } from "express";
import { z } from "zod";
import { loadProfile, loadPenanda, savePenanda } from "../services/configStore.js";
import { loadAIConfig, saveAIConfig } from "../services/aiConfigStore.js";
import { penandaSchema } from "../schemas/index.js";

const router = Router();

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

export default router;
