import type { PreviewResponse } from "../api/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { GitCommit } from "lucide-react";

interface Props {
  preview: PreviewResponse | null;
  loading: boolean;
  error: string | null;
}

export function PreviewCommit({ preview, loading, error }: Props) {
  if (loading) return <div className="text-sm text-muted-foreground animate-pulse">Memuat commit…</div>;
  if (error) return <div className="text-sm text-destructive">Gagal preview: {error}</div>;
  if (!preview) return null;

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Preview — {preview.periode}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(preview.repos).map(([label, res]) => (
          <div key={label}>
            <div className="mb-2 flex items-center gap-2">
              <GitCommit className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold">{label}</span>
              <Badge className="text-muted-foreground">{res.count} commit</Badge>
              {res.error && <span className="text-xs text-destructive">⚠ {res.error}</span>}
            </div>
            <ul className="space-y-1 pl-6">
              {res.commits.slice(0, 10).map((c) => (
                <li key={c.sha} className="font-mono text-xs text-muted-foreground">
                  <span className="text-accent">{c.sha}</span> {c.message}
                </li>
              ))}
              {res.commits.length > 10 && (
                <li className="text-xs text-muted-foreground">…{res.commits.length - 10} lainnya</li>
              )}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
