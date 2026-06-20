import type { Metadata } from "next";
import { auth } from "@/auth";
import { listConnections } from "@/lib/flip-db";
import { ConnectPanel } from "./connect-panel";

export const metadata: Metadata = {
  title: "Marketplaces — Vraelis",
  description: "Vraelis writes copy-paste-ready listings for eBay, Poshmark, Depop and Mercari today. One-click auto-posting (eBay & Shopify) is rolling out — get early access.",
};

export default async function FlipConnections() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const signedIn = Boolean(email);
  const conns = email ? await listConnections(email) : [];
  const initial: Record<string, string> = {};
  for (const c of conns) initial[c.platform] = c.status;

  return (
    <>
      <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line-1)" }}>
        <div className="gridbg" />
        <div className="wrap" style={{ position: "relative", paddingTop: "clamp(40px, 6vw, 76px)", paddingBottom: "clamp(28px, 4vw, 44px)" }}>
          <div style={{ maxWidth: 720 }}>
            <p className="eyebrow">Marketplaces</p>
            <h1 className="display" style={{ fontSize: "clamp(2.3rem, 4.4vw, 3.6rem)", marginBottom: 18 }}>
              List everywhere you <span className="em">sell</span>.
            </h1>
            <p className="lead-copy">Vraelis writes a listing tuned to each marketplace. eBay &amp; Shopify get one-click auto-posting (rolling out — grab early access below); Poshmark, Depop &amp; Mercari are copy-and-paste because they don&apos;t offer a public API. We&apos;ll always tell you what&apos;s live and what&apos;s building.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: "clamp(20px,2.5vw,32px)" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.4rem,2.4vw,1.9rem)", color: "var(--fg-1)", letterSpacing: "-0.02em" }}>Your channels</h2>
            {!signedIn && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>Sign in to enroll your accounts</span>}
          </div>
          <ConnectPanel signedIn={signedIn} initial={initial} />
        </div>
      </section>

      {/* today vs soon */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ maxWidth: 640, marginBottom: "clamp(28px, 3vw, 44px)" }}>
            <p className="eyebrow">The workflow</p>
            <h2 className="display" style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.8rem)" }}>Copy-paste today. <span className="em">One click soon</span>.</h2>
          </div>
          <div className="grid cols-2">
            <div className="card" style={{ padding: "clamp(22px, 2.4vw, 30px)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 14 }}>Live now</div>
              {["Photograph the item", "Generate the listing", "Copy each field", "Paste into the marketplace"].map((s, i) => (
                <div key={s} style={{ display: "flex", gap: 12, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", width: 18 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: 14, color: "var(--fg-2)" }}>{s}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: "clamp(22px, 2.4vw, 30px)", borderColor: "var(--acc-line)", background: "var(--acc-soft)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>Rolling out (eBay &amp; Shopify)</div>
              {["Connect your account once", "Generate the listing", "Pick where to post", "One click — Vraelis posts it"].map((s, i) => (
                <div key={s} style={{ display: "flex", gap: 12, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", width: 18 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: 14, color: "var(--fg-2)" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", marginTop: 20, lineHeight: 1.6, maxWidth: 720 }}>
            Direct posting goes through each marketplace&apos;s official API and app review, so it ships platform by platform as we&apos;re approved. Enroll above and we&apos;ll switch it on for your account automatically.
          </p>
        </div>
      </section>

      <section className="section" style={{ textAlign: "center", borderBottom: "none" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <h2 className="display" style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", marginBottom: 20 }}>Start with the listing. <span className="em">Add the posting later</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 30px", textAlign: "center" }}>The hard part — copy that sells on every platform — works today. Try it on one item.</p>
          <a href="/app" className="btn btn--lg">Try it free <span aria-hidden>→</span></a>
        </div>
      </section>
    </>
  );
}
