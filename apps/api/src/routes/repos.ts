import { Router } from "express";
import { loadProfile } from "../services/configStore.js";

const router = Router();

// GET /api/repos — list repo terdaftar dari profile aktif
router.get("/", (_req, res) => {
  const profile = loadProfile();
  if (!profile) return res.status(404).json({ error: "no_profile" });
  res.json({
    profile_name: profile.profile.name,
    repos: profile.repos.map((r) => ({
      id: `${r.owner}/${r.name}`,
      ...r,
    })),
  });
});

export default router;
