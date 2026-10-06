import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { AIConfig } from "../api/types";
import { saveAIConfig } from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Sparkles, Save } from "lucide-react";

interface Props {
  config: AIConfig | null;
  onChange: (c: AIConfig) => void;
}

const MODELS = [
  "claude-sonnet-4-5",
  "claude-opus-4-5",
  "claude-haiku-4-5",
  "claude-3-5-sonnet-20241022",
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
  const saveM = useMutation({ mutationFn: saveAIConfig });

  const update = (k: keyof AIConfig, v: string | number) =>
    onChange({ ...config!, [k]: v });

  const handleSave = () => {
    if (config) saveM.mutate(config);
  };

  if (!config) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <CardTitle>AI Settings</CardTitle>
          <Badge className="border-accent/30 bg-accent/10 text-accent">
            {config.model}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Model</label>
              <select
                className="input"
                value={config.model}
                onChange={(e) => update("model", e.target.value)}
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                {!MODELS.includes(config.model) && (
                  <option value={config.model}>{config.model} (custom)</option>
                )}
              </select>
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

          <Button variant="secondary" onClick={handleSave} disabled={saveM.isPending} className="w-full sm:w-auto">
            <Save className="h-4 w-4" />
            {saveM.isPending ? "Menyimpan…" : "Simpan"}
          </Button>
          {saveM.isSuccess && (
            <span className="ml-2 text-xs text-accent">Tersimpan</span>
          )}
        </CardContent>
      )}
    </Card>
  );
}
