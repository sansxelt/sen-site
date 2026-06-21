import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthPanel, OAuthSection } from "@/components/auth-panel";
import { VraelisSignIn } from "@/components/vraelis-auth";
import { getSafeRedirectPath } from "@/lib/auth-ui";
import { getZone, ZONE_THEME } from "@/lib/zone";
import { isVraelisRequest } from "@/lib/site-host";

export const metadata: Metadata = {
  title: "Access",
  description: "Sign in or create your account.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, params, zone, vraelis] = await Promise.all([
    auth(),
    searchParams,
    getZone(),
    isVraelisRequest(),
  ]);
  const callbackUrl = Array.isArray(params.callbackUrl)
    ? params.callbackUrl[0]
    : params.callbackUrl;

  // If they're already signed in, don't make them sit on a signin
  // page — take them where they were going. Vraelis lands on its
  // dashboard; sansxel defaults to /app (the chat host's home zone).
  // getSafeRedirectPath never returns falsy (it defaults to "/account"),
  // so the default has to be supplied as the INPUT when no callbackUrl
  // came in — not as a `||` fallback on the output.
  if (session?.user?.email) {
    redirect(getSafeRedirectPath(callbackUrl ?? "/app"));
  }

  // Vraelis gets its own light, centered, green-accent sign-in surface
  // (same NextAuth flows underneath, no sansxel chrome). A signup-intent CTA
  // (homepage "Start free") arrives with ?mode=signup so a brand-new user
  // opens in create-account mode instead of a "Welcome back" sign-in screen.
  if (vraelis) {
    const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    return (
      <div style={{ position: "relative", overflow: "hidden", minHeight: "100svh", padding: "clamp(56px, 8vw, 96px) 20px clamp(40px, 8vw, 80px)" }}>
        <div className="glow glow--soft" />
        <a href="/" style={{ position: "fixed", bottom: 20, left: 20, zIndex: 20, display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 17px", borderRadius: 99, border: "1px solid var(--line-2)", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", color: "var(--fg-2)", textDecoration: "none", fontSize: 14, fontWeight: 500, boxShadow: "var(--shadow-md)" }}>← Back to site</a>
        <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
          <VraelisSignIn
            callbackUrl={getSafeRedirectPath(callbackUrl ?? "/app")}
            initialMode={modeParam === "signup" ? "signup" : "signin"}
          />
        </div>
      </div>
    );
  }

  const t = ZONE_THEME[zone];

  // Per-zone copy so the surface speaks to where you actually are.
  const headline =
    zone === "chat"
      ? "Sign in to the workshop."
      : zone === "platform"
        ? "Sign in to platform."
        : "Sign in to Vraelis.";
  const subline =
    zone === "chat"
      ? "Pick up your threads, files, and credits across every device."
      : zone === "platform"
        ? "Manage API keys, usage, and billing from the developer console."
        : "Email, Google, and GitHub all sign in to the same Vraelis account.";

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
