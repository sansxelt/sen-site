import Link from "next/link";
import { ResendVerification } from "../../../components/resend-verification";
import { SignupWaitingPoller } from "../../../components/signup-waiting-poller";

export const metadata = {
  title: "Check your email",
  description: "Confirm your Vraelis account by clicking the link we just sent.",
};

type SearchParams = {
  email?:  string;
  status?: "expired" | "invalid" | "error";
};

type Tone = "success" | "warn" | "error";
const toneChip: Record<Tone, { bg: string; border: string; color: string; dot: string }> = {
  success: { bg: "var(--acc-soft)", border: "var(--acc-line)", color: "var(--acc-deep)", dot: "var(--acc)" },
  warn:    { bg: "rgba(194,104,12,0.08)", border: "rgba(194,104,12,0.25)", color: "#C2680C", dot: "#C2680C" },
  error:   { bg: "rgba(178,58,58,0.08)", border: "rgba(178,58,58,0.25)", color: "#9F2D2D", dot: "#B23A3A" },
};

function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const c = toneChip[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, border: `1px solid ${c.border}`, background: c.bg, color: c.color, padding: "4px 11px", fontSize: 12, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot, flex: "none" }} />
      {children}
    </span>
  );
}

const h1Style = { marginTop: 18, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg-1)", lineHeight: 1.15 } as const;
const bodyStyle = { marginTop: 12, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-3)" } as const;

/**
 * Landing page after signup, and the bounce page when a verify link
 * expires or is invalid.  The status query param tells us which variant
 * to render.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const email  = params.email ?? "";
  const status = params.status ?? "pending";

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 4vw, 24px) 80px" }}>
      <div className="card" style={{ padding: "clamp(24px, 4vw, 40px)" }}>
        {status === "pending" && <PendingState email={email} />}
        {status === "expired" && <ExpiredState email={email} />}
        {status === "invalid" && <InvalidState />}
        {status === "error"   && <ErrorState email={email} />}

        <div style={{ marginTop: 32, borderTop: "1px solid var(--line-2)", paddingTop: 22, textAlign: "center", fontSize: 14, color: "var(--fg-3)" }}>
          Already verified?{" "}
          <Link href="/signin" style={{ color: "var(--acc-deep)", fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── State: freshly signed up, waiting on verify click ────────────────────
function PendingState({ email }: { email: string }) {
  const dot = { marginTop: 7, width: 4, height: 4, flex: "none", borderRadius: 999, background: "var(--fg-4)" } as const;
  return (
    <>
      <StatusPill tone="success">Check your email</StatusPill>
      <h1 style={h1Style}>Confirm your email to finish.</h1>
      <p style={bodyStyle}>
        We just sent a confirmation link to{" "}
        {email
          ? <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>{email}</span>
          : <span style={{ color: "var(--fg-4)" }}>your email address</span>}
        . Click the link in that email and your account goes live, takes five seconds.
      </p>

      <SignupWaitingPoller />

      <ul style={{ margin: "20px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {[
          "The link expires in 24 hours. If that happens, come back here to resend.",
          "Not in your inbox? Check your spam folder, the sender is hello@vraelis.com.",
          "Nothing gets charged and no account is created until you click the link.",
        ].map((t, i) => (
          <li key={i} style={{ display: "flex", gap: 9, fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5 }}>
            <span style={dot} /><span style={{ minWidth: 0 }}>{t}</span>
          </li>
        ))}
      </ul>

      <details style={{ marginTop: 22, borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-2)", padding: 16 }}>
        <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--fg-2)" }}>
          Didn&apos;t get the email?
        </summary>
        <ResendVerification defaultEmail={email} />
      </details>
    </>
  );
}

// ── State: link expired ───────────────────────────────────────────────────
function ExpiredState({ email }: { email: string }) {
  return (
    <>
      <StatusPill tone="warn">Link expired</StatusPill>
      <h1 style={h1Style}>That verification link expired.</h1>
      <p style={bodyStyle}>
        Confirmation links last 24 hours. No problem, we&apos;ll send a fresh one to{" "}
        {email ? <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>{email}</span> : <span style={{ color: "var(--fg-4)" }}>your email</span>}.
      </p>
      <ResendVerification defaultEmail={email} />
    </>
  );
}

// ── State: link invalid / unknown token ───────────────────────────────────
function InvalidState() {
  return (
    <>
      <StatusPill tone="error">Link invalid</StatusPill>
      <h1 style={h1Style}>We couldn&apos;t verify that link.</h1>
      <p style={bodyStyle}>
        Maybe it was already used (your account might already be active), or it was edited somewhere along the way. Sign in below, if that doesn&apos;t work, enter your email and we&apos;ll send a fresh confirmation link.
      </p>
      <Link href="/signin" className="btn" style={{ marginTop: 20, display: "inline-block" }}>
        Try signing in
      </Link>
      <div style={{ marginTop: 24 }}>
        <p style={{ fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-4)", margin: "0 0 4px" }}>Or resend</p>
        <ResendVerification />
      </div>
    </>
  );
}

// ── State: server-side error during verify ────────────────────────────────
function ErrorState({ email }: { email: string }) {
  return (
    <>
      <StatusPill tone="error">Something went wrong</StatusPill>
      <h1 style={h1Style}>We hit a snag verifying your email.</h1>
      <p style={bodyStyle}>
        Try the link again in a minute, if it keeps failing, resend a fresh link below or email <a href="mailto:help@vraelis.com" style={{ color: "var(--acc-deep)", fontWeight: 600 }}>help@vraelis.com</a> and we&apos;ll sort it out.
      </p>
      <ResendVerification defaultEmail={email} />
    </>
  );
}
