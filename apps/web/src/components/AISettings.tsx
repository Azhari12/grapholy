import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { AIConfig } from "../api/types";
import { saveAIConfig, testAIConnection, type AITestResult } from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Sparkles, Save, Eye, EyeOff, Zap, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface Props {
  config: AIConfig | null;
  onChange: (c: AIConfig) => void;
}

const FORMAT_HELP: Record<string, { label: string; hint: string; example: string }> = {
  anthropic: {
    label: "Anthropic",
    hint: "Format /v1/messages — pakai untuk Claude langsung atau proxy Anthropic-compat.",
    example: "https://api.anthropic.com",
  },
  openai: {
    label: "OpenAI-compatible",
    hint: "Format /chat/completions — pakai untuk OpenAI, Mistral, Groq, Together, Ollama, LM Studio, dll.",
    example: "https://api.openai.com/v1",
  },
};

const MODELS = [
  "claude-opus-5",
  "claude-sonnet-4-5",
  "gpt-4o",
  "gpt-4o-mini",
  "llama3.1",
  "mistral-large-latest",
];

const PRESETS: Record<string, string> = {
  "Formal RSUD": `Anda adalah asisten penyusun laporan bulanan formal dalam Bahasa Indonesia. Tugas: rangkas daftar commit Git berikut menjadi kalimat laporan formal yang rapi, sesuai konteks grup.

Periode laporan: {periode}
Grup/konteks: {group}

Daftar commit:
{subjects}

Instruksi:
1. Untuk TABEL AKTIVITAS: ubah TIAP commit menjadi satu kalimat formal berawalan kata kerja benda (Penambahan/Penyempurnaan/Perbaikan/Implementasi/Pengembangan/Optimasi/Dokumentasi) + deskripsi singkat + kategori teknis dalam tanda kurung (Back-End/Front-End/DevOps/dll).
2. Hilangkan prefix konvensional (feat:, fix:, refactor:, dll) dan jargon teknis berlebihan.
3. Gunakan Bahasa Indonesia formal, bukan terjemahan harfiah.
4. Untuk RINGKASAN PARAGRAF: gabungkan commit-commit terkait jadi 1-2 kalimat narasi mengalir.
5. Jangan sebut nomor/sha commit. Jangan gunakan bullet point.

Output HANYA daftar kalimat (satu per baris untuk tabel) atau paragraf (untuk ringkasan), tanpa label atau penjelasan meta.`,
  "Ringkas": `Ringkas commit berikut menjadi 1-2 kalimat laporan formal Bahasa Indonesia untuk laporan bulanan, tanpa istilah teknis berlebihan. Konteks: {group}, periode: {periode}.\n\nCommit:\n{subjects}\n\nRingkasan:`,
  "Teknis": `Berdasarkan daftar commit berikut, buat ringkasan teknis singkat untuk laporan pengembangan (periode {periode}, grup {group}). Tekan fitur/bugfix yang signifikan.\n\nCommit:\n{subjects}\n\nRingkasan teknis:`,
};

export function AISettings({ config, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<AITestResult | null>(null);
  const saveM = useMutation({ mutationFn: saveAIConfig });
  const testM = useMutation({
    mutationFn: testAIConnection,
    onSuccess: setTestResult,
  });

  const update = (k: keyof AIConfig, v: string | number) =>
    onChange({ ...config!, [k]: v });

  const handleSave = () => {
    if (config) saveM.mutate(config);
  };

  if (!config) return null;
  const help = FORMAT_HELP[config.format];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <CardTitle>AI Settings</CardTitle>
          <Badge className="border-accent/30 bg-accent/10 text-accent">
            {config.model || "belum set"}
          </Badge>
        </div>
        <button
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "Tutup" : "Edit"}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          {/* Format */}
          <div>
            <label className="label">Format API</label>
            <div className="flex gap-2">
              {(Object.keys(FORMAT_HELP) as Array<keyof typeof FORMAT_HELP>).map((f) => (
                <button
                  key={f}
                  onClick={() =>
                    onChange({ ...config, format: f as AIConfig["format"], baseURL: FORMAT_HELP[f].example })
                  }
                  className={`btn ${config.format === f ? "btn-primary" : "btn-secondary"}`}
                >
                  {FORMAT_HELP[f].label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{help.hint}</p>
          </div>

          {/* Base URL */}
          <div>
            <label className="label">Base URL</label>
            <input
              className="input"
              value={config.baseURL}
              placeholder={help.example}
              onChange={(e) => update("baseURL", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Tanpa trailing slash. Contoh: <code>{help.example}</code>
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="label">API Key / Token</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showKey ? "text" : "password"}
                value={config.apiKey}
                placeholder="sk-... / sk-ant-... / (kosong untuk Ollama)"
                onChange={(e) => update("apiKey", e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? "Sembunyikan key" : "Tampilkan key"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Model + Temperature */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Model</label>
              <input
                className="input"
                list="model-list"
                value={config.model}
                onChange={(e) => update("model", e.target.value)}
              />
              <datalist id="model-list">
                {MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">Temperature: {config.temperature.toFixed(2)}</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={config.temperature}
                onChange={(e) => update("temperature", Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>
          </div>

          {/* Prompt template */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label mb-0">Prompt Template</label>
              <div className="flex gap-1">
                {Object.keys(PRESETS).map((name) => (
                  <button
                    key={name}
                    onClick={() => onChange({ ...config, promptTemplate: PRESETS[name] })}
                    className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="input min-h-[180px] font-mono text-xs leading-relaxed"
              value={config.promptTemplate}
              onChange={(e) => update("promptTemplate", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Placeholder: <code>{"{periode}"}</code>, <code>{"{group}"}</code>, <code>{"{subjects}"}</code>
            </p>
          </div>

          {/* Test connection */}
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Test Koneksi AI</span>
              </div>
              <Button
                variant="secondary"
                onClick={() => testM.mutate()}
                disabled={testM.isPending}
                className="h-8 px-3"
              >
                {testM.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing…</>
                ) : (
                  <><Zap className="h-3.5 w-3.5" /> Test</>
                )}
              </Button>
            </div>
            {testResult && (
              <div
                className={`rounded border p-2 text-xs animate-fade-in ${
                  testResult.ok
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {testResult.ok ? (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Berhasil</>
                  ) : (
                    <><XCircle className="h-3.5 w-3.5" /> Gagal</>
                  )}
                  <span className="font-mono opacity-80">
                    {testResult.provider} · {testResult.model} · {testResult.latencyMs}ms
                  </span>
                </div>
                {testResult.ok ? (
                  <div className="mt-1 font-mono text-[11px] opacity-90">
                    {testResult.response}
                  </div>
                ) : (
                  <div className="mt-1 font-mono text-[11px] opacity-90">
                    {testResult.error}
                  </div>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Simpan config dulu sebelum Test agar pakai nilai terbaru.
            </p>
          </div>

          <Button variant="secondary" onClick={handleSave} disabled={saveM.isPending} className="w-full sm:w-auto">
            <Save className="h-4 w-4" />
            {saveM.isPending ? "Menyimpan…" : "Simpan"}
          </Button>
          {saveM.isSuccess && <span className="ml-2 text-xs text-accent">Tersimpan</span>}
        </CardContent>
      )}
    </Card>
  );
}
