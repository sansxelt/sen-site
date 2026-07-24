import type { Metadata } from "next";
import Link from "next/link";
import { v6meta } from "../_system/meta";
import { PageHero, Prose } from "../_system/ui";

export const metadata: Metadata = v6meta({
  title: "The Vraelis Method",
  description: "The worldview behind Vraelis: responsibility before implementation, evidence before confidence, and autonomy that must be earned.",
  path: "/method",
  ogTitle: "The Vraelis Method",
});

const CHAPTERS: [string, string, string[]][] = [
  ["introduction", "Introduction", [
    "Software is increasingly built by agents that can plan, write, call systems, and repair their own work. The bottleneck is no longer how fast software gets made. It is whether the result can be trusted.",
    "The Vraelis Method is a set of positions about how to earn that trust. They are opinionated on purpose. They are the reason the product is shaped the way it is.",
  ]],
  ["responsibility", "Responsibility before implementation", [
    "A company does not care which files an agent changed. It cares whether an outcome it depends on still holds. Oversight should start from the responsibility, stated as an outcome, and treat the implementation as the thing being judged, not the thing being described.",
    "State what must remain true first. Everything the agent does is then measured against it.",
  ]],
  ["judge", "The builder cannot be the only judge", [
    "An agent that plans, writes, and repairs the work will also tell you it is finished. A test written inside the system inherits the same assumptions the mistake came from. Independence is not something you reach by trying harder; it is structural.",
    "The thing that produces the work does not get to certify it. Someone, or something, outside the work has to decide.",
  ]],
  ["standards", "Keep standards outside the agent", [
    "If the standard a piece of work is held to lives inside the agent, the agent can move it. Requirements, the plan that proves them, and the decision to accept a completion belong outside the agent's control, where a person approves them and the agent cannot quietly change them.",
  ]],
  ["evidence", "Evidence before confidence", [
    "A confident claim is not proof. Vraelis prefers what can be observed: the running software driven in a real browser, the systems actually called, the state actually left behind. When evidence and confidence disagree, evidence wins.",
  ]],
  ["boundary", "Human judgment at the boundary", [
    "Most of oversight can be mechanical. Some of it cannot. Sensitive actions and irreducible uncertainty should be raised to a person, deliberately and rarely, rather than absorbed silently by automation. The goal is not to remove human judgment; it is to spend it where it matters.",
  ]],
  ["repair", "Repairs must resolve the responsibility", [
    "A fix is not finished because the agent changed something. It is finished when the responsibility that failed now holds, checked independently, as its own record. A later result never overwrites an earlier one, so the history of how the software reached trust stays intact.",
  ]],
  ["memory", "Memory compounds", [
    "Oversight is worth more over time. Every responsibility teaches the system how a company's software and agents actually fail. That accumulated, company-specific understanding is the compounding value, not any single verdict.",
  ]],
  ["autonomy", "Autonomy must be earned", [
    "The right amount of autonomy for an agent is not a setting; it is a conclusion. An agent earns more responsibility by a track record of trusted completions on real work, observed independently. Until then, oversight stays close.",
  ]],
];

export default function Method() {
  return (
    <>
      <PageHero
        kicker="The Vraelis Method"
        title="How we think about trusting AI software work."
        lead="Eight positions that decide how the product is built. They are opinionated on purpose."
      />
      <section className="v6-sec" style={{ paddingTop: 0 }}>
        <div className="v6-wrap v6-wrap--read">
          <nav aria-label="Chapters" style={{ marginBottom: "clamp(32px,4vw,52px)", paddingBottom: 24, borderBottom: "1px solid var(--line)" }}>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {CHAPTERS.map(([slug, title], i) => (
                <li key={slug} style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                  <span className="v6-mono" style={{ fontSize: 12, color: "var(--brand-ink)" }}>{String(i + 1).padStart(2, "0")}</span>
                  <a href={`#${slug}`} style={{ color: "var(--ink-2)", textDecoration: "none", fontSize: 16 }}>{title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <Prose>
            {CHAPTERS.map(([slug, title, paras]) => (
              <section key={slug} id={slug}>
                <h2>{title}</h2>
                {paras.map((p, i) => <p key={i}>{p}</p>)}
              </section>
            ))}
          </Prose>
          <div style={{ marginTop: 56, paddingTop: 28, borderTop: "1px solid var(--line)", display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link href="/dev-preview/v6/readme" className="v6-btn v6-btn--ghost">Read the README</Link>
            <Link href="/signin?callbackUrl=%2Fapp" className="v6-btn v6-btn--brand">Open Vraelis <span className="v6-arw" aria-hidden>→</span></Link>
          </div>
        </div>
      </section>
    </>
  );
}
