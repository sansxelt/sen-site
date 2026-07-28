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
    `    ${cyan("vraelis verify")} --url <deployment> --claim <outcome> [options]`,
    heading("  Required"),
    row("--url <url>", "The deployment to verify. Must be https and publicly reachable.", 24),
    row("--claim <text>", "What should be true, in a sentence. The outcome, not the steps.", 24),
    cont('e.g. "A customer can upgrade to Pro and still have access after signing in again"'),
    heading("  Options"),
    row("--wait", "Wait for the verdict. Without it, prints the id and exits 0 at once.", 24),
    row("--json", "Emit one JSON object instead of human output. For CI and agents.", 24),
    row("--repair-prompt", "On failure, print ONLY the repair prompt, ready for a coding agent.", 24),
    row("--timeout <seconds>", "How long --wait waits before giving up. Default 900.", 24),
    row("--idempotency-key <k>", "Reuse a key so a retry returns the original verification", 24),
    cont("instead of starting, and paying for, a second one."),
    row("--api-key <key>", "Overrides VRAELIS_API_KEY.", 24),
    row("--base-url <url>", "Overrides VRAELIS_BASE_URL. Default https://vraelis.com", 24),
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
  const key = args["api-key"] || process.env.VRAELIS_API_KEY || "";
  const url = args.url || "";
  const claim = args.claim || "";

  if (!key) fail("No API key. Set VRAELIS_API_KEY, or pass --api-key.\nCreate one at https://app.vraelis.com/api with \"Launch runs\" access.");
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

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.help || argv.length === 0) { say(usage()); return argv.length === 0 ? EXIT_BLOCKED : EXIT_VERIFIED; }
  const cmd = args._[0];
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
