// Live first-party API canary fixture — the HTTP twin of lib/preflight/runtime/api-fixture.ts.
//
// A deliberately tiny, STATELESS, DATA-FREE fake SaaS API the live canary verifies against over real HTTPS.
// Statelessness is load-bearing: Vercel gives no cross-invocation memory, so "persistence" is modeled with
// HMAC-signed ids — POST /projects mints a signed id; GET /projects/:id validates the signature. The BROKEN
// mode's bug is that creation "succeeds" (201) but the read-back 404s: a genuine failing persistence
// assertion over real chained authenticated requests, exactly the fake-success class Vraelis exists to catch.
//
// Modes: 'broken' (create succeeds, persistence fails) | 'fixed' (everything works). The repair phase's
// "partially fixed" state comes from COVERAGE (a targeted rerun of only the repaired flow), not a third mode.
//
// Safety posture: no state, no DB, no cookies, no user data, tiny JSON bodies, cache disabled. The entire
// fixture is DISABLED (uniform 404) unless VRAELIS_CANARY_PASSWORD is configured, and every data endpoint
// requires the bearer token minted by POST /login with that password. Pure function -> unit-testable offline.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type FixtureMode = "broken" | "fixed";
export const FIXTURE_MODES: readonly FixtureMode[] = ["broken", "fixed"];

export type FixtureRequest = {
  mode: FixtureMode;
  method: string;
  path: string;                       // path AFTER the mode segment, e.g. "/projects/abc?sig=..."
  headers: Record<string, string>;    // lowercased keys
  body?: string;
  password: string | undefined;       // VRAELIS_CANARY_PASSWORD; undefined -> fixture disabled
  clock: () => number;                // injected (never Date.now inside)
};
export type FixtureResponse = { status: number; headers: Record<string, string>; body: string };

const TOKEN_TTL_MS = 15 * 60 * 1000;

function hmacKey(password: string): Buffer {
  return createHash("sha256").update(`vraelis-canary-fixture:${password}`).digest();
}
function sig(password: string, data: string): string {
  return createHmac("sha256", hmacKey(password)).update(data).digest("hex");
}
function tsEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function json(status: number, obj: unknown, extra: Record<string, string> = {}): FixtureResponse {
  return { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra }, body: JSON.stringify(obj) };
}
const notFound = () => json(404, { error: "not_found" });
const unauthorized = () => json(401, { error: "unauthorized" });

function mintToken(password: string, now: number): string {
  const exp = now + TOKEN_TTL_MS;
  return `cnry_${exp}_${sig(password, `tok:${exp}`).slice(0, 24)}`;
}
function tokenValid(password: string, token: string, now: number): boolean {
  const m = /^cnry_(\d+)_([a-f0-9]{24})$/.exec(token);
  if (!m) return false;
  const exp = Number(m[1]);
  if (!Number.isFinite(exp) || exp < now) return false;
  return tsEqual(m[2], sig(password, `tok:${exp}`).slice(0, 24));
}
function bearerOk(req: FixtureRequest): boolean {
  const h = req.headers["authorization"] ?? "";
  return h.startsWith("Bearer ") && !!req.password && tokenValid(req.password, h.slice(7), req.clock());
}

export function handleFixture(req: FixtureRequest): FixtureResponse {
  // Disabled fixture is indistinguishable from a missing route (no oracle about configuration).
  if (!req.password) return notFound();
  if (!FIXTURE_MODES.includes(req.mode)) return notFound();

  const [rawPath, rawQuery = ""] = req.path.split("?", 2);
  const path = rawPath.replace(/\/+$/, "") || "/";
  const query = new URLSearchParams(rawQuery);
  const { method } = req;

  // ── public ──
  if (method === "GET" && path === "/health") return json(200, { ok: true, mode: req.mode });

  if (method === "POST" && path === "/login") {
    let body: Record<string, unknown> = {};
    try { body = JSON.parse((req.body ?? "").slice(0, 2048)); } catch { /* fall through to 401 */ }
    const given = typeof body.password === "string" ? body.password : "";
    if (!given || !tsEqual(given, req.password)) return json(401, { error: "bad_credentials" });
    return json(200, { token: mintToken(req.password, req.clock()) });
  }

  // ── authenticated ──
  if (method === "GET" && path === "/admin/metrics") {
    // Deliberately checked BEFORE the generic gate so the authz flow can assert the 401 first.
    if (!bearerOk(req)) return unauthorized();
    return json(200, { requests: 42, mode: req.mode });
  }
  if (!bearerOk(req)) return unauthorized();

  if (method === "GET" && path === "/echo-auth") return json(200, { authed: true, scheme: "bearer" });

  if (method === "GET" && path === "/redirect-away") {
    // An SSRF escape attempt: redirect toward the cloud metadata endpoint. The runtime must surface the 302
    // WITHOUT following it (redirect:"manual" + origin boundary). Nothing here ever fetches this Location.
    return { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/", "cache-control": "no-store" }, body: "" };
  }

  if (method === "POST" && path === "/projects") {
    const idem = req.headers["idempotency-key"];
    if (!idem) return json(400, { error: "missing_idempotency_key" });
    const id = `proj_${sig(req.password, `pid:${idem}`).slice(0, 16)}`;
    const idSig = sig(req.password, `sig:${id}`).slice(0, 16);
    // BROKEN mode's bug: creation still returns 201 (it LOOKS like it worked) — the read-back is what fails.
    return json(201, { id, sig: idSig, name: "Canary Project", persisted: req.mode !== "broken" });
  }

  const projMatch = /^\/projects\/([A-Za-z0-9_]+)$/.exec(path);
  if (method === "GET" && projMatch) {
    const id = projMatch[1];
    const given = query.get("sig") ?? "";
    if (!tsEqual(given, sig(req.password, `sig:${id}`).slice(0, 16))) return json(400, { error: "bad_signature" });
    if (req.mode === "broken") return notFound();   // THE persistence bug: created but never stored
    return json(200, { id, name: "Canary Project", persisted: true });
  }

  return notFound();
}
