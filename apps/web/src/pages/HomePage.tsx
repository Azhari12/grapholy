import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PenandaForm } from "../components/PenandaForm";
import { PeriodePicker } from "../components/PeriodePicker";
import { RepoSelector } from "../components/RepoSelector";
import { PreviewCommit } from "../components/PreviewCommit";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { fetchRepos, fetchPenanda, previewCommits, generateLaporan } from "../api/client";
import type { Penanda, Periode, GenerateRequest } from "../api/types";
import { FileText, Search, Loader2 } from "lucide-react";

const TAHUN_NOW = new Date().getFullYear();

export function HomePage() {
  const [penanda, setPenanda] = useState<Penanda | null>(null);
  const [periode, setPeriode] = useState<Periode>({
    mode: "bulan",
    bulan: new Date().getMonth() + 1,
    tahun: TAHUN_NOW,
  });
  const [selected, setSelected] = useState<string[]>([]);

  const reposQ = useQuery({ queryKey: ["repos"], queryFn: fetchRepos });
  const penandaQ = useQuery({
    queryKey: ["penanda"],
    queryFn: fetchPenanda,
  });

  // sinkron penanda saat fetch selesai
  if (penandaQ.data && !penanda) setPenanda(penandaQ.data);

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
    };
    generateM.mutate(req);
  };

  if (reposQ.isLoading || penandaQ.isLoading) {
    return <div className="text-muted-foreground">Memuat konfigurasi…</div>;
  }
  if (reposQ.error) {
    return <div className="text-destructive">Gagal memuat repo: {(reposQ.error as Error).message}</div>;
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

      <PeriodePicker periode={periode} onChange={setPeriode} tahunNow={TAHUN_NOW} />

      <RepoSelector
        repos={reposQ.data?.repos ?? []}
        selected={selected}
        onToggle={toggle}
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4 accent-accent"
            />
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
