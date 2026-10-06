import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import laporanRouter from "./routes/laporan.js";
import configRouter from "./routes/config.js";
import reposRouter from "./routes/repos.js";

const app = express();

app.use(cors({ origin: `http://localhost:5174` }));
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "grapholy-api", version: "0.1.0" });
});

app.use("/api/laporan", laporanRouter);
app.use("/api/config", configRouter);
app.use("/api/repos", reposRouter);

app.listen(env.apiPort, () => {
  console.log(`[grapholy-api] listening on http://localhost:${env.apiPort}`);
});
