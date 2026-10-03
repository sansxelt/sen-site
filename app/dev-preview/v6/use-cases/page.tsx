import Link from "next/link";
import { v6meta } from "../_system/meta";
import { IndexHero } from "../_system/kit";
import { ClosingScene } from "../_system/close";
import { Outcome } from "../_system/record-panel";
import { RECORDS, USE_CASES } from "../_content/use-cases";

/* THE USE-CASE INDEX (plan A9 T15, S2 "/use-cases"; revision 2, 2026-10-02).
 *
 * Four real recorded checks, one row each: the record date (UTC), the title, the app, the outcome phrase, and a
 * link to the full record. Everything in a row is read from _content/use-cases.ts, which reads the records
 * themselves (_content/strike.ts, _content/demos.ts). Rows only, no pictures: the evidence screenshots are near
 * white, and the plan allows one of them per screen; each use case shows its own.
 */

export const metadata = v6meta({
  title: "Use cases",
  // "What it was asked", not "the sentence": the fixture dashboard's record (de53ab8b) has no sentence, only a journey.
  description: "Real checks, recorded step by step: what each run was asked, the plan, every step, and what it found, on a simulated mission console and three Vraelis demo apps.",
  path: "/use-cases",
});

export default function UseCasesIndex() {
  return (
    <>
      <IndexHero
        eyebrow="Use cases"
        title="Real checks, recorded step by step"
        lead="Each one is a real run: what it was asked, the plan, every step, and what it found."
      />

      <section className="v6-sec v6-ucx">
        <div className="v6-wrap">
          <ol className="v6-ucx__list" role="list">
            {USE_CASES.map((uc) => {
              const r = RECORDS[uc.record];
              const run = r.runs[0];
              const after = r.runs[1];
              return (
                <li className="v6-ucx__row" key={uc.slug}>
                  <p className="v6-ucx__date" data-no-translate>{run.recorded}</p>
                  <div className="v6-ucx__main">
                    <h2 className="v6-ucx__t"><Link href={r.href} className="v6-ucx__link">{uc.title}</Link></h2>
                    <p className="v6-ucx__app">{r.about}</p>
                  </div>
                  {/* Each run's outcome phrase; a record of two runs names each ("Before the fix", "After the fix"). */}
                  <div className="v6-ucx__out">
                    {r.runs.map((x) => (
                      <p className="v6-ucx__word" key={x.id}>
                        {after && x.label ? <span className="v6-ucx__k">{x.label}</span> : null}
                        <Outcome run={x} />
                      </p>
                    ))}
                    <p className="v6-ucx__id" data-no-translate>{after ? `${run.id}, ${after.id}` : run.id}</p>
                  </div>
                  <span className="v6-ucx__go" aria-hidden>→</span>
                </li>
              );
            })}
          </ol>
          <p className="v6-ucx__note">All four apps are Vraelis demo apps and fixtures, so these records hold no customer data. Each app is public: every use case links to it.</p>
        </div>
      </section>

      <ClosingScene title="Check one sentence on your own app" />
    </>
  );
}
