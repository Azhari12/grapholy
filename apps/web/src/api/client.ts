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

export interface GithubStatus {
  hasPat: boolean;
  source: "ui" | "env" | "none";
  masked: string;
}

export async function fetchGithubStatus(): Promise<GithubStatus> {
  return jsonFetch("/config/github");
}

export async function saveGithubPat(pat: string): Promise<{ ok: boolean }> {
  return jsonFetch("/config/github", { method: "PUT", body: JSON.stringify({ pat }) });
}

export interface GithubTestResult {
  ok: boolean;
  login?: string;
  name?: string;
  status?: number;
  error?: string;
}

export async function testGithubPat(): Promise<GithubTestResult> {
  return jsonFetch("/config/github/test", { method: "POST" });
}

export interface ServiceStatus {
  ok: boolean;
  detail: string;
  url: string;
}

export interface HealthServices {
  api: ServiceStatus;
  docgen: ServiceStatus;
  aiProxy: ServiceStatus;
}

export async function fetchHealthServices(): Promise<HealthServices> {
  return jsonFetch("/health/services");
}

export interface AITestResult {
  ok: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  response: string;
  error?: string;
}

export async function testAIConnection(): Promise<AITestResult> {
  return jsonFetch("/config/ai/test", { method: "POST" });
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

export interface GenerateResult {
  blob: Blob;
  aiStatus: "ai" | "fallback" | "unknown";
  aiError?: string;
}

export async function generateLaporan(req: GenerateRequest): Promise<GenerateResult> {
  const res = await fetch(`${BASE}/laporan/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }
  const aiStatus = (res.headers.get("X-AI-Status") as "ai" | "fallback" | null) ?? "unknown";
  const aiErrorHeader = res.headers.get("X-AI-Error");
  return {
    blob: await res.blob(),
    aiStatus,
    aiError: aiErrorHeader ? decodeURIComponent(aiErrorHeader) : undefined,
  };
}
