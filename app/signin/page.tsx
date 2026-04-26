import type { Metadata } from "next";
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
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <div className={`text-xs font-medium uppercase tracking-[0.22em] ${t.accent}`}>
          {t.signInLabel}
        </div>
        <h1
          className={`mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl ${zone === "platform" ? "font-mono" : ""}`}
        >
          {headline}
        </h1>
        <p className="mt-4 text-sm leading-6 text-neutral-300 sm:text-base sm:leading-7">
          {subline}
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-4xl sm:mt-12">
        <div className="grid gap-6 xl:grid-cols-[1.08fr_.92fr] xl:items-start">
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
