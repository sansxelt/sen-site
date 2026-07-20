// The single canonical gate for EVERY API-runtime customer surface (routes + pages). The API runtime is
// LIVE and ACCESSIBLE by default to every signed-in Preflight account, but it is BETA: it works and passes
// our own tests, and no customer outside this account has run their own API through it end to end. Surfaces
// that show its results must label it accordingly and must not present it at parity with the browser
// runtime. Access is deliberately unrestricted; the honesty is in the labelling, not in the gate. Two
// conditions still gate access, and a denial remains INDISTINGUISHABLE from "this surface does not exist":
//   1. apiRuntimeEnabled()          — the surface is on (default: yes wherever Preflight is enabled; the
//                                      VRAELIS_API_RUNTIME_DISABLED kill switch flips it off instantly).
//   2. apiRuntimeBetaAllowed(email) — this account may use it (default: any signed-in account; the optional
//                                      VRAELIS_API_RUNTIME_BETA allowlist can narrow it back down if needed).
// When either is false the surface behaves as if absent: routes return a bare 404, pages notFound(), the tab
// is absent from the DOM. Never a 401/403 (that would confirm the surface exists), never an error body.

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
