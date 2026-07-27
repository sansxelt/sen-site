import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { preflightEnabled } from "./v-preflight-flags";
import { applicationAccess } from "./preflight/team-access";
import type { Role } from "./v-workspace";

// Server-side gate for every /systems/* page. Preflight is dark unless a flag is set (route access is the
// real security boundary — the nav item is separate), so a guessed URL redirects to the normal dashboard.
// Returns the owner email (lowercased) or redirects to sign-in. redirect() throws, so callers get a
// non-null string.
//
// THE CALLBACK STAYS RELATIVE.
//
// These used to wrap the return path in appHostUrl(), which is absolute in production, on the reasoning
// that the product lives on app.vraelis.com while /signin lives on vraelis.com so the callback has to name
// the other host. That reasoning collides head-on with the open-redirect defence: safeReturnPath rejects
// anything that is not a same-origin path, exactly as it should, so the absolute URL was discarded and
// getSafeRedirectPath fell back to its default. Every signed-out deep link into the product therefore lost
// its destination and landed on account settings. A team invite is precisely the link you send to someone
// who is not signed in.
//
// Neither mechanism was wrong on its own; they were solving the same problem in opposite directions, and
// the security control won silently. Relative wins because the proxy ALREADY carries a product path across
// to the app host, and the session cookie is scoped to .vraelis.com in production so it survives the hop.
// Every other signin callback in this codebase is relative for that reason; these three were the outliers.

export async function requirePreflightOwner(returnPath: string): Promise<string> {
  if (!preflightEnabled()) redirect("/app");
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=${encodeURIComponent(returnPath)}`);
  return email.toLowerCase();
}

// Team-aware page guard for a SPECIFIC application: resolves the caller to the app OWNER (the data-plane key
// every owner-scoped page read already uses) + the caller's role, granting access to the owner OR an active
// member of the app's workspace. Returns null (NOT a redirect) when the caller has no access, so the page can
// render its own honest "not found / no access" empty state (mirroring today's getApplication===null path).
// The caller email is still required (redirects to sign-in when absent). Pass `owner` to every owner-scoped
// read on the page and `role` to gate edit/launch affordances (viewer read-only; editor+ can act).
export async function requirePreflightAppAccess(appId: string, returnPath: string): Promise<{ owner: string; role: Role } | null> {
  if (!preflightEnabled()) redirect("/app");
  const email = (await auth())?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=${encodeURIComponent(returnPath)}`);
  const access = await applicationAccess(email, appId);
  return access ? { owner: access.owner, role: access.role } : null;
}
