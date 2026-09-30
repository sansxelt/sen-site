import type { Metadata } from "next";
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import Link from "next/link";
import { v6meta } from "../_system/meta";
import { PageHero } from "../_system/ui";

export const metadata: Metadata = v6meta({
  title: "README",
  description: "Why Vraelis exists: done used to mean someone checked; software now ships faster than anyone checks it; Vraelis puts one independent check on the live app.",
  path: "/readme",
  ogTitle: "Why Vraelis exists",
});

// REWRITTEN 2026-09-28. The three acts told a story about agents taking over the loop and oversight following
// them "everywhere". The gap is the same whoever built the software, so the present act names all of them,
// and the third act is the one direction the founder named that day, stated to the site's standard: the
// control-panel check is live, reading a device itself is next and not built.
const ACTS: [string, string, string][] = [
  ["Past", "Done meant someone checked.", "People wrote the software, reviewed each other's work, wrote the tests, and decided when it was safe to ship. Trust came from a chain of people who each understood a piece of the system. It was slow, and it did not scale, but everyone in the loop could be asked what they had checked."],
  ["Present", "Software ships faster than anyone checks it.", "Small teams, agencies shipping client sites, founders on no-code tools and AI coding agents all ship changes faster than any review process built for people. Whoever did the work is usually also the one saying it is done, and confidence is not the same as proof. Vraelis is one independent check on the live app: a sentence about what should work, a plan a person approves, and an answer with the evidence."],
  ["Next", "The check follows software onto what it controls.", "More software now runs hardware: drones, robots and fleets operated from web control panels. Vraelis checks those panels today, through the same real browser. Reading the device itself, its firmware, sensors and telemetry, is next and not built yet."],
];

export default function Readme() {
  return (
    <>
      <PageHero
        read
        kicker="README"
        title="Why Vraelis exists."
        lead="Software used to be trusted because someone checked it before saying it was done. That step is disappearing. Vraelis puts it back, on the live app."
      />
      <section className="v6-sec" style={{ paddingTop: 0 }}>
        <div className="v6-wrap v6-wrap--read">
          {ACTS.map(([act, head, body], i) => (
            <div key={act} style={{ paddingTop: i === 0 ? 0 : "clamp(36px,4vw,56px)", marginTop: i === 0 ? 0 : "clamp(36px,4vw,56px)", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
              <span className="v6-mono" style={{ fontSize: 12, color: "var(--brand-ink)" }}>{act}</span>
              <h2 className="v6-dl" style={{ margin: "14px 0 16px" }}>{head}</h2>
              <p style={{ fontSize: "1.12rem", lineHeight: 1.62, color: "var(--ink-2)", margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="v6-sec v6-sec--tight v6-dark" data-nav-dark>
        <div className="v6-wrap v6-wrap--read" style={{ textAlign: "center" }}>
          <h2 className="v6-dl" style={{ marginInline: "auto" }}>Know it works before you say it does.</h2>
          <p className="v6-lead" style={{ margin: "18px auto 28px", textAlign: "center" }}>Vraelis checks one sentence about what should work against the live app, and keeps the evidence behind every decision.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href={v6SignInPath()} className="v6-btn v6-btn--brand v6-btn--lg">Open Vraelis <span className="v6-arw" aria-hidden>→</span></Link>
            <Link href={`${V6_BASE}/method`} className="v6-btn v6-btn--ghost v6-btn--lg" style={{ background: "transparent", color: "var(--g-fg)", borderColor: "var(--g-line-2)" }}>Read the Method</Link>
          </div>
        </div>
      </section>
    </>
  );
}
