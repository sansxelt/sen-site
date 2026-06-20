import type { Metadata } from "next";
import { auth } from "@/auth";
import { ensureProfile, listUserTests, getPlan } from "@/lib/v-db";
import { ensureSignupGrant, balance } from "@/lib/v-credits";
import { isAdmin } from "@/lib/v-entitlements";

function FirstRun({ bal }: { bal: number }) {
  const steps: [string, string, boolean][] = [
    ["Claim your starter credits", `${bal} credits ready`, bal > 0],
    ["Create your first test", "Upload 2–8 options", false],
    ["Pick a vote target", "1 credit = 1 human vote", false],
    ["Launch & collect votes", "Real people weigh in", false],
    ["Read your report", "Winner, why, what to fix", false],
    ["Embed or use the API", "Collect votes anywhere", false],
  ];
  const credits: [string, string][] = [
    ["1 credit = 1 valid human vote", "You only pay for real judgments."],
    ["Credits are held when you launch", "Escrowed, not spent up front."],
    ["Invalid votes are filtered", "Too-fast, duplicate and spam votes are rejected."],
    ["Unused credits are refunded", "If a test doesn't fill, you get them back."],
    ["Buy more anytime", "Top up from $5, or earn credits by voting."],
  ];
  return (
    <>
      <div style={{ background: "linear-gradient(150deg, var(--acc) 0%, var(--acc-deep) 100%)", borderRadius: 14, color: "#fff", padding: "clamp(24px, 3.5vw, 36px)", marginBottom: 16, boxShadow: "var(--shadow-win)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85, marginBottom: 8 }}>Welcome to Vraelis</div>
        <h2 className="display" style={{ fontSize: "clamp(1.5rem, 3vw, 2.1rem)", color: "#fff", marginBottom: 8 }}>You have {bal} starter credits.</h2>
        <p style={{ fontSize: 15, lineHeight: 1.55, maxWidth: 540, opacity: 0.95, marginBottom: 18 }}>Create your first test in under 2 minutes — upload a few options and real people will tell you what wins. <strong>1 credit = 1 valid human judgment.</strong></p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/app/new" className="btn" style={{ background: "#fff", color: "var(--acc-deep)", borderColor: "#fff" }}>Create first test →</a>
          <a href="/vote" className="btn btn--ghost" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.55)" }}>Try voting first</a>
        </div>
      </div>
      <div className="cols-2" style={{ gap: 14 }}>
        <div className="card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>Get started</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {steps.map(([label, sub, done], i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", border: done ? "none" : "1.5px solid var(--line-3)", background: done ? "var(--acc)" : "transparent", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, marginTop: 1 }}>{done ? "✓" : ""}</span>
                <div><div style={{ fontSize: 14, fontWeight: 600, color: done ? "var(--fg-4)" : "var(--fg-1)", textDecoration: done ? "line-through" : "none" }}>{label}</div><div style={{ fontSize: 12, color: "var(--fg-4)" }}>{sub}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>How credits work</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 11 }}>
            {credits.map(([t, d], i) => (
              <li key={i} style={{ display: "flex", gap: 9 }}><span style={{ color: "var(--acc)", marginTop: 1 }}>✓</span><div><div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)" }}>{t}</div><div style={{ fontSize: 12.5, color: "var(--fg-3)" }}>{d}</div></div></li>
            ))}
          </ul>
          <a href="/app/credits" style={{ fontSize: 13, color: "var(--acc-deep)", textDecoration: "none", display: "inline-block", marginTop: 14 }}>Buy credits →</a>
        </div>
      </div>
    </>
  );
}

function TestList({ title, items }: { title: string; items: Awaited<ReturnType<typeof listUserTests>> }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>{title} · {items.length}</div>
      <div style={{ border: "1px solid var(--line-2)", borderRadius: 12, overflow: "hidden", background: "var(--bg-1)", boxShadow: "var(--shadow-card)" }}>
        {items.map((t, i) => {
          const pct = Math.min(100, Math.round((t.votes_valid / Math.max(1, t.votes_target)) * 100));
          return (
            <a key={t.id} href={`/app/tests/${t.id}/report`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px auto auto", gap: 14, alignItems: "center", padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", textDecoration: "none" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", marginTop: 4 }}>{t.category} · {t.votes_valid}/{t.votes_target} votes</div>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "var(--bg-2)", overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: t.status === "complete" ? "var(--acc)" : "linear-gradient(90deg, var(--acc), var(--acc-deep))" }} /></div>
              <span className="pill" style={t.status === "complete" ? { background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" } : { color: "var(--fg-4)" }}>{t.status}</span>
              <span style={{ fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, whiteSpace: "nowrap" }}>{t.status === "complete" ? "Report →" : "View →"}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export const metadata: Metadata = { title: "Dashboard — Vraelis" };

export default async function Dashboard() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return (
      <section className="section" style={{ borderBottom: "none" }}>
        <div className="wrap" style={{ maxWidth: 520, textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Dashboard</p>
          <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)", marginBottom: 14 }}>Your <span className="em">tests</span>.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 26px" }}>Sign in to create tests, see results, and manage your credits.</p>
          <a href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Continue with Google</a>
        </div>
      </section>
    );
  }

  await ensureProfile(email, session.user?.name ?? undefined);
  await ensureSignupGrant(email);
  const [bal, tests, plan] = await Promise.all([balance(email), listUserTests(email), getPlan(email)]);
  const active = tests.filter((t) => t.status === "active");
  const completed = tests.filter((t) => t.status === "complete");
  const planName = plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <div className="wrap" style={{ maxWidth: 1000, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)" }}>Welcome back</h1>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {isAdmin(email) && <a href="/app/admin" className="vra-nav-secondary" style={{ fontSize: 13.5, color: "var(--fg-2)", textDecoration: "none" }}>Admin</a>}
          <a href="/app/data" className="vra-nav-secondary" style={{ fontSize: 13.5, color: "var(--fg-2)", textDecoration: "none" }}>Data</a>
          <a href="/app/billing" className="vra-nav-secondary" style={{ fontSize: 13.5, color: "var(--fg-2)", textDecoration: "none" }}>Billing</a>
          <a href="/app/new" className="btn">New test <span aria-hidden>→</span></a>
        </div>
      </div>

      {/* metric strip */}
      <div className="metric-strip" style={{ border: "1px solid var(--line-2)", borderRadius: 14, overflow: "hidden", background: "var(--bg-1)", boxShadow: "var(--shadow-card)", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 22 }}>
        <div className="metric"><div className="metric__label">Plan</div><div className="metric__val" style={{ fontFamily: "var(--font-display)" }}>{planName}</div><div className="metric__delta"><a href="/app/plans" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>{plan === "free" ? "Upgrade →" : "Manage →"}</a></div></div>
        <div className="metric"><div className="metric__label">Credits</div><div className="metric__val tnum">{bal.toLocaleString()}</div><div className="metric__delta"><a href="/app/credits" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>Buy more →</a></div></div>
        <div className="metric"><div className="metric__label">Active tests</div><div className="metric__val tnum">{active.length}</div><div className="metric__delta">collecting votes</div></div>
        <div className="metric"><div className="metric__label">Completed</div><div className="metric__val tnum">{completed.length}</div><div className="metric__delta">reports ready</div></div>
      </div>

      {tests.length === 0 ? (
        <FirstRun bal={bal} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
            <a href="/app/new" className="btn">Create a test</a>
            <a href="/app/credits" className="btn btn--ghost">Buy credits</a>
            <a href="/vote" className="btn btn--ghost">Vote &amp; earn</a>
            <a href="/app/api-keys" className="btn btn--ghost">API &amp; embed</a>
          </div>
          {active.length > 0 && <TestList title="Active" items={active} />}
          {completed.length > 0 && <TestList title="Completed" items={completed} />}
          {active.length === 0 && completed.length === 0 && tests.length > 0 && <TestList title="Tests" items={tests} />}
        </>
      )}
    </div>
  );
}
