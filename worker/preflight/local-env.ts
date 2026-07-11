// Load the repository's private local env for STANDALONE local processes: the worker run locally
// (`npm run preflight:worker`) and the Browserbase smoke (`npm run preflight:smoke:browserbase`). A local
// PowerShell/bash shell does NOT have the Vercel/Railway env vars, so these standalone tsx entrypoints load
// the local file themselves.
//
// Order: Next's loader first (.env.local, then .env, plus .env.<NODE_ENV>(.local)) — the same loader
// scripts/preflight-verify-db.ts uses — then a minimal fallback for a `.env.preflight` file if an operator
// used that name. Neither step ever OVERRIDES an already-set process.env var, so real Railway/Vercel env
// always wins and this is a safe no-op in production (no .env files there). Secret VALUES are never logged.
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

export function loadLocalEnv(cwd: string = process.cwd()): void {
  loadEnvConfig(cwd); // .env / .env.local / .env.<NODE_ENV>(.local); does not override already-set vars
  for (const name of [".env.preflight.local", ".env.preflight"]) {
    let text: string;
    try {
      text = fs.readFileSync(path.join(cwd, name), "utf8");
    } catch {
      continue; // file absent -> skip
    }
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      const inlineComment = val.indexOf(" #"); // strip a trailing "  # comment" (matches the .example style)
      if (inlineComment >= 0) val = val.slice(0, inlineComment).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val; // never override loadEnvConfig / real env
    }
  }
}
