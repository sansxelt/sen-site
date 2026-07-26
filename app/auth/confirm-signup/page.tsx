import Link from "next/link";
import type { Metadata } from "next";
import { verifyOAuthSignupToken } from "../../../lib/oauth-signup-token";
import { ConfirmSignupForm } from "./confirm-form";

export const metadata: Metadata = {
  title: "Confirm signup",
  description: "Create your Vraelis account.",
  robots: { index: false, follow: false },
};

type SearchParams = {
  email?:    string;
  provider?: string;
  name?:     string;
  token?:    string;
};

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  github: "GitHub",
};

export default async function ConfirmSignupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params   = await searchParams;
  const email    = (params.email ?? "").trim().toLowerCase();
  const provider = (params.provider ?? "").trim();
  const name     = (params.name ?? "").trim();
  const token    = params.token ?? "";

  const valid = Boolean(email && provider && token)
    && verifyOAuthSignupToken(token, { email, provider });

  if (!valid) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 4vw, 24px) 80px" }}>
        <div className="card" style={{ padding: "clamp(24px, 4vw, 40px)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, border: "1px solid var(--wait-line)", background: "var(--wait-wash)", color: "var(--wait-ink)", padding: "4px 11px", fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--wait-ink)", flex: "none" }} />
            Link expired or invalid
          </span>
          <h1 style={{ marginTop: 18, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg-1)", lineHeight: 1.15 }}>
            This signup link is no longer valid.
          </h1>
          <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
            Links from the sign-in bounce are short-lived for security.
            Head back to sign in and try again, it takes about ten seconds.
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/signin" className="btn">Back to sign in</Link>
            <Link href="/" className="btn btn--ghost">Home</Link>
          </div>
        </div>
      </div>
    );
  }

  const providerLabel = PROVIDER_LABEL[provider] ?? provider;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 4vw, 24px) 80px" }}>
      <div className="card" style={{ padding: "clamp(24px, 4vw, 40px)" }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fg-4)" }}>
          New account
        </span>
        <h1 style={{ marginTop: 12, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg-1)", lineHeight: 1.15 }}>
          Create a Vraelis account?
        </h1>
        <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
          You just signed in with <span style={{ fontWeight: 600, color: "var(--fg-1)" }}>{providerLabel}</span> as{" "}
          <span style={{ fontWeight: 600, color: "var(--fg-1)" }}>{email}</span>, and no Vraelis
          account exists for that address yet. Creating one is a one-time step.
        </p>

        <div style={{ marginTop: 20, borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-2)", padding: 16, fontSize: 12.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
          If you previously deleted this account, creating it again will start
          fresh, your old data isn&apos;t restored.
        </div>

        <ConfirmSignupForm
          email={email}
          provider={provider}
          name={name}
          token={token}
        />

        <p style={{ marginTop: 24, borderTop: "1px solid var(--line-2)", paddingTop: 20, fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-4)" }}>
          Didn&apos;t mean to do this? Pick Cancel below, no account is created
          until you confirm.
        </p>
      </div>
    </div>
  );
}
