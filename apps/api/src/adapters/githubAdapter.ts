import type { CommitItem, Periode, RepoConfig, SourceAdapter } from "./sourceAdapter.js";
import { env } from "../config/env.js";

/** GithubAdapter — fetch commit dari GitHub REST API pakai PAT. */
export class GithubAdapter implements SourceAdapter {
  readonly source = "github" as const;

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
