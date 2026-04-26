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
  // page with a 'Open workspace' button — just take them where they
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
    <div className="mx-auto max-w-4xl py-6 sm:py-10">
      {/* Hero header — generous breathing room above the form. */}
      <div className="mx-auto max-w-2xl text-center">
        <div className={`text-xs font-medium uppercase tracking-[0.22em] ${t.accent}`}>
          {t.signInLabel}
        </div>
        <h1
          className={`mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl ${zone === "platform" ? "font-mono" : ""}`}
        >
          {headline}
        </h1>
        <p className="mt-5 text-sm leading-7 text-neutral-300 sm:text-base sm:leading-8">
          {subline}
        </p>
      </div>

      {/* More space between header and form panels — was mt-10, now
          mt-16 so the page reads as 'header section' + 'form section'
          instead of one wall of text. */}
      <div className="mx-auto mt-16 max-w-4xl sm:mt-20">
        <div className="grid gap-8 xl:grid-cols-[1.08fr_.92fr] xl:gap-10 xl:items-start">
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
