import { photographHero } from "../_content/photography";
import type { Metadata } from "next";
import { v6meta } from "../_system/meta";
import { SectionHead, EditorialLink } from "../_system/ui";
import { FrameHero, AltRows, Compare, Band, CrossLinks, Tabs, type AltRow, type CompareRow, type CrossLink } from "../_system/kit";
import { ClosingScene } from "../_system/close";
import { RecordPanel } from "../_system/record-panel";
import { Photograph, PicturePlate } from "../_system/picture-plate";
import { RECORDS } from "../_content/use-cases";
import { LIVE, DIRECTION } from "../_content/scope";
import { SURFACES, COVERAGE_RULE, type CoverageTier } from "../_content/coverage";
import { sectorBySlug } from "../_content/sectors";
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import "../_system/coverage.css";
import "../_system/product.css";

// THE PLATFORM PAGE (site plan A9 T1 and C /platform, revision 2, 2026-10-02). The mechanism page: what a check
// is, shown with the product itself rather than described. In order:
//   1. FrameHero, the scene kind (our render of a drone over the garage floor), the page's one approval claim;
//   2. #runs      the four recorded demo runs, replayed from their records (RunWindow, a product panel);
//   3. #how       four rows, each with a capture of the black console (public/site/product/platform-*.png,
//                 captured read only on 2026-10-02; public/site/product/CREDITS.md);
//   4. Compare    with categories of tools, never named products, words only;
//   5. #coverage  the Band: the seven SURFACES rows from _content/coverage.ts, tier as a word;
//   6. #current   the site's one status source: LIVE and DIRECTION from _content/scope.ts, one tab each
//                 (side by side they broke the word budget), then the one line that links /limitations;
//   7. CrossLinks to three sectors (the registry, _content/sectors.ts), and the closing.
// No FactRow (plan T1 and A1.7: on a product page it would not quote a record) and no DoesBox (A1.7).
// Sections on the same black ground do not stack two paddings (v6.css's own rule for two sunk or two dark
// sections, applied here by product.css: .v6-pp-sec + .v6-pp-sec). The approval claim is said once, in the
// hero; elsewhere it appears only as a step, a table cell or inside a product panel (plan 0.3). Every number
// on the page is a permitted fact (plan A8.3) or a record's own.

export const metadata: Metadata = v6meta({
  title: "Platform",
  description:
    "How Vraelis checks a deployed web app, or a connected device through its web control panel: one sentence about what should work, one plan a person approves, one real browser run on the live app, and one decision with the evidence.",
  path: "/platform",
  ogTitle: "The Vraelis platform",
  ogDescription: "One sentence, one approved plan, one real run on the live app, and everything it saw.",
});

const BASE = V6_BASE;
const SIGNUP = `${v6SignInPath()}&mode=signup`;
const two = (n: number) => String(n).padStart(2, "0");

/* ── #how: the four rows, each with a capture of the console (read only, nothing created or approved) ── */


const ROWS: AltRow[] = [
  {
    id: "write",
    title: "Write the sentence",
    body: "Say what a person should be able to do on your web app, or on a device's web control panel, and what should be true afterwards. Vraelis does not read your code. It starts from the sentence and checks the running app.",
    link: { label: "Write your first check", href: `${BASE}/docs/getting-started` },
    media: <Photograph name="signup" />,
  },
  {
    id: "approve",
    title: "Approve the plan",
    body: "Vraelis turns the sentence into requirements and the browser journeys that would prove them. A person approves that exact plan before anything runs; an API key cannot. If no check could prove the sentence, nothing runs and nothing is charged.",
    link: { label: "How approval works", href: `${BASE}/docs/review` },
    media: <Photograph name="client" />,
  },
  {
    id: "run",
    title: "Run it on the live product",
    body: "A real browser runs the approved journeys on the address you named, one step at a time. An address that does not exist is refused before the run starts. Each step records what it expected and what it saw.",
    link: { label: "How a run is recorded", href: `${BASE}/docs/run-activity` },
    media: <PicturePlate src={RECORDS.notes.runs[0].shot.src} alt={RECORDS.notes.runs[0].shot.alt} w={480} h={480} evidence caption={RECORDS.notes.runs[0].shot.caption} credit={<span data-no-translate>4fc6e52c / 2026-07-31 UTC</span>} />,
  },
  {
    id: "evidence",
    title: "Read the evidence and the repair prompt",
    body: "The record keeps every step, the screenshots the run saved, and any console errors and failed requests. When it finds a problem, it writes a repair prompt for a person or a coding agent. After the fix, the same approved plan runs again as its own record.",
    link: { label: "How a re-check works", href: `${BASE}/docs/recheck` },
    media: <PicturePlate src={RECORDS.projects.runs[0].shot.src} alt={RECORDS.projects.runs[0].shot.alt} w={640} h={354} evidence caption={RECORDS.projects.runs[0].shot.caption} credit={<span data-no-translate>de53ab8b / 2026-07-14 UTC</span>} />,
  },
];

/* ── Compare: categories of tools, never named products; words only (plan C /platform, kit Compare) ── */
const COMPARE_COLUMNS = ["Vraelis", "Scripted end-to-end tests", "Manual QA", "Uptime checks"];
const COMPARE_ROWS: CompareRow[] = [
  { label: "What you write", cells: ["One sentence about the outcome", "A test script, and its upkeep", "A test plan or checklist", "A URL and a status to expect"] },
  { label: "Who approves what runs", cells: ["A person approves the plan before it runs", "Whoever merges the test", "The tester", "Nobody; it runs on a schedule"] },
  { label: "Where it runs", cells: ["The live deployment you name", "Usually a test environment", "Wherever the tester is", "The live deployment"] },
  { label: "What comes back", cells: ["Every step, a screenshot, expected against observed", "Pass or fail, and logs", "Notes and screenshots", "Up or down, and response time"] },
  { label: "After a fix", cells: ["The same approved plan runs again", "Re-run the suite", "Test it again by hand", "Not applicable"] },
  { label: "For a coding agent", cells: ["A repair prompt over MCP or the CLI", "A failing test to read", "A message", "An alert"] },
];

/* ── #coverage: the tier as a word. Next reads "Not built yet" (plan 0.2); the tiers themselves are coverage.ts's ── */
const TIER_WORD: Record<CoverageTier, string> = { Live: "Live", Next: "Not built yet", "Not covered": "Not covered" };
const TIER_KEY: Record<CoverageTier, string> = { Live: "live", Next: "next", "Not covered": "out" };

/* ── CrossLinks: three sectors, read from the registry (never hand-listed) ── */
const card = (slug: "defense" | "fleets" | "ai-built-apps"): CrossLink => {
  const s = sectorBySlug(slug)!;
  return { title: s.label, body: s.line, href: s.href, image: s.pics.card1610 };
};

export default function Platform() {
  return (
    <>
      <FrameHero
        eyebrow="Platform"
        title="One sentence. One approved plan. One answer from the live app."
        sub="Write what your web app, or a device it controls, should do. A person approves the plan, and a real browser tries it on the live product."
        primary={{ label: "Start free", href: SIGNUP }}
        secondary={{ label: "See real runs", href: "#runs" }}
        {...photographHero("client")}
      />

      {/* #runs: the four recorded demo runs, replayed at their recorded pace. RunWindow is a product panel
          (data-panel), so its words do not count against the page's budget. */}
      <section className="v6-sec v6-pp-sec" id="runs">
        <div className="v6-wrap">
          <SectionHead eyebrow="Recorded runs" title="Real checks. Recorded evidence." />
          <RecordPanel records={["checkout", "notes", "projects"]} />
        </div>
      </section>

      <section className="v6-sec v6-pp-sec v6-pp-how" id="how">
        <div className="v6-wrap">
          <SectionHead
            eyebrow="How it works"
            title="From one sentence to an answer with evidence."
            lead="It works the same from the console, the CLI, CI and AI assistants."
          />
          <AltRows rows={ROWS} />
        </div>
      </section>

      <section className="v6-sec v6-pp-sec" id="compare">
        <div className="v6-wrap">
          <SectionHead eyebrow="Other ways to check" title="How it compares." />
          <Compare columns={COMPARE_COLUMNS} rows={COMPARE_ROWS} />
        </div>
      </section>

      {/* #coverage: one row per surface. The brief is on the row; how it is reached and what is true today
          open under it. The tier is a word: Live, Not built yet, Not covered. */}
      <Band id="coverage">
        <SectionHead eyebrow="What it can reach" title="Web apps, and the devices they control." />
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
          <SectionHead eyebrow="What is built" title="What Vraelis does today, and what it does not." />
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
          <CrossLinks links={[card("defense"), card("fleets"), card("ai-built-apps")]} />
        </div>
      </section>

      <ClosingScene title="Say what should work. Let the live app answer." />
    </>
  );
}
