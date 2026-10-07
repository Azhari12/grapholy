import { Router } from "express";
import type { z } from "zod";
import { GithubAdapter } from "../adapters/githubAdapter.js";
import type { CommitItem } from "../adapters/sourceAdapter.js";
import { loadProfile, loadPenanda } from "../services/configStore.js";
import { groupByKeyword, buildAktivitasRows, buildRingkasanPerProject } from "../services/classifier.js";
import { summarizeCommits, generateStructuredContent } from "../services/llm.js";
import { generateDocx } from "../services/docx.js";
import { generateRequestSchema, previewRequestSchema, periodeSchema } from "../schemas/index.js";

const router = Router();
const github = new GithubAdapter();

type Periode = z.infer<typeof periodeSchema>;

/** Hitung ISO date range dari periode. */
function periodeToRange(p: Periode) {
  if (p.mode === "bulan") {
    const year = p.tahun ?? new Date().getFullYear();
    const month = p.bulan ?? new Date().getMonth() + 1;
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const monthName = start.toLocaleString("id-ID", { month: "long", timeZone: "UTC" });
    return {
      since: start.toISOString(),
      until: end.toISOString(),
      periodeLabel: `${monthName} ${year}`,
      tahunLabel: String(year),
      tanggalTtdDefault: end.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    };
  }
  const start = new Date(p.dari!);
  const end = new Date(p.sampai!);
  end.setUTCHours(23, 59, 59, 999);
  return {
    since: start.toISOString(),
    until: end.toISOString(),
    periodeLabel: `${start.toLocaleDateString("id-ID")} - ${end.toLocaleDateString("id-ID")}`,
    tahunLabel: String(start.getFullYear()),
    tanggalTtdDefault: end.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
  };
}

/** Fallback structured content tanpa AI (dipakai saat summarizeWithLLM=false). */
function fallbackStructured(
  groupedCommits: Map<string, string[]>,
  periodeLabel: string
) {
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
    rangkuman_narasi: `Pada bulan ${periodeLabel}, telah dilaksanakan kegiatan pengembangan sistem informasi pada proyek ${projects.join(", ")}.`,
  };
}

// POST /api/laporan/preview-commits
router.post("/preview-commits", async (req, res) => {
  const parsed = previewRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", detail: parsed.error.flatten() });
  }
  const { periode, repoIds } = parsed.data;
  const profile = loadProfile();
  if (!profile) return res.status(404).json({ error: "no_profile" });

  const range = periodeToRange(periode);
  const result: Record<string, { count: number; commits: { sha: string; message: string; date: string; author: string }[]; error?: string }> = {};

  for (const repoId of repoIds) {
    const repo = profile.repos.find((r) => `${r.owner}/${r.name}` === repoId || r.project_key === repoId);
    if (!repo) continue;
    try {
      const commits = await github.fetchCommits({ since: range.since, until: range.until }, repo);
      result[repo.label] = {
        count: commits.length,
        commits: commits.map((c) => ({ sha: c.sha.slice(0, 7), message: c.message.split("\n")[0], date: c.date, author: c.author })),
      };
    } catch (e) {
      result[repo.label] = { count: 0, commits: [], error: (e as Error).message };
    }
  }
  res.json({ periode: range.periodeLabel, repos: result });
});

// POST /api/laporan/generate
router.post("/generate", async (req, res) => {
  const parsed = generateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", detail: parsed.error.flatten() });
  }
  const { periode, repoIds, penanda: penandaOverride, summarizeWithLLM } = parsed.data;
  const tanggalTtd = parsed.data.tanggalTtd;
  const profile = loadProfile();

  const range = periodeToRange(periode);
  const penanda = penandaOverride ?? loadPenanda();
  const groups = profile?.keyword_groups ?? [];

  // 1. fetch + group per repo
  const groupedByRepo = new Map<string, Map<string, CommitItem[]>>();
  for (const repoId of repoIds) {
    const repo = profile?.repos.find((r) => `${r.owner}/${r.name}` === repoId || r.project_key === repoId)
      // juga support repo dari list active (tidak ada di profile YAML)
      ?? { owner: repoId.split("/")[0], name: repoId.split("/")[1], label: repoId.split("/")[1], category: repoId.split("/")[0], project_key: repoId };
    try {
      const commits = await github.fetchCommits({ since: range.since, until: range.until }, repo);
      groupedByRepo.set(repo.label, groupByKeyword(commits, repo, groups));
    } catch (e) {
      console.warn(`[generate] fetch failed for ${repo.label}: ${(e as Error).message}`);
    }
  }

  // 2. summarize per group (LLM opsional)
  const summaries = new Map<string, string>();
  if (summarizeWithLLM) {
    const tasks: Promise<[string, string]>[] = [];
    for (const [, groupsMap] of groupedByRepo) {
      for (const [groupLabel, commits] of groupsMap) {
        const subjects = commits.map((c) => c.message.split("\n")[0]);
        tasks.push(summarizeCommits(groupLabel, subjects, range.periodeLabel).then((s) => [groupLabel, s] as [string, string]));
      }
    }
    const results = await Promise.all(tasks);
    for (const [label, s] of results) if (s) summaries.set(label, s);
  }

  const template = (req.body as { template?: string }).template ?? "default";

  try {
    if (template === "rsud") {
      // Mode RSUD: AI generate JSON terstruktur, kirim ke Python untuk di-tempel ke template
      // Kumpulkan semua commit subjects per repo (untuk dikirim ke AI)
      const groupedCommits = new Map<string, string[]>();
      for (const [repoLabel, groupsMap] of groupedByRepo) {
        const allSubjects: string[] = [];
        for (const [, commits] of groupsMap) {
          allSubjects.push(...commits.map((c) => c.message.split("\n")[0]));
        }
        groupedCommits.set(repoLabel, allSubjects);
      }

      const content = summarizeWithLLM
        ? await generateStructuredContent(groupedCommits, range.periodeLabel)
        : fallbackStructured(groupedCommits, range.periodeLabel);

      const docx = await generateDocx({
        periode: range.periodeLabel,
        tahun: range.tahunLabel,
        tanggal_ttd: tanggalTtd ?? range.tanggalTtdDefault,
        penanda,
        template,
        latar_belakang: content.latar_belakang,
        ruang_lingkup: content.ruang_lingkup,
        ringkasan_per_project: content.ringkasan_per_project.map(
          (p) => ({ ...p } as Record<string, string>)
        ),
        aktivitas: content.aktivitas,
        rangkuman_narasi: content.rangkuman_narasi,
        ringkasan_penutup: content.ringkasan_penutup,
      });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", 'attachment; filename="laporan.docx"');
      res.send(docx);
    } else {
      // Mode default (template lama): summarize per group
      const ringkasan_per_project = buildRingkasanPerProject(groupedByRepo, summaries);
      const aktivitas_table = buildAktivitasRows(groupedByRepo, summaries);
      const docx = await generateDocx({
        periode: range.periodeLabel,
        tahun: range.tahunLabel,
        tanggal_ttd: tanggalTtd ?? range.tanggalTtdDefault,
        penanda,
        ringkasan_per_project,
        aktivitas_table,
        template,
      });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", 'attachment; filename="laporan.docx"');
      res.send(docx);
    }
  } catch (e) {
    res.status(500).json({ error: "docx_generation_failed", detail: (e as Error).message });
  }
});

export default router;
