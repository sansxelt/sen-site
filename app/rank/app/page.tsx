import type { Metadata } from "next";
import { auth } from "@/auth";
import { ensureProfile, listUserTests } from "@/lib/v-db";
import { ensureSignupGrant, balance } from "@/lib/v-credits";

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
  const [bal, tests] = await Promise.all([balance(email), listUserTests(email)]);

  return (
    <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)" }}>Your tests</h1>
        </div>
        <a href="/app/new" className="btn">New test <span aria-hidden>→</span></a>
      </div>

      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--fg-1)", lineHeight: 1 }}>{bal}<span style={{ fontSize: 14, color: "var(--fg-4)", fontWeight: 500, marginLeft: 8 }}>credits</span></div>
          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 6 }}>1 credit = 1 real human vote. Out of credits? Vote on others&apos; tests to earn more.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/app/credits" className="btn btn--ghost">Buy credits</a>
          <a href="/vote" className="btn btn--ghost">Vote &amp; earn</a>
        </div>
      </div>

      {tests.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "clamp(32px, 5vw, 56px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)", marginBottom: 8 }}>No tests yet</div>
          <p style={{ fontSize: 14, color: "var(--fg-3)", marginBottom: 20 }}>Upload a few options and let real people pick the winner.</p>
          <a href="/app/new" className="btn">Create your first test <span aria-hidden>→</span></a>
        </div>
      ) : (
        <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--bg-1)", boxShadow: "var(--shadow-card)" }}>
          {tests.map((t, i) => (
            <a key={t.id} href={`/app/tests/${t.id}/report`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 14, alignItems: "center", padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", textDecoration: "none" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", marginTop: 4 }}>{t.category} · {t.votes_valid}/{t.votes_target} votes</div>
              </div>
              <span className={`pill ${t.status === "complete" ? "st-won" : ""}`} style={t.status !== "complete" ? { color: "var(--fg-4)" } : undefined}><span className="dot" />{t.status}</span>
              <span style={{ fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, whiteSpace: "nowrap" }}>{t.status === "complete" ? "Report →" : "View →"}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
