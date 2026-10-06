import { photographHero } from "../_content/photography";
import { Fragment } from "react";
import { Band, FeatureCard, FeatureGrid, FrameHero } from "../_system/kit";
import { SectionHead, EditorialLink } from "../_system/ui";
import { ClosingScene } from "../_system/close";
import { Code, CopyScript } from "../_system/code";
import { LimitsLine, WAYS_IN } from "../_system/hero-asides";
import { v6meta } from "../_system/meta";
import { STRIKE } from "../_content/strike";
import { V6_BASE } from "@/lib/v6-routes";
import "./developers.css";

// DEVELOPERS (plan C /developers, template T1, revised 2026-10-02). How your own tools start a check and read
// the answer, on one short page. THE REFERENCE MOVED TO THE DOCS: the full API, the dry run, the CI gate script
// and the webhook verification code live at /docs/api, /docs/cli, /docs/ci and /docs/webhooks, copied from this
// page as it stood at 10c6b20f. What stays here is one request and its response, the four ways in, the CLI's
// exit codes and the webhook's headers, each linking to its full page.
//
// EVERY SHAPE IS READ OFF THE SHIPPED CODE (re-check before editing any snippet):
//   1. A POST with no reviewed_plan_id returns 202 { state: "review_required", reviewed_plan_id, approve_url,
//      requirements }, and nothing runs or is charged (app/api/v1/verifications/route.ts). The response below
//      is that body, abridged, with example values.
//   2. POST /v1/verifications/plans/{id}/approve refuses EVERY API key with 403 plan_requires_human: a person
//      approves at the approve_url. That is the page's one approval sentence (the hero sub, plan 0.3).
//   3. The CLI exits 0 when the claim held, 1 when it did not, and 2 when no verdict was reached or it could not
//      run (cli/vraelis.mjs). Those words are reference material, so the table carries data-reference.
//   4. A webhook is POSTed with x-vraelis-event, x-vraelis-timestamp and x-vraelis-signature (sha256=<hex>, an
//      HMAC-SHA256 over `${timestamp}.${rawBody}`), and a Slack address gets the same facts as a message
//      (lib/preflight/webhook-dispatch.ts).
// The hero panel is the CLI's own output for run vrf_51705517 on Larkspur, a simulated mission console Vraelis
// built itself (_content/strike.ts); the #cli column says so in words.
//
// ANCHORS THAT MUST SURVIVE (plan 0.5): #api, #cli and #webhooks, linked from close.tsx, shell.tsx,
// /integrations and app/rank/_components/rank-ui.tsx.

export const metadata = v6meta({
  title: "Developers",
  description:
    "Start a Vraelis check from your own tools: submit a claim through the API or the CLI, gate a release on the exit code, and receive a signed webhook when a run finishes.",
  path: "/developers",
});

const BASE = V6_BASE;
/* Where the CLI sends people for a key (cli/vraelis.mjs NO_KEY): the console's own Developers page. */
const API_KEYS = "https://app.vraelis.com/developers";
const run = STRIKE.run!;

const REQUEST = `# Example. The first POST returns a plan to approve. Nothing runs yet.
curl -X POST https://vraelis.com/api/v1/verifications \\
  -H "x-api-key: $VRAELIS_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "deployment_url": "https://staging.example.com",
    "claim": "A customer can upgrade to Pro and keep access after signing in again."
  }'`;

const RESPONSE = `{
  "state": "review_required",
  "review_required": true,
  "requirements": [
    "Upgrading to Pro grants Pro access immediately",
    "Pro access is still present after signing out and back in"
  ],
  "reviewed_plan_id": "rvp_3c9e26ef",
  "approve_url": "https://app.vraelis.com/review/rvp_3c9e26ef",
  "human_reviewed": false
}`;

const GATE = `vraelis verify --url "$PREVIEW_URL" --claim "$VRAELIS_CLAIM" --wait`;

/* The exit codes, as cli/vraelis.mjs documents them. Reference material: the verdict words stay as the CLI
   uses them (plan 0.3). */
const EXITS: [string, string][] = [
  ["0", "Verified. The claim held on the live app, with evidence."],
  ["1", "Failed. The claim did not hold. With --repair-prompt it prints only the repair prompt, ready for a coding agent."],
  ["2", "Blocked. No verdict was reached, or the CLI could not run."],
];

const HOOK = `POST https://example.com/hooks/vraelis
content-type: application/json
x-vraelis-event: verification.completed
x-vraelis-timestamp: 1790618651220
x-vraelis-signature: sha256=<hex>`;

/* The four cards: WAYS_IN gives the name and where each is documented; the one line of code and the sentence are
   this page's. */
const WAY: Record<(typeof WAYS_IN)[number]["key"], { code: string; body: string }> = {
  console: { code: "app.vraelis.com", body: "Write the sentence and read the answer in the browser." },
  cli: { code: "vraelis verify … --wait", body: "Exits 0 only when the claim held." },
  api: { code: "POST /api/v1/verifications", body: "Submit a claim from any language or pipeline." },
  mcp: { code: "vraelis_verify", body: "Your coding agent asks for the check over MCP." },
};

/* A line of code as a card label. It may wrap between words, never inside one: a browser would otherwise break a
   flag such as --wait after its hyphens. Machine text, so never translated. */
function CodeLine({ code }: { code: string }) {
  return (
    <span data-no-translate>
      {code.split(" ").map((t, i) => <Fragment key={i}>{i ? " " : null}<span className="dv-tok">{t}</span></Fragment>)}
    </span>
  );
}

export default function DevelopersPage() {
  return (
    <>
      <FrameHero
        eyebrow="Developers"
        title="Start a check from your own tools"
        sub="Send a deployment address and one sentence about what should work. A person approves the plan, a real browser runs it, and your tools read the answer."
        primary={{ label: "Create an API key", href: API_KEYS }}
        secondary={{ label: "Read the API", href: `${BASE}/docs/api` }}
        {...photographHero("electronicsBench")}
      />

      {/* ── The API: one request and what comes back. ── */}
      <section className="v6-sec" id="api">
        <div className="v6-wrap">
          <SectionHead
            eyebrow="The API"
            title="Submit a claim, read the answer"
            lead="Every request carries your API key in a header. The first POST returns a plan to approve, and nothing runs or is charged before that."
          />
          <div className="dv-pair" data-reference="">
            <figure className="dv-pair__req">
              <figcaption className="dv-pair__h">Request</figcaption>
              <Code lang="bash" src={REQUEST} />
            </figure>
            <figure className="dv-pair__res">
              <figcaption className="dv-pair__h">Response: <span data-no-translate>202</span>, abridged</figcaption>
              <Code lang="json" src={RESPONSE} />
            </figure>
          </div>
          <div className="dv-more"><EditorialLink href={`${BASE}/docs/api`}>The full API reference</EditorialLink></div>
        </div>
      </section>

      {/* ── The four ways in, each with its line of code and its page in the docs. ── */}
      <section className="v6-sec dv-ways" id="ways">
        <div className="v6-wrap">
          <SectionHead eyebrow="Four ways in" title="The same check from every tool" />
          <FeatureGrid span={3}>
            {WAYS_IN.map((w) => (
              <FeatureCard
                key={w.key}
                label={<CodeLine code={WAY[w.key].code} />}
                title={w.name}
                body={WAY[w.key].body}
                href={w.docs}
              />
            ))}
          </FeatureGrid>
        </div>
      </section>

      {/* ── The CLI gate and the webhook, side by side: the page's one Band. Each column is its own anchor. ── */}
      <Band id="gate">
        <div className="dv-two">
          <div className="dv-col" id="cli">
            <SectionHead eyebrow="CLI" title="One command, the exit code is the interface" lead="In a pipeline, the next step reads the exit code." />
            <Code lang="bash" src={GATE} />
            <table className="dv-exits" data-reference="">
              <caption className="dv-exits__cap">Exit codes</caption>
              <thead>
                <tr><th scope="col">Code</th><th scope="col">Meaning</th></tr>
              </thead>
              <tbody>
                {EXITS.map(([n, d]) => (
                  <tr key={n}><td className="dv-exits__n" data-no-translate>{n}</td><td>{d}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="dv-note">
              <span>The transcript at the top of this page is the CLI&apos;s own output from a check of Larkspur, a simulated mission console Vraelis built itself.</span>
              <span className="dv-id" data-no-translate>{run.id.slice(0, 12)}</span>
            </p>
            <div className="dv-col__link"><EditorialLink href={`${BASE}/docs/ci`}>Gate a release in CI</EditorialLink></div>
          </div>
          <div className="dv-col" id="webhooks">
            <SectionHead
              eyebrow="Webhooks"
              title="Get the answer pushed to you"
              lead="When a run finishes, Vraelis sends a signed POST to your endpoint. Check the signature before you act on it."
            />
            <Code lang="http" src={HOOK} />
            <p className="dv-note">
              <span>The signature is an HMAC over the timestamp and the raw body, so recompute it over the exact bytes you received. A Slack incoming webhook address gets the same event as a message.</span>
            </p>
            <div className="dv-col__link"><EditorialLink href={`${BASE}/docs/webhooks`}>Verify a delivery</EditorialLink></div>
          </div>
        </div>
      </Band>

      <LimitsLine text="We will not document an endpoint we have not shipped." />

      <ClosingScene title="Put the check where you ship from" action={{ label: "Create an API key", href: API_KEYS }} />
      <CopyScript />
    </>
  );
}
