import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPenanda, fetchAIConfig } from "../api/client";
import type { Penanda, AIConfig } from "../api/types";
import { GithubSettings } from "../components/GithubSettings";
import { AISettings } from "../components/AISettings";
import { PenandaForm } from "../components/PenandaForm";
import { cn } from "../lib/utils";
import { KeyRound, Sparkles, UserCircle, Settings as SettingsIcon, ArrowLeft } from "lucide-react";

type Tab = "github" | "ai" | "penanda";

interface Props {
  onBack: () => void;
}

const TABS: Array<{ id: Tab; label: string; icon: typeof KeyRound }> = [
  { id: "github", label: "GitHub", icon: KeyRound },
  { id: "ai", label: "AI / LLM", icon: Sparkles },
  { id: "penanda", label: "Penanda", icon: UserCircle },
];

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
