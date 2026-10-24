import { CodeTabs, RiseWords } from "../_kit/client";
import { Button, Faq, PageHero, Section, TextLink, Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { PROMPTO, TAB_NAMES } from "../_kit/site";
import "./prompto.css";

// Vraelis Prompto, the public open-source product (founder, 2026-10-24: "it isn't a news article, it's a real product").
// Every statement here follows the public README at the 0.1.2 release; nothing is claimed beyond it.
export const metadata = v8meta({
  title: `${PROMPTO.name} | ${PROMPTO.headline.replace(/\.$/, "")}`,
  description: `${PROMPTO.line} Open source (Apache-2.0), alpha.`,
  path: "/prompto",
  tab: TAB_NAMES.prompto,
});

const LOCKS = [
  {
    cmd: "vraelis models",
    title: "AI model folders",
    line: "Pins the exact bytes of a model folder: safetensors, GGUF, configs, tokenizer.",
    points: [
      "Checks the folder's structure: truncated weights, bad GGUF headers, shard indexes naming missing shards, Git LFS pointers, invalid JSON.",
      "Names every file that changed, went missing or was added.",
      "Optionally checks a publisher's Sigstore signature against a signer you name (OpenSSF model_signing).",
    ],
  },
  {
    cmd: "vraelis agents",
    title: "Coding-agent add-ons",
    tag: "Preview",
    line: "Pins what an AI coding agent is allowed to load and launch.",
    points: [
      "MCP servers (.mcp.json, .cursor/mcp.json, .vscode/mcp.json).",
      "Claude Code settings, with hooks and permissions as separate, diffable entries.",
      "Skills, agents and commands, and the local scripts those configs launch.",
    ],
  },
];

const USE = `vraelis models lock   ./my-model        # writes ./my-model/modellock.json
vraelis models verify ./my-model        # Unchanged / Changed / Can't verify
vraelis models diff   approved.json new.json

vraelis agents lock   ./project         # writes ./project/addonlock.json
vraelis agents verify ./project`;

const INSTALL = `# Python 3.11 or newer. Check the wheel against SHA256SUMS from the same release.
pip install https://github.com/sansxelt/vraelis-cli/releases/download/v0.1.2/vraelis-0.1.2-py3-none-any.whl`;

const NOT = [
  "That a model, add-on or server is safe, correct or behaves as intended.",
  "Which model a device or server actually loads, or which tools a server exposes at run time. Nothing is launched.",
  "Who published the files, unless you run the optional signature check against a signer you chose.",
  "Changes inside packages fetched at launch (npx, uvx, docker). Floating or unpinned packages are flagged.",
];

export default function Prompto() {
  return (
    <div className="pr-page">
      <PageHero
        center
        eyebrow={PROMPTO.name}
        title={<RiseWords text={PROMPTO.headline} />}
        lead={PROMPTO.line}
        actions={<>
          <Button to={PROMPTO.repo} external size="lg" arrow>Get it on GitHub</Button>
          <Button to="/news/vraelis-cli-0-1-0" kind="soft" size="lg">Release notes</Button>
        </>}
      />

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head" style={{ maxWidth: 720 }}>
              <span className="v8-eyebrow">Two locks, one tool</span>
              <h2 className="v8-h2">Record exactly what you approved. Know the moment it changes.</h2>
              <p className="v8-lead">Every result is one of Unchanged, Changed or Can&apos;t verify, and says what it shows and what it does not. It runs offline, uses only the Python standard library, never loads a model and never launches anything.</p>
            </div>
            <div className="pr-locks">
              {LOCKS.map((l) => (
                <div key={l.cmd} className="pr-lock">
                  <code className="pr-lock__cmd">{l.cmd}</code>
                  <h3 className="v8-h3">{l.title}{l.tag ? <span className="pr-lock__tag">{l.tag}</span> : null}</h3>
                  <p className="v8-body">{l.line}</p>
                  <ul className="pr-list">{l.points.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-split-sec">
            <div className="v8-stack--lg">
              <div className="v8-head">
                <span className="v8-eyebrow">Use</span>
                <h2 className="v8-h2">Lock, then verify.</h2>
                <p className="v8-lead">Lock a folder once you approve it. Verify it before you load, ship or share it.</p>
              </div>
              <div className="v8-facts">
                <div><b>0</b><span>Unchanged</span></div>
                <div><b>1</b><span>Changed, with each change listed</span></div>
                <div><b>2</b><span>Can&apos;t verify</span></div>
              </div>
              <p className="v8-small">Secrets-named files (.env, keys, id_rsa and similar) are recorded as present only: never read, digested or measured.</p>
            </div>
            <CodeTabs tabs={[
              { id: "use", label: "Use", file: "terminal", code: USE },
              { id: "install", label: "Install", file: "terminal", code: INSTALL },
            ]} />
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head" style={{ maxWidth: 720 }}>
              <span className="v8-eyebrow">Scope</span>
              <h2 className="v8-h2">What a result does not show</h2>
            </div>
            <ul className="pr-list pr-list--not">{NOT.map((n) => <li key={n}>{n}</li>)}</ul>
            <p className="v8-small">Alpha. Testing so far was self-run, not independent, and no outside user has run it yet. The README names other tools that do overlapping jobs, several of them well. <TextLink to={PROMPTO.repo}>Read the README</TextLink></p>
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <Faq
            title={<>Questions about {PROMPTO.name}</>}
            items={[
              { q: `Is ${PROMPTO.name} free?`, a: "Yes. It is open source under the Apache-2.0 license." },
              { q: "Why is the command called vraelis?", a: `${PROMPTO.name} is the product name; the command you run is vraelis, as it was at the first release.` },
              { q: `How does it relate to Vraelis Contour?`, a: `${PROMPTO.name} records which files you approved, on your own machine. Vraelis Contour, in private development, compares an approved release with what a machine reports it is running.` },
              { q: "Is it on PyPI?", a: "Not yet. Install the wheel from the GitHub release and check it against SHA256SUMS." },
            ]}
          />
        </Wrap>
      </Section>
    </div>
  );
}
