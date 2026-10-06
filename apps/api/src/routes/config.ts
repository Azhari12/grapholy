import { Router } from "express";
import { loadProfile, loadPenanda, savePenanda } from "../services/configStore.js";
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

// GET /api/config/profile
router.get("/profile", (_req, res) => {
  const profile = loadProfile();
  if (!profile) return res.status(404).json({ error: "no_profile" });
  res.json(profile);
});

export default router;
