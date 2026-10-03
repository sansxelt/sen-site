import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { v6meta } from "../../_system/meta";
import { CrossLinks, type CrossLink } from "../../_system/kit";
import { ClosingScene } from "../../_system/close";
import { Code, CopyScript } from "../../_system/code";
import {
  Outcome, RecordClaim, RecordPlan, RunFacts, RunFinding, RunPrompt, RunShot, RunSteps, shotShape, shotWidth,
} from "../../_system/record-panel";
import { RECORDS, USE_CASES, useCaseBySlug, secondsText, type UseCase } from "../../_content/use-cases";
import { sectorBySlug } from "../../_content/sectors";
import { V6_BASE } from "@/lib/v6-routes";
import { robotsMeta } from "@/lib/stealth";

/* A USE CASE: ONE REAL RECORDED CHECK, READ FROM TOP TO BOTTOM (plan A9 T3, S1; revision 2, 2026-10-02).
 *
 * The page renders a record and writes nothing a record does not hold. The sentence, the plan, every step with
 * its timing, what was expected and observed, the screenshot and the repair prompt all come from
 * _content/use-cases.ts, which reads _content/strike.ts and _content/demos.ts; the record pieces are the same
 * ones the sector pages' record panels use (_system/record-panel.tsx), so a record looks the same everywhere.
 *
 * Layout: a reading column (680), the head first (breadcrumb, h1 at the read size, the outcome line, a mono
 * meta row), then one section per part of the record, each under an h2 at the h3 size, then related sectors
 * and the closing. Record text sits in data-panel elements: it is the record, not page copy, so the word
 * budget skips it and the translator leaves it as the run recorded it.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const uc = useCaseBySlug(slug);
  // An unresolved slug must not invite indexing (see research/[slug]): Next answers 200 for a streamed notFound.
  if (!uc) return { title: "Not found", robots: robotsMeta(false) };
  return v6meta({ title: uc.metaTitle, description: uc.description, path: `/use-cases/${uc.slug}` });
}

/* Related pages: the sectors that cite this record, from the registry, with their 16:10 card pictures (two or
   three; Larkspur is cited by defense and fleets only). */
function related(uc: UseCase): CrossLink[] {
  return uc.sectors.slice(0, 3).map((slug) => {
    const s = sectorBySlug(slug)!;
    return { title: s.label, body: s.line, href: s.href, image: s.pics.card1610 };
  });
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const uc = useCaseBySlug(slug);
  if (!uc) notFound();
  const r = RECORDS[uc.record];
  const run = r.runs[0];
  const after = r.runs[1] ?? null;
  const multi = r.runs.length > 1;
  // A plan section only where the record holds more than one journey's name: requirements (Larkspur) or two
  // journeys (Notewell). For one journey and no requirements it would repeat the journey's name, so the plan's
  // sentence leads the steps instead.
  const planSection = r.plan.requirements.length > 0 || r.plan.journeys.length > 1;
  const shape = shotShape(run);

  return (
    <article className="v6-uc">
      <header className="v6-uc__head">
        <div className="v6-wrap v6-wrap--read">
          <p className="v6-uc__crumb"><Link href={`${V6_BASE}/use-cases`}>Use cases</Link></p>
          <h1 className="v6-dread v6-uc__h1">{uc.title}</h1>
          <p className="v6-uc__outcome">{uc.outcome}</p>
          <dl className="v6-uc__meta">
            <div><dt>App</dt><dd>{r.name}</dd></div>
            <div><dt>Recorded</dt><dd data-no-translate>{run.recorded}</dd></div>
            {/* "Run ID" as in every record panel; a record of two runs names this one ("Before the fix"). */}
            <div><dt>{multi && run.label ? run.label : "Run ID"}</dt><dd data-no-translate>{run.id}</dd></div>
            <div><dt>Duration</dt><dd data-no-translate>{secondsText(run.seconds)}</dd></div>
          </dl>
        </div>
      </header>

      <div className="v6-uc__body">
        <div className="v6-wrap v6-wrap--read">
          <section className="v6-uc__sec" aria-labelledby="uc-sentence">
            <h2 id="uc-sentence" className="v6-dm v6-uc__h2">{r.claim ? "The sentence it was given" : "The journey it ran"}</h2>
            <RecordClaim record={r} large />
            {r.cli ? (
              <div className="v6-uc__block">
                <p className="v6-rp__k">The command that started the check</p>
                <Code lang="bash" src={r.cli} />
              </div>
            ) : null}
          </section>

          {planSection ? (
            <section className="v6-uc__sec" aria-labelledby="uc-plan">
              <h2 id="uc-plan" className="v6-dm v6-uc__h2">The plan it ran</h2>
              <p className="v6-uc__lead">{uc.planNote}</p>
              <RecordPlan record={r} stacked />
            </section>
          ) : null}

          <section className="v6-uc__sec" aria-labelledby="uc-run">
            <h2 id="uc-run" className="v6-dm v6-uc__h2">Every step the browser took</h2>
            {planSection ? null : <p className="v6-uc__lead">{uc.planNote}</p>}
            {multi && run.label ? <p className="v6-uc__label">{run.label}</p> : null}
            {/* A journey's note is printed under its steps unless the takeaway below already says it. */}
            <RunSteps run={run} notes={(n) => !r.takeaway.includes(n)} />
            {run.failure?.more ? <p className="v6-rp__note v6-uc__after">{run.failure.more}</p> : null}
          </section>

          <section className="v6-uc__sec" aria-labelledby="uc-found">
            <h2 id="uc-found" className="v6-dm v6-uc__h2">{run.found ? "What it found" : "What it saw"}</h2>
            <div className="v6-uc__found" data-shape={shape} style={{ ["--shot-w" as string]: `${shotWidth(run) + 18}px` }}>
              <div>
                {run.failure ? (
                  <RunFinding run={run} more={false} />
                ) : (
                  <div className="v6-uc__held">
                    <p className="v6-uc__big"><Outcome run={run} /></p>
                    <p className="v6-uc__lead">It found no problem, so it wrote no repair prompt.</p>
                  </div>
                )}
              </div>
              <div><RunShot record={r} run={run} /></div>
            </div>
          </section>

          {run.prompt ? (
            <section className="v6-uc__sec" aria-labelledby="uc-prompt">
              <h2 id="uc-prompt" className="v6-dm v6-uc__h2">The repair prompt it wrote</h2>
              <p className="v6-uc__lead">It is written for the coding agent that built the app: what was expected, what happened instead, and how to see it again.</p>
              <RunPrompt run={run} />
            </section>
          ) : null}

          {after ? (
            <section className="v6-uc__sec" aria-labelledby="uc-after">
              <h2 id="uc-after" className="v6-dm v6-uc__h2">The run after the fix</h2>
              {after.note ? <p className="v6-uc__lead">{after.note}</p> : null}
              <RunFacts run={after} outcome />
              <div className="v6-uc__block"><RunShot record={r} run={after} /></div>
            </section>
          ) : null}

          <section className="v6-uc__sec" aria-labelledby="uc-shows">
            <h2 id="uc-shows" className="v6-dm v6-uc__h2">What this shows</h2>
            <p className="v6-uc__read">{r.takeaway}</p>
          </section>

          {/* The Copy buttons of the command and the prompt (Code), wired once. */}
          {r.cli || r.runs.some((x) => x.prompt) ? <CopyScript /> : null}

          <section className="v6-uc__sec" aria-labelledby="uc-open">
            <h2 id="uc-open" className="v6-dm v6-uc__h2">Open it yourself</h2>
            <p className="v6-uc__lead">{r.about}</p>
            <ul className="v6-uc__open" role="list">
              {uc.open.map((o) => (
                <li key={o.href}>
                  <a href={o.href} className="v6-uc__olink">{o.label}</a>
                  <span className="v6-uc__oaddr" data-no-translate>{o.address}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="v6-sec v6-uc__rel">
        <div className="v6-wrap"><CrossLinks links={related(uc)} /></div>
      </section>

      <ClosingScene title={uc.closing.title} action={uc.closing.action} />
    </article>
  );
}
