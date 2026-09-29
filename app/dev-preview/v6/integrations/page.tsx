import { Reveal, PageHero, SectionHead, CTA, EditorialLink, Signal, Kicker } from "../_system/ui";
import { v6meta } from "../_system/meta";
import { V6_BASE } from "@/lib/v6-routes";

// Integrations (design 06), titled "Ways to use it". Only surfaces that are actually shipped.
//
// REWRITTEN 2026-09-28 around FOUR CHANNELS, SIDE BY SIDE: the console, the CLI, CI through the API, and AI
// assistants over MCP. They start the same check and read the same answer, and none of them is the identity
// of the product (founder, 2026-09-28: narrow on the function, wide on the audience). MCP used to sit on
// this page under Direction, "Expose verification as a tool an agent can call"; it is built, local and
// hosted, so it moved into the live set. The rest of that Direction list (an editor extension, a desktop
// companion, mobile approvals) left the page with it, because nothing in the product is building toward them.
//
// Below the channels sit the places an answer is delivered (webhooks, Slack) and the two platforms a check
// is commonly pointed at (GitHub Actions, Vercel). Each says truthfully what it does today: GitHub is the CLI
// or the API run from a workflow plus read-only repository metadata, Vercel is a deployment URL, and Slack
// is an incoming webhook the owner pastes.

export const metadata = v6meta({
  title: "Ways to use it",
  description:
    "Four ways to start a Vraelis check and read the answer: the console, the CLI, CI through the API, and AI assistants over MCP. Plus signed webhooks, Slack, GitHub Actions and Vercel deployments.",
  path: "/integrations",
});

const BASE = V6_BASE;
type Item = { name: string; who: string; what: string; href?: string; hrefLabel?: string };

// The four channels. `who` is deliberately a situation, not a job title: the same person may use all four.
const CHANNELS: Item[] = [
  {
    name: "Console",
    who: "When you want to see it",
    what: "Open Vraelis, name the deployed app, and write one sentence about what should work. Review the plan, approve it, and read the decision with its screenshots and step record. Every earlier run stays on the record.",
    href: `${BASE}/docs/getting-started`,
    hrefLabel: "Get started",
  },
  {
    name: "CLI",
    who: "From a terminal",
    what: "vraelis verify prints the plan and the approval link, waits for a person to approve, runs, and exits 0, 1 or 2 for Verified, Failed or Blocked. vraelis recheck runs the same plan again after a fix.",
    href: `${BASE}/developers#cli`,
    hrefLabel: "See the CLI",
  },
  {
    name: "CI and the API",
    who: "From a pipeline",
    what: "POST a deployment and a claim, hand the approve_url to a person, run the approved plan, and gate the release on the decision. Re-check the same plan after a fix. Authenticated with an x-api-key header.",
    href: `${BASE}/developers#api`,
    hrefLabel: "Read the API",
  },
  {
    name: "AI assistants, over MCP",
    who: "From the assistant that made the change",
    what: "Claude Code, Codex, Gemini CLI, GitHub Copilot, Cursor and Trae run the local server; ChatGPT and Claude connect to the hosted one. The assistant calls vraelis_verify, hands you the approval link, and gets the answer back. It cannot approve a plan.",
    href: `${BASE}/agents`,
    hrefLabel: "Set up an assistant",
  },
];

const DELIVERY: Item[] = [
  {
    name: "Webhooks",
    who: "Where the answer goes",
    what: "A signed verification.completed event is pushed the moment a run finalizes, carrying only owner-safe facts. Verify the HMAC signature over the raw body, then act on the decision.",
    href: `${BASE}/developers#webhooks`,
    hrefLabel: "Verify a delivery",
  },
  {
    name: "Slack",
    who: "Where the answer goes",
    what: "Paste a Slack incoming webhook URL and every verification.completed arrives as a formatted message with the decision, the flows that passed, and a link to the evidence.",
    href: `${BASE}/developers#webhooks`,
    hrefLabel: "How webhooks work",
  },
  {
    name: "GitHub Actions",
    who: "Where a check runs",
    what: "Run the CLI or call the API from a workflow after a deployment succeeds, and let the exit code stop a release. Connecting GitHub also lets Vraelis read repository metadata, read-only, with no code write access.",
    href: `${BASE}/developers#cli`,
    hrefLabel: "Gate a deploy in CI",
  },
  {
    name: "Vercel",
    who: "What a check points at",
    what: "Point a check at a Vercel preview or production deployment URL, then gate promotion on the decision it returns.",
    href: `${BASE}/developers#api`,
    hrefLabel: "Create a verification",
  },
];

function Card({ it, i }: { it: Item; i: number }) {
  return (
    <Reveal i={i % 4} className="v6-gcard">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>{it.name}</h3>
        <Signal state="go">Live</Signal>
      </div>
      <p style={{ margin: "0 0 10px" }}><Kicker>{it.who}</Kicker></p>
      <p>{it.what}</p>
      {it.href ? (
        <div style={{ marginTop: 16 }}>
          <EditorialLink href={it.href}>{it.hrefLabel ?? "Learn more"}</EditorialLink>
        </div>
      ) : null}
    </Reveal>
  );
}

export default function IntegrationsPage() {
  return (
    <>
      <PageHero
        kicker="Ways to use it"
        title="One check, four ways to start it."
        lead="Start a check from the console, the CLI, a CI pipeline, or an AI assistant. Each one sends the same sentence, waits for the same one-click approval from a person, and gets back the same Verified, Failed or Blocked, with the evidence. Everything on this page works today."
        cta={<><CTA brand>Open Vraelis</CTA><EditorialLink href={`${BASE}/developers`}>Developer docs</EditorialLink></>}
      />

      {/* ── The four channels ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Start a check"
              title="The console, the CLI, CI, and your AI assistant."
              lead="Pick whichever fits the moment. They are not tiers or plans, and a team usually uses more than one: the console to read, CI to gate a release, and an assistant to check its own change before it says it is done."
            />
          </Reveal>
          <div className="v6-grid3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,260px),1fr))" }}>
            {CHANNELS.map((it, i) => <Card key={it.name} it={it} i={i} />)}
          </div>
        </div>
      </section>

      {/* ── Where the answer goes ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Deliver the answer"
              title="Send the decision where the team already is."
              lead="Each of these is the API, the CLI, or a webhook wired to a surface you already use. Not a marketplace of half-built connectors, the small set that actually works."
            />
          </Reveal>
          <div className="v6-grid3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,260px),1fr))" }}>
            {DELIVERY.map((it, i) => <Card key={it.name} it={it} i={i} />)}
          </div>
        </div>
      </section>

      {/* ── Honest note ── */}
      <section className="v6-sec">
        <div className="v6-wrap v6-wrap--read">
          <Reveal>
            <Kicker>The rule</Kicker>
            <h2 className="v6-dm" style={{ margin: "12px 0 16px" }}>A way in appears here only after it ships.</h2>
            <p className="v6-body">
              Nothing on this page is a placeholder for something that does not exist. The set is small on purpose, and it grows only when a new surface works end to end. That is the same standard the decisions themselves are held to.
            </p>
            <div style={{ marginTop: 22 }}>
              <EditorialLink href={`${BASE}/developers`}>See how each one is built</EditorialLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Close ── */}
      <hr className="v6-rule" />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap" style={{ textAlign: "center", maxWidth: 720 }}>
          <Reveal>
            <h2 className="v6-dl" style={{ marginInline: "auto" }}>Start from wherever you already work.</h2>
            <p className="v6-lead" style={{ margin: "18px auto 28px", textAlign: "center" }}>
              One sentence about what should work, one approval from a person, and an answer from the live app, in the tool you already have open.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <CTA brand lg>Open Vraelis</CTA>
              <CTA href={`${BASE}/agents`} ghost lg>Set up an AI assistant</CTA>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
