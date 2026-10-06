import type { CommitItem, RepoConfig } from "../adapters/sourceAdapter.js";

export interface KeywordGroup {
  group: string;
  keywords: string[];
}

export interface ClassifiedRow {
  no: number;
  project: string;
  aktivitas: string;
  status: string;
}

export interface RingkasanProject {
  project: string;
  ringkasan: string;
}

/** Parse conventional commit type dari subject. */
export function parseType(message: string): string {
  const first = message.split("\n")[0].trim();
  const m = first.match(/^(\w+)(\(.+\))?:/);
  return m ? m[1] : "other";
}

/** Bersihkan subject: hapus prefix `type(scope):`, lowercase ringkas. */
export function cleanSubject(message: string): string {
  const first = message.split("\n")[0].trim();
  return first.replace(/^\w+(\(.+\))?:\s*/, "");
}

/** Kelompokkan commit per repo + per keyword group. */
export function groupByKeyword(
  commits: CommitItem[],
  repo: RepoConfig,
  groups: KeywordGroup[]
): Map<string, CommitItem[]> {
  const buckets = new Map<string, CommitItem[]>();
  const used = new Set<number>();

  // Assign commit ke keyword group pertama yang match
  for (const g of groups) {
    const matched = commits.filter((c, i) => {
      if (used.has(i)) return false;
      const text = c.message.toLowerCase();
      return g.keywords.some((k) => text.includes(k.toLowerCase()));
    });
    if (matched.length) {
      buckets.set(`${repo.label} — ${g.group}`, matched);
      matched.forEach((_, i) => commits[i] && used.add(i));
    }
  }

  // Sisa commit tanpa keyword match → bucket "Umum"
  const rest = commits.filter((_, i) => !used.has(i));
  if (rest.length) buckets.set(`${repo.label} — Umum`, rest);

  return buckets;
}

/** Bangun baris tabel aktivitas dari commit yang sudah dikelompokkan. */
export function buildAktivitasRows(
  groupedByRepo: Map<string, Map<string, CommitItem[]>>,
  summaries: Map<string, string>
): ClassifiedRow[] {
  const rows: ClassifiedRow[] = [];
  let no = 1;
  for (const [repoLabel, groups] of groupedByRepo) {
    for (const [groupLabel, commits] of groups) {
      const aktivitas = commits
        .map((c) => cleanSubject(c.message))
        .slice(0, 5) // max 5 subject per baris biar tidak panjang
        .join("; ");
      const project = repoLabel;
      const ringkasan = summaries.get(groupLabel) ?? aktivitas;
      rows.push({
        no: no++,
        project,
        aktivitas: ringkasan,
        status: "Selesai",
      });
    }
  }
  return rows;
}

/** Bangun ringkasan per project (pakai ringkasan LLM kalau ada, else subject list). */
export function buildRingkasanPerProject(
  groupedByRepo: Map<string, Map<string, CommitItem[]>>,
  summaries: Map<string, string>
): RingkasanProject[] {
  const out: RingkasanProject[] = [];
  for (const [repoLabel, groups] of groupedByRepo) {
    const parts: string[] = [];
    for (const [groupLabel, commits] of groups) {
      const s = summaries.get(groupLabel);
      if (s) parts.push(s);
      else {
        const subj = commits
          .map((c) => cleanSubject(c.message))
          .slice(0, 3)
          .join("; ");
        if (subj) parts.push(`${groupLabel}: ${subj}`);
      }
    }
    if (parts.length) out.push({ project: repoLabel, ringkasan: parts.join(" ") });
  }
  return out;
}
