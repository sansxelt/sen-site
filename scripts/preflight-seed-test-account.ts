// Seed ONE sealed test account (role "customer") on the owner's API-verification lane application, so a
// verification flow can prove the SAME identity with `sign_in_as customer`. The credentials are sealed by the
// vault (AES-256-GCM) exactly like any test account; the plaintext is never printed, logged, or returned —
// this script prints only the role and a username mask.
//
// This is the SMALLEST production-correct primitive. It does not build a Connections UI or an identity system;
// it stores one role-scoped credential the worker decrypts at run time and nowhere else.
//
// Requires the same environment the deployment uses (a service-role Supabase client + the vault key):
//   VRAELIS_SECRET_KEY   64-hex vault key (AES-256-GCM)
//   the Supabase service-role env the admin client reads
// and:
//   VRAELIS_SEED_OWNER   the account email that owns the lane app / API key   (required)
//   VRAELIS_SEED_ROLE    role label, default "customer"
//   VRAELIS_SEED_USER    default demo@example.com   (the fixture's PUBLIC sign-in email)
//   VRAELIS_SEED_PASS    default hunter2            (the fixture's PUBLIC sign-in password)
//
// The defaults are the broken-checkout fixture's own published credentials, so no real secret is involved.
// For any other app, pass real credentials via env; they are sealed and never echoed.
export {};

// Load .env.local (and .env) into process.env BEFORE anything reads it, exactly like the other DB scripts.
// supabase-admin reads env lazily, so this runs early enough; without it the script sees no Supabase config
// even when the deployment is fully configured, which reads as "Supabase not there".
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { listApplications } from "../lib/v-applications";
import { LANE_BUILDER } from "../lib/preflight/verification-lane";
import { addTestAccount, listConnections } from "../lib/preflight/connections-db";
import { vaultConfigured } from "../lib/preflight/secret-vault";
import { isDatabaseConfigured } from "../lib/supabase-admin";

const OWNER = (process.env.VRAELIS_SEED_OWNER || "").trim().toLowerCase();
const ROLE = (process.env.VRAELIS_SEED_ROLE || "customer").trim();
const USER = process.env.VRAELIS_SEED_USER || "demo@example.com";
const PASS = process.env.VRAELIS_SEED_PASS || "hunter2";

function present(name: string): boolean { return !!(process.env[name] || "").trim(); }

async function main(): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    const haveUrl = present("SUPABASE_URL") || present("NEXT_PUBLIC_SUPABASE_URL");
    const haveKey = present("SUPABASE_SERVICE_ROLE_KEY");
    console.error("Database is not configured for THIS process. Loaded .env.local, but still missing:");
    if (!haveUrl) console.error("  - SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
    if (!haveKey) console.error("  - SUPABASE_SERVICE_ROLE_KEY");
    console.error("Ensure these are in .env.local (run: vercel env pull .env.local), then re-run from the project root.");
    return false;
  }
  if (!vaultConfigured()) { console.error("VRAELIS_SECRET_KEY is not set to a 64-hex vault key (add it to .env.local); refusing to store anything weaker."); return false; }
  if (!OWNER) { console.error("Set VRAELIS_SEED_OWNER to the account email that owns the lane app."); return false; }

  const app = (await listApplications(OWNER)).find((a) => a.builder === LANE_BUILDER);
  if (!app) {
    console.error(`No API-verification lane application found for ${OWNER}. Run one verification (or dry run) first so the lane app exists, then re-run this seed.`);
    return false;
  }

  // Idempotent: if a test account for this role already exists, do nothing rather than pile up duplicates.
  const existing = await listConnections(OWNER, app.id);
  const already = existing.find((c) => c.provider === "test_account"
    && String((c.meta as Record<string, unknown>).role || (c.meta as Record<string, unknown>).label || "").trim().toLowerCase() === ROLE.toLowerCase());
  if (already) {
    console.log(`A "${ROLE}" test account already exists on the lane app (connection ${already.id}). Nothing to do.`);
    return true;
  }

  const res = await addTestAccount(OWNER, app.id, {
    label: ROLE,                       // becomes the sign_in_as role
    username: USER,
    password: PASS,
    scope: "API-verification sign-in (fixture)",
  });
  if ("error" in res) { console.error(`Could not store the test account: ${res.error}`); return false; }

  console.log(`Sealed test account created on the lane app.`);
  console.log(`  application: ${app.id}`);
  console.log(`  role:        ${ROLE}   (use: sign_in_as ${ROLE})`);
  console.log(`  username:    ${res.usernameMask}   (masked; plaintext sealed in the vault, never printed)`);
  console.log(`\nRe-run the dry run: flow correction can now build a credentialed sign-in, and would_launch can become true.`);
  return true;
}

main().then((ok) => { process.exitCode = ok ? 0 : 1; }).catch((e) => { console.error(e); process.exitCode = 1; });
