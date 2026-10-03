import { CrossLinks, FrameHero, Band } from "../_system/kit";
import { SectionHead, EditorialLink } from "../_system/ui";
import { ClosingScene } from "../_system/close";
import { Code, CopyScript } from "../_system/code";
import { IntegrationsAside, LimitsLine } from "../_system/hero-asides";
import { v6meta } from "../_system/meta";
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import "./integrations.css";

// INTEGRATIONS (plan C /integrations, template T1, revised 2026-10-02).
//
// Four channels: the console, the CLI, CI through the API, and AI assistants over MCP. They start the same check
// and read the same answer, and none of them is the identity of the product (founder, 2026-09-28: narrow on the
// function, wide on the audience). They are the hero's panel, said once: each row names a way in (a link to its
// page in the docs), its entry point and what it does (WAYS_IN, _system/hero-asides.tsx). A "Four ways in" card
// section used to follow the hero and repeated the panel item for item, so its words moved into the panel and the
// section went (final review, 2026-10-02). Below the hero, where a check sits in a release (GitHub Actions,
// Vercel) and where the answer goes (signed webhooks, Slack).
//
// WHAT EACH ONE IS, TRUTHFULLY (rules.md): GitHub Actions is the CLI run in a workflow step, and Vercel is a
// deployment address a check points at. Neither is a built integration, so neither gets a mark: every name on
// this page is text (no brand logos, plan 0.2). The webhook example is the payload lib/preflight/
// webhook-dispatch.ts builds, with example values, and the headers it sends; a Slack address gets the same
// facts as a message (buildSlackMessage). The CLI row says what its exit code means and nothing more:
// 0 only when the claim held (cli/vraelis.mjs).
//
// The anchors /developers#api, #cli and #webhooks are linked from here and must survive there (plan 0.5).

export const metadata = v6meta({
  title: "Integrations",
  description:
    "Four ways to start a Vraelis check and read the answer: the console, the CLI, CI through the API, and AI assistants over MCP. Signed webhooks and Slack carry the answer to your team.",
  path: "/integrations",
});

const BASE = V6_BASE;
const SIGNUP = `${v6SignInPath()}&mode=signup`;

/* What a webhook endpoint receives: the headers deliverJson sends (user-agent left out) and the body
   buildVerificationPayload builds (lib/preflight/webhook-dispatch.ts), with example values. The timestamp is the
   delivery time in milliseconds, here the same instant as completed_at. */
const DELIVERY = `POST https://example.com/hooks/vraelis
content-type: application/json
x-vraelis-event: verification.completed
x-vraelis-timestamp: 1790618651220
x-vraelis-signature: sha256=<hex>

{
  "event": "verification.completed",
  "run_id": "9c1e0f2a41",
  "application_id": "app_5b7d",
  "decision": "failed",
  "flows_total": 4,
  "flows_passed": 3,
  "deployment_url": "https://staging.example.com",
  "completed_at": "2026-09-28T18:04:11.220Z",
  "report_url": "https://app.vraelis.com/systems/app_5b7d/passes/9c1e0f2a41"
}`;

export default function IntegrationsPage() {
  return (
    <>
      <FrameHero
        eyebrow="Integrations"
        title="One check, four ways to start it."
        sub="Start a check from the console, the CLI, a pipeline or an AI assistant. Each gets back the same answer, with the evidence."
        primary={{ label: "Start free", href: SIGNUP }}
        secondary={{ label: "Read the docs", href: `${BASE}/docs` }}
        panel={{ kind: "node", label: "The four ways to start a check", node: <IntegrationsAside /> }}
      />

      {/* ── Where it fits in a release ── two names, two sentences, no marks. */}
      <section className="v6-sec" id="release">
        <div className="v6-wrap">
          <SectionHead
            eyebrow="In your release"
            title="Where it fits in your release."
            lead="Neither is a separate integration to install. GitHub Actions runs the CLI, and Vercel gives a check the address to open."
          />
          <div className="ig-two">
            <div className="ig-two__item">
              <h3 className="ig-two__t">GitHub Actions</h3>
              <p className="ig-two__d">Run the CLI in a workflow step. The job passes only on exit code 0.</p>
              <div className="ig-two__link"><EditorialLink href={`${BASE}/docs/ci`}>Gate a release in CI</EditorialLink></div>
            </div>
            <div className="ig-two__item">
              <h3 className="ig-two__t">Vercel</h3>
              <p className="ig-two__d">Point a check at a Vercel preview or production deployment URL.</p>
              <div className="ig-two__link"><EditorialLink href={`${BASE}/docs/getting-started`}>Start a check</EditorialLink></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Where the answer goes ── the page's one Band: the words on the left, the delivery itself on the right. */}
      <Band id="delivery">
        <SectionHead
          eyebrow="Delivery"
          title="Where the answer goes."
          lead="When a run finishes, the answer can come to you: a signed event at your endpoint, or a message in a Slack channel."
        />
        <div className="ig-deliver">
          <div className="ig-deliver__text">
            <dl className="ig-rows">
              <div className="ig-row">
                <dt>Webhooks</dt>
                <dd>A signed event goes to your endpoint when a run finishes. Recompute the signature over the raw body before you act on it.</dd>
              </div>
              <div className="ig-row">
                <dt>Slack</dt>
                <dd>Paste a Slack incoming webhook address and the same event arrives as a message, with the outcome and a link to the evidence.</dd>
              </div>
            </dl>
            <div className="ig-deliver__link"><EditorialLink href={`${BASE}/docs/webhooks`}>Read the webhook guide</EditorialLink></div>
          </div>
          <figure className="ig-deliver__code">
            <Code lang="http" src={DELIVERY} />
            <figcaption className="ig-cap">
              Example values. Every delivery carries the outcome, the journey counts, the ids and a link to the evidence, never a token or a credential.
            </figcaption>
          </figure>
        </div>
      </Band>

      <LimitsLine text="A way in appears here only after it ships." />

      <section className="v6-sec ig-related">
        <div className="v6-wrap">
          {/* Every card has its 16:10 picture, as on /platform, /limitations and the sector pages, and each line is
              the one the site uses for that target. The Documentation card is public/site/product/CREDITS.md's. */}
          <CrossLinks
            links={[
              { title: "Developers", body: "The CLI, the API and CI.", href: `${BASE}/developers`, image: "/site/card/developers-16x10.jpg" },
              { title: "AI assistants", body: "Set up Vraelis in your coding agent, over MCP.", href: `${BASE}/agents`, image: "/site/card/agents-16x10.jpg" },
              { title: "Documentation", body: "Every way in, step by step.", href: `${BASE}/docs`, image: "/site/product/docs-16x10.jpg" },
            ]}
          />
        </div>
      </section>

      <ClosingScene title="Start from wherever you already work." />
      <CopyScript />
    </>
  );
}
