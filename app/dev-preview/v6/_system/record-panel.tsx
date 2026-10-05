// Real recorded checks, presented as plain text beside genuine evidence.
// The sector pages use RecordPanel; use-case pages reuse the exported record pieces.
// The record's steps and observations stay verbatim. No product UI is recreated.
import Image from "next/image";
import { RecordSteps } from "./kit";
import { PicturePlate } from "./picture-plate";
import { EditorialLink, Signal } from "./ui";
import { Code } from "./code";
import {
  FOUND, HELD, RECORDS, secondsText,
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
          <figcaption className="v6-rp__k">The record has no sentence, so this is the journey&apos;s recorded name.</figcaption>
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
export function RunShot({ record, run, eager = false }: { record: CheckRecord; run: CheckRun; eager?: boolean; maxH?: number }) {
  const s = run.shot;
  return <PicturePlate src={s.src} alt={s.alt} w={s.w} h={s.h} evidence eager={eager}
    caption={s.caption} credit={<span className="v6-plate__metadata" data-no-translate><span>{record.name}</span>{" "}<span>{run.id}</span>{" "}<time>{run.recorded} UTC</time></span>} />;
}

/** The repair prompt as a reference block with Copy (Code). `lines` shows only the first lines, as the sector
 *  panels do (a blank line left at the end is dropped); Copy copies what is shown. Needs <CopyScript /> once on
 *  the page (RecordPanel renders it). */
export function RunPrompt({ run, lines }: { run: CheckRun; lines?: number }) {
  if (!run.prompt) return null;
  const text = lines ? run.prompt.split("\n").slice(0, lines).join("\n").trimEnd() : run.prompt;
  return <div className="v6-rp__prompt"><Code lang="Repair prompt" src={text} /></div>;
}

type PanelProps = { height?: number; label?: string; initial?: string; compact?: boolean; currentSimulation?: boolean } & (
  | { record: RecordKey; views?: RecordView[]; records?: never }
  | { records: RecordKey[]; record?: never; views?: never }
);

/** The record is an editorial explanation beside its actual evidence, never a replica of the app. */
export function RecordPanel(props: PanelProps) {
  const records = props.records ?? [props.record];
  return <div className="v6-evidence-list" aria-label={props.label}>
    {records.map((key) => {
      const r = RECORDS[key];
      return r.runs.map((run) => <article className="v6-evidence-record" key={run.id}>
        <div className="v6-evidence-record__text">
          <h3>{r.name}</h3>
          {run.label ? <p>{run.label}</p> : null}
          <p>{run.note ?? r.takeaway}</p>
          {props.compact ? <p className="v6-evidence-record__outcome"><Outcome run={run} /></p> : <RunFacts run={run} outcome />}
          <EditorialLink href={r.href}>Read the whole record</EditorialLink>
          {!props.compact ? (
          <details className="v6-evidence-record__details" data-panel="">
            <summary>The sentence, the steps and the finding</summary>
            <RecordClaim record={r} />
            <RunSteps run={run} />
            <RunFinding run={run} />
          </details>
          ) : null}
        </div>
        {props.currentSimulation && key === "strike" ? (
          <figure className="v6-evidence-current">
            <Image src="/site/hero/larkspur-current-console.png" width={1440} height={936}
              sizes="(max-width: 900px) 100vw, 48vw"
              alt="Current Larkspur simulation in black and white: the 3D terrain and contact list show T-1 and civilian bus T-3 cleared after confirming T-1." />
            <figcaption>Current Larkspur simulation, captured October 4, 2026. Original run screenshots are in the linked record.</figcaption>
          </figure>
        ) : <RunShot record={r} run={run} />}
        {props.compact ? (
          <details className="v6-evidence-record__details v6-evidence-record__full" data-panel="">
            <summary>View recorded steps and findings</summary>
            <RunFacts run={run} outcome />
            <RecordClaim record={r} />
            <RunSteps run={run} />
            <RunFinding run={run} />
          </details>
        ) : null}
      </article>);
    })}
  </div>;
}
