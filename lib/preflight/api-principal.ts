// Who is calling a preflight endpoint: a signed-in browser, or a machine holding an API key.
//
// THE WHOLE POINT OF THIS FILE is that it answers exactly one question — which email is acting — and then
// gets out of the way. Every tenancy check, entitlement gate, credit hold, quota and cost governor
// downstream is the code that already existed for the session path, unchanged. A second authentication
// method must never become a second authorization path; that is how a key ends up able to do something its
// owner could not do in the browser.
//
// A key therefore grants NO privilege of its own. It resolves to an owner, and that owner's existing access
// decides everything.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyApiKey } from "@/lib/v-api-keys";
import { logEvent } from "@/lib/v-events";

// Scopes are explicit and additive. A key minted before these existed carries none of them, so it cannot
// launch a run — the safe direction. Read is separate from create so a CI job that only polls, or a
// dashboard that only prices, can hold a key that cannot spend money.
export const PREFLIGHT_SCOPES = {
  preview: "preflight:preview",
  runCreate: "preflight:run:create",
  runRead: "preflight:run:read",
} as const;
export type PreflightScope = (typeof PREFLIGHT_SCOPES)[keyof typeof PREFLIGHT_SCOPES];

export type Principal = {
  /** The acting identity. Downstream code treats this exactly like a session email. */
  email: string;
  via: "session" | "api_key";
  /** Public, non-secret key identifier for usage logging. Never the key itself. */
  keyPrefix: string | null;
  /** Row id of the key, for attributing usage to one key across renames. Null for sessions. */
  keyId: string | null;
  /** This key own daily spend ceiling in cents, or null for no ceiling. Never raises an owner limit. */
  dailyCeilingCents: number | null;
};

export type PrincipalResult =
  | { ok: true; principal: Principal }
  | { ok: false; res: NextResponse };

// Stable, documented error codes. Agents branch on these, so they are part of the contract and must not be
// reworded casually.
function deny(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: code, message }, { status, headers: { "cache-control": "no-store" } });
}

// A key in a query string has already been written to access logs, proxy logs and browser history by the
// time it reaches us. Refusing it loudly is better than serving the request and letting the caller believe
// that placement is supported.
const QUERY_KEY_PARAMS = ["api_key", "apikey", "key", "x-api-key", "token"];
function keyInQueryString(url: URL): boolean {
  return QUERY_KEY_PARAMS.some((p) => {
    const v = url.searchParams.get(p);
    return !!v && v.startsWith("vr_live_");
  });
}

/**
 * Resolve the caller of a preflight endpoint to a single acting email.
 *
 * Order matters: an API key, when present, is authoritative. Falling back to a session after a bad key
 * would let a browser-authenticated developer testing a revoked key silently succeed as themselves, which
 * hides exactly the failure they are trying to observe.
 */
export async function resolvePrincipal(req: Request, requiredScope: PreflightScope): Promise<PrincipalResult> {
  const url = new URL(req.url);
  if (keyInQueryString(url)) {
    return { ok: false, res: deny(400, "api_key_in_query", "Send the key in the x-api-key header. A key in a URL is recorded in logs and browser history; treat this one as compromised and revoke it.") };
  }

  const raw = (req.headers.get("x-api-key") ?? "").trim();
  if (raw) {
    const verified = await verifyApiKey(raw);
    // Revocation is a row delete, so a revoked key fails here on the very next request with no cache to wait
    // out. Unknown and revoked are deliberately indistinguishable.
    if (!verified) return { ok: false, res: deny(401, "invalid_api_key", "That API key is not valid.") };
    if (!verified.scopes.includes(requiredScope)) {
      return { ok: false, res: deny(403, "insufficient_scope", `This key is missing the ${requiredScope} scope.`) };
    }
    return { ok: true, principal: { email: verified.userId, via: "api_key", keyPrefix: verified.prefix, keyId: verified.id, dailyCeilingCents: verified.dailyCeilingCents } };
  }

  const email = (await auth())?.user?.email;
  if (!email) return { ok: false, res: deny(401, "signin_required", "Sign in, or send an API key in the x-api-key header.") };
  return { ok: true, principal: { email, via: "session", keyPrefix: null, keyId: null, dailyCeilingCents: null } };
}

/**
 * Record one machine call against the preflight surface.
 *
 * Only the PUBLIC key identifiers are written: the prefix already shown in the UI and the row id. The key
 * itself is never held here in any form, hashed or otherwise, so this log can be read by anyone who can read
 * the events table without handing them a credential. Session calls are skipped; the browser already has its
 * own analytics and this log exists to answer "what did this key do".
 *
 * Best-effort by construction (logEvent swallows its own failures): an unwritable audit row must never fail
 * a run the caller has already paid for.
 */
export async function logKeyUsage(p: Principal, e: {
  endpoint: string;
  status: number;
  applicationId?: string | null;
  runId?: string | null;
  creditsReserved?: number | null;
  creditsCharged?: number | null;
}): Promise<void> {
  if (p.via !== "api_key") return;
  await logEvent({
    userId: p.email,
    eventType: "api_key_used",
    actorType: "api",
    source: "api",
    route: e.endpoint,
    metadata: {
      prefix: p.keyPrefix,
      id: p.keyId,
      status: e.status,
      application_id: e.applicationId ?? null,
      run_id: e.runId ?? null,
      credits_reserved: e.creditsReserved ?? null,
      credits_charged: e.creditsCharged ?? null,
    },
  });
}
