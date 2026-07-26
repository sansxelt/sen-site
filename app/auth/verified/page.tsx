import Link from "next/link";
import { getSignInPath } from "../../../lib/auth-ui";

export const metadata = {
  title: "Account verified",
  description: "Your Vraelis account is live.",
};

type SearchParams = { email?: string };

export default async function VerifiedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const email  = params.email ?? "";
  const signInHref = getSignInPath(email ? `/account?email=${encodeURIComponent(email)}` : "/account");

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 4vw, 24px) 80px" }}>
      <div className="card" style={{ padding: "clamp(24px, 4vw, 40px)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, border: "1px solid var(--go-line)", background: "var(--go-wash)", color: "var(--go-ink)", padding: "4px 11px", fontSize: 12, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--acc)", flex: "none" }} />
          Email verified
        </span>
        <h1 style={{ marginTop: 18, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg-1)", lineHeight: 1.15 }}>
          You&apos;re in.
        </h1>
        <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
          Your Vraelis account{email && <> (<span style={{ color: "var(--fg-1)", fontWeight: 600 }}>{email}</span>)</>} is active. Sign in with the password you chose during signup and you&apos;re ready to go.
        </p>

        <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href={signInHref} className="btn" style={{ flex: 1, minWidth: 130 }}>Sign in</Link>
          <Link href="/pricing" className="btn btn--ghost" style={{ flex: 1, minWidth: 120 }}>See pricing</Link>
        </div>

        <p style={{ marginTop: 24, borderTop: "1px solid var(--line-2)", paddingTop: 20, fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-4)" }}>
          You&apos;ll also get a welcome email from hello@vraelis.com with getting-started tips.
        </p>
      </div>
    </div>
  );
}
