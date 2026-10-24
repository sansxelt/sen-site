import { PROMPTO, promptoDownloadUrl } from "../../_kit/site";
import type { Page } from "./types";

// VRAELIS PROMPTO, under Products in the docs (founder, 2026-10-24: Prompto is a real product and needs real docs).
// Every statement comes from the public README and the --help output of the 0.1.2 release
// (sansxelt/vraelis-cli at v0.1.2). Nothing is claimed beyond them. Slugs avoid the retired "cli" page (410 Gone).

const UPDATED = "2026-10-24";
const S = "Vraelis Prompto";

export const PROMPTO_PAGES: Page[] = [
  {
    tab: "products", section: S, group: "", slug: "prompto", badge: "New",
    title: S, nav: "Overview",
    description: `${S} is an open-source tool that locks AI model folders and coding-agent add-ons to their exact bytes, offline, and tells you when anything changes.`,
    updated: UPDATED,
    blocks: [
      { t: "p", text: `${S} keeps a lockfile of exactly what you approved, then tells you later whether it is still the same. It runs offline, never loads a model and never launches anything. The command is \`vraelis\`.` },
      { t: "facts", rows: [
        ["Version", `${PROMPTO.version} (alpha), released ${PROMPTO.released}`],
        ["License", "Apache-2.0, open source"],
        ["Runs on", "Windows, macOS and Linux. Standalone downloads need nothing else; the Python package needs Python 3.11 or newer"],
        ["Network", "None. The optional `signature` check is the one command that contacts Sigstore"],
      ] },
      { t: "h2", text: "Two locks, one tool" },
      { t: "ul", items: [
        "`vraelis models` pins the exact bytes of an AI model folder (safetensors, GGUF, configs, tokenizer) and checks its structure. [Model folders](/docs/prompto-models)",
        "`vraelis agents` (preview) pins an AI coding agent's add-ons: MCP servers, Claude Code settings, skills, agents and commands, and the local scripts those configs launch. [Agent add-ons](/docs/prompto-agents)",
      ] },
      { t: "p", text: "Every result is one of Unchanged, Changed or Can't verify, and says what it shows and what it does not. Nothing here is a security assessment. [Results and exit codes](/docs/prompto-results)" },
      { t: "note", label: "Alpha", text: "Testing so far was self-run, not independent, and no outside user has run it yet. Interfaces and lockfile formats may change." },
      { t: "cards", items: [
        { to: "/docs/prompto-install", title: "Download and install", line: "Standalone downloads for every system, or pip." },
        { to: "/docs/prompto-models", title: "Model folders", line: "Lock, verify and diff a model folder." },
        { to: "/docs/prompto-agents", title: "Agent add-ons", line: "Lock and verify what a coding agent loads and launches." },
        { to: "/docs/prompto-limits", title: "Secrets and limits", line: "What is recorded, what never is, and what a result does not show." },
      ] },
    ],
  },
  {
    tab: "products", section: S, group: "Get started", slug: "prompto-install",
    title: "Download and install", nav: "Download and install",
    description: `Download ${S} for Windows, macOS or Linux, or install the Python package with pip.`,
    updated: UPDATED,
    blocks: [
      { t: "h2", text: "Download" },
      { t: "p", text: "Each download is one file with everything it needs, so you do not need Python. They are not yet code-signed, so Windows and macOS warn the first time you run one." },
      { t: "table", label: "Downloads", head: ["System", "File"], rows: PROMPTO.downloads.map((d) => [`${d.label} (${d.arch})`, `[${d.file}](${promptoDownloadUrl(d.file)})`]) },
      { t: "steps", items: [
        "Windows: rename the file to `vraelis.exe` and open a terminal in its folder. If Windows says it protected your PC, choose More info, then Run anyway.",
        "macOS: double-click the archive to unpack it, then open Terminal in that folder. The first time, right-click `vraelis`, choose Open, then Open again.",
        "Linux: `tar -xzf` the archive, then run `./vraelis` from that folder.",
        "Check it runs: `vraelis --version`.",
      ] },
      { t: "p", text: `Check each file against [SHA256SUMS-downloads](${promptoDownloadUrl("SHA256SUMS-downloads")}) from the same release. The downloads are built from the release's source and smoke-tested before they are attached.` },
      { t: "h2", text: "Install with pip" },
      { t: "p", text: "For developers who prefer the Python package: Python 3.11 or newer. It is not on PyPI yet, so install the wheel from the release and check it against `SHA256SUMS`." },
      { t: "code", label: "pip", lang: "bash", text: `pip install ${PROMPTO.repo}/releases/download/v${PROMPTO.version}/vraelis-${PROMPTO.version}-py3-none-any.whl
# with the optional signature check (adds model-signing 1.1.1):
pip install "vraelis[signature] @ ${PROMPTO.repo}/releases/download/v${PROMPTO.version}/vraelis-${PROMPTO.version}-py3-none-any.whl"` },
      { t: "note", label: "Running it safely", text: "Run the installed `vraelis` command, `python -I -m vraelis`, or from a checkout `PYTHONPATH=<checkout> python -P -m vraelis`. A plain `python -m vraelis` is refused, because Python would put the current folder first on its module path and a folder holding its own `vraelis` package could run code first." },
    ],
  },
  {
    tab: "products", section: S, group: "Use", slug: "prompto-models",
    title: "Model folders", nav: "Model folders",
    description: "Pin the exact bytes of an AI model folder with vraelis models, then verify it before you load, ship or share it.",
    updated: UPDATED,
    blocks: [
      { t: "p", text: "`vraelis models` records the exact bytes of every file in a model folder (safetensors, GGUF, configs, tokenizer) and checks the folder's structure: truncated weights, bad GGUF headers, shard indexes naming missing shards, Git LFS pointers and invalid JSON." },
      { t: "code", label: "Lock, then verify", lang: "bash", text: `vraelis models lock   ./my-model        # writes ./my-model/modellock.json
vraelis models verify ./my-model        # Unchanged / Changed / Can't verify
vraelis models diff   approved.json new.json
vraelis models signature ./my-model --identity <expected signer> --issuer <OIDC issuer>   # optional, contacts Sigstore` },
      { t: "table", label: "Options", head: ["Command", "Option", "What it does"], rows: [
        ["lock", "`--out OUT`", "Write the lockfile here instead of `<folder>/modellock.json`, leaving the folder untouched"],
        ["lock", "`--source SOURCE`", "A free-text note, for example `repo@revision`"],
        ["lock", "`--strict`", "Refuse to lock if the checker reports PROBLEM or ERROR (exit 3)"],
        ["verify", "`--lockfile LOCKFILE`", "Compare against this lockfile"],
        ["all", "`--json`", "Machine-readable output"],
      ] },
      { t: "p", text: "Verify names every file that changed, went missing or was added. The optional `signature` command checks a publisher's Sigstore signature against a signer you name, using OpenSSF model_signing 1.1.1; it is the only command that uses the network." },
    ],
  },
  {
    tab: "products", section: S, group: "Use", slug: "prompto-agents",
    title: "Agent add-ons", nav: "Agent add-ons",
    description: "Pin what an AI coding agent loads and launches with vraelis agents: MCP servers, Claude Code settings, skills and launched scripts.",
    updated: UPDATED,
    blocks: [
      { t: "note", label: "Preview", text: "`vraelis agents` is a preview. Its lockfile format may change." },
      { t: "p", text: "`vraelis agents` records an AI coding agent's add-on configuration without launching anything:" },
      { t: "ul", items: [
        "MCP servers (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`);",
        "Claude Code settings, with hooks and permissions as separate, diffable entries;",
        "skills, agents and commands;",
        "the local scripts those configs launch.",
      ] },
      { t: "code", label: "Lock, then verify", lang: "bash", text: `vraelis agents lock   ./project         # writes ./project/addonlock.json
vraelis agents verify ./project
vraelis agents diff   old.json new.json` },
      { t: "table", label: "Options", head: ["Option", "What it does"], rows: [
        ["`--config CONFIG`", "An extra MCP config file (repeatable)"],
        ["`--pin-env NAME`", "Also record this environment variable's value, in plain text (repeatable)"],
        ["`--pin-header NAME`", "Also record this header's value, in plain text (repeatable)"],
        ["`--out OUT`", "Write the lockfile here instead of `<folder>/addonlock.json` (lock)"],
        ["`--strict`", "Refuse to lock if any package is unpinned or floating (exit 3)"],
        ["`--lockfile LOCKFILE`", "Compare against this lockfile (verify)"],
        ["`--json`", "Machine-readable output"],
      ] },
      { t: "p", text: "Packages fetched at launch (`npx`, `uvx`, `docker`) are flagged when they are floating or unpinned; changes inside them are not seen. [Secrets and limits](/docs/prompto-limits)" },
    ],
  },
  {
    tab: "products", section: S, group: "Reference", slug: "prompto-results",
    title: "Results and exit codes", nav: "Results and exit codes",
    description: "What Unchanged, Changed and Can't verify mean in Vraelis Prompto, and the exit code for each.",
    updated: UPDATED,
    blocks: [
      { t: "table", label: "Exit codes", head: ["Exit code", "Result", "Meaning"], rows: [
        ["0", "Unchanged", "Everything that was checked matches the lockfile"],
        ["1", "Changed", "Something differs; each change is listed"],
        ["2", "Can't verify", "A missing or invalid lockfile, an unsafe path or link, an unreadable file, or any internal error"],
        ["3", "Lock refused", "`lock --strict` refused to write a lockfile"],
      ] },
      { t: "p", text: "Can't verify is kept separate from Changed: it means the tool could not establish a result, not that something changed. Every result also says what it shows and what it does not." },
      { t: "p", text: "Files compared for presence only (secrets-named files) are listed under \"Not checked (presence only)\" in `lock`, `verify` and `diff`, and a result claims byte identity only for files that were digested." },
    ],
  },
  {
    tab: "products", section: S, group: "Reference", slug: "prompto-limits",
    title: "Secrets and limits", nav: "Secrets and limits",
    description: "What Vraelis Prompto records, what it never reads, and what a result does not show.",
    updated: UPDATED,
    blocks: [
      { t: "h2", text: "Secrets" },
      { t: "ul", items: [
        "`vraelis models` records file names, sizes and digests only. A file named like a secrets file (`.env`, keys, `id_rsa`, `.npmrc`, ...) is recorded as present only: never read, digested or measured, so its content is not checked.",
        "`vraelis agents` never records environment or header values unless you pin them. Pinned values are stored in plain text, by your choice.",
        "Some agent files are recorded as structure only (keys, booleans, numbers, env and header names, and values you pinned): `.claude/settings.local.json`, user-level `--config` files, and any project config or settings file that the project's own ignore rules exclude.",
        "Ignore rules are read from `.git/info/exclude` and the `.gitignore` files inside the project, following git's own matching rules. A file counts as ignored if git would ignore it with either case-sensitive or case-insensitive matching, and any pattern it cannot parse makes the file count as private.",
        "In shared project files, credentials it recognises are redacted on a best-effort basis. Read a lockfile before you commit or share it.",
      ] },
      { t: "h2", text: "What a result does not show" },
      { t: "ul", items: [
        "That a model, add-on or server is safe, correct or behaves as intended.",
        "Which model a device or server actually loads, or which tools a server exposes at run time. Nothing is launched.",
        "Who published the files, unless you run the optional signature check against a signer you chose.",
        "Changes inside packages fetched at launch (`npx`, `uvx`, `docker`). Floating or unpinned packages are flagged.",
        "Changes in files a launched script itself imports or loads.",
      ] },
      { t: "h2", text: "How it was tested" },
      { t: "p", text: "Testing was self-run, not independent, and no outside user has run it yet. The model checks were tried on three blind sets of real broken releases; the most recent matched 23 of 24 predictions and detected 5 of 22 runnable defects, with no false alarms on 15 healthy models. It is a narrow structural gate: most real breakage (wrong config values, templates, tokenizers) is outside what it checks. The agent checks were tried on four blind sets of real configuration changes from 61 public repositories; on the most recent, 19 of 22 changes were detected with no false alarms." },
      { t: "p", text: `Other tools do overlapping jobs, several of them well; the [README](${PROMPTO.repo}) lists them.` },
    ],
  },
];
