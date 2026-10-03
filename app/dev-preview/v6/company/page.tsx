import { photographHero } from "../_content/photography";
import type { ReactNode } from "react";
import Link from "next/link";
import { v6meta } from "../_system/meta";
import { FOOTER_STATEMENT } from "../_system/positioning";
import { SectionHead, CTA, EditorialLink } from "../_system/ui";
import { Band, FeatureCard, FeatureGrid, FrameHero } from "../_system/kit";
import { ClosingScene } from "../_system/close";
import { sectorBySlug } from "../_content/sectors";
import { V6_BASE } from "@/lib/v6-routes";
import "./company.css";

export const metadata = v6meta({
  title: "Company",
  description: `${FOOTER_STATEMENT} Who it is for, how it is different, the commitments it keeps, and how to reach a person.`,
  path: "/company",
  type: "website",
});

const BASE = V6_BASE;

// The defense sector page, from the sector registry (never a hand-written sector href).
const DEFENSE = sectorBySlug("defense")!;

// THE COMPANY PAGE (plan T4, revision 2, 2026-10-02). One idea per section: the frame and the line, the mission,
// three acts, who it is for, how it is different, the commitments, the two partnership records, and how to reach
// a person. What it deliberately does NOT carry any more:
//   - people. The founder is a solo founder; there is no team section, no photo and no bio until he supplies one.
//   - the live and direction lists. They were a second copy of /platform#current, imported from _content/scope.ts;
//     one link card points there instead, so the two surfaces can never disagree.
//   - the hero aside (CompanyAside). The partnership records have their own section further down.
// The approval claim (a person approves every plan) is made once on this page, in the commitments (plan 0.3).
// Every row of copy below is a whole sentence in one element, for the DOM translator.

// Three acts. The label is the act's place in time, the same three words the README uses (Past, Present, Next):
// the acts are a story, not coverage rows, so the present act is "Present", never the coverage word "Live". The
// third act's "Next" is also the coverage tier of what it names (_content/coverage.ts: reading the device itself
// is Next), so data-tier marks that one word as a tier rather than a claim.
const ACTS: { label: string; tier?: boolean; title: string; body: string }[] = [
  {
    label: "Past",
    title: "Builders owned the judgment",
    body: "People wrote, reviewed, tested and shipped their own work.",
  },
  {
    label: "Present",
    title: "The work outran the checking",
    body: "Teams and AI agents ship faster than anyone can review by hand. Vraelis checks the live app instead.",
  },
  {
    label: "Next",
    tier: true,
    title: "The check follows software onto what it controls",
    body: "Vraelis checks the web panels that run drones, robots and fleets today. Reading the device itself is not built yet.",
  },
];

// Who it is for, and who it is not for yet. Described by the SHAPE of the problem, never as a claim about who is
// already a customer. The "not for yet" half is the honest edge of the product, so both halves always render.
// One plain sentence an item (plan T4: two plain numbered lists): the two lists sit side by side in one screen.
const FOR: string[] = [
  "Developers, QA, product teams, agencies, founders and no-code builders who ship a web app.",
  "CI pipelines that gate a release, and AI assistants that check their own change.",
  "Teams that run drones, robots and fleets from a web control panel.",
];
const NOT_YET: string[] = [
  "Watching people or agents at work. A check runs only when someone asks for one.",
  "Writing or maintaining your tests. Vraelis checks the deployed result against one sentence.",
  "Native mobile and desktop apps, and reading a device's firmware, sensors and telemetry, are not built yet.",
];

// How this is different: against categories a reader already pays for, never against a named product, and each
// difference stated as a mechanism. "Uptime checks" names the category the old copy called monitoring (plan 0.3).
const DIFFERENT: [string, string][] = [
  ["It is not the builder's own report",
    "Whoever made the change, a person or an agent, does not decide whether it worked. Something else checks the deployed result."],
  ["It is not a test suite",
    "A suite is written beside the code and often runs against mocks. Vraelis holds one plain sentence outside the code and checks the running app."],
  ["It is not an uptime check",
    "An uptime check says the page answered. Vraelis checks that what the sentence describes actually happens on the live app."],
  ["It says no rather than guess",
    "When no check could prove the sentence, Vraelis says so before anything runs, and nothing is charged."],
];

// The commitments the product is held to. Row 04 is this page's one approval claim.
const COMMITMENTS: [string, string][] = [
  ["We ship what is real",
    "What is built and what is not are labelled separately, on the site and in the product. We would rather show an honest gap than imply a finished one."],
  ["The judge is independent of the builder",
    "Nothing is trusted because its author says so. Whether work is done is decided on evidence, by something other than the author."],
  ["History is kept",
    "Failures and fixes are kept, not overwritten. A later run never erases the one before it."],
  ["A person approves the check",
    "Whoever asks for a check, a teammate, a pipeline or an AI assistant, a person approves its plan before it runs. An API key cannot."],
];

// The two partnership records, as text lockups: no marks and no dates on a new surface (plan 0.2 and E6). The
// one line under each is the record's own overline.
const RECORDS: { name: string; line: string; href: string }[] = [
  { name: "Reddit", line: "Audience and advertising, through Reddit Ads.", href: `${BASE}/partnerships/reddit` },
  { name: "ByteDance", line: "AI models, from the company behind TikTok.", href: `${BASE}/partnerships/bytedance` },
];

// The three addresses that reach a person (lib/email.ts SUPPORT_INBOXES; Cloudflare routing confirmed
// 2026-10-02). /contact says what each one is for at more length and has the form.
const INBOXES: [string, string][] = [
  ["help@vraelis.com", "Support, and anything that does not fit elsewhere"],
  ["sales@vraelis.com", "Sales, enterprise and invoicing"],
  ["privacy@vraelis.com", "Privacy and data rights"],
];

const two = (n: number) => String(n).padStart(2, "0");

/** One of the two plain numbered lists under "Who it is for" (plan T4: two lists, not a DoesBox). */
function FitList({ title, items, after }: { title: string; items: string[]; after?: ReactNode }) {
  return (
    <div className="co-fit__col">
      <h3 className="co-fit__h" data-label="">{title}</h3>
      <ol className="co-fit__list" role="list">
        {items.map((t, i) => (
          <li className="co-fit__item" key={t}>
            <span className="co-fit__n" aria-hidden data-no-translate>{two(i + 1)}</span>
            <p className="co-fit__t">{t}</p>
          </li>
        ))}
      </ol>
      {after ? <div className="co-fit__after">{after}</div> : null}
    </div>
  );
}

export default function CompanyPage() {
  return (
    <>
      <FrameHero
        id="company-hero"
        eyebrow="Company"
        title="We check that what people build does what they meant"
        sub="Software ships faster than anyone can check by hand. Vraelis is the independent check on the live product, with the evidence attached."
        primary={{ label: "Talk to us", href: `${BASE}/contact` }}
        secondary={{ label: "Read the README", href: `${BASE}/readme` }}
        // Our own render (app/film/orbit, plan A7.5): the drone on its pad in the garage. Never the hand catch,
        // which is stock footage of someone else's drone.
        {...photographHero("drone")}
      />

      <section className="v6-sec co-mission" id="mission">
        <div className="v6-wrap">
          <SectionHead
            align="center"
            eyebrow="Mission"
            title="The builder can no longer be the only judge"
            lead="When a person or an agent says the work is done, something else should check it on the live app."
          />
          {/* Defense, said once on this page and lightly (founder update, 2026-10-02): one sector among several.
              The line rests only on what is true: Vraelis checks software and builds no weapons or mission
              software, and the judge is separate from the builder. No value judgment, no claim of defense work
              beyond the simulated console Vraelis built itself. Whole sentences in one element for the
              translator, then the link after them. The sector page carries the position in full. */}
          <div className="co-mission__more">
            <p className="co-mission__line">
              Defense is one of the sectors Vraelis checks software for. Vraelis builds no weapons or mission software, and the check stays separate from whoever built the system.
            </p>
            <EditorialLink href={DEFENSE.href}>How Vraelis works in defense</EditorialLink>
          </div>
        </div>
      </section>

      <section className="v6-sec" id="acts">
        <div className="v6-wrap">
          <SectionHead eyebrow="Three acts" title="Where the checking happens has moved" />
          <FeatureGrid span={4}>
            {ACTS.map((a) => (
              <FeatureCard
                key={a.title}
                label={a.tier ? <span data-tier="">{a.label}</span> : a.label}
                title={a.title}
                body={a.body}
              />
            ))}
          </FeatureGrid>
        </div>
      </section>

      <section className="v6-sec" id="who">
        <div className="v6-wrap">
          <SectionHead eyebrow="Who it is for" title="Anyone who can say what should work, on a live app" />
          {/* Each list ends on the page that holds its detail. Under "Built for", the one link card to what is built
              (plan C /company): the live and direction lists live on /platform#current only, never copied here.
              Under "Not for yet", the one line to /limitations every page without a DoesBox carries (plan A1.7). */}
          <div className="co-fit">
            <FitList
              title="Built for"
              items={FOR}
              after={(
                <FeatureCard
                  label="What is built"
                  title="What works today, and what is not built yet"
                  body="Each unfinished part says what happens today instead."
                  href={`${BASE}/platform#current`}
                />
              )}
            />
            <FitList
              title="Not for yet"
              items={NOT_YET}
              after={(
                <FeatureCard
                  label="Limitations"
                  title="What a check cannot do, written down"
                  body="Where a check stops today, stated before you rely on one."
                  href={`${BASE}/limitations`}
                />
              )}
            />
          </div>
        </div>
      </section>

      <section className="v6-sec" id="different">
        <div className="v6-wrap">
          <SectionHead eyebrow="How this is different" title="Four things it is not, and what it does instead" />
          <FeatureGrid span={6}>
            {DIFFERENT.map(([t, d], i) => <FeatureCard key={t} label={two(i + 1)} title={t} body={d} />)}
          </FeatureGrid>
          <div className="co-after">
            <EditorialLink href={`${BASE}/method#in-public`}>What happened in public</EditorialLink>
          </div>
        </div>
      </section>

      <section className="v6-sec" id="commitments">
        <div className="v6-wrap">
          <SectionHead eyebrow="How we build" title="The commitments the product is held to" />
          <ol className="v6-rows co-rows" role="list">
            {COMMITMENTS.map(([t, d], i) => (
              <li className="v6-row" key={t}>
                <span className="v6-row__n" aria-hidden data-no-translate>{two(i + 1)}</span>
                <div>
                  <h3 className="v6-row__t">{t}</h3>
                  <p className="v6-row__d">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Band id="partnerships">
        <SectionHead
          eyebrow="Partnerships"
          title="Partnerships, on the record"
          lead="Each record says what the partnership covers, and claims no endorsement."
        />
        <ul className="co-pr" role="list">
          {RECORDS.map((r) => (
            <li key={r.name}>
              <Link href={r.href} className="co-pr__card">
                <span className="co-pr__l">Partnership record</span>
                {/* The lockup is the two names, never translated; the × between them is not read aloud. */}
                <h3 className="co-pr__lock" data-no-translate>
                  Vraelis <span className="co-pr__x" aria-hidden>×</span> {r.name}
                </h3>
                <span className="co-pr__d">{r.line}</span>
                <span className="co-pr__go" aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      </Band>

      {/* /company#contact is linked from the docs footer (docs-ui.tsx) and the Resources menu: the id stays. */}
      <section className="v6-sec" id="contact">
        <div className="v6-wrap co-contact">
          <div className="co-contact__text">
            <SectionHead
              eyebrow="Contact"
              title="A person reads every message"
              lead="Use the contact form, or write to the address that fits your question."
            />
            <div className="v6-actions">
              <CTA ghost lg href={`${BASE}/contact`}>Open the contact form</CTA>
            </div>
          </div>
          <ul className="co-contact__list" role="list">
            {INBOXES.map(([addr, job]) => (
              <li key={addr}>
                <a href={`mailto:${addr}`} data-no-translate>{addr}</a>
                <span>{job}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ClosingScene />
    </>
  );
}
