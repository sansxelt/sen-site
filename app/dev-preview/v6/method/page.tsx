import type { Metadata } from "next";
import { V6_BASE, v6AppEntry } from "@/lib/v6-routes";
import Link from "next/link";
import { v6meta } from "../_system/meta";
import { PageHero, Prose, SectionHead } from "../_system/ui";

export const metadata: Metadata = v6meta({
  title: "The Vraelis Method",
  description: "The worldview behind Vraelis: responsibility before implementation, evidence before confidence, and autonomy that must be earned.",
  path: "/method",
  ogTitle: "The Vraelis Method",
});

const CHAPTERS: [string, string, string[]][] = [
  ["introduction", "Introduction", [
    "Software is increasingly built by agents that can plan, write, call systems, and repair their own work. The bottleneck is no longer how fast software gets made. It is whether the result can be trusted.",
    "The Vraelis Method is a set of positions about how to earn that trust. They are opinionated on purpose. They are the reason the product is shaped the way it is.",
  ]],
  ["responsibility", "Responsibility before implementation", [
    "A company does not care which files an agent changed. It cares whether an outcome it depends on still holds. Oversight should start from the responsibility, stated as an outcome, and treat the implementation as the thing being judged, not the thing being described.",
    "State what must remain true first. Everything the agent does is then measured against it.",
  ]],
  ["judge", "The builder cannot be the only judge", [
    "An agent that plans, writes, and repairs the work will also tell you it is finished. A test written inside the system inherits the same assumptions the mistake came from. Independence is not something you reach by trying harder; it is structural.",
    "The thing that produces the work does not get to certify it. Someone, or something, outside the work has to decide.",
  ]],
  ["standards", "Keep standards outside the agent", [
    "If the standard a piece of work is held to lives inside the agent, the agent can move it. Requirements, the plan that proves them, and the decision to accept a completion belong outside the agent's control, where a person approves them and the agent cannot quietly change them.",
  ]],
  ["evidence", "Evidence before confidence", [
    "A confident claim is not proof. Vraelis prefers what can be observed: the running software driven in a real browser, the systems actually called, the state actually left behind. When evidence and confidence disagree, evidence wins.",
  ]],
  ["boundary", "Human judgment at the boundary", [
    "Most of oversight can be mechanical. Some of it cannot. Sensitive actions and irreducible uncertainty should be raised to a person, deliberately and rarely, rather than absorbed silently by automation. The goal is not to remove human judgment; it is to spend it where it matters.",
  ]],
  ["repair", "Repairs must resolve the responsibility", [
    "A fix is not finished because the agent changed something. It is finished when the responsibility that failed now holds, checked independently, as its own record. A later result never overwrites an earlier one, so the history of how the software reached trust stays intact.",
  ]],
  ["memory", "Memory compounds", [
    "Oversight is worth more over time. Every responsibility teaches the system how a company's software and agents actually fail. That accumulated, company-specific understanding is the compounding value, not any single verdict.",
  ]],
  ["autonomy", "Autonomy must be earned", [
    "The right amount of autonomy for an agent is not a setting; it is a conclusion. An agent earns more responsibility by a track record of trusted completions on real work, observed independently. Until then, oversight stays close.",
  ]],
];

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
 * NO SIGNAL COLOUR ANYWHERE IN THIS BLOCK. green, amber and red mean "it held", "a person is needed" and
 * "it failed", and they mean that about a verification. These are news stories, not verdicts the product
 * produced, and dressing a headline in the palette that means "this check failed" spends the one signal the
 * product has on something it did not decide. Same reasoning as app/not-found.tsx.
 *
 * Sources were read before being cited. Keep it that way: a fabricated citation on a page arguing for
 * evidence over confidence would be the single most expensive sentence on this site.
 */
type Case = {
  who: string;
  when: string;
  what: string;
  bears: string;      // which position above it tests
  verdict: string;    // what an independent outcome check would and would not have done. May be "no".
  source: string;
  sourceLabel: string;
};

const CASES: Case[] = [
  {
    who: "Ford",
    when: "Reported June 2026",
    what: "Ford leaned on AI in vehicle engineering and thinned the bench of veteran engineers who had been the independent check on its designs. Software defects and industry-leading recalls followed. The correction was to bring roughly 300 of those engineers back as internal auditors running mandatory design reviews before a blueprint reaches the factory. Its vice president of vehicle hardware engineering put it as: artificial intelligence is a fantastic tool, but it is only as good as the information you use to train it.",
    bears: "The builder cannot be the only judge",
    verdict: "Vraelis would not have caught this, and it is not close. This is vehicle hardware engineering, and Vraelis checks outcomes observable through deployed web applications and HTTP APIs. It is here because of what the correction was: an independent reviewer, structurally separate from the people producing the work, put back in the loop. That is the position above, arrived at the expensive way.",
    source: "https://www.foxbusiness.com/technology/ford-rehires-experienced-engineers-after-ai-misses-mark",
    sourceLabel: "Fox Business, 29 June 2026",
  },
  {
    who: "Amazon",
    when: "March 2026",
    what: "A week of high-severity incidents on Amazon's retail site, one of them a roughly six-hour outage. An internal email from the senior vice president for eCommerce services convened a mandatory review of a trend of incidents with, in its words, high blast radius and Gen-AI assisted changes, and Amazon added a requirement that AI-assisted production changes get additional senior review. Amazon's own account is that only one incident directly involved AI tools, and that the cause was not faulty AI-generated code but an engineer acting on inaccurate advice an AI agent had inferred from an outdated internal wiki.",
    bears: "Evidence before confidence",
    verdict: "This is the shape a check does catch. Whether a shopper can place an order is an outcome a real browser can put to the live site, and it stops being true the moment orders stop. What a check like this buys is the time between shipping and knowing. It does not stop a deploy, and it would not have prevented the change from going out.",
    source: "https://www.cnbc.com/2026/03/10/amazon-plans-deep-dive-internal-meeting-address-ai-related-outages.html",
    sourceLabel: "CNBC, 10 March 2026",
  },
  {
    who: "Air Canada",
    when: "Ruling February 2024",
    what: "A support chatbot on Air Canada's own site told a passenger he could apply for a bereavement fare after flying. The airline's actual published policy did not allow that, and it refused the claim. British Columbia's Civil Resolution Tribunal held the airline liable for negligent misrepresentation and awarded damages, finding that a company is responsible for the information on its website whether it comes from a static page or from a chatbot.",
    bears: "Keep standards outside the agent",
    verdict: "Partly, and the honest half matters. Whether a quoted policy still matches the published one is an outcome that can be stated and checked. Whether a model invents a new policy in answer to a question nobody thought to write down is not something a check can enumerate in advance.",
    source: "https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-february/bc-tribunal-confirms-companies-remain-liable-information-provided-ai-chatbot/",
    sourceLabel: "American Bar Association, February 2024",
  },
];

function Cases() {
  return (
    <section className="v6-sec v6-sec--sunk" id="in-public">
      <div className="v6-wrap v6-wrap--read">
        <SectionHead
          eyebrow="The positions, in public"
          title="Three times this was tested by somebody else."
          lead="Public, dated, reported incidents that bear on the positions above. Vraelis was not involved in any of them and prevented none of them. Each one says plainly what an independent check of a stated outcome would have done, including the first, where the answer is nothing."
        />
        <ol style={{ listStyle: "none", margin: "clamp(30px,3.4vw,44px) 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "clamp(26px,3vw,38px)" }}>
          {CASES.map((c) => (
            <li key={c.who} style={{ paddingTop: 22, borderTop: "1px solid var(--line-2)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <h3 className="v6-dm" style={{ margin: 0 }}>{c.who}</h3>
                <span className="v6-kicker">{c.when}</span>
              </div>
              <p className="v6-body" style={{ marginTop: 12 }}>{c.what}</p>
              {/* The label and the position need a visible boundary between them: set at the same weight and
                  colour they read as one run-on sentence ("Tests The builder cannot be the only judge").
                  The label recedes, the position it names does not. */}
              <p style={{ margin: "14px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
                <span className="v6-kicker" style={{ marginRight: 10 }}>Tests</span>{c.bears}
              </p>
              {/* The verdict is set apart because it is the sentence a reader came for, and because it is the
                  one this company has an incentive to overstate. Left inline it reads as commentary. */}
              <p style={{ margin: "12px 0 0", paddingLeft: 16, borderLeft: "2px solid var(--line-2)", fontSize: 14.5, lineHeight: 1.6, color: "var(--ink-2)" }}>
                {c.verdict}
              </p>
              <p style={{ margin: "12px 0 0", fontSize: 13 }}>
                {/* rel=noopener on a target=_blank is not optional: without it the opened page gets a handle
                    back to this one through window.opener. nofollow because a citation is not an endorsement
                    and this page should not pass ranking to a news site to make a point. */}
                <a href={c.source} target="_blank" rel="noopener noreferrer nofollow" className="v6-plink" style={{ color: "var(--ink-4)" }}>
                  Source: {c.sourceLabel}
                </a>
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function Method() {
  return (
    <>
      <PageHero
        kicker="The Vraelis Method"
        title="How we think about trusting AI software work."
        lead="Eight positions that decide how the product is built. They are opinionated on purpose."
      />
      <section className="v6-sec" style={{ paddingTop: 0 }}>
        <div className="v6-wrap v6-wrap--read">
          <nav aria-label="Chapters" style={{ marginBottom: "clamp(32px,4vw,52px)", paddingBottom: 24, borderBottom: "1px solid var(--line)" }}>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {CHAPTERS.map(([slug, title], i) => (
                <li key={slug} style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                  <span className="v6-mono" style={{ fontSize: 12, color: "var(--brand-ink)" }}>{String(i + 1).padStart(2, "0")}</span>
                  <a href={`#${slug}`} style={{ color: "var(--ink-2)", textDecoration: "none", fontSize: 16 }}>{title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <Prose>
            {CHAPTERS.map(([slug, title, paras]) => (
              <section key={slug} id={slug}>
                <h2>{title}</h2>
                {paras.map((p, i) => <p key={i}>{p}</p>)}
              </section>
            ))}
          </Prose>
        </div>
      </section>
      <Cases />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap v6-wrap--read">
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link href={`${V6_BASE}/readme`} className="v6-btn v6-btn--ghost">Read the README</Link>
            <Link href={`${V6_BASE}/limitations`} className="v6-btn v6-btn--ghost">What Vraelis cannot do</Link>
            <Link href={v6AppEntry()} className="v6-btn v6-btn--brand">Open Vraelis <span className="v6-arw" aria-hidden>→</span></Link>
          </div>
        </div>
      </section>
    </>
  );
}
