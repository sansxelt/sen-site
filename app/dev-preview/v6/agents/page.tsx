import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, CTA, EditorialLink, Signal, Kicker } from "../_system/ui";
import { Code, CopyScript } from "../_system/code";
import { V6_BASE } from "@/lib/v6-routes";

// AI ASSISTANTS (design 06), at /agents. THE SETUP GUIDE, and one page among the ways to use Vraelis.
//
// Rewritten 2026-09-28. This page used to describe "oversight around AI software agents": what Vraelis would
// and would not observe of an agent's work, a sensitive-decision hold marked Direction, and a Direction card
// that listed "MCP and agent tools" as not built. MCP is built now, `vraelis init` prints a link to this
// exact route when it finishes, and a reader who follows that link needs setup, not a thesis. So the order
// is: what the assistant can do with Vraelis, the loop it runs, the approval rule, then setup, recommended
// first and by hand per assistant after.
//
// IT IS NOT THE PITCH (founder, 2026-09-28). Vraelis checks a deployed web app against one sentence for
// anyone who ships one; an AI assistant is one of four ways to start that check, beside the console, the CLI
// and CI. Nothing here says the product is for assistants, and no assistant is claimed as tested or endorsed.
// Each setup line is the one cli/vraelis.mjs writes (ASSISTANTS in that file), so if the CLI changes a path
// or a command, this page changes with it.
//
// FACTS THIS PAGE LEANS ON, and where they live: the three tools and their rules (lib/mcp/tools.ts and the
// copy in cli/vraelis.mjs), the approval refusal (app/api/v1/verifications/plans/[id]/approve/route.ts),
// the re-check limits (lib/preflight/recheck.ts: 24 hours, 10 re-checks, same scheme and host), the hosted
// server and its OAuth key naming (app/api/mcp/route.ts, app/oauth/authorize/page.tsx), and the card
// (lib/mcp/widget.ts).

export const metadata: Metadata = v6meta({
  title: "AI assistants",
  description:
    "Connect Vraelis to an AI assistant over MCP, so it can check a change on your deployed web app in a real browser and get back Verified, Failed or Blocked with the evidence. Setup for Claude Code, Codex, Gemini CLI, GitHub Copilot, Cursor, Trae, ChatGPT and Claude.",
  path: "/agents",
  ogTitle: "Vraelis in your AI assistant",
});

const BASE = V6_BASE;
type Sig = "go" | "wait" | "stop";

const wrapRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "clamp(20px,2.8vw,44px)",
  alignItems: "stretch",
};

/* ---------- the three tools, and what none of them can do ---------- */

const TOOLS: [string, string][] = [
  ["vraelis_verify", "The live https URL and one sentence about what should now work. The first time, it returns the approval link for a person."],
  ["vraelis_status", "Where a check is, from its job_ or vrf_ id: preparing, waiting for approval, running, or the decision. It waits briefly for news before answering."],
  ["vraelis_recheck", "After a fix is deployed, the same approved plan again, from its vrf_ id. No new approval inside the limits below."],
];

const CANNOT = [
  "Approve a plan. The first check of a claim waits for a person at the link.",
  "Re-check more than 24 hours after the approval, more than 10 times, or on a different site.",
  "Check localhost or a private address. The change has to be deployed somewhere public; a preview URL is enough.",
];

/* ---------- the loop, in two lanes ---------- */

const LOOP: { n: string; agent: string; vraelis: string; sig?: Sig; tag?: string }[] = [
  { n: "01", agent: "Finishes a change and deploys it.", vraelis: "Nothing yet. Vraelis does not read the code or watch the assistant work." },
  { n: "02", agent: "Calls vraelis_verify with the live URL and one sentence about what should now work.", vraelis: "Writes a plan: the requirements the sentence implies and the browser steps that would prove them.", sig: "wait", tag: "Plan" },
  { n: "03", agent: "Hands you the approval link.", vraelis: "Waits for a person. No tool and no API key can approve a plan.", sig: "wait", tag: "Needs you" },
  { n: "04", agent: "Calls vraelis_status while it waits.", vraelis: "Runs the approved plan in a real browser on the deployed app." },
  { n: "05", agent: "Reads the answer.", vraelis: "Returns Verified, Failed or Blocked, with the evidence. On Failed: what broke, expected against observed, and a repair prompt.", sig: "go", tag: "Decided" },
  { n: "06", agent: "Fixes the cause and redeploys to the same site.", vraelis: "Keeps the failed run on the record. Nothing is overwritten." },
  { n: "07", agent: "Calls vraelis_recheck.", vraelis: "Runs the same approved plan again, with no new click, within 24 hours of the approval and up to 10 times.", sig: "go", tag: "Re-check" },
  { n: "08", agent: "Is told to say it works only on Verified.", vraelis: "That instruction ships with the tools, and vraelis init writes the same rule into the project." },
];

/* ---------- setup ---------- */

const INIT = `# 1. Install the CLI. macOS and Linux:
curl -fsS https://vraelis.com/install | sh
# Windows (PowerShell):
irm https://vraelis.com/install.ps1 | iex

# 2. Sign in once. Paste a key with "Launch runs" access, created at app.vraelis.com/developers.
vraelis login

# 3. From your project folder: set up every assistant found on this machine.
vraelis init
# or name them: claude, codex, gemini, copilot, cursor, trae, all
vraelis init claude codex`;

const INIT_DOES = [
  "Writes the MCP setup for the assistants it finds: Claude Code, Codex, Gemini CLI, GitHub Copilot in VS Code and the Copilot CLI, and Cursor.",
  "For Trae, which keeps its MCP list inside the app, prints the JSON to paste.",
  "Adds a short rule to the project's AGENTS.md: verify before you say it's done. It adds the same rule to CLAUDE.md or GEMINI.md when you chose those assistants and the file does not already import AGENTS.md, and to .trae/rules/project_rules.md for Trae.",
  "Tells you to restart the assistant, or reload the window, so the tools load.",
];

// The plain stdio entry Cursor and Trae both read. Built from an object so the rendered JSON is always valid.
const MCP_SERVERS = JSON.stringify({ mcpServers: { vraelis: { command: "vraelis", args: ["mcp"] } } }, null, 2);

const MANUAL: { name: string; note: string; lang: string; src: string }[] = [
  { name: "Claude Code", note: "The terminal and the VS Code extension share one configuration, so one command covers both.",
    lang: "bash", src: "claude mcp add --scope user vraelis -- vraelis mcp" },
  { name: "Codex", note: "The CLI and the IDE extension share one configuration.",
    lang: "bash", src: "codex mcp add vraelis -- vraelis mcp" },
  { name: "Gemini CLI", note: "One command.",
    lang: "bash", src: "gemini mcp add vraelis vraelis mcp" },
  { name: "GitHub Copilot in VS Code", note: "Add this to your user or workspace mcp.json.",
    lang: "json", src: JSON.stringify({ servers: { vraelis: { type: "stdio", command: "vraelis", args: ["mcp"] } } }, null, 2) },
  { name: "GitHub Copilot CLI", note: "Add this to ~/.copilot/mcp-config.json.",
    lang: "json", src: JSON.stringify({ mcpServers: { vraelis: { type: "local", command: "vraelis", args: ["mcp"], tools: ["*"] } } }, null, 2) },
  { name: "Cursor", note: "Add this to ~/.cursor/mcp.json.",
    lang: "json", src: MCP_SERVERS },
  { name: "Trae", note: "In Trae, open Settings > MCP > Add > Configure manually, and paste this.",
    lang: "json", src: MCP_SERVERS },
  { name: "ChatGPT", note: "ChatGPT connects to the hosted server over the web. Turn on developer mode (Settings, Apps and Connectors, Advanced), add a connector with this URL, and choose OAuth. ChatGPT sends you to Vraelis to sign in and click Allow.",
    lang: "text", src: "https://vraelis.com/mcp" },
  { name: "Claude (claude.ai and desktop)", note: "Settings > Connectors > Add custom connector, with this URL. Claude sends you to Vraelis to sign in and click Allow.",
    lang: "text", src: "https://vraelis.com/mcp" },
  { name: "Any other MCP client", note: "Run the local server over stdio, or connect to the hosted server over HTTP with your API key in an x-api-key header.",
    lang: "text", src: "stdio   vraelis mcp\nHTTP    https://vraelis.com/mcp   with header  x-api-key: <your key>" },
];

function List({ items, tone }: { items: string[]; tone: Sig }) {
  return (
    <ul style={{ listStyle: "none", margin: "18px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((t) => (
        <li key={t} style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>
          <span aria-hidden style={{ marginTop: 7, width: 7, height: 7, borderRadius: 999, background: tone === "go" ? "var(--go)" : "var(--wait)", flex: "none" }} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/* ================================= page ================================= */

export default function Agents() {
  return (
    <>
      <PageHero
        kicker="AI assistants"
        title="Let your AI assistant check its work on the live app."
        lead="When an assistant finishes a change to your web app, it can ask Vraelis to try it on the deployed site and get back Verified, Failed or Blocked, with the evidence. You approve each new check once. Set it up with one command, or add the server by hand."
        cta={
          <>
            <CTA href="#setup" brand lg>Set it up</CTA>
            <EditorialLink href={`${BASE}/integrations`}>Other ways to use Vraelis</EditorialLink>
          </>
        }
      />

      {/* 1 ── What the assistant can do, and what it cannot ── */}
      <section className="v6-sec" style={{ paddingTop: "clamp(12px,2vw,28px)" }}>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="One of four ways in"
              title="The same check, called by the assistant."
              lead="It is the check the console, the CLI and CI run: one sentence about the deployed app, a plan a person approves, a real browser on the live site, and one answer with the evidence. Over MCP the assistant gets three tools. Vraelis looks at the deployed app, not at the assistant's code."
            />
          </Reveal>
          <div style={{ ...wrapRow, marginTop: "clamp(28px,3vw,40px)" }}>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div className="v6-card" style={{ height: "100%" }}>
                <Signal state="go">Three tools</Signal>
                <ul style={{ listStyle: "none", margin: "18px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                  {TOOLS.map(([name, d]) => (
                    <li key={name}>
                      <span className="v6-mono" style={{ display: "block", fontSize: 13.5, color: "var(--ink)", fontWeight: 600 }}>{name}</span>
                      <span style={{ display: "block", marginTop: 4, fontSize: 14.5, lineHeight: 1.5, color: "var(--ink-2)" }}>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal style={{ flex: "1 1 320px", minWidth: 0 }} i={1}>
              <div className="v6-card" style={{ height: "100%" }}>
                <Kicker>What no tool can do</Kicker>
                <List items={CANNOT} tone="wait" />
                <p style={{ margin: "20px 0 0", paddingTop: 16, borderTop: "1px solid var(--line)", color: "var(--ink-3)", fontSize: 14, lineHeight: 1.55 }}>
                  Every run, a re-check included, is billed to your Vraelis account as one verification.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 2 ── The loop, in two lanes (GRAPHITE) ── */}
      <section className="v6-sec v6-dark" data-nav-dark>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="In the loop"
              title="From the assistant's done to a decision."
              lead="Two lanes. The assistant does the work and asks. Vraelis writes the plan, waits for your approval, runs it on the live app, and answers."
            />
          </Reveal>

          <Reveal media style={{ marginTop: "clamp(28px,3vw,44px)" }}>
            <div style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 16, padding: "clamp(6px,1.4vw,20px) clamp(16px,2.2vw,28px)" }}>
              {/* lane header (desktop only labels; each row also self-labels for narrow screens) */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--g-line)" }}>
                <span className="v6-mono" style={{ flex: "1 1 260px", minWidth: 0, fontSize: 11.5, color: "var(--g-fg-3)" }}>The assistant</span>
                <span className="v6-mono" style={{ flex: "1 1 260px", minWidth: 0, fontSize: 11.5, color: "var(--go-dk)" }}>Vraelis</span>
              </div>

              {LOOP.map((s) => (
                <div key={s.n} style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "clamp(16px,2vw,22px) 0", borderTop: "1px solid var(--g-line)" }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                      <span className="v6-mono" style={{ color: "var(--g-fg-3)", fontSize: 12.5, flex: "none" }}>{s.n}</span>
                      <span style={{ color: "var(--g-fg)", fontSize: 15.5, lineHeight: 1.45 }}>{s.agent}</span>
                    </div>
                  </div>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
                      <span style={{ color: "var(--g-fg)", fontSize: 15.5, lineHeight: 1.45 }}>{s.vraelis}</span>
                      {s.sig ? <Signal state={s.sig}>{s.tag}</Signal> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 3 ── The approval rule ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <div style={wrapRow}>
            <Reveal style={{ flex: "1 1 340px", minWidth: 0 }}>
              <SectionHead
                eyebrow="The approval rule"
                title="The assistant does the work. A person approves the check."
                lead="The first check of a claim needs a person to approve Vraelis's plan, with one click at the link the assistant hands you. No tool can approve a plan, and the API refuses every API key with plan_requires_human. After a fix, the assistant can re-check the same approved plan without another click: within 24 hours of the approval, at most 10 times, and only on the same site, meaning the same scheme and host."
              />
            </Reveal>
            <Reveal media style={{ flex: "1 1 340px", minWidth: 0 }} i={1}>
              <div className="v6-dark" data-nav-dark style={{ background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 16, padding: "clamp(20px,2.4vw,30px)", boxShadow: "var(--sh-md)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingBottom: 16, marginBottom: 18, borderBottom: "1px solid var(--g-line)" }}>
                  <span className="v6-kicker" style={{ color: "var(--g-fg-3)" }}>In ChatGPT and Claude</span>
                  <Signal state="wait">Waiting for approval</Signal>
                </div>
                <p style={{ margin: 0, color: "var(--g-fg-2)", fontSize: "1.05rem", fontStyle: "italic" }}>&ldquo;A signed-in user can cancel their plan from Billing and then sees Cancelled.&rdquo;</p>
                <p style={{ margin: "16px 0 0", color: "var(--g-fg-2)", fontSize: 14.5, lineHeight: 1.55 }}>
                  On the hosted server the answer also shows as a Vraelis card: the status, the claim, the requirements, what broke, and a Review and approve button that opens the approval page.
                </p>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--g-line)" }}>
                  <span className="v6-mono" style={{ color: "var(--g-fg-3)", fontSize: 12 }}>app.vraelis.com/review/rvp_3c9e26ef</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 4 ── Setup, recommended (GRAPHITE) ── the anchor the hero button points at. */}
      <section className="v6-sec v6-dark" id="setup" data-nav-dark>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Set it up"
              title="Install, sign in, run vraelis init."
              lead="Start here. vraelis init finds the assistants on your machine and writes their setup for you. The lines further down are the same setup by hand, for when you want to see it or init cannot reach an assistant."
            />
          </Reveal>
          <div style={{ marginTop: "clamp(28px,3.4vw,44px)", display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 24 }}>
            <Reveal><Code lang="bash" src={INIT} /></Reveal>
            <Reveal>
              <p className="v6-kicker" style={{ color: "var(--g-fg-3)", margin: 0 }}>What vraelis init does</p>
              <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "grid", gap: 10, maxWidth: "72ch" }}>
                {INIT_DOES.map((t) => (
                  <li key={t} style={{ display: "flex", gap: 11, alignItems: "flex-start", color: "var(--g-fg-2)", fontSize: 14.5, lineHeight: 1.55 }}>
                    <span aria-hidden style={{ marginTop: 7, width: 7, height: 7, borderRadius: 999, background: "var(--go-dk)", flex: "none" }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              {/* WINDOWS GETS ITS OWN LINE because the manual commands below do not work there as written.
                  The installer puts a vraelis.cmd on the PATH, and many assistants start an MCP server
                  without a shell, so they cannot launch a .cmd. init registers node and the script path
                  directly instead (serverLaunch in cli/vraelis.mjs). */}
              <p style={{ margin: "18px 0 0", color: "var(--wait-dk)", fontSize: 14, lineHeight: 1.6, maxWidth: "72ch" }}>
                On Windows, use vraelis init rather than the lines below. It registers node and the script path directly, because many assistants cannot launch the installer&rsquo;s vraelis.cmd.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 5 ── Setup by hand, per assistant ── */}
      <section className="v6-sec" id="manual">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="By hand"
              title="The same setup, one assistant at a time."
              lead="Assistants on your machine run the local server, vraelis mcp, which the CLI provides. ChatGPT and Claude on the web cannot start a local process, so they connect to the hosted server at https://vraelis.com/mcp and sign in with OAuth. Allow creates an API key named after the connector, which you can revoke any time under Developers in the console."
            />
          </Reveal>
          <div style={{ marginTop: "clamp(28px,3vw,40px)", display: "flex", flexDirection: "column" }}>
            {MANUAL.map((m, i) => (
              <Reveal key={m.name} i={Math.min(i, 3)}>
                <div style={{ ...wrapRow, paddingBlock: "clamp(20px,2.2vw,26px)", borderTop: "1px solid var(--line-2)" }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <h3 className="v6-dm" style={{ margin: 0 }}>{m.name}</h3>
                    <p className="v6-body" style={{ marginTop: 8, maxWidth: "46ch" }}>{m.note}</p>
                  </div>
                  <div style={{ flex: "1 1 380px", minWidth: 0 }}>
                    <Code lang={m.lang} src={m.src} />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 6 ── Close ── */}
      <hr className="v6-rule" />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap" style={{ textAlign: "center", maxWidth: 760 }}>
          <Reveal>
            <h2 className="v6-dl" style={{ marginInline: "auto" }}>Let the assistant ask. Let the live app answer.</h2>
            <p className="v6-lead" style={{ margin: "20px auto 30px", textAlign: "center" }}>
              The same check runs from the console, the CLI and CI. The assistant is one more way to start it, and the approval stays with a person.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <CTA brand lg>Open Vraelis</CTA>
              <CTA href={`${BASE}/integrations`} ghost lg>Other ways to use it</CTA>
            </div>
          </Reveal>
        </div>
      </section>

      <CopyScript />
    </>
  );
}
