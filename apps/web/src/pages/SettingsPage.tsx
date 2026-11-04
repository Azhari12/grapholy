import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPenanda, fetchAIConfig, fetchHealthServices } from "../api/client";
import type { Penanda, AIConfig } from "../api/types";
import { GithubSettings } from "../components/GithubSettings";
import { AISettings } from "../components/AISettings";
import { PenandaForm } from "../components/PenandaForm";
import { Card, CardContent } from "../components/ui/Card";
import { cn } from "../lib/utils";
import { KeyRound, Sparkles, UserCircle, Settings as SettingsIcon, ArrowLeft, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

type Tab = "github" | "ai" | "penanda";

interface Props {
  onBack: () => void;
}

const TABS: Array<{ id: Tab; label: string; icon: typeof KeyRound }> = [
  { id: "github", label: "GitHub", icon: KeyRound },
  { id: "ai", label: "AI / LLM", icon: Sparkles },
  { id: "penanda", label: "Penanda", icon: UserCircle },
];

function ServiceStatusBar() {
  const q = useQuery({ queryKey: ["healthServices"], queryFn: fetchHealthServices, refetchInterval: 15_000 });
  const items = q.data
    ? [
        { name: "API", ...q.data.api },
        { name: "Docgen (8787)", ...q.data.docgen },
        { name: "AI Proxy", ...q.data.aiProxy },
      ]
    : [];
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
        <span className="font-medium text-muted-foreground">Status service:</span>
        {q.isLoading && <span className="text-muted-foreground">memeriksa…</span>}
        {items.map((it) => (
          <span key={it.name} className="flex items-center gap-1">
            {it.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
            <span className={it.ok ? "text-foreground" : "text-destructive"}>{it.name}</span>
            {!it.ok && <span className="font-mono text-[10px] text-muted-foreground">({it.detail})</span>}
          </span>
        ))}
        <button onClick={() => q.refetch()} className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn("h-3.5 w-3.5", q.isFetching && "animate-spin")} /> cek ulang
        </button>
      </CardContent>
    </Card>
  );
}

export function SettingsPage({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>("github");
  const [penanda, setPenanda] = useState<Penanda | null>(null);
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null);

  const penandaQ = useQuery({ queryKey: ["penanda"], queryFn: fetchPenanda });
  const aiQ = useQuery({ queryKey: ["aiConfig"], queryFn: fetchAIConfig });

  useEffect(() => {
    if (penandaQ.data && !penanda) setPenanda(penandaQ.data);
  }, [penandaQ.data, penanda]);
  useEffect(() => {
    if (aiQ.data && !aiConfig) setAIConfig(aiQ.data);
  }, [aiQ.data, aiConfig]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-12">
      <header className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        </div>
      </header>

      <ServiceStatusBar />

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "github" && <GithubSettings />}
      {tab === "ai" && aiConfig && <AISettings config={aiConfig} onChange={setAIConfig} />}
      {tab === "penanda" && penanda && <PenandaForm penanda={penanda} onChange={setPenanda} />}
    </div>
  );
}
