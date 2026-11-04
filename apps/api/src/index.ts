import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { loadAIConfig } from "./services/aiConfigStore.js";
import laporanRouter from "./routes/laporan.js";
import configRouter from "./routes/config.js";
import reposRouter from "./routes/repos.js";

const app = express();

app.use(cors({ origin: `http://localhost:5174` }));
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "grapholy-api", version: "0.1.0" });
});

// Cek status service eksternal (docgen & AI proxy) — untuk diagnosa di UI
app.get("/api/health/services", async (_req, res) => {
  // docgen punya /health (harus 200). Proxy AI: cukup bisa connect (root boleh 404)
  const checkDocgen = async (): Promise<{ ok: boolean; detail: string; url: string }> => {
    try {
      const r = await fetch(`${env.pythonServiceUrl}/health`, { signal: AbortSignal.timeout(4000) });
      return { ok: r.ok, detail: r.ok ? "ok" : `HTTP ${r.status}`, url: env.pythonServiceUrl };
    } catch (e) {
      return { ok: false, detail: (e as Error).message, url: env.pythonServiceUrl };
    }
  };
  const checkProxy = async (): Promise<{ ok: boolean; detail: string; url: string }> => {
    const base = loadAIConfig().baseURL;
    if (!base) return { ok: false, detail: "baseURL kosong (set di Settings → AI)", url: "" };
    try {
      // connect saja — endpoint root proxy bisa 404 tapi berarti hidup
      await fetch(base, { signal: AbortSignal.timeout(4000) });
      return { ok: true, detail: "reachable", url: base };
    } catch (e) {
      return { ok: false, detail: (e as Error).message, url: base };
    }
  };
  const [docgen, aiProxy] = await Promise.all([checkDocgen(), checkProxy()]);
  res.json({
    api: { ok: true, detail: "ok", url: `http://localhost:${env.apiPort}` },
    docgen,
    aiProxy,
  });
});

app.use("/api/laporan", laporanRouter);
app.use("/api/config", configRouter);
app.use("/api/repos", reposRouter);

app.listen(env.apiPort, () => {
  console.log(`[grapholy-api] listening on http://localhost:${env.apiPort}`);
});
