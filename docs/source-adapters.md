# Source Adapters

Grapholy dirancang untuk membaca aktivitas dari berbagai sumber, tidak hanya GitHub. Saat ini hanya `GithubAdapter` yang ter-implementasi.

## Interface

Semua adapter implementasi interface `SourceAdapter` di `apps/api/src/adapters/sourceAdapter.ts`:

```ts
export interface CommitItem {
  sha: string;
  message: string;
  date: string;   // ISO
  author: string;
  repo: string;
  owner: string;
}

export interface RepoConfig {
  owner: string;
  name: string;
  label: string;
  category: string;
  project_key: string;
}

export interface Periode {
  since: string;  // ISO, inclusive
  until: string;  // ISO, inclusive (end of day)
}

export interface SourceAdapter {
  readonly source: "github" | "gitlab" | "jira" | "linear";
  fetchCommits(periode: Periode, repo: RepoConfig): Promise<CommitItem[]>;
}
```

## Menambah adapter baru

### Contoh: GitlabAdapter

1. Buat `apps/api/src/adapters/gitlabAdapter.ts`:

```ts
import type { CommitItem, Periode, RepoConfig, SourceAdapter } from "./sourceAdapter.js";

export class GitlabAdapter implements SourceAdapter {
  readonly source = "gitlab" as const;

  async fetchCommits(periode: Periode, repo: RepoConfig): Promise<CommitItem[]> {
    const url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(
      `${repo.owner}/${repo.name}`
    )}/repository/commits?since=${periode.since}&until=${periode.until}`;
    const res = await fetch(url, {
      headers: { "PRIVATE-TOKEN": process.env.GITLAB_TOKEN ?? "" },
    });
    if (!res.ok) throw new Error(`Gitlab API ${res.status}`);
    const data = (await res.json()) as Array<{
      id: string;
      message: string;
      authored_date: string;
      author_name: string;
    }>;
    return data
      .filter((c) => !c.message.startsWith("Merge "))
      .map((c) => ({
        sha: c.id,
        message: c.message,
        date: c.authored_date,
        author: c.author_name,
        repo: repo.name,
        owner: repo.owner,
      }));
  }
}
```

2. Di route `laporan.ts`, pilih adapter berdasarkan field `source` di repo config (atau field baru di profile). Contoh:

```ts
const adapter = repo.source === "gitlab" ? new GitlabAdapter() : new GithubAdapter();
const commits = await adapter.fetchCommits(range, repo);
```

3. Update profile YAML untuk include field `source` per repo (default `"github"`).

## Sumber data potensial masa depan

- **GitLab** — REST API `/projects/:id/repository/commits`
- **Jira** — `/rest/api/3/issue/changelog` atau `/worklog`
- **Linear** — GraphQL API `issues` filter
- **Bitbucket** — `/repositories/:workspace/:repo/commits`

Kontribusi adapter baru sangat diterima. Lihat `CONTRIBUTING.md`.
