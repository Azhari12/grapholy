import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PenandaForm } from "../components/PenandaForm";
import { PeriodePicker } from "../components/PeriodePicker";
import { RepoSelector } from "../components/RepoSelector";
import { PreviewCommit } from "../components/PreviewCommit";
import { AISettings } from "../components/AISettings";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { fetchActiveRepos, fetchPenanda, fetchAIConfig, previewCommits, generateLaporan } from "../api/client";
import type { Penanda, Periode, GenerateRequest, AIConfig, ActiveRepo } from "../api/types";
import { FileText, Search, Loader2, Sparkles } from "lucide-react";

const TAHUN_NOW = new Date().getFullYear();
const BULAN_NOW = new Date().getMonth() + 1;

export function HomePage() {
  const [penanda, setPenanda] = useState<Penanda | null>(null);
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null);
  const [periode, setPeriode] = useState<Periode>({
    mode: "bulan",
    bulan: BULAN_NOW,
    tahun: TAHUN_NOW,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [activeRepos, setActiveRepos] = useState<ActiveRepo[]>([]);
  const [template, setTemplate] = useState<"default" | "rsud">("default");

  const penandaQ = useQuery({ queryKey: ["penanda"], queryFn: fetchPenanda });
  const aiQ = useQuery({ queryKey: ["aiConfig"], queryFn: fetchAIConfig });

  // sinkron state saat fetch selesai
  if (penandaQ.data && !penanda) setPenanda(penandaQ.data);
  if (aiQ.data && !aiConfig) setAIConfig(aiQ.data);

  // auto-fetch repo aktif saat bulan/tahun berubah (hanya mode "bulan")
  const activeQ = useQuery({
    queryKey: ["activeRepos", periode.mode === "bulan" ? `${periode.bulan}-${periode.tahun}` : "custom"],
    queryFn: () =>
      periode.mode === "bulan"
        ? fetchActiveRepos(periode.bulan, periode.tahun)
        : Promise.resolve({ periode: "custom", repos: [] }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (activeQ.data) {
      setActiveRepos(activeQ.data.repos);
      // reset selection yang tidak ada di list baru
      setSelected((s) => s.filter((id) => activeQ.data.repos.some((r) => r.id === id)));
    }
  }, [activeQ.data]);

  const previewM = useMutation({
    mutationFn: () => previewCommits(periode, selected),
  });

  const generateM = useMutation({
    mutationFn: async (req: GenerateRequest) => {
      const blob = await generateLaporan(req);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "laporan.docx";
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleGenerate = () => {
    if (!penanda) return;
    const req: GenerateRequest = {
      periode,
      repoIds: selected,
      penanda,
      summarizeWithLLM: true,
      template,
    };
    generateM.mutate(req);
  };

  const periodeLabel =
    periode.mode === "bulan"
      ? activeQ.data?.periode ?? `${periode.bulan}/${periode.tahun}`
      : "custom range";

  if (penandaQ.isLoading) {
    return <div className="text-muted-foreground">Memuat konfigurasi…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-12">
      <header className="space-y-1 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Grapholy</h1>
        <p className="text-sm text-muted-foreground">
          Pembuat laporan otomatis dari aktivitas Git
        </p>
      </header>

      {penanda && <PenandaForm penanda={penanda} onChange={setPenanda} />}

      {aiConfig && <AISettings config={aiConfig} onChange={setAIConfig} />}

      <PeriodePicker periode={periode} onChange={setPeriode} tahunNow={TAHUN_NOW} />

      <RepoSelector
        repos={activeRepos}
        selected={selected}
        onToggle={toggle}
        loading={activeQ.isLoading}
        periodeLabel={periodeLabel}
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <label className="label">Template Dokumen</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTemplate("default")}
                className={`btn ${template === "default" ? "btn-primary" : "btn-secondary"}`}
              >
                Default (generic)
              </button>
              <button
                onClick={() => setTemplate("rsud")}
                className={`btn ${template === "rsud" ? "btn-primary" : "btn-secondary"}`}
              >
                RSUD Arifin Achmad
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {template === "rsud"
                ? "Meniru format Laporan-Bulanan-September-2026.docx (BAB I-IV + tabel + TTD)."
                : "Template generic sederhana (judul + ringkasan + tabel + TTD)."}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-accent" />
              <Sparkles className="h-4 w-4 text-accent" />
              Gunakan LLM untuk ringkasan natural
            </label>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => previewM.mutate()}
                disabled={selected.length === 0 || previewM.isPending}
              >
                {previewM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Preview Commit
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={selected.length === 0 || generateM.isPending}
              >
                {generateM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate .docx
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {generateM.isError && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          Gagal generate: {(generateM.error as Error).message}
        </div>
      )}
      {generateM.isSuccess && (
        <div className="rounded-md border border-accent bg-accent/10 p-3 text-sm text-accent">
          ✅ Laporan .docx berhasil didownload
        </div>
      )}

      <PreviewCommit
        preview={previewM.data ?? null}
        loading={previewM.isPending}
        error={previewM.isError ? (previewM.error as Error).message : null}
      />
    </div>
  );
}
