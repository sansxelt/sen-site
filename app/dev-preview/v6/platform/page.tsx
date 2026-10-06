import { RecordedEntry } from "../_system/recorded-entry";
import localFont from "next/font/local";
import { photographHero } from "../_content/photography";
import { v6meta } from "../_system/meta";
import { SectionHead, EditorialLink } from "../_system/ui";
import { FrameHero, Compare, Band, CrossLinks, Tabs, type CompareRow, type CrossLink } from "../_system/kit";
import { ClosingScene } from "../_system/close";
import { StrikeStory } from "../_system/strike-story";
import { STRIKE, STRIKE_CHAPTERS, STRIKE_CAPTION } from "../_content/strike";
import { LIVE, DIRECTION } from "../_content/scope";
import { SURFACES, COVERAGE_RULE, type CoverageTier } from "../_content/coverage";
import { sectorBySlug } from "../_content/sectors";
import { V6_BASE } from "@/lib/v6-routes";
import "../_system/coverage.css";
import "../_system/product.css";

export const metadata = v6meta({
  title: "Platform",
  description: "Verify software behind defense, infrastructure and robotics systems. Live control-panel execution and local recorded task-evidence review.",
  path: "/platform",
  ogTitle: "Physical-system software verification | Vraelis",
  ogDescription: "An approved requirement. An observed result. Evidence you can inspect.",
});

const platformFont = localFont({ src: "../../../fonts/manrope/Manrope-Variable.ttf", display: "swap", variable: "--font-platform", weight: "200 800" });
const BASE = V6_BASE;
const two = (n: number) => String(n).padStart(2, "0");

const WORKFLOW = [
  { title: "Define the requirement", body: "Name the expected result and any reported state that must stay unchanged. Start with an unclassified simulation or staging build.", href: `${BASE}/docs/getting-started`, link: "Write a requirement" },
  { title: "Review the exact plan", body: "Inspect the proposed requirements and browser journeys. A person approves them before execution; an API key cannot.", href: `${BASE}/docs/review`, link: "Review and approval" },
  { title: "Observe the running app", body: "A real browser exercises the approved steps on the address you name. The record keeps what each step expected and observed.", href: `${BASE}/docs/run-activity`, link: "Run activity" },
  { title: "Inspect the failure and re-check", body: "Read the available screenshots and browser errors. After a repair, re-run the approved plan within its limits and keep both records.", href: `${BASE}/docs/recheck`, link: "Re-check a repair" },
];

// Explain the scope of evidence. Do not imply that other test frameworks cannot exercise real deployments.
const EVIDENCE_COLUMNS = ["Required behavior", "Available evidence", "What that does not prove"];
const EVIDENCE_ROWS: CompareRow[] = [
  { label: "Task completion", cells: ["The correct asset reports completion within the reviewed window", "Task identity, reported states and declared coverage in the supplied recording", "That the physical task happened or the device report is authentic"] },
  { label: "State change", cells: ["The approved action changes the intended reported state", "The values and controls visible in the browser", "That a physical device received or executed the command"] },
  { label: "Persistence", cells: ["The required state remains after a reload or new session", "The result of the reload or sign-in steps in the plan", "Durability beyond the conditions and period exercised"] },
  { label: "Permissions", cells: ["The supplied test role can or cannot reach a workflow", "The pages and actions exercised with that test identity", "Every permission or role that was not exercised"] },
];

const TIER_WORD: Record<CoverageTier, string> = { Live: "Live", Next: "Not built yet", "Not covered": "Not covered" };
const TIER_KEY: Record<CoverageTier, string> = { Live: "live", Next: "next", "Not covered": "out" };
const card = (slug: "defense" | "fleets"): CrossLink => {
  const s = sectorBySlug(slug)!;
  return { title: s.label, body: s.line, href: s.href, image: s.pics.card1610 };
};

export default function Platform() {
  return (
    <div className={`${platformFont.variable} v6-platform`}>
      <FrameHero
        eyebrow="The platform"
        title="Find where control software and device reports disagree"
        sub="For defense, infrastructure and robotics teams. Compare supplied task reports or exercise an approved simulation panel. Inspect what happened and what the evidence cannot establish."
        primary={{ label: "Try recorded evidence", href: "/verifications/recorded" }}
        secondary={{ label: "Watch the browser demo", href: "#how-a-check-works" }}
        {...photographHero("robotCell")}
      />

      <RecordedEntry />
      <StrikeStory record={STRIKE} chapters={STRIKE_CHAPTERS} caption={STRIKE_CAPTION} />

      <section className="v6-sec v6-pp-sec" id="how">
        <div className="v6-wrap v6-pp-workflow">
          <div>
            <SectionHead eyebrow="Browser workflow" title="Exercise the operator’s test panel" lead="This separate hosted workflow runs from the console, CLI, CI or an AI assistant. It observes the browser, without connecting to the device." />
          </div>
          <ol className="v6-pp-flow" role="list">
            {WORKFLOW.map((step, i) => (
              <li key={step.title}>
                <span className="v6-pp-flow__n" aria-hidden>{two(i + 1)}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <EditorialLink href={step.href}>{step.link}</EditorialLink>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="v6-sec v6-pp-sec" id="evidence-scope">
        <div className="v6-wrap">
          <SectionHead eyebrow="Evidence and scope" title="Know what the record proves" lead="A reported state and a physical outcome are different evidence. Every check has a boundary." />
          <Compare columns={EVIDENCE_COLUMNS} rows={EVIDENCE_ROWS} caption="Evidence and limits for the behavior exercised by an approved plan." />
        </div>
      </section>

      {/* #coverage: one row per surface. The brief is on the row; how it is reached and what is true today
          open under it. The tier is a word: Live, Not built yet, Not covered. */}
      <Band id="coverage">
        <SectionHead eyebrow="What it can reach" title="What the check can reach" />
        <ul className="v6-reach" role="list">
          {SURFACES.map((s) => (
            <li className="v6-reach__row" key={s.name}>
              <details className="v6-reach__d">
                <summary className="v6-reach__sum">
                  <span className="v6-reach__name">{s.name}</span>
                  <span className="v6-reach__brief">{s.brief}</span>
                  <span className="v6-reach__end">
                    <span className="v6-tw" data-tier={TIER_KEY[s.tier]}>{TIER_WORD[s.tier]}</span>
                    <span className="v6-pp-x" aria-hidden />
                  </span>
                </summary>
                <div className="v6-reach__more">
                  <div>
                    <p>{s.reach}</p>
                    <p>{s.today}</p>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
        <p className="v6-reach__rule">{COVERAGE_RULE}</p>
      </Band>

      {/* #current: THE SITE'S ONE STATUS SOURCE. Every line is _content/scope.ts; nothing here is retyped. */}
      <section className="v6-sec v6-pp-sec" id="current">
        <div className="v6-wrap">
          <SectionHead eyebrow="What is built" title="What Vraelis does today, and what it does not" />
          {/* Two lists, one tab each (kit Tabs): side by side, the two full lists put 264 words in one 900px
              screen (A1.6 allows 180). The tab labels say both halves at once; each panel is a fixed height,
              so switching moves nothing below it. */}
          <Tabs
            label="What is built"
            height={464}
            tabs={[
              {
                id: "live-today",
                label: "Live today",
                content: (
                  <ol className="v6-pp-now__list" role="list">
                    {LIVE.map((t, i) => (
                      <li className="v6-pp-now__item" key={t}>
                        <span className="v6-pp-now__n" aria-hidden data-no-translate>{two(i + 1)}</span>
                        <p className="v6-pp-now__t">{t}</p>
                      </li>
                    ))}
                  </ol>
                ),
              },
              {
                id: "not-built-yet",
                label: "Not built yet",
                content: (
                  <>
                    <ol className="v6-pp-now__list" role="list">
                      {DIRECTION.map(([t, now], i) => (
                        <li className="v6-pp-now__item" key={t}>
                          <span className="v6-pp-now__n" aria-hidden data-no-translate>{two(i + 1)}</span>
                          <details className="v6-pp-now__d">
                            <summary className="v6-pp-now__sum"><span>{t}</span><span className="v6-pp-x" aria-hidden /></summary>
                            <p className="v6-pp-now__today">{now}</p>
                          </details>
                        </li>
                      ))}
                    </ol>
                    {/* The standing rule for both lists, under the one a line moves out of. */}
                    <p className="v6-pp-now__rule">A line moves to Live today when it works in the product, never because it is nearly done.</p>
                  </>
                ),
              },
            ]}
          />
          <div className="v6-pp-limit">
            <p className="v6-pp-limit__t">Where every check stops, and what Vraelis does not do, is on one page.</p>
            <EditorialLink href={`${BASE}/limitations`}>Read the limitations</EditorialLink>
          </div>
        </div>
      </section>


      <section className="v6-sec v6-pp-sec v6-pp-xl">
        <div className="v6-wrap">
          <CrossLinks links={[card("defense"), card("fleets"), { title: "Security", body: "Data handling, access and execution boundaries.", href: `${BASE}/security`, image: "/site/photography/firmware.jpg" }]} />
        </div>
      </section>
      <ClosingScene title="Verify the behavior you require" />
    </div>
  );
}
