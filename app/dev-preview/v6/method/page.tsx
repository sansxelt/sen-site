import type { Metadata } from "next";
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import { v6meta } from "../_system/meta";
import { CTA, Prose } from "../_system/ui";
import { CrossLinks } from "../_system/kit";
import { ClosingScene } from "../_system/close";
import { SUPPORT } from "../_system/positioning";
import "../_system/read.css";
import "./method.css";

export const metadata: Metadata = v6meta({
  title: "The Vraelis Method",
  description: "The worldview behind Vraelis: say what should work before judging how it was built, evidence before confidence, a person approves the check, and a check that cannot decide says so.",
  path: "/method",
  ogTitle: "The Vraelis Method",
});

/* THE METHOD, IN THE READ LAYOUT (plan T9 and C /method, revision 2, 2026-10-02).
 *
 * The same page as a research article (_system/read.css, research/[slug]/page.tsx): a head in the 680 column, the
 * body at 17/1.65 with every chapter title at the h3 tier, a contents list held on the right from 1200px (shown
 * in the column, under the head, below that), then the related reading, the product step and the closing. The
 * three bare buttons that used to end the page are gone: the README and the limitations are the related
 * reading, and the one way into the product is the step card. Nothing here is wrapped in Reveal.
 *
 * Anchors that must survive (plan 0.5): #introduction and #in-public. The positions keep the ids they had
 * (#claim ... #answer), because a link to one may already be held somewhere.
 */

// Account creation is the sign-in screen in its sign-up mode, as the closing scene and the bar use it.
const SIGNUP = `${v6SignInPath()}&mode=signup`;

type Chapter = { id: string; title: string; paras: string[] };

/** The introduction is not a position, so it carries no number, and the count starts at the first real one. */
const INTRO: Chapter = {
  id: "introduction",
  title: "Introduction",
  paras: [
    "Software now ships faster than anyone checks it, from small teams, agencies, founders on no-code tools, and AI agents that can plan, write and repair their own work. The bottleneck is no longer how fast software gets made. It is whether anyone checked that the live app does what they say it does.",
    "The Vraelis Method is a set of positions about how to earn that trust. They are the reason the product is shaped the way it is.",
  ],
};

// THE EIGHT POSITIONS. The count is said elsewhere (the deck, the homepage card, the menu), so it stays eight.
//
// A POSITION IS NAMED AFTER THE OBJECT THE PRODUCT ACTUALLY HAS. The first was "Responsibility before
// implementation", then "The guarantee comes before the implementation"; since 2026-09-28 the object in the public
// story is the claim, one sentence about what should work.
// THE LAST TWO were "Memory should compound" and "Autonomy must be earned" until 2026-09-28. Both argued for a much
// larger product than the one that is built, so they were replaced by two positions the product already acts on.
// THE SEVENTH WAS "Blocked is an answer" until 2026-10-02. Verified, Failed and Blocked are the product's own
// vocabulary (console, API, docs) and stay out of pitch and essay copy (positioning.ts rule 8, plan 0.3), so the
// position says what happens in plain words. Its facts are the code's: a run that cannot reach a decision answers
// with no decision and the reason (lib/preflight/public-decision.ts; the docs' example is a test account that
// cannot sign in), and a sentence no check could prove is refused before anything runs, with no charge
// (claim_not_provable in lib/preflight/acceptance/accept-run.ts). The id stays "blocked" for held links.
// THE APPROVAL IS SAID ONCE ON THIS PAGE (plan 0.3), in the fifth position. The third used to repeat it.
// THE EIGHTH sends a repair prompt only with a found problem: on a pass there is nothing to repair
// (public-decision.ts: failed carries the evidence and a repair prompt).
const POSITIONS: Chapter[] = [
  { id: "claim", title: "Say what should work before judging how it was built", paras: [
    "Nobody using your app cares which files changed. They care whether they can do what they came to do. A check should start from that, written as one sentence, and treat the implementation as the thing being judged, not the thing being described.",
    "State what should work first. Everything the work did is then measured against it, on the live app.",
  ] },
  { id: "judge", title: "The builder cannot be the only judge", paras: [
    "Whoever plans, writes, and repairs the work, a developer, an agency or an AI agent, will also tell you it is finished. A test written inside the system inherits the same assumptions the mistake came from. Independence is not something you reach by trying harder; it is structural.",
    "The thing that produces the work does not get to certify it. Someone, or something, outside the work has to decide.",
  ] },
  { id: "standards", title: "Keep the standard outside the work", paras: [
    "If the standard a piece of work is held to lives inside the work, whoever did the work can move it. The claim, the plan that proves it, and the decision to accept a completion belong outside that control, where the builder cannot quietly change them.",
  ] },
  { id: "evidence", title: "Evidence before confidence", paras: [
    "A confident claim is not proof. Vraelis prefers what can be observed: the running app driven in a real browser, what each step expected and what it observed, the screenshots, the console errors and the failed requests. When evidence and confidence disagree, evidence wins.",
  ] },
  { id: "boundary", title: "A person approves the check", paras: [
    "Most of a check can be mechanical. Deciding what counts as working cannot. A person approves the plan before it runs, once, and a script or an AI assistant cannot approve it for them. The goal is not to remove human judgment; it is to spend it where it matters.",
  ] },
  { id: "repair", title: "A fix is finished when the check passes", paras: [
    "A fix is not finished because someone changed something. It is finished when the claim that failed now holds on the live app, checked independently, as its own record. A later result never overwrites an earlier one, so the history of how the software came to work stays intact.",
  ] },
  { id: "blocked", title: "A check that cannot decide says so", paras: [
    "A check that could not decide should say so. When a run cannot reach a decision, for example because a test account cannot sign in or the run cannot finish, the answer reports no decision and the reason. It never dresses a guess up as a pass.",
    "When no check could prove the sentence at all, Vraelis says so before anything runs, and nothing is charged. A tool that always returns a pass or a fail is one whose answers are not worth much.",
  ] },
  { id: "answer", title: "The answer goes back to whoever asked", paras: [
    "A result only helps if it reaches whoever has to act on it. Vraelis returns the answer and its evidence, with a repair prompt when it found a problem, to wherever the check started: the console, the CLI, a CI job, or an AI assistant over MCP. The fix then starts from what the live app actually did.",
  ] },
];

type PositionId = "claim" | "judge" | "standards" | "evidence" | "boundary" | "repair" | "blocked" | "answer";
const positionTitle = (id: PositionId) => POSITIONS.find((p) => p.id === id)!.title;

/* ══════════════════════════════ WHERE THE POSITIONS HAVE ALREADY BEEN TESTED ═══════════════════════════
 *
 * Eight positions with nothing behind them is a manifesto, and a manifesto from a company with no customers
 * is the weakest thing it is possible to publish. These are public, dated, reported incidents that bear on
 * the positions above, with a source for each.
 *
 * THE RULE THAT MAKES THIS PUBLISHABLE, and it is not negotiable: Vraelis was not involved in any of these,
 * did not prevent any of them, and was not consulted about any of them. Nothing here may imply otherwise.
 * The `verdict` field is deliberately allowed to say NO, and on the first entry it does. An honest "this is
 * outside what we check" from the company selling the check is worth more than three cases bent until they
 * look like near misses, and a reader who catches one bent case stops believing the other two.
 *
 * ALL THREE ARE SOFTWARE THAT SHIPPED. A fourth entry about AI in vehicle engineering was removed, not
 * because it was untrue but because the verdict on it had to be "this is not remotely what we check", and a
 * case that can only be connected to the product by analogy weakens a page whose argument is that evidence
 * beats a good story.
 *
 * ON THE AMAZON ENTRY IN PARTICULAR. Secondary write-ups of this merged two separate incidents, in two
 * different months, on two different systems, and attached an order-volume loss figure that appears in no
 * primary source. None of that is repeated here. What is stated is what the outlets actually report: the
 * outage and Amazon's own attribution of it, the Financial Times reporting of the internal briefing, and
 * Amazon's public rejection of the AI framing, which is quoted rather than paraphrased away.
 *
 * NO SIGNAL COLOUR ANYWHERE IN THIS BLOCK. The stop colour means a check found a problem, and these are news
 * stories, not results the product produced. Same reasoning as app/not-found.tsx.
 *
 * Sources were read before being cited. Keep it that way: a fabricated citation on a page arguing for
 * evidence over confidence would be the single most expensive sentence on this site.
 */
type Case = {
  who: string;
  when: string;
  what: string;
  bears: PositionId;  // the position it tests: the line under the case reads that position's own title
  verdict: string;    // what an independent outcome check would and would not have done. May be "no".
  // MORE THAN ONE SOURCE, because the most important fact in the Amazon entry is that two sources disagree.
  // A single citation there would have to pick a side, and picking a side is the thing this page argues
  // nobody involved should get to do.
  sources: { url: string; label: string }[];
};

const CASES: Case[] = [
  {
    who: "Replit",
    when: "July 2025",
    what: "During a live build, a founder asked Replit's agent to freeze code changes. It did not hold. The agent deleted the production database, then reported that a rollback was impossible and that it had destroyed every version. The rollback in fact worked. Over the same period the agent also produced fake reports and fake passing unit tests over code that did not work.",
    bears: "judge",
    verdict: "It would not have prevented this. Vraelis does not sit between an agent and a database and nothing it does can stop a destructive command. The half it speaks to is the other one: the agent reported tests passing that it had fabricated, and reported an unrecoverable database that was recoverable. Both were false, in opposite directions, and both came from the system being asked to grade itself.",
    sources: [
      { url: "https://www.theregister.com/2025/07/21/replit_saastr_vibe_coding_incident/", label: "The Register, 21 July 2025" },
      { url: "https://incidentdatabase.ai/cite/1152/", label: "AI Incident Database, incident 1152" },
    ],
  },
  {
    who: "Amazon",
    when: "February and March 2026",
    what: "For about six hours in March, shoppers could not check out, see prices, or reach their account information. Amazon attributed that outage to a software code deployment. Separately, the Financial Times reported an internal weekly operations briefing describing a trend of incidents with, in its words, high blast radius and Gen-AI assisted changes, and reported that four sources attributed an earlier thirteen-hour disruption of one AWS service to its own agentic coding tool. Amazon disputes the framing on both counts: it said the earlier incident was employee error involving misconfigured access controls rather than AI, and a spokesperson said the company has not seen evidence that incidents are more common with AI tools.",
    bears: "evidence",
    verdict: "The outage itself is the shape a check does catch. Whether a shopper can complete a purchase is an outcome a real browser can put to the live site, and it stopped being true while the deployment was reported as successful. It would not have stopped the deploy, and it buys only the time between shipping and knowing. The disagreement about the cause is the more useful part of this entry, and it is not something a check settles: when the only account of what happened comes from the party that shipped it, there is nothing for anyone outside to check it against.",
    sources: [
      { url: "https://www.cnbc.com/2026/03/10/amazon-plans-deep-dive-internal-meeting-address-ai-related-outages.html", label: "CNBC, 10 March 2026" },
      { url: "https://www.theregister.com/2026/03/10/amazon_ai_coding_outages", label: "The Register, 10 March 2026" },
    ],
  },
  {
    who: "Air Canada",
    when: "Ruling February 2024",
    what: "A support chatbot on Air Canada's own site told a passenger he could apply for a bereavement fare after flying. The airline's actual published policy did not allow that, and it refused the claim. British Columbia's Civil Resolution Tribunal held the airline liable for negligent misrepresentation and awarded damages, finding that a company is responsible for the information on its website whether it comes from a static page or from a chatbot.",
    bears: "standards",
    verdict: "Partly, and the honest half matters. Whether a quoted policy still matches the published one is an outcome that can be stated and checked. Whether a model invents a new policy in answer to a question nobody thought to write down is not something a check can enumerate in advance.",
    sources: [
      { url: "https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-february/bc-tribunal-confirms-companies-remain-liable-information-provided-ai-chatbot/", label: "American Bar Association, February 2024" },
    ],
  },
];

const PUBLIC_LEAD = "Public, dated, reported incidents that bear on the positions above. Vraelis was not involved in any of them and prevented none of them. Each one says plainly what an independent check of a stated outcome would and would not have done, including where the answer is that it would have done nothing at all.";

const two = (n: number) => String(n).padStart(2, "0");

/** The contents: the introduction, the eight positions with their numbers, and the cases. */
const TOC: { id: string; n?: string; text: string }[] = [
  { id: INTRO.id, text: INTRO.title },
  ...POSITIONS.map((p, i) => ({ id: p.id, n: two(i + 1), text: p.title })),
  { id: "in-public", text: "In public" },
];

/** Read time, counted the way the research articles count it (app/rank/research/_articles.ts readingMinutes). */
const MINUTES = (() => {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const texts = [
    ...INTRO.paras, ...POSITIONS.flatMap((p) => p.paras), PUBLIC_LEAD,
    ...CASES.flatMap((c) => [c.what, c.verdict]),
  ];
  return Math.max(1, Math.round(texts.reduce((n, s) => n + words(s), 0) / 220));
})();

function ChapterView({ c, n }: { c: Chapter; n?: string }) {
  return (
    <section id={c.id} className="v6-mt__ch">
      {n ? <p className="v6-read__act" data-no-translate>{n}</p> : null}
      <h2>{c.title}</h2>
      {c.paras.map((p, i) => <p key={i}>{p}</p>)}
    </section>
  );
}

function InPublic() {
  return (
    <section id="in-public" className="v6-mt__ch v6-mt__public">
      <p className="v6-read__act">In public</p>
      <h2>Three times this was tested by somebody else</h2>
      <p>{PUBLIC_LEAD}</p>
      <ol className="v6-read__cases" role="list">
        {CASES.map((c) => (
          <li key={c.who} className="v6-read__case">
            <div className="v6-read__casehead">
              <h3>{c.who}</h3>
              <span className="v6-read__when">{c.when}</span>
            </div>
            <p>{c.what}</p>
            {/* The label recedes and the position it names does not: set at the same weight and colour they
                read as one run-on sentence ("Tests The builder cannot be the only judge"). The position is a
                link back to where the page argues it. */}
            <p className="v6-read__tests"><span className="v6-read__k">Tests</span><a href={`#${c.bears}`}>{positionTitle(c.bears)}</a></p>
            {/* Set apart because it is the sentence a reader came for, and the one this company has an
                incentive to overstate. */}
            <p className="v6-read__verdict">{c.verdict}</p>
            {/* rel=noopener on a target=_blank is not optional: without it the opened page gets a handle back
                to this one through window.opener. nofollow because a citation is not an endorsement. */}
            <p className="v6-read__sources">
              <span className="v6-read__k">{c.sources.length > 1 ? "Sources" : "Source"}</span>
              {c.sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.label}</a>
              ))}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Method() {
  return (
    <>
      <article className="v6-read v6-mt" aria-labelledby="read-h1">
        <div className="v6-wrap">
          <div className="v6-read__grid" data-toc="">
            <header className="v6-read__head">
              <p className="v6-read__eyebrow">The Vraelis Method</p>
              <p className="v6-read__meta"><span>{`${MINUTES} min read`}</span></p>
              <h1 id="read-h1" className="v6-read__h1">How we think about trusting software that says it works</h1>
              <p className="v6-read__deck">Eight positions that decide how the product is built. They are opinionated on purpose.</p>
            </header>

            <div className="v6-read__body">
              <Prose>
                <ChapterView c={INTRO} />
                {POSITIONS.map((p, i) => <ChapterView key={p.id} c={p} n={two(i + 1)} />)}
                <InPublic />
              </Prose>
            </div>

            {/* The contents are part of what this page says (eight positions, then the cases), so below 1200px
                they stay in the column under the head (data-inline) instead of disappearing. */}
            <nav className="v6-read__toc v6-mt__toc" data-inline="" aria-labelledby="mt-toc-h">
              <p id="mt-toc-h" className="v6-read__tochead">On this page</p>
              <ol className="v6-read__toclist">
                {TOC.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`}>
                      <span className="v6-read__tocn" aria-hidden data-no-translate>{t.n ?? ""}</span>
                      <span>{t.text}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </div>
      </article>

      <section className="v6-sec v6-read-end">
        <div className="v6-wrap">
          <div className="v6-read-end__in">
            <CrossLinks heading="Keep reading" links={[
              { title: "README", body: "Why Vraelis exists, in three acts", href: `${V6_BASE}/readme` },
              { title: "Limitations", body: "What Vraelis cannot do today", href: `${V6_BASE}/limitations` },
            ]} />
            <aside className="v6-read__step" aria-labelledby="mt-step-h">
              <div>
                <h2 id="mt-step-h" className="v6-read__steph">Check one claim on your own app</h2>
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
