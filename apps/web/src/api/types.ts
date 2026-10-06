// Shared types — mirror BE schemas (apps/api/src/schemas). Project independen,
// jadi duplicate type kecil di sini (YAGNI: tidak perlu shared package).

export interface Penanda {
  nama: string;
  nip: string;
  jabatan: string;
  unit_kerja: string;
  instansi: string;
  nama_kepala: string;
  nip_kepala: string;
}

export interface RepoConfig {
  id: string;
  owner: string;
  name: string;
  label: string;
  category: string;
  project_key: string;
}

export interface ActiveRepo {
  id: string;
  owner: string;
  name: string;
  label: string;
  category: string;
  commitCount: number;
}

export interface ActiveReposResponse {
  periode: string;
  repos: ActiveRepo[];
}

export interface AIConfig {
  format: "openai" | "anthropic";
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  mode: "default" | "with-reference-doc" | "structure-only";
  referenceDocPath: string;
  promptTemplate: string;
}

export interface PeriodeBulan {
  mode: "bulan";
  bulan: number;
  tahun: number;
  tanggal_ttd?: string;
}

export interface PeriodeCustom {
  mode: "custom";
  dari: string;
  sampai: string;
  tanggal_ttd?: string;
}

export type Periode = PeriodeBulan | PeriodeCustom;

export interface PreviewCommit {
  sha: string;
  message: string;
  date: string;
  author: string;
}

export interface PreviewRepoResult {
  count: number;
  commits: PreviewCommit[];
  error?: string;
}

export interface PreviewResponse {
  periode: string;
  repos: Record<string, PreviewRepoResult>;
}

export interface GenerateRequest {
  periode: Periode;
  repoIds: string[];
  penanda?: Penanda;
  summarizeWithLLM?: boolean;
  tanggalTtd?: string;
  template?: "default" | "rsud";
}
