import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { VraelisSignIn } from "@/components/vraelis-auth";
import { getSafeRedirectPath } from "@/lib/auth-ui";
import { v6meta } from "../_system/meta";
import { V6_BASE, V6_APP } from "@/lib/v6-routes";

/* The V6 sign-in destination.

   This exists so the preview stops throwing reviewers out of V6 and into the old site. It is deliberately
   NOT a second auth system: the form below is the SHIPPED VraelisSignIn component running the real NextAuth
   flows, the same one /signin renders. Nothing about credentials, providers, sessions, redirects or route
   permissions is reimplemented or altered here. The only thing this route adds is the V6 surface around it
   and a callback that lands inside V6 instead of at /app, which does not exist.

   getSafeRedirectPath still gates the callback, and /dev-preview/v6/app passes its allowlist unchanged
   (relative, no protocol-relative prefix, no backslash, no encoded separators, no dot segments), so the
   hardening is untouched.

   The full V6 auth redesign, including two-step authentication, is the next separate phase. */

export const metadata = v6meta({
  title: "Sign in",
  description: "Sign in to Vraelis.",
  path: "/signin",
  type: "website",
});

const APP = V6_APP;

export default async function V6SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const raw = Array.isArray(params.callbackUrl) ? params.callbackUrl[0] : params.callbackUrl;
  const callbackUrl = getSafeRedirectPath(raw ?? APP);

  // Already signed in: go where they were going rather than sitting on a sign-in screen.
  if (session?.user?.email) redirect(callbackUrl);

  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;

  return (
    <section className="v6-sec v6-signin" data-nav-theme="light">
      <div className="v6-wrap v6-signin__wrap">
        {/* One heading, this one. VraelisSignIn also ships its own, so it is suppressed below: two stacked
            headers pushed the form most of a fold down the page.

            The wording has to work in BOTH modes. This is a server component and the Sign in / Create
            account toggle is client state inside the form, so a heading that said "Sign in to Vraelis."
            was still saying it after the reader switched to Create account. */}
        <div className="v6-signin__head">
          <p className="v6-eyebrow">Access</p>
          <h1 className="v6-signin__h">Your Vraelis account.</h1>
          <p className="v6-signin__lead">
            The same account across the console, the CLI, and the API.
          </p>
        </div>
        <div className="v6-signin__panel">
          <VraelisSignIn
            callbackUrl={callbackUrl}
            initialMode={modeParam === "signup" ? "signup" : "signin"}
            showHeader={false}
            legalBase={V6_BASE}
          />
        </div>
        <p className="v6-signin__note">
          This is the shipped sign-in, shown inside the V6 preview. The redesigned account surface is still
          being built.
        </p>
      </div>
    </section>
  );
}
