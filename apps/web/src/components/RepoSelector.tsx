import type { ActiveRepo } from "../api/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Check, Loader2, GitBranch } from "lucide-react";

interface Props {
  repos: ActiveRepo[];
  selected: string[];
  onToggle: (id: string) => void;
  loading: boolean;
  periodeLabel: string;
}

export function RepoSelector({ repos, selected, onToggle, loading, periodeLabel }: Props) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Repo Aktif</CardTitle>
        <Badge className="text-muted-foreground">{periodeLabel}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memindai repo yang ada aktivitas…
          </div>
        ) : repos.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            <GitBranch className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Tidak ada repo dengan aktivitas commit di periode ini.
          </div>
        ) : (
          repos.map((r) => {
            const checked = selected.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => onToggle(r.id)}
                className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                  checked
                    ? "border-accent bg-accent/10"
                    : "border-border hover:bg-muted"
                }`}
                aria-pressed={checked}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded border ${
                    checked ? "border-accent bg-accent text-accent-foreground" : "border-input"
                  }`}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {r.owner}/{r.name}
                  </div>
                </div>
                <Badge className="border-accent/30 bg-accent/10 text-accent">
                  {r.commitCount} commit
                </Badge>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
