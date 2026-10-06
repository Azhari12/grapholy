import type { Penanda, PreviewResponse, RepoConfig, GenerateRequest, ActiveReposResponse, AIConfig } from "./types";

const BASE = "/api";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchRepos(): Promise<{ profile_name: string; repos: RepoConfig[] }> {
  return jsonFetch("/repos");
}

export async function fetchActiveRepos(bulan: number, tahun: number): Promise<ActiveReposResponse> {
  return jsonFetch(`/repos/active?bulan=${bulan}&tahun=${tahun}`);
}

export async function fetchPenanda(): Promise<Penanda> {
  return jsonFetch("/config/penanda");
}

export async function savePenanda(p: Penanda): Promise<Penanda> {
  return jsonFetch("/config/penanda", { method: "PUT", body: JSON.stringify(p) });
}

export async function fetchAIConfig(): Promise<AIConfig> {
  return jsonFetch("/config/ai");
}

export async function saveAIConfig(c: AIConfig): Promise<AIConfig> {
  return jsonFetch("/config/ai", { method: "PUT", body: JSON.stringify(c) });
}

export async function previewCommits(
  periode: GenerateRequest["periode"],
  repoIds: string[]
): Promise<PreviewResponse> {
  return jsonFetch("/laporan/preview-commits", {
    method: "POST",
    body: JSON.stringify({ periode, repoIds }),
  });
}

export async function generateLaporan(req: GenerateRequest): Promise<Blob> {
  const res = await fetch(`${BASE}/laporan/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }
  return res.blob();
}
