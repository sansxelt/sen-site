// Centralized CSRF check for state-changing browser requests.
//
// THE GAP. 66 mutating API routes authenticate with the session cookie and nothing checked where the
// request came from. SameSite=Lax was the only defence: it blocks a cross-site form POST, but it is one
// browser-side setting with a long tail of exceptions, and it does nothing for a route that mutates on GET.
//
// THE RULE, AND WHY IT IS SHAPED THIS WAY. Enforcement is keyed on AMBIENT AUTHORITY, not on a list of
// routes. A cross-site request is only dangerous when the browser attaches our credentials to it
// automatically — that is what makes CSRF work. So:
//
//   Enforce when: the method mutates AND the request carries our session cookie.
//   Otherwise:    allow.
//
// That single rule exempts every class the brief calls out, by construction rather than by maintenance:
//
//   - Provider webhooks (Stripe, PayPal, Twilio, inbound email) authenticate with a signature or a shared
//     secret and carry no cookie of ours.
//   - Cron endpoints authenticate with `Authorization: Bearer $CRON_SECRET`; no cookie.
//   - The public API (/api/v1/*) authenticates with an API key; no cookie.
//   - CLI and server-to-server callers send no cookie.
//   - OAuth and SAML callbacks arrive cross-site, and SameSite=Lax means the browser does NOT attach the
//     session cookie to a cross-site POST — so they are not enforced against either. (OAuth callbacks are
//     GETs, which this never blocks.)
//   - Unauthenticated public forms (register, reset-password, contact, the intake widget) have no session
//     to ride; they are protected by rate limiting and validation, which is the appropriate control.
//
// A list would have to be kept in step with 160 route files forever and would fail silently when someone
// added the 161st. This cannot: a new route that uses the session cookie is protected the moment it exists.
//
// ALLOWED_ORIGINS is the explicit, auditable part — the hosts a legitimate browser request can come from.

const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  // Older NextAuth v4 names, in case a long-lived cookie is still in flight.
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Hosts a legitimate browser request may originate from. */
export function allowedOrigins(): string[] {
  const extra = (process.env.CSRF_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    "https://vraelis.com",
    "https://www.vraelis.com",
    "https://app.vraelis.com",
    ...extra,
  ];
}

export type CsrfVerdict =
  | { enforced: false; reason: "not_mutating" | "no_ambient_authority" }
  | { enforced: true; ok: true; reason: "same_origin" | "allowed_origin" | "same_site" }
  | { enforced: true; ok: false; reason: "cross_origin" | "origin_missing" };

/**
 * Decide whether to allow a request. Pure over the inputs so it can be tested without a server.
 *
 * `cookieHeader` is the raw Cookie header. `origin` / `secFetchSite` are the corresponding request
 * headers, `host` is the resolved host of the request itself.
 */
export function csrfVerdict(input: {
  method: string;
  cookieHeader: string | null;
  origin: string | null;
  secFetchSite: string | null;
  host: string | null;
  proto: string | null;
}): CsrfVerdict {
  if (!MUTATING.has(input.method.toUpperCase())) {
    return { enforced: false, reason: "not_mutating" };
  }
  const cookie = input.cookieHeader ?? "";
  // Auth.js CHUNKS a cookie whose value exceeds ~4096 bytes into `<name>.0`, `<name>.1`, … and the base
  // name then never appears. With a JWT strategy the whole session rides in that value, so a session
  // carrying a few extra claims chunks — and a check for `<name>=` alone would see no session, conclude
  // there is no ambient authority, and wave the request through. That is a bypass that gets MORE likely as
  // the session grows. Match the chunked form too.
  //
  // Boundary-anchored: a cookie called `not-authjs.session-token` must not satisfy a check for
  // `authjs.session-token`, so the match requires the name to start the header or follow "; ".
  const hasSession = SESSION_COOKIE_NAMES.some((n) => cookieNamePresent(cookie, n));
  if (!hasSession) {
    // No credentials are being attached automatically, so there is nothing for a cross-site page to abuse.
    return { enforced: false, reason: "no_ambient_authority" };
  }

  // Sec-Fetch-Site is set by the browser and cannot be forged by page script. When it says the request is
  // same-origin or same-site, that is the strongest signal available and needs no Origin comparison.
  const sfs = (input.secFetchSite ?? "").toLowerCase();
  if (sfs === "same-origin" || sfs === "same-site" || sfs === "none") {
    // "none" means a user-initiated navigation (typed URL, bookmark), not a cross-site page.
    return { enforced: true, ok: true, reason: "same_site" };
  }

  const origin = input.origin;
  if (!origin) {
    // A browser sends Origin on every mutating request. Its absence, together with our session cookie,
    // means something is not a normal browser flow — refuse rather than guess.
    if (sfs === "cross-site") return { enforced: true, ok: false, reason: "cross_origin" };
    return { enforced: true, ok: false, reason: "origin_missing" };
  }

  const self = input.host ? `${input.proto ?? "https"}://${input.host}` : null;
  if (self && origin.toLowerCase() === self.toLowerCase()) {
    return { enforced: true, ok: true, reason: "same_origin" };
  }
  // Exact string match against the allowlist — never endsWith/includes, which would admit
  // "vraelis.com.evil.tld" and "evil-vraelis.com".
  if (allowedOrigins().some((a) => a.toLowerCase() === origin.toLowerCase())) {
    return { enforced: true, ok: true, reason: "allowed_origin" };
  }
  return { enforced: true, ok: false, reason: "cross_origin" };
}

/**
 * Is a cookie named `name` (or its Auth.js chunked variants `name.0`, `name.1`, …) present in the header?
 *
 * Anchored at a cookie boundary — the start of the header or a "; " separator — so a differently-named
 * cookie that merely CONTAINS this name, or a cookie whose VALUE contains it, cannot satisfy the check.
 */
export function cookieNamePresent(cookieHeader: string, name: string): boolean {
  if (!cookieHeader) return false;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) return true;
    // Chunked form: exactly `<name>.<digits>`.
    if (key.startsWith(`${name}.`) && /^\d+$/.test(key.slice(name.length + 1))) return true;
  }
  return false;
}
