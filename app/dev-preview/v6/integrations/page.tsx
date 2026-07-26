import { Reveal, PageHero, SectionHead, CTA, EditorialLink, Signal, Kicker } from "../_system/ui";
import { v6meta } from "../_system/meta";

// Integrations (design 06). Only surfaces that are actually shipped: GitHub, Vercel, Slack, API, CLI,
// webhooks. Each description says truthfully what it does today (e.g. GitHub is read-only repository
// metadata plus CLI-in-CI; Slack is an incoming-webhook the owner pastes). Future surfaces are grouped and
// clearly marked Direction, no fabricated integrations, no placeholders dressed up as live.

export const metadata = v6meta({
  title: "Integrations",
  description:
    "Where Vraelis oversight meets the tools you already ship with. Live today: GitHub Actions, Vercel deployments, Slack, the API, the CLI, and signed webhooks. Direction: IDE, desktop, mobile approvals, and MCP.",
  path: "/integrations",
});

const BASE = "/dev-preview/v6";

type Live = { name: string; what: string; href?: string; hrefLabel?: string };

const LIVE: Live[] = [
  {
    name: "GitHub",
    what: "Gate a deploy from GitHub Actions. Run the CLI on a successful deployment and let the exit code stop a release when a critical flow fails. Connecting GitHub also lets Vraelis read repository metadata, read-only, with no code write access, so it knows what it is testing.",
    href: `${BASE}/developers#cli`,
    hrefLabel: "Gate a deploy in CI",
  },
  {
    name: "Vercel",
    what: "Verify a Vercel preview or production deployment. Point a verification at the deployment URL and record the project so Vraelis knows the build under test, then gate promotion on the decision it returns.",
    href: `${BASE}/developers#api`,
    hrefLabel: "Create a verification",
  },
  {
    name: "Slack",
    what: "Get results where the team already is. Paste a Slack incoming webhook URL and every verification.completed arrives as a formatted message with the decision, the flows that passed, and a link to the evidence.",
    href: `${BASE}/developers#webhooks`,
    hrefLabel: "How webhooks work",
  },
  {
    name: "API",
    what: "Create and read verifications over HTTP. POST a deployment and a claim, then poll for an explainable decision with evidence, failures, and a repair prompt. Authenticated with an x-api-key header.",
    href: `${BASE}/developers#api`,
    hrefLabel: "Read the API",
  },
  {
    name: "CLI",
    what: "One command, one exit code. vraelis verify wraps the same endpoint for people and pipelines; the exit code carries the verdict so an if-statement in CI can act on it.",
    href: `${BASE}/developers#cli`,
    hrefLabel: "See the CLI",
  },
  {
    name: "Webhooks",
    what: "A signed verification.completed event is pushed the moment a run finalizes, carrying only owner-safe facts. Verify the HMAC signature over the raw body, then act on the decision.",
    href: `${BASE}/developers#webhooks`,
    hrefLabel: "Verify a delivery",
  },
];

const DIRECTION: [string, string][] = [
  ["Cursor / VS Code", "Start a verification and read the decision without leaving the editor."],
  ["Desktop", "A companion that watches local agent work and raises decisions to you."],
  ["Mobile approvals", "Approve a reviewed plan, or a sensitive decision, from your phone."],
  ["MCP + agent tools", "Expose verification as a tool an agent can call inside its own runtime."],
];

export default function IntegrationsPage() {
  return (
    <>
      <PageHero
        kicker="Integrations"
        title="Oversight meets the tools you already ship with."
        lead="Vraelis should not live in one more tab. It plugs into where code merges, deploys, and gets talked about, so a verification decision lands in the flow you already have. Everything on this page is live today, and everything that is not yet built is labeled as such."
        cta={<><CTA brand>Open Vraelis</CTA><EditorialLink href={`${BASE}/developers`}>Developer docs</EditorialLink></>}
      />

      {/* ── Live integrations ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Live today"
              title="Six ways to put a decision where it counts."
              lead="Each of these is the API, the CLI, or a webhook wired to a surface you already use. Not a marketplace of half-built connectors, the small set that actually works."
            />
          </Reveal>
          <div className="v6-grid3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,320px),1fr))" }}>
            {LIVE.map((it, i) => (
              <Reveal key={it.name} i={i % 3} className="v6-gcard">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>{it.name}</h3>
                  <Signal state="go">Live</Signal>
                </div>
                <p>{it.what}</p>
                {it.href ? (
                  <div style={{ marginTop: 16 }}>
                    <EditorialLink href={it.href}>{it.hrefLabel ?? "Learn more"}</EditorialLink>
                  </div>
                ) : null}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Direction ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <Reveal>
            <div className="v6-head">
              <p className="v6-eyebrow" style={{ color: "var(--wait-ink)" }}>Direction</p>
              <h2 className="v6-dl">Where oversight is going next.</h2>
              <p className="v6-lead">The surfaces agents actually run in. These are not available yet, and are listed so the roadmap is honest, not to imply they exist.</p>
            </div>
          </Reveal>
          <div className="v6-grid3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,260px),1fr))" }}>
            {DIRECTION.map(([name, line], i) => (
              <Reveal key={name} i={i % 4} className="v6-gcard" style={{ background: "var(--surface)", borderStyle: "dashed", borderColor: "var(--line-2)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <h3 style={{ margin: 0, color: "var(--ink-3)" }}>{name}</h3>
                  <Signal state="wait">Direction</Signal>
                </div>
                <p style={{ color: "var(--ink-4)" }}>{line}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Honest note ── */}
      <section className="v6-sec">
        <div className="v6-wrap v6-wrap--read">
          <Reveal>
            <Kicker>The rule</Kicker>
            <h2 className="v6-dm" style={{ margin: "12px 0 16px" }}>An integration appears here only after it ships.</h2>
            <p className="v6-body">
              Nothing on this page is a placeholder for something that does not exist. The live set is small on purpose, and it grows only when a new surface actually works end to end. That is the same standard the decisions themselves are held to.
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
            <h2 className="v6-dl" style={{ marginInline: "auto" }}>Bring the decision into your pipeline.</h2>
            <p className="v6-lead" style={{ margin: "18px auto 28px", textAlign: "center" }}>
              Connect the surfaces you already ship with, and let an explainable verdict gate the work instead of a dashboard nobody watches.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <CTA brand lg>Open Vraelis</CTA>
              <CTA href={`${BASE}/developers`} ghost lg>Developer docs</CTA>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
