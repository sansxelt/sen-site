// /pricing (plan T6, C /pricing). In order: the compact IndexHero with the Monthly/Yearly switch under its lead;
// the four plans (Free, Builder, Pro, Scale) at one height, with the page's only white button on Free; Pay as you
// go and Enterprise as a row of two under them; the definition strip ("One verification is"); the questions; what
// this pricing does and does not do; the closing.
import { v6meta } from "../_system/meta";
import { CTA, EditorialLink, SectionHead } from "../_system/ui";
import { DoesBox, Faq, IndexHero, type FaqItem } from "../_system/kit";
import { ClosingScene } from "../_system/close";
import { PricingSwitch, PricingToggle } from "../_system/pricing-toggle";
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import {
  PLAN_CATALOG_V1, FREE_TIER, PASS_INCLUDED_FLOWS, EXTRA_FLOW_CENTS, passPriceCents, type PlanV1,
} from "@/lib/preflight/pass-pricing";
import { usdFromCents, planHeadline, planCapacity } from "@/lib/preflight/pass-pricing-format";
import "./pricing.css";

export const metadata = v6meta({
  title: "Pricing",
  description:
    "Vraelis is priced per verification, not per seat. A verification is one complete check of one system, and the first one is free, with no card.",
  path: "/pricing",
  type: "website",
});

const BASE = V6_BASE;
// Account creation: the sign-in screen in its sign-up mode, the closing's default destination too (close.tsx).
const SIGNUP = `${v6SignInPath()}&mode=signup`;

// PRICES COME FROM THE BILLING CATALOG, NOT FROM THIS FILE.
//
// A pricing page holding its own copy of the numbers is a pricing page that eventually disagrees with what the
// customer is charged. PLAN_CATALOG_V1 is what checkout reads, so it is what this page renders; the free allowance
// is FREE_TIER and the single verification is passPriceCents, the function that charges for one. The formatting is
// the library's too (usdFromCents: whole dollars, "$1,490"). scripts/pricing-purchasable-verify.ts holds this page
// to it: no dollar figure is typed here.
const money = usdFromCents;


// One line under each price: who the plan is for. Keyed by plan, so a plan added to the catalog fails the type
// check here until it has its line, rather than rendering without one.
const FOR: Record<PlanV1["key"], string> = {
  builder_v1: "For one product moving toward launch.",
  pro_v1: "For teams launching several apps.",
  scale_v1: "For agencies and platforms checking at volume.",
};

// THE FREE CARD, FROM FREE_TIER: the constant the console's free card and the guarantee cap check read, so this
// card cannot advertise an allowance the product does not grant. Each line is one whole string, so the translator
// keys on the whole sentence (plan 0.6). The lines are worded for an allowance of one: FREE_TIER is `as const`, and
// `satisfies 1` fails the type check if the library ever grants more, rather than the card printing "2 verification".
// "Flows" here because the paid cards' lines (planCapacity) count a journey as a flow; the questions say so.
// The old card's "The full answer, with screenshots and the step record" is not repeated here: the line under the
// price says it is a real answer, the strip under the plans says what one holds, and "Is the first one free?" says
// it again. With it, the second screen at 1440x900 ran past its word budget (188 of 180, plan A1.6).
const FREE_HEAD = `Protects ${FREE_TIER.maxGuarantees satisfies 1} active guarantee`;
const FREE_LINES = [
  `${FREE_TIER.lifetimePasses satisfies 1} verification for the life of the account, up to ${FREE_TIER.flowsPerPass} flows`,
  `${FREE_TIER.maxApplications satisfies 1} connected system`,
  // Free is the one tier without the API, now that every paid plan has it. Stated here rather than discovered
  // when a key is refused.
  "Console only, no API or CLI",
];

/** A price: the amount and its unit as two elements, never part of a sentence (plan 0.6). The amount is machine
 *  text and is not translated; the unit is. cyc marks which billing cycle it belongs to (pricing.css shows one).
 *  The units are words ("per month"), not "/month": the translation crawl files a string with no space and a slash
 *  as machine text and never sends it to the translators, so "/month" would stay English on every locale, while
 *  "per month" and "per verification" are already in all eleven catalogues. */
function Price({ amount, unit, cyc }: { amount: string; unit?: string; cyc?: "monthly" | "yearly" }) {
  return (
    <p className="v6-pp__price" data-cyc={cyc}>
      <span className="v6-pp__amt" data-no-translate>{amount}</span>
      {unit ? <span className="v6-pp__unit">{unit}</span> : null}
    </p>
  );
}

// "One verification is": the four parts of what a verification buys. These were the hero's aside, word for word;
// they are the page's definition now, set as a strip under the plans. The last one's label was "When something
// broke" and now uses the pitch words (plan 0.3). The first is the page's one statement that a person approves the
// plan (plan 0.3).
const DEFINITION: [string, string][] = [
  ["The plan", "Written from your sentence, approved by a person."],
  ["The run", "A real browser on the live app, every step recorded."],
  ["The evidence", "Screenshots, console errors and failed requests."],
  ["If it finds a problem", "What was expected, what happened, and a repair prompt."],
];

// THE QUESTIONS. Every answer is this page's own copy as it stood before this rebuild (its lead, its cards, "What a
// verification is" and "What this pricing does not do"), the console pricing page's own lines (a yearly plan is
// charged up front and its allowance resets monthly), or the library, plus one fact from the product contract (plan
// A8.3: a re-check runs within 24 hours of the approval, up to 10 times, on the same address). Nothing else is
// claimed. A price is never inside a sentence (it stands beside a label); the counts that are (24 hours, 10 times,
// the included journeys) are fixed facts or library constants rendered into one whole string, so the translator
// still keys on the whole sentence.
const FAQ: FaqItem[] = [
  {
    q: "What is one verification?",
    a: "One complete check of one system: the plan, the real browser run, and the evidence behind the decision. It covers one connected system end to end, and it is not metered per page, per assertion or per minute.",
  },
  {
    q: "Is the first one free?",
    a: "Yes, with no card. It ends in the full answer, with screenshots and the step record. Free is console only, with no API or CLI.",
  },
  {
    q: "What if no check could prove my sentence?",
    a: "Then Vraelis says so and charges nothing. You are never billed for a verification that could not have been evidence.",
  },
  {
    q: "Is a re-check charged?",
    a: (
      <>
        <p>Yes, as one verification, the same as the first run, whether a person, a CI job or an AI assistant started it.</p>
        <p>Within 24 hours of the approval, the same plan can run again up to 10 times on the same address with no new approval. A preview URL is a different address.</p>
      </>
    ),
  },
  {
    q: "Can I pay yearly?",
    a: "Yes. Monthly is the default, and yearly is ten months for twelve, charged up front. The allowance still resets each month, and unused verifications do not roll over.",
  },
  {
    q: "What does an extra journey cost?",
    a: (
      <>
        <p>A journey is one path through the product, and it is what the plan cards count as a flow. On a plan, each verification includes up to the number of flows its card shows.</p>
        <p>{`On pay as you go, one verification includes up to ${PASS_INCLUDED_FLOWS} journeys, and each one beyond that is billed on its own.`}</p>
        <p className="v6-pp__qprice">
          <span>Each extra journey</span>
          <span className="v6-pp__qamt" data-no-translate>{money(EXTRA_FLOW_CENTS)}</span>
        </p>
      </>
    ),
  },
  {
    q: "Do reviewers need a paid seat?",
    a: "No. There is no per-seat pricing: your team size is not the thing being measured. Invite whoever needs to read the evidence.",
  },
  {
    q: "What does Enterprise add?",
    a: (
      <>
        <p>For governments, regulated institutions and established organizations that need custom capacity or contract terms. Single sign-on through your own identity provider, roles across a team, owner-anchored billing, and audit activity you can export. Invoicing, a signed agreement and a security review are all available, with written quotes rather than a calculator.</p>
        <div className="v6-pp__qlink"><EditorialLink href={`${BASE}/enterprise`}>Read about Enterprise</EditorialLink></div>
      </>
    ),
  },
];

export default function V6Pricing() {
  return (
    <>
      {/* The switch sits under the lead and the prices sit in the plans below it, so the toggle wraps both. Every
          price is in the page twice, once per cycle; the toggle only says which set shows. */}
      <PricingToggle className="v6-pp">
        <IndexHero
          compact
          eyebrow="Pricing"
          title="Priced per verification, not per seat"
          lead="A verification is one complete check of one system. The first one is free, with no card."
          actions={
            <>
              <PricingSwitch />
              <p className="v6-pp__note">Yearly is ten months for twelve.</p>
            </>
          }
        />

        <section className="v6-sec v6-pp__plans" id="plans" aria-labelledby="plans-h">
          <div className="v6-wrap">
            {/* The section's heading, for the outline only: the cards under it say what they are. */}
            <h2 className="v6-pp__sr" id="plans-h" data-label="">Plans</h2>

            {/* FOUR PLANS AT ONE HEIGHT. Each card is a subgrid of six rows (name, price, who it is for, the
                button, the guarantee headline, the capacity list), so the rows line up across the cards and
                the buttons sit on one line. Not wrapped in Reveal: the plans are the first screen. */}
            <ul className="v6-pp__grid" role="list">
              <li className="v6-pp__card">
                <h3 className="v6-pp__name">Free</h3>
                <div className="v6-pp__prow"><Price amount={money(0)} /></div>
                <p className="v6-pp__for">See a real answer on your own app.</p>
                <div className="v6-pp__act">
                  {/* The page's one white button. */}
                  <CTA href={SIGNUP}>Start free</CTA>
                </div>
                <p className="v6-pp__head">{FREE_HEAD}</p>
                <ul className="v6-pp__list" role="list">
                  {FREE_LINES.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </li>

              {PLAN_CATALOG_V1.map((p) => (
                <li className="v6-pp__card" key={p.key}>
                  <h3 className="v6-pp__name">{p.name}</h3>
                  <div className="v6-pp__prow">
                    <Price amount={money(p.monthlyCents)} unit="per month" cyc="monthly" />
                    <Price amount={money(p.yearlyCents)} unit="per year" cyc="yearly" />
                  </div>
                  <p className="v6-pp__for">{FOR[p.key]}</p>
                  {/* EVERY CARD HAS A WAY TO SAY YES, for the cycle on show. Checkout takes the plan and the cycle
                      from the query and sends a signed-out visitor through sign-in and back. No recommended tier:
                      the three buttons are the same ghost, and the numbers decide. */}
                  <div className="v6-pp__act">
                    <span data-cyc="monthly"><CTA ghost href={`/checkout?plan=${p.key}&cycle=monthly`}>Choose {p.name}</CTA></span>
                    <span data-cyc="yearly"><CTA ghost href={`/checkout?plan=${p.key}&cycle=yearly`}>Choose {p.name}</CTA></span>
                  </div>
                  {/* The plan copy is rendered from the library, not retyped: the console's plans and pricing pages
                      render the same two helpers, so a plan cannot be described two ways. */}
                  <p className="v6-pp__head">{planHeadline(p)}</p>
                  <ul className="v6-pp__list" role="list">
                    {planCapacity(p).map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </li>
              ))}
            </ul>

            <div className="v6-pp__more">
              {/* THE PRICE OF ONE RUN, where a plan is weighed against it. Both figures come from the functions
                  that charge. */}
              <div className="v6-pp__alt">
                <h3 className="v6-pp__name">Pay as you go</h3>
                <Price amount={money(passPriceCents(PASS_INCLUDED_FLOWS))} unit="per verification" />
                <p className="v6-pp__for">No plan, and nothing renews.</p>
                <ul className="v6-pp__list" role="list">
                  <li>{`Up to ${PASS_INCLUDED_FLOWS} flows included`}</li>
                  <li className="v6-pp__li-price">
                    <span>Each extra flow</span>
                    <span className="v6-pp__lamt" data-no-translate>{money(EXTRA_FLOW_CENTS)}</span>
                  </li>
                </ul>
                <div className="v6-pp__act"><CTA ghost>Run a single verification</CTA></div>
              </div>

              {/* THE WAY PAST THE TOP PLAN, in the same units as the ladder. Only what /enterprise marks
                  operational is offered here; anything that page marks as preview or planned is not sold on this
                  one (scripts/guarantee-cap-verify.ts). Not "unlimited", and no price: what a contract costs depends
                  on volume, browser time, systems, retention and support. */}
              <div className="v6-pp__alt">
                <h3 className="v6-pp__name">Enterprise</h3>
                <p className="v6-pp__cap">For governments, regulated institutions and established organizations</p>
                <p className="v6-pp__for">Custom capacity and contract terms, priced on a written quote.</p>
                <ul className="v6-pp__list" role="list">
                  <li>Single sign-on through your own identity provider</li>
                  <li>Roles, owner-anchored billing and audit export</li>
                </ul>
                <div className="v6-pp__act">
                  <CTA ghost href={`${BASE}/contact?topic=enterprise`}>Talk to sales</CTA>
                  <a className="v6-pp__mail" href="mailto:sales@vraelis.com?subject=Vraelis%20Enterprise" data-no-translate>sales@vraelis.com</a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </PricingToggle>

      <section className="v6-sec v6-pp__defsec" aria-labelledby="one-h">
        <div className="v6-wrap">
          <h2 className="v6-defs__h" id="one-h" data-label="">One verification is</h2>
          <dl className="v6-defs">
            {DEFINITION.map(([t, d], i) => (
              <div className="v6-defs__cell" key={t}>
                <dt className="v6-defs__t"><span className="v6-defs__n" aria-hidden data-no-translate>{String(i + 1).padStart(2, "0")}</span>{t}</dt>
                <dd className="v6-defs__d">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="v6-sec v6-pp-faq" id="questions">
        <div className="v6-wrap">
          <Faq items={FAQ} />
        </div>
      </section>

      <section className="v6-sec" id="plainly">
        <div className="v6-wrap">
          <SectionHead eyebrow="Stated plainly" title="What this pricing does, and what it does not" />
          <DoesBox
            titles={{ does: "What this pricing does", doesNot: "What this pricing does not do" }}
            does={[
              "Charges per verification: one complete check of one system.",
              "Bills a re-check after a fix as one verification.",
              "Lets a plan top up with single verifications at the pay as you go price.",
            ]}
            doesNot={[
              "Charge per seat.",
              "Charge for a check Vraelis could not build.",
              "Roll unused verifications over to the next month.",
              "Lock you into yearly billing.",
            ]}
            link={{ label: "Read what Vraelis cannot do yet", href: `${BASE}/limitations` }}
          />
        </div>
      </section>

      <ClosingScene title="Your first verification is free" />
    </>
  );
}
