import { photographHero } from "../_content/photography";
import type { Metadata } from "next";
import Link from "next/link";
import { AltRows, Band, CrossLinks, FeatureCard, FeatureGrid, FrameHero } from "../_system/kit";
import { SectionHead } from "../_system/ui";
import { ClosingScene } from "../_system/close";
import { Code, CopyScript } from "../_system/code";
import { LimitsLine, ProductPanel } from "../_system/hero-asides";
import { v6meta } from "../_system/meta";
import { STRIKE } from "../_content/strike";
import { sectorBySlug } from "../_content/sectors";
import { MCP_TOOLS, renderApproval } from "@/lib/mcp/tools";
import { V6_BASE } from "@/lib/v6-routes";
import "./agents.css";

// AI ASSISTANTS, at /agents (plan C /agents, template T1, revised 2026-10-02).
//
// THE PAGE `vraelis init` LINKS TO WHEN IT FINISHES, so it opens on setup, not on a thesis. It is one way in
// among four (founder, 2026-09-28): Vraelis checks a deployed web app against one sentence for anyone who ships
// one, and an AI assistant is one of the ways to start that check, beside the console, the CLI and CI. Nothing
// here says the product is for assistants, and no assistant is claimed as tested or endorsed.
//
// EVERY PANEL IS PRODUCT TEXT, READ RATHER THAN RETYPED:
//   hero          the three tools by name and title, lib/mcp/tools.ts (AgentsAside)
//   #setup        the CLI's own commands (cli/install.sh and install.ps1, cli/vraelis.mjs: login, init, verify)
//   #how 01       a vraelis_verify call, with the example sentence the tool's own description gives
//   #how 02       renderApproval(), what the tool tells the agent while a plan waits, with its fields left blank
//   #how 03       the repair prompt of run vrf_51705517 on Larkspur, a simulated mission console Vraelis built
//                 itself (_content/strike.ts), cropped, never edited
// The per-assistant setup lines moved to /docs/ai-assistants (one anchor per assistant); #manual is the index.
// The re-check limits are lib/preflight/recheck.ts: 24 hours from the approval, 10 re-checks, the same host.
//
// The approval rule is said once in pitch copy (the hero sub, plan 0.3). The panels, the second row's steps and
// the cards say what the tools do, which is where it may appear again.

export const metadata: Metadata = v6meta({
  title: "AI assistants",
  description:
    "Let your coding agent ask Vraelis to check a change on the live app before it says done. Setup for Claude Code, Codex, Gemini CLI, GitHub Copilot, Cursor, Trae, ChatGPT, Claude and any MCP client.",
  path: "/agents",
  ogTitle: "Vraelis in your AI assistant",
});

const BASE = V6_BASE;

/* The setup, as the CLI runs it. Commands only: nothing here shows output the CLI did not print. */
const SETUP = `# Install the CLI. macOS and Linux:
curl -fsS https://vraelis.com/install | sh
# Windows (PowerShell):
irm https://vraelis.com/install.ps1 | iex

# Sign in once. Paste a key with "Launch runs" access, created at app.vraelis.com/developers.
vraelis login

# Set up every assistant found on this machine, or name them:
# claude, codex, gemini, copilot, cursor, trae, all
vraelis init

# Or check a change yourself. Example:
vraelis verify \\
  --url https://staging.example.com \\
  --claim "A signed-in user can cancel their plan from Billing and then sees Cancelled" \\
  --wait`;

/* The example sentence is the one vraelis_verify's own description gives, read from it so the two never differ. */
const EXAMPLE_CLAIM =
  /for example "([^"]+)"/.exec(MCP_TOOLS[0].description)?.[1] ?? "A signed-in user can cancel their plan from Billing and then sees Cancelled";

/* What the tool tells the agent while a plan waits for a person: the real renderApproval(), with each field left
   as a named blank, so the panel shows the wording without inventing a check. */
const WAITING = renderApproval({
  id: "<job id>",
  claim: "<the sentence>",
  url: "<the address>",
  approveUrl: "<the approval link>",
  requirements: ["<each requirement the sentence implies>"],
  flows: [{ name: "<each journey>" }],
});

/* The ten assistants the setup guide covers, each with its own anchor on /docs/ai-assistants. Local means the
   assistant starts `vraelis mcp` on this machine; hosted means it connects to https://vraelis.com/mcp with OAuth
   (the setup lines in cli/vraelis.mjs and the guide). */
const ASSISTANTS: { slug: string; name: string; via: "Local server" | "Hosted server" | "Local or hosted" }[] = [
  { slug: "claude-code", name: "Claude Code", via: "Local server" },
  { slug: "codex", name: "Codex", via: "Local server" },
  { slug: "gemini-cli", name: "Gemini CLI", via: "Local server" },
  { slug: "copilot-in-vs-code", name: "GitHub Copilot in VS Code", via: "Local server" },
  { slug: "copilot-cli", name: "GitHub Copilot CLI", via: "Local server" },
  { slug: "cursor", name: "Cursor", via: "Local server" },
  { slug: "trae", name: "Trae", via: "Local server" },
  { slug: "chatgpt", name: "ChatGPT", via: "Hosted server" },
  { slug: "claude", name: "Claude, on the web and desktop", via: "Hosted server" },
  { slug: "any-mcp-client", name: "Any MCP client", via: "Local or hosted" },
];

const run = STRIKE.run!;
const aiBuilt = sectorBySlug("ai-built-apps")!;

function TheCall() {
  return (
    <ProductPanel left="vraelis_verify" right="Example call">
      <dl className="ag-call">
        <div>
          <dt>deployment_url</dt>
          <dd data-no-translate>&quot;https://staging.example.com&quot;</dd>
        </div>
        <div>
          <dt>claim</dt>
          <dd data-no-translate>&quot;{EXAMPLE_CLAIM}&quot;</dd>
        </div>
      </dl>
    </ProductPanel>
  );
}

function TheWait() {
  return (
    <ProductPanel
      left="vraelis_verify"
      right="What the agent is told"
      caption="The tool's own words while a plan waits. Each blank is filled in with the check's own details."
    >
      <pre>{WAITING}</pre>
    </ProductPanel>
  );
}

function TheAnswer() {
  return (
    <ProductPanel
      left={run.id.slice(0, 12)}
      right={<>Repair prompt, recorded <span data-no-translate>{run.recorded}</span></>}
      caption="From a check of Larkspur, a simulated mission console Vraelis built itself."
      crop={380}
    >
      <pre>{run.repairPrompt}</pre>
    </ProductPanel>
  );
}

export default function Agents() {
  return (
    <>
      <FrameHero
        eyebrow="AI assistants"
        title="Let your coding agent ask for a check."
        sub="Claude Code, Codex, Cursor, Copilot and any MCP client can request a check of the live app before they say done. Only a person can approve the plan."
        primary={{ label: "Set it up", href: "#setup" }}
        secondary={{ label: "Read the setup guide", href: `${BASE}/docs/ai-assistants` }}
        {...photographHero("client")}
      />

      {/* ── Setup: the showcase. The commands, with Copy, beside what they set up. ── */}
      <section className="v6-sec" id="setup">
        <div className="v6-wrap">
          <SectionHead
            eyebrow="Set it up"
            title="Install the CLI, sign in, and set up your assistants."
            lead="One command finds the assistants on this machine and writes their setup. Restart an assistant and its three tools are there."
          />
          <div className="ag-setup">
            <div className="ag-setup__code"><Code lang="bash" src={SETUP} /></div>
            <dl className="ag-facts">
              <div className="ag-fact">
                <dt>Local server</dt>
                <dd><code className="ag-fact__v">vraelis mcp</code></dd>
                <dd>For assistants on this machine. The CLI provides it, and the setup command adds it to their settings.</dd>
              </div>
              <div className="ag-fact">
                <dt>Hosted server</dt>
                <dd><code className="ag-fact__v">https://vraelis.com/mcp</code></dd>
                <dd>For ChatGPT and Claude on the web. You sign in to Vraelis with OAuth and click Allow.</dd>
              </div>
              <div className="ag-fact">
                <dt>Project rule</dt>
                <dd><code className="ag-fact__v">AGENTS.md</code></dd>
                <dd>The setup command adds a short rule to the project: check the live app before saying it is done.</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ── How it works: ask, approve, answer. Each row's panel is the product's own words. ── */}
      <section className="v6-sec" id="how">
        <div className="v6-wrap">
          <SectionHead
            eyebrow="How it works"
            title="From a finished change to an answer."
            lead="Three steps, in the order they happen. Vraelis looks at the deployed app, not at the agent's code."
          />
          <AltRows
            id="loop"
            rows={[
              {
                id: "asks",
                title: "The agent asks",
                body: "When a change is deployed, the agent calls the verify tool with the live address and one sentence about what should now work. Localhost and private addresses are refused before anything runs.",
                media: <TheCall />,
              },
              {
                id: "approves",
                title: "A person approves",
                body: "Vraelis writes a plan: the requirements the sentence implies and the browser steps that would prove them. The agent hands you the link. It cannot approve the plan, and an API key cannot either.",
                media: <TheWait />,
              },
              {
                id: "answer",
                title: "The answer goes back",
                body: "The agent reads the answer with its evidence. When the check finds a problem, it gets what was expected, what the app showed and a repair prompt, then re-checks the same plan after a fix.",
                media: <TheAnswer />,
                link: { label: "Read the whole record", href: `${BASE}/use-cases/only-the-confirmed-target` },
              },
            ]}
          />
        </div>
      </section>

      {/* ── The rules that come with the tools: the page's one Band. ── */}
      <Band id="rules">
        <SectionHead eyebrow="With the tools" title="The rules that ship with the tools." />
        <FeatureGrid span={4}>
          <FeatureCard
            label="01"
            title="Re-checks have a window."
            body="After a fix, the same approved plan runs again within 24 hours of the approval, up to 10 times, on the same site. A preview URL is a different site."
          />
          <FeatureCard
            label="02"
            title="Done means checked."
            body="The tools tell the agent to say a change works only when the check did what the sentence says. The setup command writes the same rule into the project."
          />
          <FeatureCard
            label="03"
            title="Every run is kept."
            body="Each run, a re-check included, counts as one verification on your account and keeps its steps and screenshots. A later run never overwrites it."
          />
        </FeatureGrid>
      </Band>

      {/* ── Setup by hand: the index into the guide, one anchor per assistant. ── */}
      <section className="v6-sec" id="manual">
        <div className="v6-wrap">
          <SectionHead
            eyebrow="Setup by hand"
            title="Each assistant, step by step."
            lead="One command covers most of them. The setup guide has the exact lines for each assistant, for when you want to add one by hand."
          />
          <ul className="ag-names" role="list">
            {ASSISTANTS.map((a) => (
              <li key={a.slug}>
                <Link className="ag-name" href={`${BASE}/docs/ai-assistants#${a.slug}`}>
                  <span className="ag-name__t">{a.name}</span>
                  <span className="ag-name__via">{a.via}</span>
                  <span className="ag-name__go" aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <LimitsLine text="Vraelis looks at the deployed app, not at the agent's code." />

      <section className="v6-sec ag-related">
        <div className="v6-wrap">
          {/* Every card has its 16:10 picture, as on /platform, /limitations and the sector pages, and each line is
              the one the site uses for that target. The setup guide's card is public/site/product/CREDITS.md's. */}
          <CrossLinks
            links={[
              { title: aiBuilt.label, body: aiBuilt.line, href: aiBuilt.href, image: aiBuilt.pics.card1610 },
              { title: "Developers", body: "The CLI, the API and CI.", href: `${BASE}/developers`, image: "/site/photography/agent.jpg" },
              { title: "The setup guide", body: "Every assistant, line by line.", href: `${BASE}/docs/ai-assistants`, image: "/site/photography/client.jpg" },
            ]}
          />
        </div>
      </section>

      <ClosingScene title="Let the assistant ask. Let the live app answer." />
      <CopyScript />
    </>
  );
}
