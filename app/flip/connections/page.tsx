import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplaces — Flip Engine",
  description: "Flip writes copy-paste-ready listings for eBay, Poshmark, Depop and Mercari today. One-click cross-posting and Shopify are rolling out.",
};

const MARKETS = [
  { name: "eBay", blurb: "Keyword-stuffed 80-char title, item specifics, and a full description — built to surface in search.", status: "live" },
  { name: "Poshmark", blurb: "Title and description in Posh's voice, plus a ready hashtag set for the share game.", status: "live" },
  { name: "Depop", blurb: "Casual, trend-aware copy and hashtags tuned for how Depop buyers actually search.", status: "live" },
  { name: "Mercari", blurb: "Tight title and clean description that fit Mercari's shorter limits.", status: "live" },
  { name: "Shopify", blurb: "Push finished listings to your own store with product fields mapped — auto-sync is in build.", status: "soon" },
];

function StatusPill({ status }: { status: string }) {
  const live = status === "live";
  return (
    <span className={`pill ${live ? "st-won" : ""}`} style={!live ? { color: "var(--fg-4)" } : undefined}>
      <span className="dot" />{live ? "Copy-paste ready" : "Coming soon"}
    </span>
  );
}

export default function FlipConnections() {
  return (
    <>
      <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line-1)" }}>
        <div className="gridbg" />
        <div className="wrap" style={{ position: "relative", paddingTop: "clamp(40px, 6vw, 76px)", paddingBottom: "clamp(28px, 4vw, 44px)" }}>
          <div style={{ maxWidth: 700 }}>
            <p className="eyebrow">Marketplaces</p>
            <h1 className="display" style={{ fontSize: "clamp(2.3rem, 4.4vw, 3.6rem)", marginBottom: 18 }}>
              List everywhere you <span className="em">sell</span>.
            </h1>
            <p className="lead-copy">Flip writes a listing tuned to each marketplace. Today you copy it in; one-click cross-posting and Shopify sync are on the way. We&apos;ll always tell you what&apos;s live and what&apos;s building.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {MARKETS.map((m) => (
              <div key={m.name} className="card" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 190 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>{m.name}</span>
                  <StatusPill status={m.status} />
                </div>
                <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, flex: 1 }}>{m.blurb}</p>
                {m.status === "live" ? (
                  <a href="/app" className="btn btn--ghost" style={{ justifyContent: "center" }}>Generate a listing</a>
                ) : (
                  <span style={{ textAlign: "center", borderRadius: "var(--r-sm)", padding: "12px 18px", fontSize: 14, fontWeight: 600, color: "var(--fg-4)", border: "1px dashed var(--line-3)", background: "var(--bg-2)" }}>Auto-sync in build</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* today vs soon */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ maxWidth: 640, marginBottom: "clamp(28px, 3vw, 44px)" }}>
            <p className="eyebrow">The workflow</p>
            <h2 className="display" style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.8rem)" }}>Copy-paste today. <span className="em">One click soon</span>.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }} className="cols-2">
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
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>Rolling out</div>
              {["Connect your marketplace accounts", "Generate the listing", "Pick where to post", "One click — it posts everywhere"].map((s, i) => (
                <div key={s} style={{ display: "flex", gap: 12, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", width: 18 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: 14, color: "var(--fg-2)" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", marginTop: 20, lineHeight: 1.6, maxWidth: 720 }}>
            Direct posting goes through each marketplace&apos;s official API and their app review — so it ships platform by platform as we&apos;re approved. Pro users get it switched on automatically.
          </p>
        </div>
      </section>

      <section className="section" style={{ textAlign: "center", borderBottom: "none" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <h2 className="display" style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", marginBottom: 20 }}>Start with the listing. <span className="em">Add the posting later</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 30px", textAlign: "center" }}>The hard part — writing copy that sells on four platforms — works today. Try it on one item.</p>
          <a href="/app" className="btn btn--lg">Try it free <span aria-hidden>→</span></a>
        </div>
      </section>
    </>
  );
}
