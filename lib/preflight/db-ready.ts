// Cheap, cached probe of whether the Preflight migration is applied, so the app can show an internal
// "SETUP REQUIRED" state instead of a misleading generic empty state. Read-only; cached briefly so it is
// not re-run on every request. Public users never see this (the pages are flag-gated).
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";

let cached: { ready: boolean; at: number } | null = null;
const TTL_MS = 30_000;

export async function preflightDbReady(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.ready;
  // Probe a column that only exists once BOTH migrations are applied. A real (non-head) select validates
  // the table + column; a missing table/column surfaces as an error.
  const { error } = await getSupabaseAdminClient().from("v_preflight_runs").select("provider_session_id").limit(1);
  const ready = !error;
  cached = { ready, at: now };
  return ready;
}
