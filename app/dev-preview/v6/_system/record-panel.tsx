// THE RECORD PANEL: ONE REAL RECORDED CHECK, IN TABS (plan A9 T2 step 4, S2; revision 2, 2026-10-02). Owner: b5b.
//
// ─── API (the sector pages wire this in; server-safe: import it from a server page) ─────────────────────────
//
//   import { RecordPanel } from "../../_system/record-panel";
//
//   <RecordPanel record="strike" />
//       Larkspur, run vrf_51705517. Tabs: The sentence, The plan, The run, The finding.             (defense)
//   <RecordPanel record="strike" views={["run", "finding"]} label="The Larkspur record" />
//       A compact Larkspur panel: any of its views, in the order given.                              (fleets)
//   <RecordPanel record="checkout" />
//       Lumen Notes, runs 3fad10f5 and 588c48f7. Tabs: Before the fix, After the fix, The steps.     (commerce)
//   <RecordPanel record="notes" />
//       Notewell, run 4fc6e52c. Tabs: Journey 1, Journey 2, The screen.                              (ai-built-apps)
//   <RecordPanel record="notes" views={["screen", "journey-2"]} />
//       Notewell's screen, then journey 2 (signed out, /dashboard sent the browser to sign in).      (public sector)
//   <RecordPanel record="projects" />
//       The fixture dashboard, run de53ab8b. Tabs: The journey, The run, The finding.                (saas)
//   <RecordPanel records={["checkout", "notes", "projects"]} />
//       One tab per demo app (Lumen Notes, Notewell, Project tracker): the sentence, each run's
//       outcome phrase, the first run's evidence crop, and a link to its use-case page.              (agencies)
//
// Props (exactly one of record and records):
//   record   RecordKey: "strike" | "checkout" | "notes" | "projects".
//   records  RecordKey[]: several records, one summary tab each, labelled with the app's name.
//   views    RecordView[]: which tabs, in this order (with `record` only). Default per record, as above. A view
//            the record cannot show is left out ("journey-2" on a one-journey run, "before" and "after" on a
//            one-run record, "prompt" on a run that found nothing).
//   height   passed to the kit's Tabs (default 520), which record-panel.css overrides at every width: from 900px
//            up the box is a visible frame (the panel ground, a hairline, radius 16, 28px inside) as tall as its
//            tallest view, so a short view sits inside one evidence window instead of over an empty band, and
//            switching tabs still moves nothing (final review, 2026-10-02). Below 900px the views stack into one
//            column, so the panel takes the open view's own height, as the kit's Tabs do on a phone. Measured for
//            every view of every panel above at 1920, 1440, 1100, 1024, 900, 768 and 390 on 2026-10-02.
//   label    the tab list's accessible name. Default "The <app> record" ("Three demo records" for `records`).
//   initial  the view (or, with `records`, the record key) open on load. Default the first.
//
// Views (tab labels in quotes):
//   "sentence"   "The sentence": the claim verbatim, the approval line where the record holds one, and Larkspur's
//                CLI command as a reference block, with the line on what Larkspur is under the sentence. "The
//                journey" where the record has no sentence (projects), with what the app is and the run's facts.
//   "plan"       "The plan": the requirements (Larkspur's record holds nine; the demo records hold none) and the
//                journeys with their planned step counts.
//   "run"        "The run": every journey of the first run, each step with its timing, the step that found the
//                problem marked "Found a problem"; the outcome, run id, date and duration beside it, and the
//                record's note on its other journeys (Larkspur's two that could not press Confirm target).
//   "journey-1", "journey-2"   "Journey 1", "Journey 2": one journey of the first run (Notewell).
//   "finding"    "The finding": expected and observed in the record's words, the evidence crop, and the first
//                eight lines of the repair prompt with Copy. On a run that found nothing: "The outcome".
//   "screen"     "The screen": the run's evidence crop (at most 640 wide) with its caption, the outcome and facts.
//   "before", "after"   "Before the fix", "After the fix": Lumen Notes' two runs, each with its outcome and facts,
//                what it found (or that the same eleven steps found nothing), and the same strip of the account
//                page.
//   "steps"      "The steps": the eleven planned steps as the run before the fix took them, and a line on the
//                run after the fix.
//   "prompt"     "The repair prompt": the whole prompt, with Copy.
// The CLI command and the repair prompt are reference blocks (Code, .v6-code): the prompt's own wording ("A check
// of ... failed") is product output, which plan 0.3 allows there and only there.
//
// Wrapping: <section className="v6-sec" id="record"><div className="v6-wrap"><SectionHead .../><RecordPanel .../>
// It carries data-panel on its outermost element (its record text does not count against the page's word
// budget), wires the Copy buttons once (CopyScript), and adds no margin of its own above.
//
// Data: _content/use-cases.ts (RECORDS), which reads _content/strike.ts and _content/demos.ts and builds the
// demo repair prompts with the product's builder, as _system/run-window.tsx does. For a FactRow beside it, read
// the same record: `import { RECORDS } from "../../_content/use-cases"`.
//
// ─── The pieces ──────────────────────────────────────────────────────────────────────────────────────────────
// The panel is built from the exported pieces below, which the use-case pages (use-cases/[slug]/page.tsx) also
// use in their read layout, so a record looks the same wherever it appears: RecordClaim, RecordPlan, RunFacts,
// RunSteps, RunFinding, RunShot, RunPrompt, Outcome, and the picture's measures shotWidth and shotShape. None of
// them carries a margin of its own.
//
// Pictures: each evidence crop shows at its own size or smaller, never over 640. Its bar names the address the
// run checked, kept whole (the recorded date wraps under it when both do not fit); on a crop too narrow for the
// address (Larkspur's contact list, 250 wide) the bar names the app instead.
//
// Rules this keeps (plan 0.3, 0.4, 0.6): the record's own words (sentence, steps, expected, observed, prompt) are
// data-no-translate and never retyped; outcomes read "Found a problem" or "Did what the sentence says", never a
// verdict word; colour appears only on the step and the observation that found the problem; evidence crops are
// shown at most 640 wide and never larger than their own pixels; no dots.
import type { ReactNode } from "react";
import { MediaPanel, RecordSteps, Tabs, type TabItem } from "./kit";
import { EditorialLink, Signal } from "./ui";
import { Code, CopyScript } from "./code";
import {
  FOUND, HELD, RECORDS, allSteps, secondsText,
  type CheckRecord, type CheckRun, type RecordKey,
} from "../_content/use-cases";
import "./record-panel.css";

export type { RecordKey } from "../_content/use-cases";

/** One tab of a record panel. See the API above. */
export type RecordView =
  | "sentence" | "plan" | "run" | "journey-1" | "journey-2" | "finding" | "screen" | "before" | "after" | "steps" | "prompt";

/** The tabs each record opens with when `views` is not given. */
export const DEFAULT_VIEWS: Record<RecordKey, RecordView[]> = {
  strike: ["sentence", "plan", "run", "finding"],
  checkout: ["before", "after", "steps"],
  notes: ["journey-1", "journey-2", "screen"],
  projects: ["sentence", "run", "finding"],
};

/* ───────────────────────────────────────────────────────────────────────────────────────── pieces ── */

/** The outcome phrase as a state word: "Found a problem" in the stop colour, "Did what the sentence says" plain. */
export function Outcome({ run }: { run: CheckRun }) {
  return run.found ? <Signal state="stop">{FOUND}</Signal> : <Signal state="go">{HELD}</Signal>;
}

/** Run, recorded date and duration as a row of mono facts, labelled as the use-case head labels them (values
 *  never translated). `outcome` adds the outcome phrase above them. */
export function RunFacts({ run, outcome = false }: { run: CheckRun; outcome?: boolean }) {
  return (
    <dl className="v6-rp__facts" data-panel="">
      {outcome ? <div><dt>Outcome</dt><dd className="v6-rp__out"><Outcome run={run} /></dd></div> : null}
      <div><dt>Run ID</dt><dd data-no-translate>{run.id}</dd></div>
      <div><dt>Recorded</dt><dd data-no-translate>{run.recorded}</dd></div>
      <div><dt>Duration</dt><dd data-no-translate>{secondsText(run.seconds)}</dd></div>
    </dl>
  );
}

/** The sentence card: the claim verbatim (or the journey's recorded name where the record has none) and the
 *  approval line where the record holds one. `large` is the use-case page's 22px setting. */
export function RecordClaim({ record, large = false }: { record: CheckRecord; large?: boolean }) {
  return (
    <figure className="v6-rp__claim" data-large={large ? "" : undefined} data-panel="">
      {record.claim ? (
        <blockquote className="v6-rp__q" data-no-translate>{record.claim}</blockquote>
      ) : (
        <>
          <figcaption className="v6-rp__k">The record has no sentence, so this is the journey's recorded name.</figcaption>
          <blockquote className="v6-rp__q" data-no-translate>{record.journeyName}</blockquote>
        </>
      )}
      {record.approved ? <p className="v6-rp__approved">{record.approved}</p> : null}
    </figure>
  );
}

/** The plan: numbered requirements where the record holds them, then the journeys with their planned steps.
 *  Side by side in a panel; `stacked` puts the journeys under the requirements (the use-case page's column). */
export function RecordPlan({ record, headingLevel = 3, stacked = false }: { record: CheckRecord; headingLevel?: 3 | 4; stacked?: boolean }) {
  const H = headingLevel === 4 ? "h4" : "h3";
  const p = record.plan;
  return (
    <div className="v6-rp__plan" data-req={p.requirements.length && !stacked ? "" : undefined} data-panel="">
      {p.requirements.length ? (
        <div className="v6-rp__col">
          <H className="v6-rp__h">Requirements</H>
          <ol className="v6-rp__reqs" role="list" data-no-translate>
            {p.requirements.map((q, i) => (
              <li key={q}><span className="v6-rp__num" aria-hidden>{String(i + 1).padStart(2, "0")}</span><span>{q}</span></li>
            ))}
          </ol>
        </div>
      ) : null}
      <div className="v6-rp__col">
        <H className="v6-rp__h">Journeys</H>
        <p className="v6-rp__k">Each journey with its planned steps.</p>
        <ul className="v6-rp__journeys" role="list">
          {p.journeys.map((j) => (
            <li key={j.name}><span data-no-translate>{j.name}</span><span className="v6-rp__num" data-no-translate>{j.steps}</span></li>
          ))}
        </ul>
        {p.id ? <p className="v6-rp__id"><span>Plan</span> <span data-no-translate>{p.id}</span></p> : null}
      </div>
    </div>
  );
}

/** One run's steps as recorded, journey by journey (kit RecordSteps). `journey` picks one journey (0-based);
 *  `split` lays a long journey out in two columns from 900px up, so fifteen steps fit the panel's height;
 *  `notes` prints each journey's note under its steps (the use-case page; the panel shows them beside), or
 *  only the notes it returns true for (the use-case page leaves out a note its takeaway already says). */
export function RunSteps({ run, journey, split = false, names = true, notes = false }: {
  run: CheckRun; journey?: number; split?: boolean; names?: boolean; notes?: boolean | ((note: string) => boolean);
}) {
  const list = journey === undefined ? run.journeys : [run.journeys[journey]].filter(Boolean);
  const showNote = (n?: string) => !!n && (typeof notes === "function" ? notes(n) : notes);
  return (
    <div className="v6-rp__runs">
      {list.map((j) => {
        const half = Math.ceil(j.steps.length / 2);
        return (
          <div className="v6-rp__journey" key={j.name}>
            {names ? <p className="v6-rp__jname" data-no-translate>{j.name}</p> : null}
            {split && j.steps.length > 8 ? (
              <div className="v6-rp__halves">
                <RecordSteps steps={j.steps.slice(0, half)} />
                <RecordSteps steps={j.steps.slice(half)} start={half + 1} />
              </div>
            ) : (
              <RecordSteps steps={j.steps} />
            )}
            {showNote(j.note) ? <p className="v6-rp__note v6-rp__jnote">{j.note}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

/** What the run found: where, what was expected and what was observed, in the record's words. `more` adds the
 *  record's note on anything else it holds (Larkspur's two further journeys). */
export function RunFinding({ run, more = true }: { run: CheckRun; more?: boolean }) {
  const f = run.failure;
  if (!f) return null;
  return (
    <div className="v6-rp__finding" data-panel="">
      <p className="v6-rp__at">{f.at}</p>
      <dl className="v6-rp__eo">
        <div><dt>Expected</dt><dd data-no-translate>{f.expected}</dd></div>
        <div><dt>Observed</dt><dd data-no-translate data-tone="stop">{f.observed}</dd></div>
      </dl>
      {more && f.more ? <p className="v6-rp__note">{f.more}</p> : null}
    </div>
  );
}

/** The width, in CSS px, a run's evidence crop is shown at: never wider than 640 or than its own pixels, and,
 *  with `maxH`, never taller than that (a panel's fixed box), by narrowing it. */
export function shotWidth(run: CheckRun, maxH?: number): number {
  const s = run.shot;
  const w = typeof s.src === "string" ? s.w ?? 640 : s.src.width;
  const h = typeof s.src === "string" ? s.h ?? 400 : s.src.height;
  return Math.round(Math.min(640, w, maxH ? (maxH * w) / h : Infinity));
}

/** "narrow" for a crop shown 340px wide or less with its shell (Larkspur's contact list, 250 wide), which sits
 *  beside its text; "wide" for a page strip or a page, which sits under it. Layouts read it as data-shape. */
export function shotShape(run: CheckRun, maxH?: number): "narrow" | "wide" {
  return shotWidth(run, maxH) + 18 <= 340 ? "narrow" : "wide";
}

/** The run's evidence crop in a MediaPanel: the address checked on the left of the bar, the recorded date on
 *  the right, the caption under it. Never wider than 640 or than its own pixels; `maxH` also keeps the picture
 *  under that height (a panel's fixed box), by narrowing it. A narrow crop's bar names the app instead of the
 *  address, which would be cut to a few letters there; the address stays in the record's first step. */
export function RunShot({ record, run, eager = false, maxH }: { record: CheckRecord; run: CheckRun; eager?: boolean; maxH?: number }) {
  const s = run.shot;
  const shown = shotWidth(run, maxH);
  const narrow = shotShape(run, maxH) === "narrow";
  return (
    <div className="v6-rp__shot" style={{ ["--shot-w" as string]: `${shown + 18}px` }}>
      <MediaPanel
        src={s.src} alt={s.alt} w={s.w} h={s.h} evidence eager={eager}
        sizes={`(max-width: 700px) 100vw, ${shown}px`}
        bar={{ left: narrow ? record.name : record.address, right: <>Recorded <span data-no-translate>{run.recorded}</span></> }}
        caption={s.caption}
      />
    </div>
  );
}

/** The repair prompt as a reference block with Copy (Code). `lines` shows only the first lines, as the sector
 *  panels do (a blank line left at the end is dropped); Copy copies what is shown. Needs <CopyScript /> once on
 *  the page (RecordPanel renders it). */
export function RunPrompt({ run, lines }: { run: CheckRun; lines?: number }) {
  if (!run.prompt) return null;
  const text = lines ? run.prompt.split("\n").slice(0, lines).join("\n").trimEnd() : run.prompt;
  return <div className="v6-rp__prompt"><Code lang="Repair prompt" src={text} /></div>;
}

/* ─────────────────────────────────────────────────────────────────────────────────────────── views ── */

function SentenceView({ r }: { r: CheckRecord }) {
  return (
    <div className="v6-rp__view v6-rp__split" data-sentence="">
      <div className="v6-rp__main v6-rp__claimset">
        <RecordClaim record={r} />
        {/* Where the record names its command (Larkspur), the app is named under the sentence: the side holds
            the command. Larkspur is always said to be a simulated console Vraelis built (rules). */}
        {r.cli ? <p className="v6-rp__note">{r.about}</p> : null}
      </div>
      {r.cli ? (
        <div className="v6-rp__side v6-rp__cli">
          <p className="v6-rp__k">The command that started the check</p>
          <Code lang="bash" src={r.cli} />
        </div>
      ) : (
        <div className="v6-rp__side">
          <p className="v6-rp__k">The app</p>
          <p className="v6-rp__note">{r.about}</p>
          <RunFacts run={r.runs[0]} outcome />
        </div>
      )}
    </div>
  );
}

function PlanView({ r }: { r: CheckRecord }) {
  return <div className="v6-rp__view"><RecordPlan record={r} /></div>;
}

function RunView({ r, journey }: { r: CheckRecord; journey?: number }) {
  const run = r.runs[0];
  const j = journey === undefined ? null : run.journeys[journey] ?? null;
  const steps = j ? j.steps : allSteps(run);
  const notes = j ? [j.note] : [run.failure?.more, ...(run.journeys.length === 1 ? [run.journeys[0].note] : [])];
  return (
    <div className="v6-rp__view v6-rp__split">
      <div className="v6-rp__main"><RunSteps run={run} journey={journey} split={steps.length > 8} /></div>
      <div className="v6-rp__side">
        <RunFacts run={run} outcome />
        {notes.filter(Boolean).map((n) => <p className="v6-rp__note" key={n}>{n}</p>)}
      </div>
    </div>
  );
}

/* The finding: what it found, the picture and the first lines of the prompt. The record's note on its other
   journeys is in "The run" beside the steps, so it is not repeated here (and the three fit the 520 box at every
   width from 900px; record-panel.css lays them out by the picture's shape). */
function FindingView({ r, run }: { r: CheckRecord; run: CheckRun }) {
  if (!run.failure) return <ScreenView r={r} run={run} />;
  return (
    <div className="v6-rp__view v6-rp__three" data-shape={shotShape(run, 380)}
      style={{ ["--shot-w" as string]: `${shotWidth(run, 380) + 18}px` }}>
      <div className="v6-rp__cell v6-rp__c-find"><RunFinding run={run} more={false} /></div>
      <div className="v6-rp__cell v6-rp__c-shot"><RunShot record={r} run={run} maxH={380} /></div>
      <div className="v6-rp__cell v6-rp__c-prompt">
        <RunPrompt run={run} lines={8} />
        <div className="v6-rp__more"><EditorialLink href={r.href}>Read the whole record</EditorialLink></div>
      </div>
    </div>
  );
}

/* One run and its screen: the outcome and the run's facts, then what it found (or the record's sentence on
   it), beside the picture. The tab names the run ("Before the fix"), so the view does not say it again. */
function ScreenView({ r, run }: { r: CheckRecord; run: CheckRun }) {
  return (
    <div className="v6-rp__view v6-rp__split" data-shot="">
      <div className="v6-rp__side v6-rp__first">
        <RunFacts run={run} outcome />
        {run.failure ? <RunFinding run={run} more={false} /> : <p className="v6-rp__note">{run.note ?? r.takeaway}</p>}
      </div>
      <div className="v6-rp__main"><RunShot record={r} run={run} maxH={380} /></div>
    </div>
  );
}

function StepsView({ r }: { r: CheckRecord }) {
  const before = r.runs[0];
  const after = r.runs[1];
  return (
    <div className="v6-rp__view v6-rp__split">
      <div className="v6-rp__main"><RunSteps run={before} split /></div>
      <div className="v6-rp__side">
        <p className="v6-rp__k">{before.label ?? "The run"}</p>
        <RunFacts run={before} outcome />
        {after ? (
          <>
            <p className="v6-rp__k v6-rp__gap">{after.label ?? "The next run"}</p>
            <RunFacts run={after} outcome />
            {after.note ? <p className="v6-rp__note">{after.note}</p> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function PromptView({ r }: { r: CheckRecord }) {
  return <div className="v6-rp__view"><RunPrompt run={r.runs.find((x) => x.prompt) ?? r.runs[0]} /></div>;
}

/** A record in one tab, for a set of records (agencies): the sentence, each run's outcome phrase, the evidence
 *  crop of the first run, and a link to its use-case page, where the rest of the record is. */
function SummaryView({ r }: { r: CheckRecord }) {
  const first = r.runs[0];
  return (
    <div className="v6-rp__view v6-rp__split" data-shot="">
      <div className="v6-rp__side v6-rp__first">
        <RecordClaim record={r} />
        <ul className="v6-rp__outs" role="list">
          {r.runs.map((run) => (
            <li key={run.id}>
              {run.label ? <span className="v6-rp__k">{run.label}</span> : null}
              <span className="v6-rp__big"><Outcome run={run} /></span>
              <span className="v6-rp__mono" data-no-translate>{run.id}</span>
              <span className="v6-rp__mono" data-no-translate>{run.recorded}</span>
              <span className="v6-rp__mono" data-no-translate>{secondsText(run.seconds)}</span>
            </li>
          ))}
        </ul>
        <div className="v6-rp__more"><EditorialLink href={r.href}>Read the record</EditorialLink></div>
      </div>
      <div className="v6-rp__main"><RunShot record={r} run={first} maxH={380} /></div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────────── the panel ── */

const VIEW_LABEL: Record<RecordView, (r: CheckRecord) => string> = {
  sentence: (r) => (r.claim ? "The sentence" : "The journey"),
  plan: () => "The plan",
  run: () => "The run",
  "journey-1": () => "Journey 1",
  "journey-2": () => "Journey 2",
  finding: (r) => (r.runs[0].failure ? "The finding" : "The outcome"),
  screen: () => "The screen",
  before: (r) => r.runs[0].label ?? "The first run",
  after: (r) => r.runs[1]?.label ?? "The next run",
  steps: () => "The steps",
  prompt: () => "The repair prompt",
};

const CAN_SHOW: Record<RecordView, (r: CheckRecord) => boolean> = {
  sentence: () => true,
  plan: () => true,
  run: () => true,
  "journey-1": (r) => r.runs[0].journeys.length > 0,
  "journey-2": (r) => r.runs[0].journeys.length > 1,
  finding: () => true,
  screen: () => true,
  before: (r) => r.runs.length > 1,
  after: (r) => r.runs.length > 1,
  steps: () => true,
  prompt: (r) => r.runs.some((x) => !!x.prompt),
};

function viewContent(view: RecordView, r: CheckRecord): ReactNode {
  switch (view) {
    case "sentence": return <SentenceView r={r} />;
    case "plan": return <PlanView r={r} />;
    case "run": return <RunView r={r} />;
    case "journey-1": return <RunView r={r} journey={0} />;
    case "journey-2": return <RunView r={r} journey={1} />;
    case "finding": return <FindingView r={r} run={r.runs[0]} />;
    case "screen": return <ScreenView r={r} run={r.runs[0]} />;
    case "before": return <ScreenView r={r} run={r.runs[0]} />;
    case "after": return <ScreenView r={r} run={r.runs[1]} />;
    case "steps": return <StepsView r={r} />;
    case "prompt": return <PromptView r={r} />;
  }
}

type PanelProps = { height?: number; label?: string; initial?: string } & (
  | { record: RecordKey; views?: RecordView[]; records?: never }
  | { records: RecordKey[]; record?: never; views?: never }
);

/**
 * One real recorded check in the kit's Tabs, one height for every tab (from 900px the frame takes its tallest
 * view's height) so switching tabs never moves the page. See the API at the top of this file.
 */
export function RecordPanel(props: PanelProps) {
  const { height = 520, initial } = props;
  let tabs: TabItem[];
  let label: string;
  if (props.records) {
    const rs = props.records.map((k) => RECORDS[k]);
    tabs = rs.map((r) => ({ id: r.key, label: r.tab, content: <SummaryView r={r} /> }));
    label = props.label ?? "Three demo records";
  } else {
    const r = RECORDS[props.record];
    const views = (props.views ?? DEFAULT_VIEWS[r.key]).filter((v) => CAN_SHOW[v](r));
    tabs = views.map((v) => ({ id: v, label: VIEW_LABEL[v](r), content: viewContent(v, r) }));
    label = props.label ?? `The ${r.name} record`;
  }
  return (
    <div className="v6-rp" data-panel="">
      <Tabs label={label} tabs={tabs} height={height} initial={initial} />
      <CopyScript />
    </div>
  );
}
