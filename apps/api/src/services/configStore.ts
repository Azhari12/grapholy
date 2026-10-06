import { readFileSync, writeFileSync, existsSync } from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import { CONFIG_DIR, ROOT_DIR } from "../config/env.js";

const PENANDA_PATH = path.join(CONFIG_DIR, "penanda.local.json");
const REPOS_LOCAL_PATH = path.join(CONFIG_DIR, "repos.local.yaml");
const PROFILE_EXAMPLE_PATH = path.join(ROOT_DIR, "profiles", "rsud-arifin-achmad.example.yaml");
const PENANDA_EXAMPLE_PATH = path.join(CONFIG_DIR, "penanda.example.json");

export interface Penanda {
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  instansi: string;
  nama_kepala: string;
  nip_kepala: string;
}

export interface RepoConfigYaml {
  owner: string;
  name: string;
  label: string;
  category: string;
  project_key: string;
}

export interface ProfileYaml {
  profile: { name: string; description?: string };
  repos: RepoConfigYaml[];
  keyword_groups?: Array<{ group: string; keywords: string[] }>;
  penanda_default?: Record<string, string>;
}

export function loadProfile(): ProfileYaml | null {
  if (existsSync(REPOS_LOCAL_PATH)) {
    const raw = readFileSync(REPOS_LOCAL_PATH, "utf8");
    return yaml.load(raw) as ProfileYaml;
  }
  // fallback ke profile contoh rsud (user belum bikin local override)
  if (existsSync(PROFILE_EXAMPLE_PATH)) {
    const raw = readFileSync(PROFILE_EXAMPLE_PATH, "utf8");
    return yaml.load(raw) as ProfileYaml;
  }
  return null;
}

export function loadPenanda(): Penanda {
  const profile = loadProfile();
  const defaults = profile?.penanda_default ?? {};
  if (existsSync(PENANDA_PATH)) {
    return { ...defaults, ...JSON.parse(readFileSync(PENANDA_PATH, "utf8")) } as Penanda;
  }
  // contoh template sebagai fallback
  if (existsSync(PENANDA_EXAMPLE_PATH)) {
    return { ...defaults, ...JSON.parse(readFileSync(PENANDA_EXAMPLE_PATH, "utf8")) } as Penanda;
  }
  return {
    nama: defaults.nama ?? "",
    nip: defaults.nip ?? "",
    jabatan: defaults.jabatan ?? "",
    unit_kerja: defaults.unit_kerja ?? "",
    instansi: defaults.instansi ?? "",
    nama_kepala: defaults.nama_kepala ?? "",
    nip_kepala: defaults.nip_kepala ?? "",
  };
}

export function savePenanda(p: Penanda): void {
  writeFileSync(PENANDA_PATH, JSON.stringify(p, null, 2), "utf8");
}
