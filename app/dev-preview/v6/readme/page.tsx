import type { Metadata } from "next";
import { v6SignInPath } from "@/lib/v6-routes";
import Link from "next/link";
import { v6meta } from "../_system/meta";
import { PageHero } from "../_system/ui";

export const metadata: Metadata = v6meta({
  title: "README",
  description: "Why Vraelis exists: humans used to write, review, test, and ship; agents now plan, build, and repair; oversight has to follow them.",
  path: "/readme",
  ogTitle: "Why Vraelis exists",
});

const ACTS: [string, string, string][] = [
  ["Past", "Humans held the whole loop.", "People wrote the software, reviewed each other's work, wrote the tests, and decided when it was safe to ship. Trust came from a chain of humans who each understood a piece of the system. It was slow, and it did not scale, but everyone in the loop could be asked why."],
  ["Present", "Agents can do most of the loop.", "AI agents now plan, change code, call external systems, and repair their own failures across increasingly large systems. They move faster than any review process built for humans. But the agent that did the work is also the one claiming it is done, and confidence is not the same as proof."],
  ["Future", "Oversight follows the work everywhere.", "Agents will take on more responsibility, not less. The answer is not to slow them down; it is to put independent oversight next to them, so a company can give an agent a real job and still know what it can be trusted to do. Vraelis is that oversight."],
];

export default function Readme() {
  return (
    <>
      <PageHero
        kicker="README"
        title="Why Vraelis exists."
        lead="Software used to be trusted because humans held the loop. That loop is changing. Vraelis is what keeps it trustworthy."
      />
      <section className="v6-sec" style={{ paddingTop: 0 }}>
        <div className="v6-wrap v6-wrap--read">
          {ACTS.map(([act, head, body], i) => (
            <div key={act} style={{ paddingTop: i === 0 ? 0 : "clamp(36px,4vw,56px)", marginTop: i === 0 ? 0 : "clamp(36px,4vw,56px)", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
              <span className="v6-mono" style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--brand-ink)" }}>{act}</span>
              <h2 className="v6-dl" style={{ margin: "14px 0 16px" }}>{head}</h2>
              <p style={{ fontSize: "1.12rem", lineHeight: 1.62, color: "var(--ink-2)", margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="v6-sec v6-sec--tight v6-dark" data-nav-dark>
        <div className="v6-wrap v6-wrap--read" style={{ textAlign: "center" }}>
          <h2 className="v6-dl" style={{ marginInline: "auto" }}>Give agents more responsibility without giving up control.</h2>
          <p className="v6-lead" style={{ margin: "18px auto 28px", textAlign: "center" }}>Vraelis follows AI software work from assigned responsibility to trusted completion, and keeps what your company learns along the way.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href={v6SignInPath()} className="v6-btn v6-btn--brand v6-btn--lg">Open Vraelis <span className="v6-arw" aria-hidden>→</span></Link>
            <Link href="/dev-preview/v6/method" className="v6-btn v6-btn--ghost v6-btn--lg" style={{ background: "transparent", color: "var(--g-fg)", borderColor: "var(--g-line-2)" }}>Read the Method</Link>
          </div>
        </div>
      </section>
    </>
  );
}
