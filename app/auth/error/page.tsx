import Link from "next/link";
import type { Metadata } from "next";
import { getSignInPath } from "@/lib/auth-ui";

const errorMessages: Record<string, string> = {
  AccessDenied: "That sign-in request was declined before the session could be created.",
  CallbackRouteError: "The provider returned to Vraelis, but the sign-in could not be completed.",
  Configuration: "Authentication is not fully configured yet for this environment.",
  InvalidProvider: "That sign-in option is not available right now.",
  MissingSecret: "The app secret is missing, so secure sessions cannot be created yet.",
  OAuthAccountNotLinked:
    "That email is already associated with a different sign-in method in this environment.",
  OAuthCallbackError:
    "The provider callback did not complete cleanly. Please try again.",
  OAuthProfileParseError:
    "The provider response could not be read cleanly. Please try again.",
  UntrustedHost:
    "This host is not trusted for authentication yet. Double-check your auth URL settings.",
};

export const metadata: Metadata = {
  title: "Auth Error",
  description: "Review and recover from an authentication error in the Vraelis sign-in flow.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const message =
    (error && errorMessages[error]) ??
    "We couldn't finish that sign-in. Please try again.";

  return (
    <section style={{ maxWidth: 560, margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 4vw, 24px) 80px" }}>
      <div className="card" style={{ padding: "clamp(24px, 4vw, 40px)" }}>
        <p style={{ fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fg-4)", margin: 0 }}>
          Auth error
        </p>
        <h1 style={{ marginTop: 10, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg-1)", lineHeight: 1.15 }}>
          Sign-in hit a snag.
        </h1>
        <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.6, color: "var(--fg-2)" }}>{message}</p>
        {error && (
          <div style={{ marginTop: 16, borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-2)", padding: "10px 14px", fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-3)" }}>
            Error code: {error}
          </div>
        )}
        <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href={getSignInPath("/account")} className="btn">
            Try again
          </Link>
          <Link href="/contact" className="btn btn--ghost">
            Contact support
          </Link>
        </div>
      </div>
    </section>
  );
}
