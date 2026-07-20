// Stealth mode: a curtain over the public site and app while Vraelis is not being shown yet.
//
// WHAT THIS IS: a way to keep the product out of view from anyone who wanders in. When it is on, the server
// renders ONLY the stealth screen. The real layout, the real pages and the RSC payload are never generated,
// so there is nothing to read in the page source and nothing to un-hide with CSS. A keyboard combination
// sets a cookie and the site comes back.
//
// WHAT THIS IS NOT: access control. The cookie name and value are in the client bundle, so anyone who looks
// can set it themselves. It also does not gate /api routes, which is deliberate: OAuth callbacks, webhooks
// and the worker must keep working while the front door is closed. Real authorization is still the session
// and the tenancy checks, exactly as before. Never treat stealth as a security boundary, and never put
// something behind it that would be harmful to reveal.
//
// Turned on by STEALTH_MODE=1 in the environment. Absent or any other value means off, so the failure mode
// of a mistyped variable is a visible site rather than an invisible one.

export const STEALTH_COOKIE = "vr_stealth";
export const STEALTH_VALUE = "open";

export function stealthConfigured(): boolean {
  return (process.env.STEALTH_MODE ?? "").trim() === "1";
}

// Paths that must render normally even while the curtain is down. API routes are excluded at the layout
// level anyway (they have no layout), but auth callbacks and health checks are listed for the day someone
// wires the check into middleware and forgets why these matter.
export const STEALTH_EXEMPT_PREFIXES = ["/api/", "/_next/", "/og"];
