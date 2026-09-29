#!/usr/bin/env node
// vraelis: check what your coding agent says it built, on the live app, in a real browser.
//
//   vraelis verify --url https://example.com --claim "Checkout grants Pro access" --wait
//
// This is the thinnest useful client for POST /v1/verifications. It deliberately contains no product logic:
// every decision, every gate, and every piece of evidence comes from the API. If this file ever starts
// deciding things, that is a bug.
//
// EXIT CODES ARE THE INTERFACE. A CLI in a pipeline is read by `if` statements far more often than by
// people, so the codes are the primary output and everything else is decoration:
//
//   0  verified          the claim held, with evidence
//   1  failed            the claim did not hold; --repair-prompt tells you what to do
//   2  blocked           no verdict was reached, or the tool could not run at all
//
// 2 covers "unable to verify" AND usage/auth/network errors on purpose. A release gate should treat "I
// could not check" exactly like "I could not reach a verdict": in both cases you do not know, and shipping
// on 2 is a decision the caller has to make deliberately rather than inherit from an exit code that looks
// like success.

const EXIT_VERIFIED = 0;
const EXIT_FAILED = 1;
const EXIT_BLOCKED = 2;

// The public API host. Named once: verify, login and status all resolve against it, and a literal
// repeated in three places is two places to forget when it moves.
const DEFAULT_BASE = "https://vraelis.com";

// ── WHERE THE KEY COMES FROM ─────────────────────────────────────────────────────────────────────────
//
// Three sources, in a fixed order, and the order is the contract:
//
//   --api-key <k>        an explicit flag beats everything, because someone typed it on purpose
//   VRAELIS_API_KEY      the environment beats stored config, so CI never inherits whatever a developer
//                        happened to log in with on that machine, and a stored key can never quietly
//                        override a pipeline secret
//   ~/.vraelis/config.json   what `vraelis login` wrote
//
// The middle rule is the one that matters. A build machine that has both must use the environment: it is
// the one the pipeline owns, and a login left behind by a person is exactly the credential you do not want
// spending an organisation's balance.
import { homedir } from "node:os";
import { join, dirname, delimiter } from "node:path";
import { readFileSync as readFile, writeFileSync as writeFile, mkdirSync, chmodSync, unlinkSync, existsSync as fileExists, renameSync, realpathSync } from "node:fs";
import { spawn as spawnChild, spawnSync } from "node:child_process";

const CLI_VERSION = "0.3.0";

const CONFIG_DIR = () => join(homedir(), ".vraelis");
const CONFIG_PATH = () => join(CONFIG_DIR(), "config.json");

function readConfig() {
  try { return JSON.parse(readFile(CONFIG_PATH(), "utf8")); } catch { return {}; }
}

// ATOMIC, because a config file half-written by an interrupted process is a credential store that reads as
// corrupt on next launch. Written to a temp file beside the target and renamed, which is atomic within a
// filesystem, so a reader sees either the old file or the new one and never a partial.
//
// 0600 on the file and 0700 on the directory where the platform honours them. Windows ignores chmod, hence
// "where supported" rather than a promise: a credential file on Windows is protected by the user profile
// ACL, not by these bits, and claiming otherwise would be worse than saying nothing.
function writeConfig(next) {
  const dir = CONFIG_DIR();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { chmodSync(dir, 0o700); } catch { /* not supported here */ }
  const tmp = join(dir, `.config.${process.pid}.tmp`);
  writeFile(tmp, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
  try { chmodSync(tmp, 0o600); } catch { /* not supported here */ }
  renameSync(tmp, CONFIG_PATH());
}

/** Where the key came from, so `status` can say and `logout` can be honest about what it cannot remove. */
function resolveKey(args) {
  if (args && args["api-key"]) return { key: args["api-key"], source: "flag" };
  if (process.env.VRAELIS_API_KEY) return { key: process.env.VRAELIS_API_KEY, source: "env" };
  const stored = readConfig().apiKey;
  if (stored) return { key: stored, source: "config" };
  return { key: "", source: "none" };
}

/** Never the whole key. Enough to recognise which one it is, not enough to use. */
function mask(key) {
  if (!key) return "";
  const tail = key.slice(-4);
  const head = key.startsWith("vr_live_") ? "vr_live_" : key.slice(0, 3);
  return `${head}...${tail}`;
}

/** Read one line without echoing it. Falls back to a plain read when stdin is not a terminal, so
 *  `echo "$KEY" | vraelis login` works for automation and says nothing about hiding what was piped. */
function promptSecret(label) {
  return new Promise((resolve) => {
    const input = process.stdin;
    if (!input.isTTY) {
      let buf = "";
      input.setEncoding("utf8");
      input.on("data", (d) => { buf += d; });
      input.on("end", () => resolve(buf.trim()));
      return;
    }
    process.stderr.write(label);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let buf = "";
    let done = false;

    const cleanup = () => { input.removeListener("data", onData); input.setRawMode(false); input.pause(); };
    const finish = (value) => { if (done) return; done = true; cleanup(); process.stderr.write("\n"); resolve(value); };

    // CHARACTER BY CHARACTER THROUGH THE CHUNK, not once per event.
    //
    // In raw mode one data event carries whatever arrived together, and a PASTE arrives as a single
    // chunk: "vr_live_abc123\r", the key and the return in the same string. Comparing the whole chunk
    // against "\r" therefore never matched, so Enter did nothing and the carriage return was appended to
    // the key. Typing slowly worked and pasting did not, which is the wrong way round for a credential
    // nobody types by hand.
    const onData = (chunk) => {
      for (const ch of String(chunk)) {
        if (done) return;
        // Ctrl-C and Ctrl-D leave nothing behind rather than half a key.
        if (ch === "\u0003" || ch === "\u0004") { finish(""); return; }
        if (ch === "\r" || ch === "\n") { finish(buf.trim()); return; }
        if (ch === "\u007f" || ch === "\b") {
          if (buf.length) { buf = buf.slice(0, -1); process.stderr.write("\b \b"); }
          continue;
        }
        // Control characters are not part of a key and must not be swallowed into one. An arrow key sends
        // an escape sequence; appending it would store a credential that never authenticates, with no
        // clue as to why.
        if (ch < " ") continue;
        buf += ch;
        // ONE DOT PER CHARACTER. The key is never echoed, but echoing NOTHING is why this looked broken:
        // a prompt that does not move while you type reads as a hung program, so people paste again,
        // press Enter twice, or kill it. A dot is not the key, and it is proof of life.
        process.stderr.write(dim("."));
      }
    };
    input.on("data", onData);
  });
}

// THE HELP SCREEN, AS A FUNCTION RATHER THAN A CONSTANT.
//
// It has to render AFTER the presentation helpers below have decided whether colour is allowed, and a
// template literal evaluated at module load cannot. Hoisting makes the call site read the same.
//
// The main invocation first, then the loop around it (re-check, result), then plugging it into coding
// assistants, then what you can pass, then the three integers a pipeline actually reads.
function usage() {
  return [
    "",
    `  ${bold("VRAELIS")}  ${dim("check what your coding agent says it built, on the live app")}`,
    heading("  Usage"),
    `    ${cyan("vraelis verify")} --url URL --claim "WHAT SHOULD NOW WORK" --wait`,
    heading("  Commands"),
    row("verify", "Check a claim against a deployment. A person approves the plan first.", 24),
    row("recheck VRF_ID", "After a fix, run the same approved check again. No new approval", 24),
    cont("for 24 hours after the original one."),
    row("result VRF_ID", "Show a verification's decision.", 24),
    row("init [ASSISTANT]", "Plug Vraelis into Claude Code, Codex, Gemini CLI, Copilot, Cursor", 24),
    cont("or Trae, and tell them to verify before saying done."),
    row("mcp", "Run the MCP server the assistants talk to. They start it for you.", 24),
    row("login", "Store an API key in ~/.vraelis/config.json.", 24),
    row("logout", "Forget the stored key.", 24),
    row("status", "Show which key is in use, where it came from, and whether it works.", 24),
    heading("  Required for verify"),
    row("--url URL", "The deployment to verify. Must be https and publicly reachable.", 24),
    row("--claim TEXT", "What should be true, in a sentence. The outcome, not the steps.", 24),
    cont('e.g. "A signed-in user can cancel their plan from Billing and then sees Cancelled"'),
    heading("  Options"),
    row("--wait", "Wait for the verdict. Without it, prints the id and exits 0 at once.", 24),
    row("--no-open", "Print the approval link without opening a browser.", 24),
    row("--json", "Emit one JSON object instead of human output. For CI and agents.", 24),
    row("--repair-prompt", "On failure, print ONLY the repair prompt, ready for a coding agent.", 24),
    row("--timeout SECONDS", "How long --wait waits before giving up. Default 900.", 24),
    row("--idempotency-key KEY", "Reuse a key so a retry returns the original verification", 24),
    cont("instead of starting, and paying for, a second one."),
    row("--api-key KEY", "Overrides VRAELIS_API_KEY.", 24),
    row("--base-url URL", "Overrides VRAELIS_BASE_URL. Default https://vraelis.com", 24),
    heading("  Environment"),
    row("VRAELIS_API_KEY", "Required. Create one with \"Launch runs\" access at", 24),
    cont("https://app.vraelis.com/developers"),
    row("VRAELIS_BASE_URL", "Optional.", 24),
    heading("  Exit codes"),
    `    ${green("0")}  ${"verified".padEnd(20)}${dim("the claim held, with evidence")}`,
    `    ${red("1")}  ${"failed".padEnd(20)}${dim("the claim did not hold")}`,
    `    ${amber("2")}  ${"blocked".padEnd(20)}${dim("no verdict was reached, or it could not run")}`,
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const key = a.slice(2);
    // Flags take no value; everything else consumes the next token.
    if (["wait", "json", "repair-prompt", "help", "version", "no-open", "print", "no-notes"].includes(key)) { out[key] = true; continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) { out[key] = ""; continue; }
    out[key] = next; i++;
  }
  return out;
}

// All human output goes to stderr so that stdout carries only the machine payload. That way
// `vraelis verify --json | jq` works, and so does `vraelis verify --repair-prompt | pbcopy`, without the
// caller having to strip progress lines.
const say = (s = "") => process.stderr.write(s + "\n");

// ── HOW IT LOOKS ─────────────────────────────────────────────────────────────────────────────────────
//
// Everything a person reads goes to STDERR, which is why any of this is safe: stdout carries the JSON and
// the repair prompt and nothing else, so styling can never contaminate a pipe.
//
// COLOUR IS OFF UNLESS SOMEONE IS WATCHING. Three conditions, and all three matter:
//
//   not a TTY      the output is being redirected to a file or captured by CI, where escape codes are
//                  noise that ends up in a build log nobody can read.
//   NO_COLOR       the cross-tool convention (no-color.org). Honouring it is one line and not honouring
//                  it is the kind of arrogance that gets a tool uninstalled.
//   TERM=dumb      emacs shells and some CI runners, which render escapes literally.
//
// The tests run this as a subprocess with piped stdio, so they see plain text, which is the point: the
// shape of the output is asserted, and the decoration cannot be what makes an assertion pass.
// FORCE_COLOR overrides the lot, because "not a TTY" is a guess and sometimes a wrong one. GitHub Actions
// and most modern CI render escapes perfectly well while presenting a pipe, so a caller who knows that has
// to be able to say so. NO_COLOR still wins over it: an explicit request for less always beats an explicit
// request for more.
const FORCED = process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== "0";
const PLAIN = process.env.NO_COLOR !== undefined
  || (!FORCED && (!process.stderr.isTTY || process.env.TERM === "dumb"));
const sgr = (open) => (s) => (PLAIN ? String(s) : `\x1b[${open}m${s}\x1b[0m`);
const bold = sgr("1");
const dim = sgr("2");
const green = sgr("32");
const red = sgr("31");
const amber = sgr("33");
const cyan = sgr("36");
// Reversed video for the verdict, so it reads as a stamp rather than a word. Falls back to plain text
// under PLAIN, where the word alone still carries it.
const stamp = { verified: sgr("1;42;30"), failed: sgr("1;41;37"), blocked: sgr("1;43;30") };

/** A two-column row, so flags and their descriptions line up like a table rather than a paragraph. */
const row = (left, right, width = 22) =>
  `    ${cyan(left.padEnd(width))}${right ? dim(right) : ""}`;

/** A continuation of the row above, aligned under its description rather than under its flag. */
const cont = (text, width = 24) => `    ${" ".repeat(width)}${dim(text)}`;

/** A section heading. Quiet, because the content is the thing being read. */
const heading = (s) => `\n${bold(s)}`;

// A SPINNER, BUT ONLY FOR A HUMAN. Under PLAIN this writes nothing at all: a CI log does not want 900
// seconds of animation frames, and the previous version's stream of dots was exactly that in a build
// artefact. It also clears its own line before anything else prints, so a verdict never lands with a
// half-drawn spinner in front of it.
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
function spinner(label) {
  if (PLAIN) return { stop() {} };
  let i = 0;
  const started = Date.now();
  const tick = () => {
    const secs = Math.round((Date.now() - started) / 1000);
    process.stderr.write(`\r  ${cyan(FRAMES[i++ % FRAMES.length])} ${label} ${dim(`${secs}s`)}\x1b[K`);
  };
  tick();
  const t = setInterval(tick, 80);
  // unref so a hung interval can never be the reason the process refuses to exit.
  if (typeof t.unref === "function") t.unref();
  return { stop() { clearInterval(t); process.stderr.write("\r\x1b[K"); } };
}

// A sentinel rather than process.exit(). process.exit() terminates while writes to a PIPE are still
// buffered, which on Windows crashes outright (0xC0000409) and everywhere else silently truncates the
// output. Both are unacceptable for a tool whose whole job is to be piped: losing the repair prompt because
// the process raced its own stdout is the exact failure this CLI exists to prevent elsewhere.
//
// So: set the code, unwind to main, and let Node exit on its own once the streams have drained.
class Exit extends Error { constructor(code) { super("exit"); this.code = code; } }

function fail(message, code = EXIT_BLOCKED) {
  say(message);
  throw new Exit(code);
}

// STATUS 0 MEANS THE NETWORK, NOT THE API. It used to throw straight out of here, which was right for a
// one-shot command and wrong for everything that waits: one dropped poll in a fifteen-minute wait ended the
// wait, and inside the MCP server it would have ended the server. So a network failure is now a value, and
// each caller decides. A one-shot request still refuses (see mustReach); a poll just tries again.
async function api(base, path, { key, method = "GET", body, idem } = {}) {
  const headers = { "x-api-key": key };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (idem) headers["idempotency-key"] = idem;
  let res;
  try {
    res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    // A network failure is not a verdict. Never let it look like one.
    return { status: 0, json: null, text: `Could not reach Vraelis at ${base}: ${e?.message ?? e}` };
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* handled by the caller via `json === null` */ }
  return { status: res.status, json, text };
}

/** For a request that has to land: a network failure refuses the command, exit 2. */
function mustReach(r) {
  if (r.status === 0) fail(r.text);
  return r;
}

function errorMessage(payload, text, status) {
  if (status === 0) return text;
  // The v1 envelope is { error: { code, message } }; the internal routes use { error, message }.
  const e = payload?.error;
  if (e && typeof e === "object") return `${e.message ?? e.code ?? "Request failed"}`;
  if (typeof e === "string") return payload?.message ?? e;
  return `Request failed with status ${status}${text ? `: ${text.slice(0, 200)}` : ""}`;
}

/** The API host and key every command resolves the same way. */
function connection(args = {}) {
  const base = (args["base-url"] || process.env.VRAELIS_BASE_URL || readConfig().baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
  const { key } = resolveKey(args);
  return { base, key };
}

// /developers, not /api. /api was the console's name for this page until it was renamed; it still
// redirects, so the old text worked and cost every reader an extra hop to a page with a different name at
// the top than the one they were sent to.
const NO_KEY = `No API key. Run "vraelis login", set VRAELIS_API_KEY, or pass --api-key.\nCreate one with "Launch runs" access at https://app.vraelis.com/developers`;

// ── THE SHARED STEPS ─────────────────────────────────────────────────────────────────────────────────
//
// verify, recheck and the MCP server all walk the same four steps: submit a claim, wait for a person to
// approve the plan, run exactly that plan, wait for the decision. Each step returns a value instead of
// printing or exiting, so the terminal and the MCP server can each render it their own way.

const APPROVAL_POLL_MS = 3000;
const RESULT_POLL_MS = 5000;

/** POST the claim. Returns the plan waiting for a person, a verification already running (an idempotent
 *  replay), or an error carrying the API's own code and message. */
async function submitClaim(conn, url, claim, idem) {
  const r = await api(conn.base, "/v1/verifications", {
    key: conn.key, method: "POST", idem,
    body: { deployment_url: url, claim },
  });
  const j = r.json ?? {};
  if (j.state === "review_required" && j.reviewed_plan_id) {
    return { kind: "review", planId: j.reviewed_plan_id, approveUrl: j.approve_url ?? null, expiresAt: j.reviewed_plan_expires_at ?? null, requirements: j.requirements ?? [] };
  }
  if (j.verification_id) return { kind: "running", vrf: j.verification_id, requirements: j.requirements ?? [], payload: j };
  return { kind: "error", status: r.status, code: typeof j.error === "object" ? j.error?.code : j.error, message: errorMessage(r.json, r.text, r.status), payload: j };
}

/** Wait until a person approves the plan, it expires, or the deadline passes. A network blip is retried. */
async function waitForApproval(conn, planId, deadline, stopped = () => false) {
  while (Date.now() < deadline && !stopped()) {
    const r = await api(conn.base, `/v1/verifications/plans/${encodeURIComponent(planId)}`, { key: conn.key });
    if (r.status === 401 || r.status === 403 || r.status === 404) return { kind: "error", status: r.status, message: errorMessage(r.json, r.text, r.status) };
    const p = r.json;
    if (p?.approval_state === "approved") return { kind: "approved", plan: p };
    if (p?.execution_state && p.execution_state !== "unconsumed") return { kind: "error", status: 409, message: "That plan was already used for a verification." };
    if (p?.expires_at && new Date(p.expires_at).getTime() <= Date.now()) return { kind: "expired" };
    await sleep(APPROVAL_POLL_MS);
  }
  return { kind: "timeout" };
}

/** Run exactly the approved plan. The idempotency key is bound to the plan, so a retry cannot pay twice. */
async function runApproved(conn, url, claim, planId) {
  const r = await api(conn.base, "/v1/verifications", {
    key: conn.key, method: "POST", idem: `run-${planId}`,
    body: { deployment_url: url, claim, reviewed_plan_id: planId },
  });
  if (r.json?.verification_id) return { kind: "running", vrf: r.json.verification_id, payload: r.json };
  return { kind: "error", status: r.status, code: typeof r.json?.error === "object" ? r.json.error.code : r.json?.error, message: errorMessage(r.json, r.text, r.status) };
}

/** Ask for a re-check of a finished verification: the same approved plan, run again after a fix. */
async function startRecheck(conn, vrf, url) {
  const r = await api(conn.base, `/v1/verifications/${encodeURIComponent(vrf)}/recheck`, {
    key: conn.key, method: "POST", idem: `recheck-${randomId()}`,
    body: url ? { deployment_url: url } : {},
  });
  if (r.json?.verification_id) return { kind: "running", vrf: r.json.verification_id, payload: r.json };
  return { kind: "error", status: r.status, code: typeof r.json?.error === "object" ? r.json.error.code : r.json?.error, message: errorMessage(r.json, r.text, r.status) };
}

/** Poll until the decision arrives or the deadline passes. */
async function waitForResult(conn, vrf, deadline, stopped = () => false) {
  let last = null;
  while (Date.now() < deadline && !stopped()) {
    await sleep(RESULT_POLL_MS);
    const r = await api(conn.base, `/v1/verifications/${encodeURIComponent(vrf)}`, { key: conn.key });
    if (r.status === 401 || r.status === 403 || r.status === 404) return { kind: "error", status: r.status, message: errorMessage(r.json, r.text, r.status) };
    last = r.json ?? last;
    if (r.json?.state === "completed") return { kind: "completed", v: r.json };
  }
  return { kind: "timeout", last };
}

// OPEN THE APPROVAL PAGE, BUT ONLY FOR SOMEONE SITTING THERE. Same rule as colour: a CI runner or an agent's
// captured shell gets the link printed and nothing launched. VRAELIS_NO_BROWSER turns it off everywhere.
function openInBrowser(url, { force = false } = {}) {
  if (!/^https?:\/\//.test(url || "")) return false;
  if (process.env.VRAELIS_NO_BROWSER || process.env.CI) return false;
  if (!force && PLAIN) return false;
  try {
    const [cmd, argv] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url.replace(/&/g, "^&")]]
      : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    const child = spawnChild(cmd, argv, { stdio: "ignore", detached: true, windowsHide: true });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch { return false; }
}

async function verify(args) {
  const conn = connection(args);
  const url = args.url || "";
  const claim = args.claim || "";
  if (!conn.key) fail(NO_KEY);
  if (!url || !claim) fail(`Both --url and --claim are required.\n\n${usage()}`);

  const quiet = args.json || args["repair-prompt"];
  const timeoutMs = (Number(args.timeout) > 0 ? Number(args.timeout) : 900) * 1000;
  const deadline = Date.now() + timeoutMs;

  // Generated per invocation unless the caller supplies one. A retried CI step that passes the same key
  // gets the original verification back instead of paying for a second identical run.
  const idem = args["idempotency-key"] || `cli-${randomId()}`;

  const prep = quiet ? { stop() {} } : spinner("Reading the site and writing a plan");
  let started;
  try { started = await submitClaim(conn, url, claim, idem); } finally { prep.stop(); }
  if (started.kind === "error") {
    mustReach({ status: started.status, text: started.message });
    if (args.json) process.stdout.write(JSON.stringify({ ok: false, error: started.payload?.error ?? null, status: started.status }) + "\n");
    fail(started.message);
  }

  // A PERSON APPROVES THE PLAN. The key cannot, by design: the agent or pipeline holding it is not the one
  // that signs off on the check. So the CLI shows what will be checked, hands over the link, and waits.
  if (started.kind === "review") {
    say("");
    say(`  ${bold("Plan ready")}  ${claim}`);
    say(`  ${dim("against")}     ${cyan(url)}`);
    say("");
    for (const r of started.requirements) say(`    ${dim("-")} ${r}`);
    say("");
    say(`  ${amber("A person has to approve this plan before it runs.")}`);
    say(`  ${dim("Approve it here:")} ${cyan(started.approveUrl ?? `${conn.base}/review/${started.planId}`)}`);
    if (!args["no-open"] && openInBrowser(started.approveUrl)) say(`  ${dim("Opened it in your browser.")}`);
    say("");
    const waiting = quiet ? { stop() {} } : spinner("Waiting for approval");
    let approval;
    try { approval = await waitForApproval(conn, started.planId, deadline); } finally { waiting.stop(); }
    if (approval.kind === "expired") fail("The plan expired before it was approved. Run the same command again for a fresh one.");
    if (approval.kind === "timeout") {
      if (args.json) process.stdout.write(JSON.stringify({ state: "review_required", reviewed_plan_id: started.planId, approve_url: started.approveUrl }) + "\n");
      fail(`Gave up waiting for approval after ${Math.round(timeoutMs / 1000)}s. Approve it, then run the same command again.`);
    }
    if (approval.kind === "error") fail(approval.message);
    if (!quiet) say(`  ${green("Approved.")} ${dim("Starting the check.")}`);
    started = await runApproved(conn, url, claim, started.planId);
    if (started.kind === "error") {
      if (args.json) process.stdout.write(JSON.stringify({ ok: false, status: started.status, error: started.code ?? null }) + "\n");
      fail(started.message);
    }
  }

  return follow(conn, started.vrf, started.payload, args, deadline, { claim, url });
}

/** After a verification starts: print its id and stop, or wait for the decision and report it. */
async function follow(conn, id, payload, args, deadline, { claim, url } = {}) {
  if (!args.wait) {
    // Without --wait there is no verdict yet, so exiting 0 means "started", not "verified". Said out loud,
    // because an exit code that looks like success is exactly what a pipeline will act on.
    if (args.json) process.stdout.write(JSON.stringify(payload ?? { verification_id: id, state: "running" }) + "\n");
    else {
      say(`Verification started: ${id}`);
      say(`Checking: ${(payload?.requirements ?? []).length} requirement(s)`);
      say(`Not waiting for the verdict. Run "vraelis result ${id} --wait" to get it.`);
    }
    return EXIT_VERIFIED;
  }

  if (!args.json && !args["repair-prompt"]) {
    say("");
    say(`  ${bold("Verifying")}  ${claim ?? payload?.claim ?? ""}`);
    if (url) say(`  ${dim("against")}    ${cyan(url)}`);
    say(`  ${dim("record")}     ${id}`);
    say("");
  }

  // Silent unless a person is watching: PLAIN makes spinner() a no-op, so a CI log gets nothing rather
  // than fifteen minutes of animation frames. The old version wrote a dot per poll, which is the same
  // problem in a build artefact.
  const spin = args.json || args["repair-prompt"] ? { stop() {} } : spinner("Verifying in a real browser");
  let done;
  try { done = await waitForResult(conn, id, deadline); } finally { spin.stop(); }
  if (done.kind === "completed") return report(done.v, args);
  if (done.kind === "error") fail(done.message);
  if (args.json) process.stdout.write(JSON.stringify({ ...(done.last ?? {}), verification_id: id, state: "timeout" }) + "\n");
  fail(`\nGave up waiting. The verification is still running: vraelis result ${id} --wait`);
}

async function recheck(args) {
  const conn = connection(args);
  const id = args._[1] || args.id || "";
  if (!conn.key) fail(NO_KEY);
  if (!/^vrf_/.test(id)) fail(`Give the verification to re-check: vraelis recheck vrf_... --wait\n\n${usage()}`);
  const timeoutMs = (Number(args.timeout) > 0 ? Number(args.timeout) : 900) * 1000;
  const started = await startRecheck(conn, id, args.url || "");
  if (started.kind === "error") {
    mustReach({ status: started.status, text: started.message });
    if (args.json) process.stdout.write(JSON.stringify({ ok: false, status: started.status, error: started.code ?? null }) + "\n");
    fail(started.message);
  }
  if (!args.json && !args["repair-prompt"]) {
    const left = started.payload?.rechecks_left;
    say("");
    say(`  ${bold("Re-checking")} ${id} ${dim("with the plan you approved")}${typeof left === "number" ? dim(`, ${left} re-check(s) left on that approval`) : ""}`);
  }
  return follow(conn, started.vrf, started.payload, args, Date.now() + timeoutMs, { claim: started.payload?.claim, url: started.payload?.deployment_url });
}

async function result(args) {
  const conn = connection(args);
  const id = args._[1] || args.id || "";
  if (!conn.key) fail(NO_KEY);
  if (!/^vrf_/.test(id)) fail(`Give the verification id: vraelis result vrf_...\n\n${usage()}`);
  const r = mustReach(await api(conn.base, `/v1/verifications/${encodeURIComponent(id)}`, { key: conn.key }));
  if (r.status >= 400) fail(errorMessage(r.json, r.text, r.status));
  if (r.json?.state === "completed") return report(r.json, args);
  if (!args.wait) {
    // No decision yet is not a pass, so it exits 2 like every other "no verdict".
    if (args.json) process.stdout.write(JSON.stringify(r.json ?? { verification_id: id, state: "running" }) + "\n");
    else say(`Still running: ${id}. Add --wait to wait for the decision.`);
    return EXIT_BLOCKED;
  }
  const timeoutMs = (Number(args.timeout) > 0 ? Number(args.timeout) : 900) * 1000;
  return follow(conn, id, r.json, args, Date.now() + timeoutMs, {});
}

function report(v, args) {
  const code = v.decision === "verified" ? EXIT_VERIFIED : v.decision === "failed" ? EXIT_FAILED : EXIT_BLOCKED;

  // --repair-prompt is for piping straight into a coding agent, so stdout carries the prompt and nothing
  // else. When there is nothing to repair, stdout stays empty rather than emitting a placeholder that would
  // be pasted into a model as if it were instructions.
  if (args["repair-prompt"]) {
    if (v.repair_prompt) process.stdout.write(v.repair_prompt + "\n");
    else say(v.decision === "verified" ? "Verified. Nothing to repair." : "No repair prompt available for this verification.");
    return code;
  }

  if (args.json) { process.stdout.write(JSON.stringify(v) + "\n"); return code; }

  // WHAT THIS RUN BELONGS TO. Printed before the verdict for every decision, because an agent handing this
  // to a person needs the record to be openable and the standing promise to be nameable. Each line appears
  // only when the API actually returned it, so the CLI never invents a relationship the record does not have.
  const context = () => {
    // Same two-space gutter and label column as everything else, so the verdict below it reads as the
    // conclusion of this block rather than as an unrelated line that happens to follow.
    const line = (label, value, link = false) => say(`  ${dim(label.padEnd(11))}${link ? cyan(value) : value}`);
    if (v.verification_id) line("Id", v.verification_id);
    if (v.guarantee_title) line("Guarantee", v.guarantee_title);
    if (v.recheck_of || v.reverification_of) line("Re-checks", v.recheck_of || v.reverification_of);
    if (v.console_url) line("Record", v.console_url, true);
    if (v.verification_id || v.guarantee_title || v.reverification_of || v.console_url) say("");
  };

  say("");
  context();
  if (v.decision === "verified") {
    // The word survives verbatim under PLAIN, which is what the suite asserts and what a build log needs.
    say(`  ${stamp.verified(" VERIFIED ")}  ${bold(v.claim ?? "")}`);
    say(`  ${dim(`${(v.requirements ?? []).length} requirement(s) checked in a real browser. No failures observed.`)}`);
    say("");
    return code;
  }
  if (v.decision === "failed") {
    say(`  ${stamp.failed(" FAILED ")}  ${bold(v.claim ?? "")}`);
    for (const f of v.failures ?? []) {
      say("");
      say(`  ${red(String(f.severity ?? "").toUpperCase())}  ${bold(f.title)}`);
      // "expected: " and "observed: " are load-bearing strings, asserted by cli-verify-test. The colour
      // sits on the label and the value stays plain, so the assertion reads the same either way.
      if (f.expected) say(`    ${dim("expected:")} ${f.expected}`);
      if (f.observed) say(`    ${dim("observed:")} ${f.observed}`);
    }
    say("");
    if (v.repair_prompt) say(`  ${dim("Run again with")} ${cyan("--repair-prompt")} ${dim("for a fix package your coding agent can take.")}`);
    if (v.verification_id) say(`  ${dim("After the fix is deployed:")} ${cyan(`vraelis recheck ${v.verification_id} --wait`)}`);
    say("");
    return code;
  }
  say(`  ${stamp.blocked(" BLOCKED ")}  ${dim("no verdict was reached for")} ${bold(v.claim ?? "")}`);
  say("The deployment could not be exercised well enough to confirm or deny the claim.");
  for (const e of v.evidence ?? []) if (e.result && e.result !== "passed") say(`  - ${e.checking}: ${e.result}`);
  return code;
}

function randomId() {
  // Crypto-strength is not required (this is a collision-avoidance token, not a secret), but the global is
  // available on every supported Node and avoids an import.
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


// ── login / logout / status ──────────────────────────────────────────────────────────────────────────
//
// Carrying VRAELIS_API_KEY in every shell is fine for a pipeline and tedious for a person, which is why
// every CLI worth using has these three. They are deliberately thin: a key goes in a file, comes back out
// of that file, or is removed from it. Nothing here decides anything about verification.

/** Prove the key is real by asking the API something harmless.
 *
 *  GET /v1/credits, because it ALREADY EXISTS and needs only credits:read. Minting a /v1/whoami purely so
 *  a login command could feel thorough would be a new public endpoint with no other reason to exist, and
 *  a public API surface is a promise you keep forever.
 *
 *  The three outcomes are genuinely different and are not collapsed:
 *    ok        the key authenticates
 *    rejected  401, the key is wrong. Refuse to store it.
 *    unproven  403 (real key, lacks credits:read), or the network did not answer. Store it and SAY SO.
 *
 *  403 is the case that matters. A key scoped to launch runs but not to read credits is perfectly valid,
 *  and treating it as bad would refuse to log in the exact key a CI user was told to create. */
async function checkKey(base, key) {
  try {
    const r = await api(base, "/v1/credits", { key });
    if (r.status === 0) return { state: "unproven", detail: `could not reach ${base}` };
    if (r.status === 401) return { state: "rejected", detail: errorMessage(r.json, r.text, r.status) };
    if (r.status === 403) return { state: "unproven", detail: "the key is valid but cannot read credits, so it could not be fully checked" };
    if (r.status >= 200 && r.status < 300) return { state: "ok", balance: r.json?.balance };
    return { state: "unproven", detail: `the API answered ${r.status}` };
  } catch (e) {
    return { state: "unproven", detail: `could not reach ${base}` };
  }
}

async function login(args) {
  const base = args["base-url"] || process.env.VRAELIS_BASE_URL || DEFAULT_BASE;

  // An existing environment key is not overwritten silently, because it would keep winning afterwards and
  // the login would look like it did nothing.
  if (process.env.VRAELIS_API_KEY) {
    say("");
    say(`  ${amber("VRAELIS_API_KEY is set in this environment.")}`);
    say(`  ${dim("It takes priority over anything stored here, so a stored key would not be used until you unset it.")}`);
    say("");
  }

  say("");
  say(`  ${bold("Sign in to Vraelis")}`);
  say(`  ${dim("Create a key with \"Launch runs\" access at")} ${cyan("https://app.vraelis.com/developers")}`);
  // WINDOWS GETS ONE EXTRA LINE, because this prompt hides what you type and that turns a failed paste
  // into a failed key. Ctrl+V inserts nothing in a legacy console window; the prompt shows nothing either
  // way, so the reader cannot tell those apart and reasonably concludes the key is wrong. Right-click
  // pastes in every Windows console, so it is the gesture worth naming. Not printed elsewhere: on macOS
  // and Linux the normal paste already works and a hint about right-clicking would just be noise.
  if (process.platform === "win32") {
    say(`  ${dim("On Windows, paste with a right-click — Ctrl+V does not work in every console window.")}`);
  }
  say("");
  const key = await promptSecret(`  ${dim("API key")} ${dim("(hidden, paste it and press Enter):")} `);
  if (!key) fail("No key entered. Nothing was stored.");

  const spin = PLAIN ? { stop() {} } : spinner("Checking the key");
  const check = await checkKey(base, key);
  spin.stop();

  if (check.state === "rejected") {
    fail(`That key was rejected: ${check.detail}\nNothing was stored.`);
  }

  writeConfig({ ...readConfig(), apiKey: key, baseUrl: base === DEFAULT_BASE ? undefined : base });

  say("");
  if (check.state === "ok") {
    say(`  ${green("Signed in")}  ${dim(mask(key))}`);
    if (typeof check.balance === "number") say(`  ${dim(`Balance ${check.balance.toLocaleString()} credits`)}`);
  } else {
    // STORED, AND SAID SO. Silently storing an unchecked key and printing "Signed in" would be the CLI
    // asserting something it did not establish, which is the one thing this product cannot do.
    say(`  ${amber("Stored, but not verified")}  ${dim(mask(key))}`);
    say(`  ${dim(check.detail)}`);
  }
  say(`  ${dim(CONFIG_PATH())}`);
  say("");
  return EXIT_VERIFIED;
}

function logout() {
  const had = fileExists(CONFIG_PATH()) && !!readConfig().apiKey;
  if (had) {
    const next = readConfig();
    delete next.apiKey;
    writeConfig(next);
  }
  say("");
  say(had ? `  ${green("Signed out")}  ${dim("the stored key was removed")}` : `  ${dim("No stored key to remove.")}`);
  // IT CANNOT UNSET AN ENVIRONMENT VARIABLE, and pretending otherwise would leave someone believing they
  // had signed out while every subsequent command still authenticated.
  if (process.env.VRAELIS_API_KEY) {
    say(`  ${amber("VRAELIS_API_KEY is still set in this environment.")}`);
    say(`  ${dim("A child process cannot unset it. Clear it in your shell if you meant to sign out entirely.")}`);
  }
  say("");
  return EXIT_VERIFIED;
}

async function status(args) {
  const { key, source } = resolveKey(args);
  const base = args["base-url"] || process.env.VRAELIS_BASE_URL || readConfig().baseUrl || DEFAULT_BASE;
  say("");
  if (!key) {
    say(`  ${dim("Not signed in.")}`);
    say(`  ${dim("Run")} ${cyan("vraelis login")}${dim(", or set VRAELIS_API_KEY.")}`);
    say("");
    return EXIT_BLOCKED;
  }
  const where = source === "flag" ? "--api-key flag" : source === "env" ? "VRAELIS_API_KEY" : CONFIG_PATH();
  say(`  ${bold("Signed in")}  ${dim(mask(key))}`);
  say(`  ${dim("from")}       ${where}`);
  say(`  ${dim("api")}        ${cyan(base)}`);
  // Both sources at once is not an error, but which one wins decides whose balance gets spent.
  if (source === "env" && readConfig().apiKey) {
    say(`  ${dim("A different key is stored in")} ${CONFIG_PATH()}${dim(", and the environment wins.")}`);
  }
  const spin = PLAIN ? { stop() {} } : spinner("Checking");
  const check = await checkKey(base, key);
  spin.stop();
  say("");
  if (check.state === "ok") {
    say(`  ${green("The key works.")}${typeof check.balance === "number" ? dim(`  Balance ${check.balance.toLocaleString()} credits`) : ""}`);
    say("");
    return EXIT_VERIFIED;
  }
  if (check.state === "rejected") {
    say(`  ${red("The key was rejected.")} ${dim(check.detail)}`);
    say("");
    return EXIT_BLOCKED;
  }
  say(`  ${amber("Could not confirm the key.")} ${dim(check.detail)}`);
  say("");
  return EXIT_BLOCKED;
}
// ── vraelis mcp ──────────────────────────────────────────────────────────────────────────────────────
//
// THE SAME CHECK, SPOKEN TO A CODING AGENT. Claude Code, Codex, Gemini CLI, Copilot, Cursor and Trae all
// load tools over the Model Context Protocol: they start this process, write JSON-RPC to its stdin and read
// JSON-RPC from its stdout, one message per line. So stdout here carries protocol and nothing else, and every
// human line still goes to stderr, which the clients keep as a log.
//
// Three tools, and the loop they make is the product:
//
//   vraelis_verify    the agent finished something and says what should now work. Vraelis writes a plan;
//                     the agent's person approves it at a link; the check runs in a real browser.
//   vraelis_status    where that check is, waiting a little for news so the agent is not spinning.
//   vraelis_recheck   the check FAILED, the agent fixed and redeployed, run the approved plan again.
//
// NO TOOL APPROVES A PLAN, and none ever will. The approval link is handed to the person, because the
// promise is that the agent that did the work is not the one that signs off on it.
//
// EVERY CALL RETURNS WITHIN ABOUT FORTY SECONDS. Writing a plan can take a couple of minutes and a run
// longer, while Codex gives a tool sixty seconds by default and other clients vary. So the slow work runs in
// this process as a job, and a call waits only a bounded moment for it before answering "still going, ask
// again". The job keeps going between calls: once the person approves, the run starts on its own.

const MCP_WAIT_MS = Number(process.env.VRAELIS_MCP_WAIT_MS) > 0 ? Number(process.env.VRAELIS_MCP_WAIT_MS) : 40_000;
const JOB_DEADLINE_MS = 90 * 60 * 1000;

const MCP_INSTRUCTIONS = [
  "Vraelis independently checks whether something you built works on the live, deployed web app, in a real browser.",
  "Use vraelis_verify after you finish a change a user can see or do in a deployed web app, before you tell the user it is done.",
  "Tell the user it works only if the result is VERIFIED. If it is FAILED, fix the cause, redeploy to the same site, and call vraelis_recheck.",
  "The first check of a claim needs the user to approve Vraelis's plan. You cannot approve it yourself: give the user the approval link.",
  "Each run is billed to the user's Vraelis account as one verification.",
].join(" ");

const MCP_TOOLS = [
  {
    name: "vraelis_verify",
    title: "Verify on the live app",
    description: "Independently check that a change you made works on the deployed web app, in a real browser, before you tell the user it is done. "
      + "Give the public https URL where the change is live and ONE sentence saying what a user can now do and what should be true afterwards, "
      + "for example \"A signed-in user can cancel their plan from Billing and then sees Cancelled\". "
      + "The first check of a claim needs the user to approve Vraelis's plan; this tool returns the approval link, and the check starts by itself once they approve. "
      + "Ends in VERIFIED, FAILED (with what broke, expected vs observed, and a repair prompt) or BLOCKED (could not decide). Billed as one verification.",
    inputSchema: {
      type: "object",
      properties: {
        deployment_url: { type: "string", description: "Public https URL where the change is deployed, e.g. a preview or production URL. Not localhost." },
        claim: { type: "string", description: "One sentence: what a user can now do and what should be true afterwards. The outcome, not the steps." },
      },
      required: ["deployment_url", "claim"],
      additionalProperties: false,
    },
    annotations: { title: "Verify on the live app", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "vraelis_status",
    title: "Check status",
    description: "Get where a Vraelis check is: PREPARING, WAITING FOR APPROVAL, RUNNING, or its decision. Waits up to about 40 seconds for news before answering. "
      + "Pass the id vraelis_verify or vraelis_recheck gave you (job_... or vrf_...). Call again while it is still going.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "The job_... or vrf_... id from vraelis_verify or vraelis_recheck." } },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { title: "Check status", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "vraelis_recheck",
    title: "Re-check after a fix",
    description: "Run the same approved check again after you fixed something that FAILED. Deploy the fix first: Vraelis tests what is live, not your local code. "
      + "No new approval is needed for 24 hours after the user approved the plan (at most 10 re-checks); after that, use vraelis_verify again. "
      + "It runs on the same site the plan was approved for. Billed as one verification.",
    inputSchema: {
      type: "object",
      properties: {
        verification_id: { type: "string", description: "The vrf_... id of the verification to run again." },
        deployment_url: { type: "string", description: "Optional. A different URL on the SAME site, if the fix is live at another path." },
      },
      required: ["verification_id"],
      additionalProperties: false,
    },
    annotations: { title: "Re-check after a fix", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
];

const jobs = new Map();
let jobSeq = 0;

function newJob(fields) {
  const job = { id: `job_${++jobSeq}`, state: "preparing", createdAt: Date.now(), waiters: new Set(), ...fields };
  jobs.set(job.id, job);
  return job;
}

/** Move a job to a new state and wake every call waiting on it. */
function update(job, fields) {
  Object.assign(job, fields);
  // Swap the set out BEFORE waking anyone: a waiter that is not satisfied yet re-registers itself, and it
  // has to land in the new set rather than in the one about to be cleared.
  const woken = [...job.waiters];
  job.waiters.clear();
  for (const w of woken) w();
}

const SETTLED = new Set(["needs_approval", "completed", "error"]);

/** Wait for the job to change (or, with untilSettled, to need someone), at most `ms`. */
function waitOn(job, ms, untilSettled) {
  if (SETTLED.has(job.state)) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); job.waiters.delete(check); resolve(); }
    function check() { if (!untilSettled || SETTLED.has(job.state)) done(); else job.waiters.add(check); }
    job.waiters.add(check);
  });
}

function failJob(job, r, fallbackTitle = "ERROR") {
  const code = r.code ?? "";
  const title = r.status === 0 ? "CANNOT REACH VRAELIS"
    : r.status === 401 || code === "invalid_api_key" || code === "signin_required" ? "NOT SIGNED IN"
    : r.status === 402 ? "NO BALANCE"
    : code === "claim_not_provable" ? "CANNOT BUILD A CHECK FOR THIS"
    : code === "plan_requires_human" ? "NEEDS A PERSON"
    : fallbackTitle;
  update(job, { state: "error", title, message: r.message, code, payload: r.payload ?? null });
}

/** The whole life of one vraelis_verify: plan, approval, run, decision. Never throws. */
async function runVerifyJob(job, conn) {
  try {
    const deadline = job.createdAt + JOB_DEADLINE_MS;
    const started = await submitClaim(conn, job.url, job.claim, `mcp-${randomId()}`);
    if (started.kind === "error") return failJob(job, started);
    let running = started;
    if (started.kind === "review") {
      // The journeys are part of what the person approves, so the agent gets to show them too.
      const plan = await api(conn.base, `/v1/verifications/plans/${encodeURIComponent(started.planId)}`, { key: conn.key });
      const opened = openInBrowser(started.approveUrl, { force: true });
      update(job, {
        state: "needs_approval", planId: started.planId, approveUrl: started.approveUrl, expiresAt: started.expiresAt,
        requirements: started.requirements, flows: plan.json?.flows ?? [], opened,
      });
      const approval = await waitForApproval(conn, started.planId, deadline);
      if (approval.kind === "expired") return update(job, { state: "error", title: "APPROVAL EXPIRED", message: "The plan expired before anyone approved it. Call vraelis_verify again for a fresh plan." });
      if (approval.kind === "timeout") return update(job, { state: "error", title: "APPROVAL EXPIRED", message: "Nobody approved the plan in time. Call vraelis_verify again when the user is ready." });
      if (approval.kind === "error") return failJob(job, approval);
      update(job, { state: "launching" });
      running = await runApproved(conn, job.url, job.claim, started.planId);
      if (running.kind === "error") return failJob(job, running);
    }
    update(job, { state: "running", vrf: running.vrf, requirements: running.requirements ?? job.requirements });
    const done = await waitForResult(conn, running.vrf, deadline);
    if (done.kind === "completed") return update(job, { state: "completed", result: done.v });
    if (done.kind === "error") return failJob(job, done);
    update(job, { state: "error", title: "STILL RUNNING", message: `No decision yet. Call vraelis_status with id "${running.vrf}" later.` });
  } catch (e) {
    update(job, { state: "error", title: "ERROR", message: String(e?.message ?? e) });
  }
}

/** Follow a verification that is already running (a re-check, or a vrf id this process did not start). */
async function followJob(job, conn) {
  try {
    const done = await waitForResult(conn, job.vrf, job.createdAt + JOB_DEADLINE_MS);
    if (done.kind === "completed") return update(job, { state: "completed", result: done.v });
    if (done.kind === "error") return failJob(job, done);
    update(job, { state: "error", title: "STILL RUNNING", message: `No decision yet. Call vraelis_status with id "${job.vrf}" later.` });
  } catch (e) {
    update(job, { state: "error", title: "ERROR", message: String(e?.message ?? e) });
  }
}

function renderResult(v) {
  const id = v.verification_id;
  const claim = v.claim ? `"${v.claim}"` : "the claim";
  const out = [];
  if (v.decision === "verified") {
    out.push(`VERIFIED: ${claim}`);
    out.push(`Vraelis checked ${(v.requirements ?? []).length} requirement(s) on the live app in a real browser and saw no failures. Verification ${id}.`);
    for (const r of v.requirements ?? []) out.push(`  - ${r}`);
    if (v.console_url) out.push(`Record: ${v.console_url}`);
    out.push("You can tell the user this is verified on the deployed app. Share the record link if they want the evidence.");
    return out.join("\n");
  }
  if (v.decision === "failed") {
    out.push(`FAILED: ${claim}. Verification ${id}.`);
    out.push("What broke:");
    (v.failures ?? []).forEach((f, i) => {
      out.push(`${i + 1}. [${f.severity ?? "issue"}] ${f.title ?? ""}`);
      if (f.expected) out.push(`   expected: ${f.expected}`);
      if (f.observed) out.push(`   observed: ${f.observed}`);
      if (f.reproduce) out.push(`   reproduce: ${f.reproduce}`);
    });
    if (v.repair_prompt) { out.push(""); out.push("Repair prompt from Vraelis:"); out.push(v.repair_prompt); }
    if (v.console_url) { out.push(""); out.push(`Record: ${v.console_url}`); }
    out.push("");
    out.push(`Next: fix the cause, deploy it to the same site, then call vraelis_recheck with verification_id "${id}". Do not tell the user this works until a check comes back VERIFIED.`);
    return out.join("\n");
  }
  out.push(`BLOCKED: Vraelis could not reach a decision for ${claim}. Verification ${id}.`);
  for (const e of v.evidence ?? []) if (e.result && e.result !== "passed") out.push(`  - ${e.checking}: ${e.result}${e.failed_at_step ? ` (step ${e.failed_at_step})` : ""}`);
  out.push("This is not a pass. Common causes: a page needs a sign-in Vraelis has no test account for, a bot check, or the site did not respond.");
  if (v.console_url) out.push(`Record: ${v.console_url}`);
  out.push("Tell the user it could not be verified and show them the record. Do not say it works.");
  return out.join("\n");
}

function renderJob(job) {
  switch (job.state) {
    case "preparing":
      return `PREPARING (id "${job.id}"). Vraelis is reading ${job.url} and writing a check plan for "${job.claim}". This usually takes under two minutes. Call vraelis_status with id "${job.id}".`;
    case "needs_approval": {
      const out = [`WAITING FOR APPROVAL (id "${job.id}").`, `Vraelis wrote this plan for "${job.claim}" on ${job.url}. A person has to approve it before it runs. You cannot approve it yourself.`, "", "Requirements it will check:"];
      (job.requirements ?? []).forEach((r, i) => out.push(`${i + 1}. ${r}`));
      if ((job.flows ?? []).length) {
        out.push("", "What a real browser will do:");
        for (const f of job.flows) out.push(`- ${f.name}${f.goal ? `: ${f.goal}` : ""}`);
      }
      out.push("", `Ask the user to open this link and approve the plan: ${job.approveUrl}`);
      if (job.opened) out.push("(Vraelis also tried to open it in their browser.)");
      out.push("If the requirements do not match what you built, tell the user before they approve.");
      out.push(`The check starts by itself once they approve. Then call vraelis_status with id "${job.id}".`);
      return out.join("\n");
    }
    case "launching":
      return `APPROVED, STARTING (id "${job.id}"). Call vraelis_status with id "${job.id}".`;
    case "running":
      return `RUNNING (verification ${job.vrf}). A real browser is checking ${job.url ?? "the deployment"}. Call vraelis_status with id "${job.vrf}".`;
    case "completed":
      return renderResult(job.result);
    default: {
      const out = [`${job.title ?? "ERROR"}: ${job.message ?? "Something went wrong."}`];
      if (job.title === "NOT SIGNED IN") out.push("Ask the user to run `vraelis login` in a terminal (create a key at https://app.vraelis.com/developers), then try again.");
      if (job.title === "NO BALANCE") out.push("Ask the user to add balance or a plan at https://app.vraelis.com/billing, then try again.");
      if (job.title === "CANNOT BUILD A CHECK FOR THIS") {
        const p = job.payload ?? {};
        for (const o of p.remaining_obligations ?? []) out.push(`  - ${typeof o === "string" ? o : o?.text ?? JSON.stringify(o)}`);
        if (p.repair_prompt) out.push("", p.repair_prompt);
        out.push("Nothing was charged. Rewrite the claim as something a user can see or do on the site, or tell the user.");
      }
      return out.join("\n");
    }
  }
}

const textResult = (text, isError = false) => ({ content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) });

async function callTool(name, a) {
  const conn = connection({});
  if (!conn.key) return textResult("NOT SIGNED IN: Vraelis has no API key on this machine. Ask the user to run `vraelis login` in a terminal (create a key at https://app.vraelis.com/developers), then try again.", true);

  if (name === "vraelis_verify") {
    const url = String(a?.deployment_url ?? "").trim();
    const claim = String(a?.claim ?? "").trim();
    if (!/^https:\/\//i.test(url)) return textResult("deployment_url must be the public https URL where the change is deployed. Vraelis cannot reach localhost or your local files.", true);
    if (claim.length < 12) return textResult("claim must be one sentence saying what a user can now do and what should be true afterwards.", true);
    const job = newJob({ kind: "verify", url, claim });
    void runVerifyJob(job, conn);
    await waitOn(job, MCP_WAIT_MS, true);
    return textResult(renderJob(job), job.state === "error");
  }

  if (name === "vraelis_status") {
    const id = String(a?.id ?? "").trim();
    let job = jobs.get(id) ?? [...jobs.values()].find((j) => j.vrf === id && j.state !== "error");
    if (!job && /^vrf_/.test(id)) {
      // A verification this process did not start (a restart, or one started from the CLI). Ask the API.
      const r = await api(conn.base, `/v1/verifications/${encodeURIComponent(id)}`, { key: conn.key });
      if (r.status !== 200) return textResult(`${errorMessage(r.json, r.text, r.status)}`, true);
      if (r.json?.state === "completed") return textResult(renderResult(r.json));
      job = newJob({ kind: "follow", state: "running", vrf: id });
      void followJob(job, conn);
    }
    if (!job) return textResult(`No Vraelis check with id "${id}". Use the id vraelis_verify or vraelis_recheck returned.`, true);
    const before = job.state;
    if (!SETTLED.has(before)) await waitOn(job, MCP_WAIT_MS, false);
    return textResult(renderJob(job), job.state === "error");
  }

  if (name === "vraelis_recheck") {
    const vrf = String(a?.verification_id ?? "").trim();
    if (!/^vrf_/.test(vrf)) return textResult("verification_id must be the vrf_... id of the verification to run again.", true);
    const url = String(a?.deployment_url ?? "").trim();
    const started = await startRecheck(conn, vrf, url);
    if (started.kind === "error") {
      const job = newJob({ kind: "recheck" });
      failJob(job, started, started.code === "recheck_window_closed" || started.code === "recheck_limit_reached" ? "NEEDS A NEW APPROVAL" : "CANNOT RE-CHECK");
      return textResult(renderJob(job) + (job.title === "NEEDS A NEW APPROVAL" ? "\nCall vraelis_verify with the same URL and claim; the user approves the new plan." : ""), true);
    }
    const job = newJob({ kind: "recheck", state: "running", vrf: started.vrf, url: started.payload?.deployment_url, claim: started.payload?.claim });
    void followJob(job, conn);
    await waitOn(job, MCP_WAIT_MS, true);
    return textResult(renderJob(job), job.state === "error");
  }

  return textResult(`Unknown tool "${name}".`, true);
}

async function mcp() {
  const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
  const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
  const error = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

  async function dispatch(msg) {
    if (!msg || typeof msg !== "object") return;
    const { id, method, params } = msg;
    if (typeof method !== "string") return; // a response to a request we never send
    const notification = id === undefined || id === null;
    try {
      switch (method) {
        case "initialize":
          // Tools are the only capability, and they work the same in every protocol version so far, so the
          // client's version is echoed rather than negotiated down.
          return reply(id, {
            protocolVersion: typeof params?.protocolVersion === "string" ? params.protocolVersion : "2025-06-18",
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "vraelis", title: "Vraelis", version: CLI_VERSION },
            instructions: MCP_INSTRUCTIONS,
          });
        case "ping": return reply(id, {});
        case "tools/list": return reply(id, { tools: MCP_TOOLS });
        case "tools/call": return reply(id, await callTool(params?.name, params?.arguments ?? {}));
        case "resources/list": return reply(id, { resources: [] });
        case "resources/templates/list": return reply(id, { resourceTemplates: [] });
        case "prompts/list": return reply(id, { prompts: [] });
        default:
          if (method.startsWith("notifications/")) return;
          if (!notification) error(id, -32601, `Method not found: ${method}`);
      }
    } catch (e) {
      if (!notification) error(id, -32603, String(e?.message ?? e));
    }
  }

  say(`vraelis mcp ${CLI_VERSION}: ready on stdio`);
  process.stdin.setEncoding("utf8");
  let buf = "";
  process.stdin.on("data", (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); continue; }
      for (const m of Array.isArray(msg) ? msg : [msg]) void dispatch(m);
    }
  });
  // The client closing stdin is the end of the session. Jobs still polling would keep Node alive forever,
  // so this exits explicitly, after stdout has drained.
  await new Promise((resolve) => process.stdin.on("end", resolve));
  await new Promise((resolve) => process.stdout.write("", resolve));
  process.exit(EXIT_VERIFIED);
}

// ── vraelis init ─────────────────────────────────────────────────────────────────────────────────────
//
// ONE COMMAND TO PLUG VRAELIS INTO THE ASSISTANTS ON THIS MACHINE, and one paragraph in the project telling
// them to use it. Every assistant keeps MCP servers in its own place and its own shape, which is the whole
// reason this exists; getting one of them slightly wrong fails silently inside someone else's tool.
//
// WHAT IT LAUNCHES. On Windows the installer's vraelis.cmd cannot be started by a client that spawns without
// a shell, which is most of them, so the server is registered as node plus this script, both absolute. On
// macOS and Linux the installed `vraelis` shim is used when it is on PATH, because it keeps working when
// Node is upgraded and an absolute Node path would not.
//
// USER-LEVEL CONFIG, NOT PROJECT FILES, for the servers. Those paths are this machine's, and a committed
// .vscode/mcp.json with them in it breaks for every teammate. The instruction paragraph is the opposite: it
// is plain text meant to be committed, so it goes in the project.

const MARK_START = "<!-- vraelis:start -->";
const MARK_END = "<!-- vraelis:end -->";
const AGENT_NOTE = [
  MARK_START,
  "## Verify before you say it's done",
  "",
  "This project uses Vraelis to check changes on the deployed app. After you change something a user can see or",
  "do in the deployed web app, deploy it, then call the `vraelis_verify` tool with the deployment URL and one",
  "sentence saying what a user can now do and what should be true afterwards.",
  "",
  "- Tell the user it works only when the result is VERIFIED.",
  "- If it is FAILED, fix the cause, redeploy to the same site, and call `vraelis_recheck`.",
  "- If it needs approval, give the user the approval link. Never try to approve a Vraelis plan yourself.",
  MARK_END,
].join("\n");

function onPath(cmd) {
  const exts = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  for (const dir of (process.env.PATH || "").split(delimiter)) {
    if (!dir) continue;
    for (const ext of exts) { const p = join(dir, cmd + ext); if (fileExists(p)) return p; }
  }
  return null;
}

/** How an MCP client should start this server on this machine. */
function serverLaunch() {
  let script = process.argv[1];
  try { script = realpathSync(script); } catch { /* keep as given */ }
  if (process.platform !== "win32") {
    const shim = onPath("vraelis");
    if (shim) return { command: shim, args: ["mcp"] };
  }
  return { command: process.execPath, args: [script, "mcp"] };
}

function readJson(path) {
  try { return JSON.parse(readFile(path, "utf8")); } catch { if (fileExists(path)) throw new Error(`${path} is not valid JSON, so it was left alone. Fix it, then run init again.`); return {}; }
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFile(path, JSON.stringify(value, null, 2) + "\n");
}

/** Merge one server entry into a JSON config under `key`, leaving every other server untouched. */
function mergeServer(path, key, entry) {
  const cfg = readJson(path);
  cfg[key] = { ...(cfg[key] ?? {}), vraelis: entry };
  writeJson(path, cfg);
  return path;
}

function vscodeUserDir(product = "Code") {
  if (process.platform === "win32") return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), product, "User");
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", product, "User");
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), product, "User");
}

/** Run an assistant's own CLI. Windows needs a shell to start .cmd shims, so arguments are quoted for it. */
function runTool(cmd, args) {
  const win = process.platform === "win32";
  const q = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
  const r = win ? spawnSync([cmd, ...args].map(q).join(" "), { shell: true, encoding: "utf8" }) : spawnSync(cmd, args, { encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

function tomlString(s) { return JSON.stringify(s); }

const ASSISTANTS = {
  claude: {
    label: "Claude Code (terminal and VS Code)",
    notes: ["CLAUDE.md"],
    detect: () => !!onPath("claude") || fileExists(join(homedir(), ".claude")),
    install(launch) {
      if (!onPath("claude")) return { manual: `claude mcp add --scope user vraelis -- ${[launch.command, ...launch.args].map((s) => (/\s/.test(s) ? `"${s}"` : s)).join(" ")}` };
      runTool("claude", ["mcp", "remove", "vraelis", "--scope", "user"]);
      const r = runTool("claude", ["mcp", "add", "--scope", "user", "vraelis", "--", launch.command, ...launch.args]);
      return r.ok ? { done: "added with `claude mcp add --scope user`" } : { error: r.out || "claude mcp add failed" };
    },
  },
  codex: {
    label: "Codex (CLI and IDE extension)",
    notes: ["AGENTS.md"],
    detect: () => !!onPath("codex") || fileExists(join(homedir(), ".codex")),
    install(launch) {
      const path = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "config.toml");
      let toml = "";
      try { toml = readFile(path, "utf8"); } catch { /* new file */ }
      // Replace our own table if it is there, append it if not. Nothing else in the file is touched.
      const block = `[mcp_servers.vraelis]\ncommand = ${tomlString(launch.command)}\nargs = [${launch.args.map(tomlString).join(", ")}]\ntool_timeout_sec = 60\n`;
      const re = /\[mcp_servers\.vraelis\][\s\S]*?(?=\n\[|$)/;
      toml = re.test(toml) ? toml.replace(re, block.trimEnd()) : `${toml}${toml && !toml.endsWith("\n") ? "\n" : ""}${toml ? "\n" : ""}${block}`;
      mkdirSync(dirname(path), { recursive: true });
      writeFile(path, toml);
      return { done: path };
    },
  },
  gemini: {
    label: "Gemini CLI",
    notes: ["GEMINI.md"],
    detect: () => !!onPath("gemini") || fileExists(join(homedir(), ".gemini")),
    install: (launch) => ({ done: mergeServer(join(homedir(), ".gemini", "settings.json"), "mcpServers", { command: launch.command, args: launch.args, timeout: 60000 }) }),
  },
  copilot: {
    label: "GitHub Copilot (VS Code and Copilot CLI)",
    notes: ["AGENTS.md"],
    detect: () => fileExists(vscodeUserDir()) || fileExists(join(homedir(), ".copilot")) || !!onPath("copilot"),
    install(launch) {
      const paths = [];
      if (fileExists(vscodeUserDir())) paths.push(mergeServer(join(vscodeUserDir(), "mcp.json"), "servers", { type: "stdio", command: launch.command, args: launch.args }));
      if (fileExists(join(homedir(), ".copilot")) || onPath("copilot")) {
        paths.push(mergeServer(join(homedir(), ".copilot", "mcp-config.json"), "mcpServers", { type: "local", command: launch.command, args: launch.args, tools: ["*"] }));
      }
      return paths.length ? { done: paths.join(", ") } : { manual: "Install VS Code or the Copilot CLI first." };
    },
  },
  cursor: {
    label: "Cursor",
    notes: ["AGENTS.md"],
    detect: () => fileExists(join(homedir(), ".cursor")),
    install: (launch) => ({ done: mergeServer(join(homedir(), ".cursor", "mcp.json"), "mcpServers", { command: launch.command, args: launch.args }) }),
  },
  trae: {
    label: "Trae",
    notes: [".trae/rules/project_rules.md"],
    detect: () => fileExists(join(homedir(), ".trae")) || fileExists(vscodeUserDir("Trae")),
    // Trae keeps its MCP list inside the app, so this hands over the exact entry to paste into
    // Settings > MCP > Add > Configure manually rather than guessing at a file it owns.
    install: (launch) => ({ manual: `In Trae: Settings > MCP > Add > Configure manually, and paste:\n${JSON.stringify({ mcpServers: { vraelis: { command: launch.command, args: launch.args } } }, null, 2)}` }),
  },
};

/** Put the paragraph in a project file once. A second run replaces it rather than stacking copies. */
function writeNote(file) {
  const path = join(process.cwd(), file);
  let text = "";
  try { text = readFile(path, "utf8"); } catch { /* new file */ }
  const start = text.indexOf(MARK_START), end = text.indexOf(MARK_END);
  if (start >= 0 && end > start) text = text.slice(0, start) + AGENT_NOTE + text.slice(end + MARK_END.length);
  else text = `${text}${text && !text.endsWith("\n") ? "\n" : ""}${text ? "\n" : ""}${AGENT_NOTE}\n`;
  mkdirSync(dirname(path), { recursive: true });
  writeFile(path, text);
  return file;
}

/** CLAUDE.md and GEMINI.md that already import AGENTS.md get nothing extra: one copy is enough. */
function importsAgents(file) {
  try { return /@AGENTS\.md/.test(readFile(join(process.cwd(), file), "utf8")); } catch { return false; }
}

async function init(args) {
  const asked = args._.slice(1).map((s) => s.toLowerCase());
  const unknown = asked.filter((a) => a !== "all" && !ASSISTANTS[a]);
  if (unknown.length) fail(`Unknown assistant: ${unknown.join(", ")}. Choose from: ${Object.keys(ASSISTANTS).join(", ")}, all.`);
  const names = asked.includes("all") ? Object.keys(ASSISTANTS)
    : asked.length ? asked
    : Object.keys(ASSISTANTS).filter((n) => ASSISTANTS[n].detect());
  const launch = serverLaunch();

  say("");
  say(`  ${bold("Plug Vraelis into your coding assistants")}`);
  say(`  ${dim("server:")} ${[launch.command, ...launch.args].join(" ")}`);
  say("");
  if (!names.length) {
    say(`  ${amber("No supported assistant found on this machine.")}`);
    say(`  ${dim("Name one to set it up anyway:")} ${cyan(`vraelis init ${Object.keys(ASSISTANTS).join("|")}`)}`);
    say("");
    return EXIT_BLOCKED;
  }

  const notes = new Set(["AGENTS.md"]);
  let failed = false;
  for (const n of names) {
    const a = ASSISTANTS[n];
    for (const f of a.notes) notes.add(f);
    if (args.print) { say(`  ${cyan(a.label)}`); say(`    ${dim(JSON.stringify(launch))}`); continue; }
    let r;
    try { r = a.install(launch); } catch (e) { r = { error: String(e?.message ?? e) }; }
    if (r.done) say(`  ${green("✓")} ${a.label}  ${dim(r.done)}`);
    else if (r.manual) { say(`  ${amber("•")} ${a.label}  ${dim("do this once:")}`); for (const l of r.manual.split("\n")) say(`      ${l}`); }
    else { failed = true; say(`  ${red("✗")} ${a.label}  ${dim(r.error)}`); }
  }

  if (!args.print && !args["no-notes"]) {
    const written = [];
    for (const f of notes) {
      if ((f === "CLAUDE.md" || f === "GEMINI.md") && importsAgents(f)) continue;
      written.push(writeNote(f));
    }
    say("");
    say(`  ${green("✓")} ${dim("Told the assistants to verify before saying done, in")} ${written.join(", ")}`);
  }

  const who = resolveKey({});
  say("");
  if (!who.key) say(`  ${amber("Not signed in yet.")} ${dim("Run")} ${cyan("vraelis login")} ${dim("so the assistants can use your account.")}`);
  say(`  ${dim("Restart the assistant (or reload the window) to load the tools. ChatGPT connects over the web instead: https://vraelis.com/agents")}`);
  say("");
  return failed ? EXIT_BLOCKED : EXIT_VERIFIED;
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.version) { process.stdout.write(`${CLI_VERSION}\n`); return EXIT_VERIFIED; }
  if (args.help || argv.length === 0) { say(usage()); return argv.length === 0 ? EXIT_BLOCKED : EXIT_VERIFIED; }
  const cmd = args._[0];
  if (cmd === "login") return await login(args);
  if (cmd === "logout") return logout();
  if (cmd === "status") return await status(args);
  if (cmd === "recheck") return await recheck(args);
  if (cmd === "result") return await result(args);
  if (cmd === "mcp") return await mcp();
  if (cmd === "init") return await init(args);
  if (cmd !== "verify") fail(`Unknown command ${cmd ? `"${cmd}"` : ""}.\n\n${usage()}`);
  return await verify(args);
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => {
    if (e instanceof Exit) { process.exitCode = e.code; return; }
    // An unexpected throw is not a verdict either. Report it and exit blocked, never 0.
    say(`vraelis: ${e?.stack ?? e?.message ?? e}`);
    process.exitCode = EXIT_BLOCKED;
  });
