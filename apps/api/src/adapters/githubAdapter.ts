import type { CommitItem, Periode, RepoConfig, SourceAdapter } from "./sourceAdapter.js";
import { loadGithubPat } from "../services/githubConfigStore.js";

/** GithubAdapter — fetch commit dari GitHub REST API pakai PAT. */
export class GithubAdapter implements SourceAdapter {
  readonly source = "github" as const;

  /** Ambil username dari PAT (login user yang authenticated). */
  async getAuthenticatedUser(): Promise<string | null> {
    if (!loadGithubPat()) return null;
    const res = await fetch("https://api.github.com/user", { headers: this.headers() });
    if (!res.ok) return null;
    const data = (await res.json()) as { login?: string };
    return data.login ?? null;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const pat = loadGithubPat();
    if (pat) h.Authorization = `Bearer ${pat}`;
    return h;
  }

  /** Search semua commit user di SEMUA repo & SEMUA branch dalam periode.
   * Pakai endpoint /search/commits — satu API call, hasil sudah grouped per repo.
   * Return Map<repo_fullname, commitCount>. */
  async searchUserCommits(
    periode: Periode,
    author: string
  ): Promise<Map<string, number>> {
    // GitHub search pakai format date YYYY-MM-DD
    const since = periode.since.slice(0, 10);
    const until = periode.until.slice(0, 10);
    const q = `author:${author} author-date:${since}..${until}`;
    const result = new Map<string, number>();
    let page = 1;
    // paginasi (per_page max 100, total bisa >100)
    for (let i = 0; i < 10; i++) {
      const url = new URL("https://api.github.com/search/commits");
      url.searchParams.set("q", q);
      url.searchParams.set("sort", "author-date");
      url.searchParams.set("order", "desc");
      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) throw new Error(`GitHub /search/commits ${res.status}`);
      const data = (await res.json()) as {
        total_count?: number;
        items?: Array<{ repository?: { full_name?: string; owner?: { login: string }; name?: string } }>;
      };
      const items = data.items ?? [];
      if (items.length === 0) break;
      for (const it of items) {
        const repo = it.repository;
        const fullName = repo?.full_name ?? "";
        if (fullName) result.set(fullName, (result.get(fullName) ?? 0) + 1);
      }
      if (items.length < 100) break; // halaman terakhir
      page++;
    }
    return result;
  }

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
      const res = await fetch(url, { headers: this.headers() });
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

  /** Cek jumlah commit user tertentu dalam periode untuk satu repo.
   * Kalau author kosong → hitung semua commit (dari siapapun). */
  async countCommits(periode: Periode, repo: RepoConfig, author?: string): Promise<number> {
    const url = new URL(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/commits`
    );
    url.searchParams.set("since", periode.since);
    url.searchParams.set("until", periode.until);
    url.searchParams.set("per_page", "100");
    // filter: hanya commit dari user tertentu (username GitHub)
    if (author) url.searchParams.set("author", author);
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) return 0; // repo inaccessible → skip
    const data = (await res.json()) as unknown[];
    return Array.isArray(data) ? data.length : 0;
  }

  /** Search detail commit user di SEMUA branch untuk satu repo spesifik.
   * Pakai /search/commits + filter repo:owner/name author:user — dapat
   * commit dari semua branch (bukan cuma default). Return CommitItem[]. */
  async fetchUserCommitsAllBranches(
    periode: Periode,
    repo: RepoConfig,
    author: string
  ): Promise<CommitItem[]> {
    const since = periode.since.slice(0, 10);
    const until = periode.until.slice(0, 10);
    const q = `repo:${repo.owner}/${repo.name} author:${author} author-date:${since}..${until}`;
    const result: CommitItem[] = [];
    let page = 1;
    for (let i = 0; i < 10; i++) {
      const url = new URL("https://api.github.com/search/commits");
      url.searchParams.set("q", q);
      url.searchParams.set("sort", "author-date");
      url.searchParams.set("order", "desc");
      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) throw new Error(`GitHub search/commits ${res.status} for ${repo.owner}/${repo.name}`);
      const data = (await res.json()) as {
        items?: Array<{
          sha: string;
          commit?: {
            message?: string;
            author?: { date?: string; name?: string };
          };
        }>;
      };
      const items = data.items ?? [];
      if (items.length === 0) break;
      for (const c of items) {
        result.push({
          sha: c.sha,
          message: c.commit?.message ?? "",
          date: c.commit?.author?.date ?? "",
          author: c.commit?.author?.name ?? author,
          repo: repo.name,
          owner: repo.owner,
        });
      }
      if (items.length < 100) break;
      page++;
    }
    return result;
  }

  async fetchCommits(periode: Periode, repo: RepoConfig): Promise<CommitItem[]> {
    const url = new URL(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/commits`
    );
    url.searchParams.set("since", periode.since);
    url.searchParams.set("until", periode.until);
    url.searchParams.set("per_page", "100");

    const headers = this.headers();

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
