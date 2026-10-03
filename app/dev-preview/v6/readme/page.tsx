import type { Metadata } from "next";
import { Fragment } from "react";
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import { v6meta } from "../_system/meta";
import { CTA, Prose } from "../_system/ui";
import { CrossLinks } from "../_system/kit";
import { ClosingScene } from "../_system/close";
import { SUPPORT } from "../_system/positioning";
import "../_system/read.css";

export const metadata: Metadata = v6meta({
  title: "README",
  description: "Why Vraelis exists: done used to mean someone checked; software now ships faster than anyone checks it; Vraelis puts one independent check on the live app.",
  path: "/readme",
  ogTitle: "Why Vraelis exists",
});

/* THE README, IN THE READ LAYOUT (plan T9 and C /readme, revision 2, 2026-10-02).
 *
 * The canonical long form of the three acts; /company links here. The page is a read
 * page like a research article (_system/read.css): a head in the 680 column, the three acts as the body (each act's
 * name is the section label over its title), then the related reading, the product step, and its own closing line,
 * "Read what is built today.", which goes to the list of what is built (/platform#current). Three short acts need
 * no contents list. Nothing here is wrapped in Reveal.
 *
 * REWRITTEN 2026-09-28. The three acts told a story about agents taking over the loop and oversight following them
 * "everywhere". The gap is the same whoever built the software, so the present act names all of them, and the third
 * act is the one direction the founder named that day, stated to the site's standard: the control-panel check is
 * built, reading a device itself is next and not built (_content/scope.ts, the first Direction line).
 * The approval is said once on this page, in the present act (plan 0.3).
 */

// Account creation is the sign-in screen in its sign-up mode, as the closing scene and the bar use it.
const SIGNUP = `${v6SignInPath()}&mode=signup`;

const ACTS: [string, string, string][] = [
  ["Past", "Done meant someone checked.", "People wrote the software, reviewed each other's work, wrote the tests, and decided when it was ready to ship. Trust came from a chain of people who each understood a piece of the system. It was slow, and it did not scale, but everyone in the loop could be asked what they had checked."],
  ["Present", "Software ships faster than anyone checks it.", "Small teams, agencies shipping client sites, founders on no-code tools and AI coding agents all ship changes faster than any review process built for people. Whoever did the work is usually also the one saying it is done, and confidence is not the same as proof. Vraelis is one independent check on the live app: a sentence about what should work, a plan a person approves, and an answer with the evidence."],
  ["Next", "The check follows software onto what it controls.", "More software now runs hardware: drones, robots and fleets operated from web control panels. Vraelis checks those panels today, through the same real browser. Reading the device itself, its firmware, sensors and telemetry, is next and not built yet."],
];

const DECK = "Software used to be trusted because someone checked it before saying it was done. That step is disappearing. Vraelis puts it back, on the live app.";

/** Read time, counted the way the research articles count it (app/rank/research/_articles.ts readingMinutes). */
const MINUTES = Math.max(1, Math.round(ACTS.reduce((n, [, , body]) => n + body.split(/\s+/).filter(Boolean).length, 0) / 220));

export default function Readme() {
  return (
    <>
      <article className="v6-read" aria-labelledby="read-h1">
        <div className="v6-wrap">
          <div className="v6-read__grid">
            <header className="v6-read__head">
              <p className="v6-read__eyebrow">README</p>
              <p className="v6-read__meta"><span>{`${MINUTES} min read`}</span></p>
              <h1 id="read-h1" className="v6-read__h1">Why Vraelis exists</h1>
              <p className="v6-read__deck">{DECK}</p>
            </header>

            <div className="v6-read__body">
              <Prose>
                {ACTS.map(([act, head, body]) => (
                  <Fragment key={act}>
                    <p className="v6-read__act">{act}</p>
                    <h2>{head}</h2>
                    <p>{body}</p>
                  </Fragment>
                ))}
              </Prose>
            </div>
          </div>
        </div>
      </article>

      <section className="v6-sec v6-read-end">
        <div className="v6-wrap">
          <div className="v6-read-end__in">
            <CrossLinks heading="Keep reading" links={[
              { title: "The Vraelis Method", body: "Eight positions that decide how the product is built", href: `${V6_BASE}/method` },
              { title: "About Vraelis", body: "Who it is for, the commitments it keeps, and how to reach a person", href: `${V6_BASE}/company` },
            ]} />
            <aside className="v6-read__step" aria-labelledby="rm-step-h">
              <div>
                <h2 id="rm-step-h" className="v6-read__steph">Check one claim on your own app</h2>
                <p>{SUPPORT}</p>
              </div>
              {/* A ghost: the closing's white button is in the same screen, and a view carries one white button. */}
              <div className="v6-actions"><CTA ghost href={SIGNUP}>Start free</CTA></div>
            </aside>
          </div>
        </div>
      </section>

      <ClosingScene title="Read what is built today" action={{ label: "What is built", href: `${V6_BASE}/platform#current` }} />
    </>
  );
}
