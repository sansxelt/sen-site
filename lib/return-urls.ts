// The single return-URL allowlist (V1.1 workstream S1; docs/v1.1-program-plan.md section 9).
// EVERY place the app sends a user out and takes them back must build its URLs here: Stripe checkout
// return_url, Stripe portal return_url, auth callback deep links, provider OAuth returns (later
// workstreams). No arbitrary returns anywhere: relative deep links go through safeReturnPath, absolute
// family URLs through familyUrl, and the billing returns are a fixed four-route matrix. Pure string
// logic (the only env read is the same production check appHostUrl uses); covered by
// scripts/billing-returns-verify.ts (npm run billing:returns:test).

import { appHostUrl } from "./app-routes";

// ── Relative deep links ───────────────────────────────────────────────────────────────────────────────
// Accepts ONLY a same-app relative path and returns it unchanged; anything else collapses to "/".
// Rejected shapes (each is a known open-redirect or path-confusion trick):
//   //evil.com            protocol-relative: the browser treats it as a full origin
//   /\evil.com, \\evil    backslashes: browsers normalize \ to / after our check would have passed
//   https://evil.com      absolute URLs never pass (use familyUrl for the two family hosts)
//   /a/../b, /., /..      dot segments: the resolved path may escape what was reviewed
//   %2F %5C %2e%2e        encoded slashes/backslashes/dots: decoded later by some layer into the above
//   \r \n and controls    header-splitting / log-forging characters
export function safeReturnPath(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  const s = raw.trim();
  if (!s || s.length > 2000) return "/";
  if (!s.startsWith("/")) return "/";
  if (s.startsWith("//")) return "/";
  if (s.includes("\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(s)) return "/";
  if (/%2f|%5c|%2e/i.test(s)) return "/";
  // Dot segments anywhere in the path portion (before ? or #) reject the whole link.
  const pathPart = s.split(/[?#]/, 1)[0];
  if (pathPart.split("/").some((seg) => seg === "." || seg === "..")) return "/";
  return s;
}

// ── Absolute family URLs ──────────────────────────────────────────────────────────────────────────────
// Accepts ONLY an https URL on vraelis.com or a *.vraelis.com subdomain (app.vraelis.com is the one we
// use today) and returns the normalized href; everything else is null. Suffix matching is on the PARSED
// hostname with a leading-dot anchor, so vraelis.com.evil.com and creds@ tricks can never pass (the URL
// parser has already decided the real host before we compare).
export function familyUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port) return null; // family hosts serve on 443 only; an explicit port is not one of ours
  const host = u.hostname.toLowerCase();
  if (host !== "vraelis.com" && !host.endsWith(".vraelis.com")) return null;
  return u.href;
}

// ── The billing return matrix (spec section 21 / plan section 9) ──────────────────────────────────────
// Four canonical routes, nothing else: Stripe checkout comes back to success, an abandoned checkout to
// cancelled, dunning links to payment-failed, and the Stripe portal to portal-return. Absolute
// app.vraelis.com URLs in production, relative in dev, via the same appHostUrl the auth guards use.
export const BILLING_RETURN_PATHS = {
  success: "/billing/success",
  cancelled: "/billing/cancelled",
  paymentFailed: "/billing/payment-failed",
  portalReturn: "/billing/portal-return",
} as const;

export type BillingReturnUrls = { [K in keyof typeof BILLING_RETURN_PATHS]: string };

export function billingReturnUrls(): BillingReturnUrls {
  return {
    success: appHostUrl(BILLING_RETURN_PATHS.success),
    cancelled: appHostUrl(BILLING_RETURN_PATHS.cancelled),
    paymentFailed: appHostUrl(BILLING_RETURN_PATHS.paymentFailed),
    portalReturn: appHostUrl(BILLING_RETURN_PATHS.portalReturn),
  };
}

// Credit TOP-UPS keep returning to /credits (the page already polls ?session_id= for the webhook
// grant); only SUBSCRIPTION checkouts moved to /billing/success. Kept here so the checkout route has
// no inline return URL either.
export function topupReturnUrl(): string {
  return appHostUrl("/credits");
}

// Stripe requires ABSOLUTE return URLs even in dev, where appHostUrl stays relative so localhost auth
// round-trips. This anchors a relative return to the dev origin; production values pass through
// untouched. The base fallbacks mirror lib/stripe.ts APP_URL so dev behavior does not change.
export function stripeReturnUrl(target: string): string {
  if (/^https?:\/\//.test(target)) return target;
  const base = process.env.NEXT_PUBLIC_SITE_URL
    || process.env.AUTH_URL
    || process.env.NEXTAUTH_URL
    || "http://localhost:3000";
  return base.replace(/\/+$/, "") + target;
}
