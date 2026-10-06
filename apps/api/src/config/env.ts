import dotenv from "dotenv";
import * as path from "node:path";

// BE dijalankan dari apps/api/ (npm run dev) → root grapholy/ = ../../
const ROOT_DIR = path.resolve(process.cwd(), "..", "..") + path.sep;
dotenv.config({ path: path.join(ROOT_DIR, ".env") });

function required(key: string, fallback = ""): string {
  const v = process.env[key] ?? fallback;
  if (!v && !fallback) {
    console.warn(`[env] ${key} not set — using empty default`);
  }
  return v;
}

export const env = {
  githubPat: required("GITHUB_PAT"),
  apiPort: Number(required("API_PORT", "3001")),
  pythonServiceUrl: required("PYTHON_SERVICE_URL", "http://localhost:8787"),
};

export const CONFIG_DIR = path.join(ROOT_DIR, "config") + path.sep;
export { ROOT_DIR };
