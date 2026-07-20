// Provider hand-off after a popup authorization.
//
// Vercel's install supplies a `next` URL and its dashboard closes its own window from there. That is the
// only reliable way to close our popup after a Vercel install: once the popup has navigated to a COOP
// same-origin document (Vercel's), the browser moves it into a new browsing context group and permanently
// disowns the opener, so neither the popup's own window.close() nor the opener's close() is honoured again.
//
// `next` arrives as a query parameter on OUR callback, which makes it attacker-supplied by definition.
// Redirecting to it unchecked would turn a signed-in route into an open redirect: a crafted link could send
// someone from a real vraelis.com URL to a look-alike login page, wearing our domain as the referrer. So it
// is pinned to https on vercel.com, and anything else is refused rather than sanitized.
export function vercelHandoffUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    // Exact host or a real subdomain. The leading dot matters: "notvercel.com" must not pass, and neither
    // must "vercel.com.evil.test".
    if (u.hostname !== "vercel.com" && !u.hostname.endsWith(".vercel.com")) return null;
    return u.toString();
  } catch {
    return null; // not a parseable absolute URL (a relative path lands here too, which is correct)
  }
}
