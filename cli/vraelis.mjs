#!/usr/bin/env node
// vraelis — verify a claimed outcome against a real deployment.
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
import { join, dirname } from "node:path";
import { readFileSync as readFile, writeFileSync as writeFile, mkdirSync, chmodSync, unlinkSync, existsSync as fileExists, renameSync } from "node:fs";

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
// One command, so this is not a command list. It is the one invocation, then exactly what you can pass it,
// then the three integers a pipeline actually reads.
function usage() {
  return [
    "",
    `  ${bold("VRAELIS")}  ${dim("verify that a claimed outcome is actually true")}`,
    heading("  Usage"),
    `    ${cyan("vraelis verify")} --url URL --claim "OUTCOME" [options]`,
    heading("  Commands"),
    row("verify", "Check that a claimed outcome holds against a deployment.", 24),
    row("login", "Store an API key in ~/.vraelis/config.json.", 24),
    row("logout", "Forget the stored key.", 24),
    row("status", "Show which key is in use, where it came from, and whether it works.", 24),
    heading("  Required"),
    row("--url URL", "The deployment to verify. Must be https and publicly reachable.", 24),
    row("--claim TEXT", "What should be true, in a sentence. The outcome, not the steps.", 24),
    cont('e.g. "A customer can upgrade to Pro and still have access after signing in again"'),
    heading("  Options"),
    row("--wait", "Wait for the verdict. Without it, prints the id and exits 0 at once.", 24),
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
    if (["wait", "json", "repair-prompt", "help", "version"].includes(key)) { out[key] = true; continue; }
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

async function api(base, path, { key, method = "GET", body, idem } = {}) {
  const headers = { "x-api-key": key };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (idem) headers["idempotency-key"] = idem;
  let res;
  try {
    res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    // A network failure is not a verdict. Never let it look like one.
    fail(`Could not reach Vraelis at ${base}: ${e?.message ?? e}`);
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* handled by the caller via `json === null` */ }
  return { status: res.status, json, text };
}

function errorMessage(payload, text, status) {
  // The v1 envelope is { error: { code, message } }; the internal routes use { error, message }.
  const e = payload?.error;
  if (e && typeof e === "object") return `${e.message ?? e.code ?? "Request failed"}`;
  if (typeof e === "string") return payload?.message ?? e;
  return `Request failed with status ${status}${text ? `: ${text.slice(0, 200)}` : ""}`;
}

async function verify(args) {
  const base = (args["base-url"] || process.env.VRAELIS_BASE_URL || "https://vraelis.com").replace(/\/+$/, "");
  const { key } = resolveKey(args);
  const url = args.url || "";
  const claim = args.claim || "";

  // /developers, not /api. /api was the console's name for this page until it was renamed; it still
  // redirects, so the old text worked and cost every reader an extra hop to a page with a different name
  // at the top than the one they were sent to.
  if (!key) fail(`No API key. Run "vraelis login", set VRAELIS_API_KEY, or pass --api-key.\nCreate one with "Launch runs" access at https://app.vraelis.com/developers`);
  if (!url || !claim) fail(`Both --url and --claim are required.\n\n${usage()}`);

  // Generated per invocation unless the caller supplies one. A retried CI step that passes the same key
  // gets the original verification back instead of paying for a second identical run.
  const idem = args["idempotency-key"] || `cli-${randomId()}`;

  const started = await api(base, "/v1/verifications", {
    key, method: "POST", idem,
    body: { deployment_url: url, claim, context: { source: "vraelis-cli" } },
  });

  if (!started.json?.verification_id) {
    if (args.json) process.stdout.write(JSON.stringify({ ok: false, error: started.json?.error ?? null, status: started.status }) + "\n");
    fail(errorMessage(started.json, started.text, started.status));
  }

  const id = started.json.verification_id;

  if (!args.wait) {
    // Without --wait there is no verdict yet, so exiting 0 means "started", not "verified". Said out loud,
    // because an exit code that looks like success is exactly what a pipeline will act on.
    if (args.json) process.stdout.write(JSON.stringify(started.json) + "\n");
    else {
      say(`Verification started: ${id}`);
      say(`Checking: ${(started.json.requirements ?? []).length} requirement(s) derived from your claim`);
      say(`Not waiting for the verdict. Re-run with --wait, or poll ${base}/v1/verifications/${id}`);
    }
    return EXIT_VERIFIED;
  }

  if (!args.json && !args["repair-prompt"]) {
    say("");
    say(`  ${bold("Verifying")}  ${claim}`);
    say(`  ${dim("against")}    ${cyan(url)}`);
    say("");
    for (const r of started.json.requirements ?? []) say(`    ${dim("-")} ${r}`);
    say("");
    say(`  ${amber("No human reviewed these requirements.")} ${dim("If they do not match your claim, the verdict will not either.")}`);
    say("");
  }

  const timeoutMs = (Number(args.timeout) > 0 ? Number(args.timeout) : 900) * 1000;
  const deadline = Date.now() + timeoutMs;
  let last = null;
  // Silent unless a person is watching: PLAIN makes spinner() a no-op, so a CI log gets nothing rather
  // than fifteen minutes of animation frames. The old version wrote a dot per poll, which is the same
  // problem in a build artefact.
  const spin = args.json || args["repair-prompt"] ? { stop() {} } : spinner("Verifying");
  try {
    while (Date.now() < deadline) {
      await sleep(5000);
      const poll = await api(base, `/v1/verifications/${id}`, { key });
      if (poll.status === 401 || poll.status === 403) { spin.stop(); fail(errorMessage(poll.json, poll.text, poll.status)); }
      last = poll.json ?? last;
      if (poll.json?.state === "completed") { spin.stop(); return report(poll.json, args); }
    }
  } finally { spin.stop(); }

  if (args.json) process.stdout.write(JSON.stringify({ ...(last ?? {}), verification_id: id, state: "timeout" }) + "\n");
  fail(`\nGave up waiting after ${Math.round(timeoutMs / 1000)}s. The verification is still running: ${base}/v1/verifications/${id}`);
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
    if (v.guarantee_title) line("Guarantee", v.guarantee_title);
    if (v.reverification_of) line("Reverifies", v.reverification_of);
    if (v.console_url) line("Record", v.console_url, true);
    if (v.guarantee_title || v.reverification_of || v.console_url) say("");
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
async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.help || argv.length === 0) { say(usage()); return argv.length === 0 ? EXIT_BLOCKED : EXIT_VERIFIED; }
  const cmd = args._[0];
  if (cmd === "login") return await login(args);
  if (cmd === "logout") return logout();
  if (cmd === "status") return await status(args);
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
