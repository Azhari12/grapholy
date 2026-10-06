/** SourceAdapter — interface untuk fetch aktivitas dari sumber manapun.
 *
 * Extendability inti Grapholy. Saat ini hanya GithubAdapter.
 * Masa depan: GitlabAdapter, JiraAdapter, LinearAdapter, dll.
 */
export interface CommitItem {
  sha: string;
  message: string;
  date: string; // ISO
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
  since: string; // ISO date, inclusive
  until: string; // ISO date, inclusive (end of day)
}

export interface SourceAdapter {
  readonly source: "github" | "gitlab" | "jira" | "linear";
  fetchCommits(periode: Periode, repo: RepoConfig): Promise<CommitItem[]>;
}
