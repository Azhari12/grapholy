import { Router } from "express";
import { z } from "zod";
import { GithubAdapter } from "../adapters/githubAdapter.js";
import type { Periode } from "../adapters/sourceAdapter.js";
import { loadProfile } from "../services/configStore.js";

const router = Router();
const github = new GithubAdapter();

// GET /api/repos — list repo terdaftar dari profile aktif (statis, dari YAML)
router.get("/", (_req, res) => {
  const profile = loadProfile();
  if (!profile) return res.status(404).json({ error: "no_profile" });
  res.json({
    profile_name: profile.profile.name,
    repos: profile.repos.map((r) => ({ id: `${r.owner}/${r.name}`, ...r })),
  });
});

// GET /api/repos/active?bulan=&tahun= — search SEMUA commit user di SEMUA repo
// & SEMUA branch, return repo yang ada commit user di periode itu.
router.get("/active", async (req, res) => {
  const q = z
    .object({
      bulan: z.coerce.number().int().min(1).max(12),
      tahun: z.coerce.number().int().min(2000).max(2100),
    })
    .safeParse(req.query);
  if (!q.success) {
    return res.status(400).json({ error: "invalid_query", detail: q.error.flatten() });
  }
  const { bulan, tahun } = q.data;
  const start = new Date(Date.UTC(tahun, bulan - 1, 1));
  const end = new Date(Date.UTC(tahun, bulan, 0, 23, 59, 59));
  const periode: Periode = { since: start.toISOString(), until: end.toISOString() };

  try {
    // Ambil username dari PAT — filter hanya commit user sendiri
    const author = await github.getAuthenticatedUser();
    if (!author) {
      return res.status(401).json({ error: "no_auth", detail: "PAT tidak valid atau kosong" });
    }
    // Satu API call: search semua commit user di semua repo & branch
    const repoCounts = await github.searchUserCommits(periode, author);
    // build list repo aktif
    const active: Array<{ id: string; owner: string; name: string; label: string; category: string; commitCount: number }> = [];
    for (const [fullName, count] of repoCounts.entries()) {
      const [owner, name] = fullName.split("/");
      active.push({
        id: fullName,
        owner,
        name,
        label: name,
        category: owner,
        commitCount: count,
      });
    }
    // urut: commit terbanyak dulu
    active.sort((a, b) => b.commitCount - a.commitCount);
    res.json({
      periode: `${start.toLocaleString("id-ID", { month: "long", timeZone: "UTC" })} ${tahun}`,
      author,
      repos: active,
    });
  } catch (e) {
    res.status(500).json({ error: "fetch_failed", detail: (e as Error).message });
  }
});

export default router;
