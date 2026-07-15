// The single canonical gate for EVERY API-beta customer surface (routes + pages). Both conditions required,
// fail-closed, and the failure is INDISTINGUISHABLE from "this surface does not exist":
//   1. VRAELIS_API_RUNTIME_BETA_ENABLED=1  (the surface is deployed/on at all)   -> apiRuntimeEnabled()
//   2. the signed-in email is in VRAELIS_API_RUNTIME_BETA                        -> apiRuntimeBetaAllowed()
// A non-enabled account NEVER learns the beta exists: routes return a bare 404, pages notFound(), the tab is
// absent from the DOM. Never a 401/403 (that would confirm the surface exists), never an error body that
// hints at a private beta.

import { auth } from "@/auth";
import { apiRuntimeEnabled } from "@/lib/v-preflight-flags";
import { apiRuntimeBetaAllowed } from "@/lib/v-entitlements";
import { preflightEnabled } from "@/lib/v-preflight-flags";

// For ROUTES: resolves the owner if fully allowed, else null (caller returns a uniform 404). Also requires
// the general Preflight surface to be enabled (defense in depth — the API beta lives inside Preflight).
export async function apiBetaOwner(): Promise<string | null> {
  if (!preflightEnabled() || !apiRuntimeEnabled()) return null;
  const email = (await auth())?.user?.email ?? null;
  if (!email || !apiRuntimeBetaAllowed(email)) return null;
  return email.trim().toLowerCase();
}

// For PAGES (server components): true only when this signed-in owner may see the API beta. Pages call
// notFound() when false — same "does not exist" posture as the routes.
export async function apiBetaVisible(email: string | null | undefined): Promise<boolean> {
  if (!preflightEnabled() || !apiRuntimeEnabled()) return false;
  if (!email || !apiRuntimeBetaAllowed(email)) return false;
  return true;
}
