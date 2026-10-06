import type { RepoConfig } from "../api/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Check } from "lucide-react";

interface Props {
  repos: RepoConfig[];
  selected: string[];
  onToggle: (id: string) => void;
}

export function RepoSelector({ repos, selected, onToggle }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Repo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {repos.map((r) => {
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
                <div className="text-sm font-medium">{r.label}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {r.owner}/{r.name}
                </div>
              </div>
              <Badge className="text-muted-foreground">{r.category}</Badge>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
