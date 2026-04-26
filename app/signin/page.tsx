import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthPanel, OAuthSection } from "@/components/auth-panel";
import { getSafeRedirectPath } from "@/lib/auth-ui";
import { getZone, ZONE_THEME } from "@/lib/zone";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Continue into sansxel with app-hosted email, Google, and GitHub sign-in flows.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, params, zone] = await Promise.all([
    auth(),
    searchParams,
    getZone(),
  ]);
  const callbackUrl = Array.isArray(params.callbackUrl)
    ? params.callbackUrl[0]
    : params.callbackUrl;

  // If they're already signed in, don't make them sit on a signin
  // page with a 'Open workspace' button, just take them where they
  // were going. Default to /app since the chat host is signin's
  // home zone.
  if (session?.user?.email) {
    redirect(getSafeRedirectPath(callbackUrl) || "/app");
  }

  const t = ZONE_THEME[zone];

  // Per-zone copy so the surface speaks to where you actually are.
  const headline =
    zone === "chat"
      ? "Sign in to the workshop."
      : zone === "platform"
        ? "Sign in to platform."
        : "Sign in to sansxel.";
  const subline =
    zone === "chat"
      ? "Pick up your threads, files, and credits across every device."
      : zone === "platform"
        ? "Manage API keys, usage, and billing from the developer console."
        : "Email, Google, and GitHub all sign in to the same sansxel account.";

  return (
    <div className="mx-auto max-w-6xl py-8 sm:py-14">
      {/* Hero header. Generous breathing room above the form. */}
      <div className="mx-auto max-w-3xl text-center">
        <div className={`text-xs font-medium uppercase tracking-[0.22em] ${t.accent}`}>
          {t.signInLabel}
        </div>
        <h1
          className={`mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl ${zone === "platform" ? "font-mono" : ""}`}
        >
          {headline}
        </h1>
        <p className="mt-6 text-sm leading-7 text-neutral-300 sm:text-base sm:leading-8">
          {subline}
        </p>
      </div>

      {/* The two-column form region. Wider gap so the password form
          and the OAuth providers feel like distinct choices rather
          than one continuous panel. */}
      <div className="mx-auto mt-24 max-w-6xl sm:mt-32">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-20 xl:gap-28 lg:items-start">
          <AuthPanel
            callbackUrl={getSafeRedirectPath(callbackUrl)}
            initialSessionEmail={session?.user?.email ?? null}
          />
          <OAuthSection callbackUrl={getSafeRedirectPath(callbackUrl)} />
        </div>
      </div>
    </div>
  );
}
