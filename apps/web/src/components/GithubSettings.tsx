import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchGithubStatus, saveGithubPat, testGithubPat, type GithubTestResult } from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Save, KeyRound, CheckCircle2, XCircle, Loader2, Zap, Eye, EyeOff } from "lucide-react";

export function GithubSettings() {
  const [pat, setPat] = useState("");
  const [show, setShow] = useState(false);
  const [testResult, setTestResult] = useState<GithubTestResult | null>(null);

  const statusQ = useQuery({ queryKey: ["githubStatus"], queryFn: fetchGithubStatus });
  const saveM = useMutation({
    mutationFn: () => saveGithubPat(pat),
    onSuccess: () => statusQ.refetch(),
  });
  const testM = useMutation({
    mutationFn: testGithubPat,
    onSuccess: setTestResult,
  });

  // kosongkan input setelah save sukses
  useEffect(() => {
    if (saveM.isSuccess) setPat("");
  }, [saveM.isSuccess]);

  const status = statusQ.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-accent" />
            <CardTitle>GitHub</CardTitle>
          </div>
          {status && (
            <Badge
              className={
                status.hasPat
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }
            >
              {status.hasPat ? `PAT aktif (${status.source === "ui" ? "diatur di UI" : "dari .env"})` : "PAT belum di-set"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="label">Personal Access Token (PAT)</label>
          <div className="relative">
            <input
              className="input pr-10 font-mono"
              type={show ? "text" : "password"}
              value={pat}
              placeholder={status?.hasPat ? `Tersimpan: ${status.masked} — isi untuk ganti` : "ghp_... atau github_pat_..."}
              onChange={(e) => setPat(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={show ? "Sembunyikan" : "Tampilkan"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Scope minimal: <code>repo</code> (atau fine-grained: Contents read, Metadata read). Buat di GitHub → Settings → Developer settings → Personal access tokens.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => saveM.mutate()} disabled={!pat || saveM.isPending}>
            <Save className="h-4 w-4" />
            {saveM.isPending ? "Menyimpan…" : "Simpan PAT"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => testM.mutate()}
            disabled={testM.isPending || !status?.hasPat}
          >
            {testM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Test Koneksi
          </Button>
          {saveM.isSuccess && <span className="self-center text-xs text-accent">Tersimpan</span>}
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
              {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {testResult.ok ? `Terhubung sebagai ${testResult.login}` : "Gagal"}
            </div>
            {!testResult.ok && <div className="mt-1 font-mono opacity-90">{testResult.error}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
