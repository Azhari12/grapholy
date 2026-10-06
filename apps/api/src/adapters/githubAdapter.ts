import type { CommitItem, Periode, RepoConfig, SourceAdapter } from "./sourceAdapter.js";
import { env } from "../config/env.js";

/** GithubAdapter — fetch commit dari GitHub REST API pakai PAT. */
export class GithubAdapter implements SourceAdapter {
  readonly source = "github" as const;

  /** List semua repo yang PAT punya akses (public + private). */
  async listAccessibleRepos(): Promise<RepoConfig[]> {
    const repos: RepoConfig[] = [];
    let page = 1;
    // paginasi sampai habis (max 100/page, aman sampai ~10 page)
    for (let i = 0; i < 10; i++) {
      const url = new URL("https://api.github.com/user/repos");
      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      url.searchParams.set("sort", "pushed");
      url.searchParams.set("direction", "desc");
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };
      if (env.githubPat) headers.Authorization = `Bearer ${env.githubPat}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`GitHub /user/repos ${res.status}`);
      const data = (await res.json()) as Array<{
        name: string;
        full_name: string;
        owner: { login: string };
        description: string | null;
      }>;
      if (data.length === 0) break;
      for (const r of data) {
        repos.push({
          owner: r.owner.login,
          name: r.name,
          label: r.name,
          category: r.owner.login,
          project_key: r.full_name,
        });
      }
      page++;
    }
    return repos;
  }

  /** Cek jumlah commit dalam periode untuk satu repo (tanpa fetch detail). */
  async countCommits(periode: Periode, repo: RepoConfig): Promise<number> {
    const url = new URL(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/commits`
    );
    url.searchParams.set("since", periode.since);
    url.searchParams.set("until", periode.until);
    url.searchParams.set("per_page", "100");
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (env.githubPat) headers.Authorization = `Bearer ${env.githubPat}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return 0; // repo inaccessible → skip
    const data = (await res.json()) as unknown[];
    return Array.isArray(data) ? data.length : 0;
  }

  async fetchCommits(periode: Periode, repo: RepoConfig): Promise<CommitItem[]> {
    const url = new URL(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/commits`
    );
    url.searchParams.set("since", periode.since);
    url.searchParams.set("until", periode.until);
    url.searchParams.set("per_page", "100");

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (env.githubPat) {
      headers.Authorization = `Bearer ${env.githubPat}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `GitHub API ${res.status} for ${repo.owner}/${repo.name}: ${body.slice(0, 200)}`
      );
    }
    const data = (await res.json()) as Array<{
      sha: string;
      commit: {
        message: string;
        author: { date: string; name: string };
      };
    }>;

    // Filter merge commit (message starts with "Merge") — optional, biar ringkas
    return data
      .filter((c) => !c.commit.message.startsWith("Merge "))
      .map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        date: c.commit.author.date,
        author: c.commit.author.name,
        repo: repo.name,
        owner: repo.owner,
      }));
  }
}
