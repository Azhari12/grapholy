import { readFileSync, writeFileSync, existsSync } from "node:fs";
import * as path from "node:path";
import { CONFIG_DIR } from "../config/env.js";

const GITHUB_CONFIG_PATH = path.join(CONFIG_DIR, "github.local.json");

export interface GithubConfig {
  pat: string;
}

/**
 * Baca PAT GitHub. Prioritas: config/github.local.json → .env GITHUB_PAT.
 * User bisa set dari UI Settings; kalau belum, pakai .env.
 */
export function loadGithubPat(): string {
  if (existsSync(GITHUB_CONFIG_PATH)) {
    try {
      const data = JSON.parse(readFileSync(GITHUB_CONFIG_PATH, "utf8")) as Partial<GithubConfig>;
      if (data.pat) return data.pat;
    } catch {
      // file rusak → fallback .env
    }
  }
  return process.env.GITHUB_PAT ?? "";
}

export function saveGithubPat(pat: string): void {
  writeFileSync(GITHUB_CONFIG_PATH, JSON.stringify({ pat }, null, 2), "utf8");
}

/** Ambil PAT yang tersimpan di config local saja (bukan .env) — untuk UI
 * agar user tahu apakah sudah di-set dari UI. Nilai akan di-mask. */
export function loadGithubPatFromConfig(): string {
  if (!existsSync(GITHUB_CONFIG_PATH)) return "";
  try {
    const data = JSON.parse(readFileSync(GITHUB_CONFIG_PATH, "utf8")) as Partial<GithubConfig>;
    return data.pat ?? "";
  } catch {
    return "";
  }
}
