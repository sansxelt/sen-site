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

const USAGE = `vraelis verify — check that a claimed outcome is actually true

  vraelis verify --url <deployment> --claim <outcome> [options]

Required
  --url <url>          The deployment to verify. Must be https and publicly reachable.
  --claim <text>       What should be true, in a sentence. Describe the outcome, not the steps.
                       e.g. "A customer can upgrade to Pro and still have access after signing in again"

Options
  --wait               Wait for the verdict. Without it, prints the id and exits 0 immediately.
  --json               Emit one JSON object instead of human output. Use this in CI and from agents.
  --repair-prompt      On failure, print ONLY the repair prompt, ready to paste into a coding agent.
  --timeout <seconds>  How long --wait waits before giving up. Default 900.
  --idempotency-key <k>  Reuse a key to make a retry return the original verification instead of
                       starting (and paying for) a second one. Generated automatically if omitted.
  --api-key <key>      Overrides VRAELIS_API_KEY.
  --base-url <url>     Overrides VRAELIS_BASE_URL. Default https://vraelis.com

Environment
  VRAELIS_API_KEY      Required. Create one at https://app.vraelis.com/api with "Launch runs" access.
  VRAELIS_BASE_URL     Optional.

Exit codes
  0  verified     1  failed     2  blocked, or could not run`;

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
  if (!url || !claim) fail(`Both --url and --claim are required.\n\n${USAGE}`);

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
    say(`Verifying: ${claim}`);
    say(`Against:   ${url}`);
    for (const r of started.json.requirements ?? []) say(`  · ${r}`);
    say("");
    say("No human reviewed these requirements. If they do not match your claim, the verdict will not either.");
    say("");
  }

  const timeoutMs = (Number(args.timeout) > 0 ? Number(args.timeout) : 900) * 1000;
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    await sleep(5000);
    const poll = await api(base, `/v1/verifications/${id}`, { key });
    if (poll.status === 401 || poll.status === 403) fail(errorMessage(poll.json, poll.text, poll.status));
    last = poll.json ?? last;
    if (poll.json?.state === "completed") return report(poll.json, args);
    if (!args.json && !args["repair-prompt"]) process.stderr.write(".");
  }

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

  say("");
  if (v.decision === "verified") {
    say(`VERIFIED  ${v.claim ?? ""}`);
    say(`Checked ${(v.requirements ?? []).length} requirement(s) in a real browser. No failures observed.`);
    return code;
  }
  if (v.decision === "failed") {
    say(`FAILED  ${v.claim ?? ""}`);
    for (const f of v.failures ?? []) {
      say("");
      say(`  ${String(f.severity ?? "").toUpperCase()}  ${f.title}`);
      if (f.expected) say(`    expected: ${f.expected}`);
      if (f.observed) say(`    observed: ${f.observed}`);
    }
    say("");
    if (v.repair_prompt) say("Run again with --repair-prompt to get a fix package for your coding agent.");
    return code;
  }
  say(`BLOCKED  no verdict was reached for: ${v.claim ?? ""}`);
  say("The deployment could not be exercised well enough to confirm or deny the claim.");
  for (const e of v.evidence ?? []) if (e.result && e.result !== "passed") say(`  · ${e.checking}: ${e.result}`);
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
  if (args.help || argv.length === 0) { say(USAGE); return argv.length === 0 ? EXIT_BLOCKED : EXIT_VERIFIED; }
  const cmd = args._[0];
  if (cmd !== "verify") fail(`Unknown command ${cmd ? `"${cmd}"` : ""}.\n\n${USAGE}`);
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
