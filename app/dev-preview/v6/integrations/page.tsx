import { photographHero } from "../_content/photography";
import { CrossLinks, FrameHero, Band } from "../_system/kit";
import { SectionHead, EditorialLink } from "../_system/ui";
import { ClosingScene } from "../_system/close";
import { Code, CopyScript } from "../_system/code";
import { LimitsLine, WAYS_IN } from "../_system/hero-asides";
import { v6meta } from "../_system/meta";
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import "./integrations.css";

// Four ways to start the same check, explained as page content beneath the photograph.
// GitHub Actions runs the CLI and Vercel supplies the deployment address; neither is
// a separate built integration. The delivery example reflects webhook-dispatch.ts.

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
        title="One check, four ways to start it"
        sub="Start a check from the console, the CLI, a pipeline or an AI assistant. Each gets back the same answer, with the evidence."
        primary={{ label: "Start free", href: SIGNUP }}
        secondary={{ label: "Read the docs", href: `${BASE}/docs` }}
        {...photographHero("robotDetail")}
      />

      <section className="v6-sec" id="ways-in">
        <div className="v6-wrap">
          <SectionHead eyebrow="Four ways in" title="One check, four ways to start it" />
          <div className="ig-two">
            {WAYS_IN.map((way) => <div className="ig-two__item" key={way.key}>
              <h3 className="ig-two__t">{way.name}</h3>
              <p className="ig-two__d">{way.more}</p>
              <div className="ig-two__link"><EditorialLink href={way.docs}>{way.who}</EditorialLink></div>
            </div>)}
          </div>
        </div>
      </section>

      {/* ── Where it fits in a release ── two names, two sentences, no marks. */}
      <section className="v6-sec" id="release">
        <div className="v6-wrap">
          <SectionHead
            eyebrow="In your release"
            title="Where it fits in your release"
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
          title="Where the answer goes"
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
              the one the site uses for that target. Photography sources are recorded in public/site/photography/CREDITS.md. */}
          <CrossLinks
            links={[
              { title: "Developers", body: "The CLI, the API and CI.", href: `${BASE}/developers`, image: "/site/photography/agent.jpg" },
              { title: "AI assistants", body: "Set up Vraelis in your coding agent, over MCP.", href: `${BASE}/agents`, image: "/site/photography/client.jpg" },
              { title: "Documentation", body: "Every way in, step by step.", href: `${BASE}/docs`, image: "/site/photography/agent.jpg" },
            ]}
          />
        </div>
      </section>

      <ClosingScene title="Start from wherever you already work" />
      <CopyScript />
    </>
  );
}
