import { redirect } from "next/navigation";
import { getSafeRedirectPath } from "@/lib/auth-ui";
import { V6_APP } from "@/lib/v6-routes";

/* THERE IS ONE SIGN-IN, AND THIS IS NOT IT.
 *
 * This route used to render a second copy of the sign-in form: the shipped VraelisSignIn component wrapped
 * in a light V6 section, so that preview navigation would not throw a reviewer out of V6.
 *
 * It should never have been a page. /signin is deliberately absent from the proxy's V6 map, so it is never
 * rewritten — app/signin is what a visitor reaches today AND after promotion. That made this a duplicate
 * auth surface that had to be kept in step with the real one by hand, and it immediately drifted: the real
 * sign-in moved onto the design-06 product theme (graphite, contrast primary action, no italic serif) while
 * this one stayed on warm paper. A preview that shows a LIGHT sign-in for a page that ships DARK is worse
 * than no preview, because it invites approving a design nobody will ever see.
 *
 * Rendering the product surface inside a V6 page was tried and is not the answer either: the V6 nav and
 * footer are light, so the result was a three-surface sandwich that matched neither system.
 *
 * So the duplicate is gone and this redirects to the real thing. A reviewer clicking "Sign in" in the V6 nav
 * now lands on exactly what ships. One sign-in page also means one place where credentials, providers,
 * sessions and redirect allowlisting live, which is the right number for an auth surface.
 *
 * The callback is still gated by getSafeRedirectPath before it is forwarded, so this cannot be used to
 * launder an unvalidated redirect target into /signin.
 */
export default async function V6SignInRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const callbackUrl = getSafeRedirectPath(one(params.callbackUrl) ?? V6_APP);
  const mode = one(params.mode) === "signup" ? "&mode=signup" : "";
  redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}${mode}`);
}
