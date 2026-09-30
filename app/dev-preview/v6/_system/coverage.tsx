"use client";

/* WHAT YOU CAN CHECK, ON THE HOMEPAGE.

   One list of every kind of thing the company is for, each row saying whether it works today. Added
   2026-09-30 so a reader who builds an Electron app, an SDK or a robot finds out on the homepage whether
   Vraelis can check it, instead of assuming yes from the examples above or no from their absence.

   It reads SURFACES from _content/coverage.ts, the same list /platform renders in full, so the two can never
   disagree about what is live. Only the wording is compact here (each row's `brief`).

   The tier is typography, not a signal colour. Green, amber and red on this site mean a result held, a
   person is needed, or it failed; a roadmap label is none of those. Live is a filled ink chip, Next is
   plain text that says it is not built, Not covered is plain text. */
import { Reveal, SectionHead, EditorialLink } from "./ui";
import { SURFACES, COVERAGE_RULE, type CoverageTier } from "../_content/coverage";
import { V6_BASE } from "@/lib/v6-routes";
import "./coverage.css";

const TIER_LABEL: Record<CoverageTier, string> = { Live: "Live", Next: "Not built yet", "Not covered": "Not covered" };

export function Coverage() {
  return (
    <section className="v6-sec" id="what-you-can-check" data-nav-theme="light">
      <div className="v6-wrap">
        <Reveal>
          <SectionHead
            align="center"
            title="Anything a browser can reach, today."
            lead="And everything else Vraelis is for, labelled for exactly where it is."
          />
        </Reveal>
        <Reveal className="v6-cov" i={1}>
          <ul className="v6-cov__list">
            {SURFACES.map((s) => (
              <li key={s.name} className="v6-cov__row" data-tier={s.tier === "Live" ? "live" : s.tier === "Next" ? "next" : "out"}>
                <span className="v6-cov__what">{s.name}</span>
                <span className="v6-cov__how">{s.brief}</span>
                <span className="v6-cov__status">{TIER_LABEL[s.tier]}</span>
              </li>
            ))}
          </ul>
          <p className="v6-cov__note">{COVERAGE_RULE}</p>
          <div className="v6-cov__more">
            <EditorialLink href={`${V6_BASE}/platform#coverage`}>Each one in detail</EditorialLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
