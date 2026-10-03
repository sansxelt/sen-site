import { v6meta } from "../_system/meta";
import Link from "next/link";
import { publishedArticles, formatDate, readingMinutes } from "@/app/rank/research/_articles";
import { SectionHead, EditorialLink } from "../_system/ui";
import { IndexHero } from "../_system/kit";
import { ClosingScene } from "../_system/close";
import { V6_BASE } from "@/lib/v6-routes";
import "./research.css";

export const metadata = v6meta({
  title: "Research",
  description:
    "The methodology behind trusting a claim that software works: why builders cannot remain their only judges, evidence versus confidence, human judgment at the boundary, repair verification, preserved failure history, and the questions still open.",
  path: "/research",
  type: "website",
});

const BASE = V6_BASE;

// THE RESEARCH INDEX (plan T8, 2026-10-02): the articles as one list, the stance in one section, the eight
// directions as one accordion, and the closing. It used to carry two lists of the same articles (a hero aside and
// "Written at length"), two stance sections and two conceptual exhibits drawn with state colours and dots; the
// articles are listed once now, and the exhibits are gone because nothing here is a recorded result.

/* ---- the research directions ---- */
type Dir = { id: string; n: string; title: string; blurb: string; body: string[]; now: string[]; open: string[] };

// Every id is an anchor someone may hold (/research#earned-autonomy): they stay as they were.
const DIRECTIONS: Dir[] = [
  {
    id: "independent-judgment",
    n: "01",
    title: "Independent judgment",
    blurb: "Why the party doing the work cannot certify it.",
    body: [
      "The same agent that designs a change, writes it, and repairs it is not a neutral witness to whether it worked. Its report that the work is finished is a claim, produced by the party with the strongest reason to believe it. Oversight starts by refusing to treat that claim as proof.",
      "Independence does not mean distrusting agents. It means the standard for done is set outside the agent and checked against the running system, so that trust is the result of the check rather than a precondition for it.",
    ],
    now: [
      "A requirement is stated and held outside the code the agent controls.",
      "The running software is exercised and judged against that requirement.",
      "The decision is computed from evidence, not accepted on assertion.",
    ],
    open: [
      "How much of a system can be judged this way as responsibilities get broader and fuzzier.",
      "How to keep the standard independent when agents help write the standard itself.",
    ],
  },
  {
    id: "responsibility-vs-implementation",
    n: "02",
    title: "Responsibility vs implementation",
    blurb: "A task and a promise are different objects.",
    body: [
      "A task and a responsibility are not the same thing. Add usage based billing is an implementation. Existing customers are never overcharged is a responsibility. Agents are handed implementations and graded on implementations, which is why passing tests can sit right next to a broken promise.",
      "Vraelis tries to keep the responsibility primary and durable, held apart from whatever code happens to satisfy it at a given moment. The implementation is allowed to change. What must remain true should not quietly change with it.",
    ],
    now: [
      "A responsibility is recorded as a durable object, distinct from any one change.",
      "Evidence is gathered against the responsibility, not only against the diff.",
    ],
    open: [
      "How to elicit the real responsibility when a person states only a task.",
      "How responsibilities compose, and conflict, across a large system.",
    ],
  },
  {
    id: "evidence-vs-confidence",
    n: "03",
    title: "Evidence vs confidence",
    blurb: "The unit we trust is the observation.",
    body: [
      "Confidence is cheap. A model can report high certainty about an outcome it never observed. Evidence is a record of the software actually doing the thing, captured in a way a person can inspect later.",
      "The unit Vraelis trusts is the observation, not the assurance. A result should reduce to what was exercised, what was seen, and where the boundary of the check sat.",
    ],
    now: [
      "Decisions are backed by execution against the live software, captured as inspectable evidence.",
      "The engine runs pinned, on a fixed model and fixed settings, so a result can be re-run under the same conditions.",
    ],
    open: [
      "How to represent the edge of a check, so absence of evidence is never read as evidence of safety.",
    ],
  },
  {
    id: "judgment-at-boundaries",
    n: "04",
    title: "Judgment at the boundaries",
    blurb: "The small set of moments that need a person.",
    body: [
      "Most of a task can be checked mechanically. A few points cannot, and they tend to be the ones that matter: an irreversible action, a pricing change, a decision that trades one risk for another. These are boundaries where a person should decide, not because the machine failed, but because the choice was never the machine's to make.",
      "The design problem is not raising everything to a person, which no one can sustain, nor raising nothing, which is how bad decisions ship quietly. It is finding the small set of moments that genuinely need judgment and presenting each with enough context to decide well.",
    ],
    now: [
      "A plan is approved or refused as a whole, by a person, before a run can start.",
    ],
    open: [
      "How to identify the moments that truly need a person without flooding the queue.",
      "How review load should scale as one person oversees many agents.",
      "How to raise exactly the sensitive or irreversible moments inside an approved plan, rather than holding the whole plan as one unit.",
    ],
  },
  {
    id: "repair-verification",
    n: "05",
    title: "Repair, then verify",
    blurb: "Fixed has to mean proven again.",
    body: [
      "A failure is not the end of a task; it is the middle. The useful question is whether the fix actually holds, and a fix proposed by the same agent that failed is not self certifying. A repair has to be rechecked independently, against the original responsibility, before it counts.",
      "Vraelis treats repair as a structured handoff back to the agent followed by a fresh, independent recheck, so that fixed means proven again rather than asserted again.",
    ],
    now: [
      "A failure becomes a structured handoff, not a bug to triage by hand.",
      "The repair is re-verified independently against the original requirement.",
    ],
    open: [
      "How many repair cycles are healthy before a responsibility should be escalated instead of retried.",
    ],
  },
  {
    id: "failure-history",
    n: "06",
    title: "Preserved failure history",
    blurb: "The failures are the most useful record.",
    body: [
      "When a fix lands, the temptation is to erase what came before. But the earlier failures are the most informative record a system has: they show how this software breaks, which repairs did not survive, and what an agent tends to get wrong.",
      "Vraelis preserves that history rather than overwriting it. A trusted completion is more credible when you can see the failed attempts it replaced, and the record compounds into knowledge about both the system and the agents working on it.",
    ],
    now: [
      "Requirements, failures, repairs, and decisions are retained, not overwritten by the latest pass.",
      "A completion keeps the trail of what it replaced.",
    ],
    open: [
      "How to turn preserved history into prediction of where the next failure will land.",
    ],
  },
  {
    id: "judging-the-judge",
    n: "07",
    title: "Judging the judge",
    blurb: "Evaluator failure is not application failure.",
    body: [
      "An oversight system can fail in two very different ways. The application under test can be broken, or the evaluator itself can be wrong: a check that passes something it should have caught, or flags something correct. Treating those as the same failure is how an overseer quietly loses its authority.",
      "The evaluator has to be held to a higher standard than the software it judges, and its mistakes have to be findable and separable from the application's. An overseer that cannot be audited is just another opinion.",
    ],
    now: [
      "The decision is computed and fail-closed, so an uncertain check does not pass by default.",
      "Evaluator behavior is inspectable, kept separate from the application result.",
    ],
    open: [
      "How to detect evaluator error systematically, apart from application error, across many checks.",
    ],
  },
  {
    id: "earned-autonomy",
    n: "08",
    title: "Autonomy is earned",
    blurb: "Independence should be a conclusion, not a setting.",
    body: [
      "The endpoint people imagine is agents acting with less supervision. That is reasonable, but autonomy should be a conclusion, not a setting. An agent earns room to act by accumulating a record of responsibilities met and failures handled honestly, on a given kind of work.",
      "The direction Vraelis is working toward is oversight that measures reliability over time and lets autonomy expand where it is warranted and contract where it is not, per agent and per domain, rather than granted once and forgotten.",
    ],
    now: [
      "Completion is accepted only when the responsibility is met, on every task.",
    ],
    open: [
      "How to measure earned reliability well enough to justify expanding an agent's autonomy.",
      "How autonomy should degrade automatically when an agent's record slips.",
    ],
  },
];

/** One direction: a native <details> in the page kit's question list. The id sits on the <details> itself, never
 *  on a box that moves, so an arrival at /research#<id> lands on the direction's own row under the bar. */
function Direction({ d }: { d: Dir }) {
  return (
    <details id={d.id} className="v6-faq__item">
      <summary className="v6-faq__q">
        <span className="v6-faq__qt v6-rx__dq">
          <span className="v6-rx__dn" aria-hidden data-no-translate>{d.n}</span>
          <span className="v6-rx__dt">{d.title}</span>
          <span className="v6-rx__db">{d.blurb}</span>
        </span>
        <span className="v6-faq__x" aria-hidden />
      </summary>
      <div className="v6-faq__a">
        {d.body.map((p) => <p key={p}>{p}</p>)}
        <div className="v6-rx__cols">
          <div>
            <p className="v6-rx__k">Current methodology</p>
            <ul>{d.now.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div>
            {/* Two whole labels, chosen by count: never a plural "s" glued onto a word. */}
            <p className="v6-rx__k">{d.open.length > 1 ? "Open questions" : "Open question"}</p>
            <ul>{d.open.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      </div>
    </details>
  );
}

export default function ResearchPage() {
  const articles = publishedArticles();
  return (
    <>
      <IndexHero
        eyebrow="Research"
        title="The methods behind trusting a claim that something works."
        lead="Vraelis checks whether live software does what someone says it does. These are the methods we use today, and the questions we have not closed."
      />

      {/* THE ARTICLES, ONCE. A row per article, the whole row one link, newest first (publishedArticles). */}
      <section className="v6-rx-list" aria-labelledby="rx-articles-h">
        <div className="v6-wrap">
          <h2 id="rx-articles-h" className="v6-rx__label" data-label="">Articles</h2>
          <ol className="v6-rx__rows" role="list">
            {articles.map((a) => (
              <li key={a.slug}>
                <Link className="v6-rx__row" href={`${BASE}/research/${a.slug}`}>
                  <time className="v6-rx__date" dateTime={a.date}>{formatDate(a.date)}</time>
                  <div className="v6-rx__main">
                    <h3 className="v6-rx__t">{a.title}</h3>
                    <p className="v6-rx__s">{a.summary}</p>
                  </div>
                  <span className="v6-rx__cat">{a.category}</span>
                  <span className="v6-rx__time">{`${readingMinutes(a)} min`}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* THE STANCE, ONCE: what used to be "Our stance", "How we read a claim" and "Where this goes". */}
      <section className="v6-sec" id="stance">
        <div className="v6-wrap">
          <div className="v6-rx__stance">
            <SectionHead eyebrow="Our stance" title="A builder cannot remain the only judge of its own work." />
            <p className="v6-rx__p">Whoever builds a system, a person, a team or an agent, will also report that it is finished. That report is a claim. Vraelis checks it against what the running software shows.</p>
            <p className="v6-rx__p">Each direction below says what we do today and what we have not solved. Checking is a practice, not a finished science.</p>
            <div className="v6-actions v6-rx__more">
              <EditorialLink href={`${BASE}/method`}>Read the Vraelis Method</EditorialLink>
              <EditorialLink href={`${BASE}/readme`}>Why Vraelis exists</EditorialLink>
            </div>
          </div>
        </div>
      </section>

      {/* THE EIGHT DIRECTIONS, ONE ACCORDION. */}
      <section className="v6-sec v6-rx-dirsec" id="directions">
        <div className="v6-wrap">
          <div className="v6-faq v6-rx-dirs">
            <div className="v6-faq__head"><h2 className="v6-faq__t" data-label="">Methodology and open questions</h2></div>
            <div className="v6-faq__list">
              {DIRECTIONS.map((d) => <Direction key={d.id} d={d} />)}
            </div>
          </div>
        </div>
      </section>

      <ClosingScene title="Check one claim on your own app." />
    </>
  );
}
