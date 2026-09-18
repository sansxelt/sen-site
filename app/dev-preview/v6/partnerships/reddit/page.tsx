import { v6meta } from "../../_system/meta";

export const metadata = v6meta({
  title: "Reddit partnership",
  description:
    "The public record of Vraelis's 2026 advertising partnership with Reddit, focused on reaching and engaging audiences through Reddit Ads.",
  path: "/partnerships/reddit",
  type: "website",
  ogTitle: "Vraelis × Reddit",
  ogDescription: "A 2026 advertising partnership focused on audience reach through Reddit Ads.",
});

const FACTS = [
  ["Partner", "Reddit"],
  ["Date", "September 14, 2026"],
  ["Focus", "Audience reach and Reddit Ads"],
] as const;

export default function RedditPartnershipPage() {
  return (
    <>
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap">
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
              <p className="v6-eyebrow" style={{ margin: 0 }}>Partnership record</p>
              <span className="v6-eyebrow" style={{ margin: 0, padding: "8px 11px", border: "1px solid var(--line-2)", borderRadius: 999 }}>
                Partnered 2026
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "clamp(34px, 7vw, 100px)", alignItems: "end", marginTop: "clamp(28px, 5vw, 64px)" }}>
              <div>
                <h1 className="v6-dl" style={{ margin: 0 }}>Vraelis × Reddit</h1>
                <p className="v6-lead" style={{ marginTop: 20, maxWidth: "38rem" }}>
                  Vraelis entered an advertising partnership with Reddit focused on reaching and engaging relevant audiences through Reddit Ads.
                </p>
              </div>
              <dl style={{ margin: 0, borderTop: "1px solid var(--line-2)" }}>
                {FACTS.map(([term, value]) => (
                  <div key={term} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 20, padding: "16px 0", borderBottom: "1px solid var(--line-2)" }}>
                    <dt className="v6-eyebrow" style={{ margin: 0 }}>{term}</dt>
                    <dd style={{ margin: 0, color: "var(--ink)", fontSize: 15 }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "clamp(34px, 7vw, 100px)" }}>
          <div>
            <p className="v6-eyebrow">The record</p>
            <h2 className="v6-dm" style={{ margin: "12px 0 16px", color: "var(--g-fg)" }}>What the partnership means.</h2>
            <p className="v6-body" style={{ color: "var(--g-fg-2)", maxWidth: "58ch" }}>
              The relationship gives Vraelis a direct path to develop its presence and advertising work on Reddit. Any specific campaign or measured result will be named only after it exists.
            </p>
          </div>
          <div>
            <p className="v6-eyebrow">The boundary</p>
            <h2 className="v6-dm" style={{ margin: "12px 0 16px", color: "var(--g-fg)" }}>No claim beyond the partnership.</h2>
            <p className="v6-body" style={{ color: "var(--g-fg-2)", maxWidth: "58ch" }}>
              This record does not claim campaign performance, exclusivity, private user-data access or a Reddit endorsement of Vraelis products.
            </p>
            <a href="https://www.business.reddit.com/" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 22, color: "var(--g-fg)", textDecoration: "none", borderBottom: "1px solid var(--g-line)", paddingBottom: 5 }}>
              Visit Reddit for Business&nbsp; ↗
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
