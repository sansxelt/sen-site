"use client";

/* HOW IT WORKS, ON ONE SCREEN.

   This replaced three homepage chapters on 2026-09-29 (the pinned five-screen loop, the "where it lands"
   collage and the terminal with its exit codes) when the founder asked for a tighter homepage that does not
   rest the whole product on its three answers. The same facts, four cards, no scroll scene: the sentence,
   the person's approval, the live run and its evidence, and the fix and re-check. The four ways in are named
   in the first card instead of a chapter of their own. The longer walk-throughs still live on /platform,
   /agents and /developers. Every line is enforced by code: approval refuses API keys (plan_requires_human),
   and re-checks run inside lib/preflight/recheck.ts. */
import { Reveal, SectionHead, EditorialLink } from "./ui";
import { V6_BASE } from "@/lib/v6-routes";

const STEPS: { h: string; p: string }[] = [
  { h: "Say what should work", p: "One sentence about the deployed app or the panel that runs a device. Send it from the Vraelis console, the CLI, a CI job, or your AI assistant." },
  { h: "Approve the plan", p: "Vraelis writes the steps that would prove it. A person reads them and approves once. No script, key or agent can approve for you." },
  { h: "It runs on the live app", p: "A real browser follows the plan and records every step, a screenshot, console errors and failed requests." },
  { h: "Fix and check again", p: "If something broke, you see what was expected, what happened instead, and a repair prompt. After the fix, the same plan runs again without a new approval." },
];

export function HowItWorks() {
  return (
    // The page's own ground is graphite, and .v6-sec sets none, so a light section has to name its paper or
    // it inherits the dark and its ink headings vanish into it.
    <section className="v6-sec" id="how" data-nav-theme="light" style={{ background: "var(--paper)" }}>
      <div className="v6-wrap">
        <Reveal>
          <SectionHead eyebrow="How it works" title="From one sentence to the live app" />
        </Reveal>
        <div className="v6-grid3" role="list" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))" }}>
          {STEPS.map((s, i) => (
            <Reveal key={s.h} className="v6-gcard" i={i}>
              <div role="listitem">
                <p className="v6-mono" style={{ margin: "0 0 14px", fontSize: 12, color: "var(--ink-4)" }}>{String(i + 1).padStart(2, "0")}</p>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal style={{ marginTop: 26 }}>
          <EditorialLink href={`${V6_BASE}/platform`}>The whole product</EditorialLink>
        </Reveal>
      </div>
    </section>
  );
}
