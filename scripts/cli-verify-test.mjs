// The CLI's contract is its EXIT CODE. A release gate reads it far more often than a person reads the
// output, so these are end-to-end tests against a mock API: spawn the real CLI, answer it with a scripted
// server, and assert the process exit code and which stream carried the payload.
//
// Testing this any other way (importing an internal function) would prove the mapping and miss the thing
// that actually breaks a pipeline: a message written to stdout, a nonzero code on success, or a crash
// exiting 0.
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cli", "vraelis.mjs");
let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); }
};

// A server that returns `terminal` on the first poll, so --wait finishes fast.
function mock(terminal, { createStatus = 202 } = {}) {
  const seen = { idem: null, body: null, keys: [] };
  const server = createServer((req, res) => {
    seen.keys.push(req.headers["x-api-key"]);
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.method === "POST") {
        seen.idem = req.headers["idempotency-key"];
        seen.body = raw ? JSON.parse(raw) : null;
        res.writeHead(createStatus);
        res.end(JSON.stringify(createStatus >= 400
          ? { error: { code: "key_daily_ceiling", message: "This key's daily limit would be exceeded." } }
          : { verification_id: "vrf_run1", state: "running", requirements: ["Payment completes", "Access is granted"] }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(terminal));
    });
  });
  return { server, seen };
}

function run(args, env, port) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, VRAELIS_API_KEY: "vr_live_test", VRAELIS_BASE_URL: `http://127.0.0.1:${port}`, ...env },
    });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, out, err }));
  });
}

async function withServer(terminal, opts, fn) {
  const { server, seen } = mock(terminal, opts);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try { return await fn(server.address().port, seen); }
  finally { server.close(); }
}

const VERIFIED = { verification_id: "vrf_run1", state: "completed", decision: "verified", claim: "Checkout grants Pro access", requirements: ["Payment completes"], failures: [], evidence: [], repair_prompt: null };
const FAILED = { verification_id: "vrf_run1", state: "completed", decision: "failed", claim: "Checkout grants Pro access", requirements: ["Payment completes"], failures: [{ severity: "critical", title: "Access not granted", expected: "Pro is active", observed: "Still on Free" }], evidence: [], repair_prompt: "REPAIR PROMPT BODY" };
const BLOCKED = { verification_id: "vrf_run1", state: "completed", decision: "blocked", claim: "Checkout grants Pro access", requirements: [], failures: [], evidence: [{ checking: "Upgrade", result: "errored" }], repair_prompt: null };

async function main() {
  console.log("── exit codes are the interface ──");
  await withServer(VERIFIED, {}, async (port) => {
    const r = await run(["verify", "--url", "https://x.example.com", "--claim", "Checkout grants Pro access", "--wait"], {}, port);
    ok("a verified claim exits 0", r.code === 0, `got ${r.code}`);
    ok("the human summary says VERIFIED", /VERIFIED/.test(r.err));
  });
  await withServer(FAILED, {}, async (port) => {
    const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait"], {}, port);
    ok("a failed claim exits 1 (distinct from an error)", r.code === 1, `got ${r.code}`);
    ok("the failure names what was expected and observed",
      /expected: Pro is active/.test(r.err) && /observed: Still on Free/.test(r.err));
  });
  await withServer(BLOCKED, {}, async (port) => {
    const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait"], {}, port);
    ok("a blocked verification exits 2, never 0", r.code === 2, `got ${r.code}`);
  });

  console.log("\n── stdout carries ONLY the machine payload ──");
  await withServer(VERIFIED, {}, async (port) => {
    const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait", "--json"], {}, port);
    ok("--json writes exactly one parseable object to stdout", (() => {
      try { return JSON.parse(r.out.trim()).decision === "verified"; } catch { return false; }
    })(), r.out.slice(0, 120));
    ok("progress never contaminates stdout", !/Verifying:/.test(r.out));
  });
  await withServer(FAILED, {}, async (port) => {
    const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait", "--repair-prompt"], {}, port);
    ok("--repair-prompt puts ONLY the prompt on stdout", r.out.trim() === "REPAIR PROMPT BODY", JSON.stringify(r.out));
    ok("--repair-prompt still exits 1 so the gate still fails", r.code === 1, `got ${r.code}`);
  });
  // A verified run has nothing to repair. Emitting a placeholder would be pasted into a model as if it were
  // an instruction, so stdout must stay empty.
  await withServer(VERIFIED, {}, async (port) => {
    const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait", "--repair-prompt"], {}, port);
    ok("--repair-prompt emits NOTHING on stdout when there is nothing to repair", r.out.trim() === "", JSON.stringify(r.out));
  });

  console.log("\n── errors never look like a verdict ──");
  await withServer(VERIFIED, { createStatus: 429 }, async (port) => {
    const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait"], {}, port);
    ok("a refusal from the API exits 2, not 0 and not 1", r.code === 2, `got ${r.code}`);
    ok("the refusal's own message is shown", /daily limit/.test(r.err), r.err.slice(0, 200));
  });
  {
    // Nothing listening: a network failure is not a verdict.
    const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait"], { VRAELIS_BASE_URL: "http://127.0.0.1:1" }, 1);
    ok("an unreachable API exits 2", r.code === 2, `got ${r.code}`);
    ok("stdout stays empty on a network failure", r.out.trim() === "");
  }
  {
    const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c"], { VRAELIS_API_KEY: "" }, 1);
    ok("a missing API key exits 2 and says where to get one", r.code === 2 && /app\.vraelis\.com\/api/.test(r.err));
  }

  console.log("\n── idempotency is automatic ──");
  await withServer(VERIFIED, {}, async (port, seen) => {
    await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait"], {}, port);
    ok("an Idempotency-Key is sent without being asked for", !!seen.idem, String(seen.idem));
    ok("the claim and url reach the API unchanged",
      seen.body?.claim === "c" && seen.body?.deployment_url === "https://x.example.com");
    ok("the key is sent as a header on every call", seen.keys.every((k) => k === "vr_live_test"));
  });
  await withServer(VERIFIED, {}, async (port, seen) => {
    await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait", "--idempotency-key", "mine-1"], {}, port);
    ok("an explicit --idempotency-key is used verbatim", seen.idem === "mine-1", String(seen.idem));
  });

  // ── THE INSTALL INSTRUCTION HAS TO BE ONE A STRANGER CAN RUN ──────────────────────────────────────
  //
  // Everything above proves the CLI works. None of it proved anyone could GET it. The console told
  // customers to run `node ./cli/vraelis.mjs`, a path inside this repository, which they do not have, so
  // every command in that section was unrunnable for the person reading it. cli/package.json is
  // `private: true` and the package has never been published, so the npm form would be a different lie.
  console.log("\n── the install instruction is obtainable ──");
  {
    // COMMENTS STRIPPED BEFORE ANY BAN IS CHECKED. The comment in cli-section.tsx explains that
    // "npm i -g vraelis" would be a lie, so a check reading raw text finds the string it is banning inside
    // the sentence banning it. That is the third guard in this repo to fail by searching prose. Strip
    // first, then assert, every time.
    const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const install = code(readFileSync("app/rank/app/api/cli-section.tsx", "utf8"));
    const hasRoute = existsSync("app/cli/vraelis.mjs/route.ts");
    ok("the CLI is served from the site", hasRoute);
    ok("from its SOURCE file, so there is no second copy to go stale",
      hasRoute && /readFile\(join\(process\.cwd\(\), "cli", "vraelis\.mjs"\)/.test(
        readFileSync("app/cli/vraelis.mjs/route.ts", "utf8")));
    // Nothing imports cli/vraelis.mjs, so without tracing the download 404s in production and works locally.
    ok("and traced into the route bundle, or it 404s only in production",
      /outputFileTracingIncludes[\s\S]{0,240}cli\/vraelis\.mjs/.test(readFileSync("next.config.ts", "utf8")));

    ok("the install line does not point at a path inside this repository",
      !/node \.?\/?cli\/vraelis\.mjs/.test(install), "customers do not have this repo");
    // THE INSTALL BLOCK SPECIFICALLY, not "somewhere in the file". The CI block further down also fetches
    // the CLI, so a check against the whole file stayed green when the download was deleted from the very
    // first thing a reader sees. Found by mutation: removing it from INSTALL changed nothing.
    const installBlock = /const INSTALL = `([\s\S]*?)`;/.exec(install)?.[1] ?? "";
    ok("the install block exists to be checked", installBlock.length > 0);
    ok("it tells the reader how to install the CLI, in the install block itself",
      /curl -fsS https:\/\/vraelis\.com\/install \| sh/.test(installBlock));
    ok("and the CI block installs it too, so a runner needs nothing preinstalled",
      /curl -fsS https:\/\/vraelis\.com\/install \| sh/.test(/const CI = `([\s\S]*?)`;/.exec(install)?.[1] ?? ""));
    // Piping a script into a shell asks for real trust. Offering to show it first is the least that buys,
    // and offering a route that skips the installer is what makes the trust optional rather than required.
    ok("the reader is told they can read the script before running it",
      /curl https:\/\/vraelis\.com\/install/.test(installBlock));
    ok("and offered a way to skip the installer entirely",
      /curl -O https:\/\/vraelis\.com\/cli\/vraelis\.mjs/.test(installBlock));
    // The commands must be the INSTALLED one. Leaving `node vraelis.mjs` after adding an installer is the
    // same halfway rename that put a repo path in front of customers in the first place.
    ok("the examples call the installed command, not a file path",
      /^vraelis verify/m.test(installBlock));

    // ── The installer itself ────────────────────────────────────────────────────────────────────────
    const sh = readFileSync("cli/install.sh", "utf8");
    const shCode = sh.replace(/^\s*#.*$/gm, "");
    ok("the installer is served from the site", existsSync("app/install/route.ts"));
    ok("from its source file, so there is no second copy to go stale",
      /readFile\(join\(process\.cwd\(\), "cli", "install\.sh"\)/.test(readFileSync("app/install/route.ts", "utf8")));
    ok("and traced into the bundle, or it 404s only in production",
      /outputFileTracingIncludes[\s\S]{0,320}cli\/install\.sh/.test(readFileSync("next.config.ts", "utf8")));

    // NO SUDO. An installer that wants root to place one text file is asking for far more trust than the
    // job needs, and a CI runner usually cannot grant it anyway.
    ok("the installer never asks for root", !/\bsudo\b/.test(shCode));
    ok("it installs into the user's own directory", /\$HOME\/\.local\/bin/.test(sh));
    // Editing someone's shell profile from a piped script is a surprise found later by someone else.
    ok("it does not edit anyone's shell profile",
      !/(>>|>)\s*"?\$HOME\/\.(bashrc|zshrc|profile|bash_profile)/.test(shCode));
    ok("it stops at the first failure rather than half-installing", /^set -eu/m.test(shCode));
    ok("it checks the Node version, so the failure is a sentence and not a syntax error",
      /MIN_NODE/.test(shCode) && /process\.versions\.node/.test(shCode));
    // A captive portal's login page is a valid file of about the right size and would install cleanly.
    ok("it refuses a download that is empty or is not the CLI",
      /-s "\$TMP"/.test(shCode) && /grep -q "vraelis"/.test(shCode));
    // Writing straight to the destination leaves a truncated CLI that runs and does the wrong thing.
    ok("it downloads to a temporary file and moves it into place",
      /mktemp/.test(shCode) && /mv "\$TMP"/.test(shCode));
    ok("it is POSIX sh, not bash", /^#!\/bin\/sh/.test(sh) && !/\[\[/.test(shCode));
    // npm publish is a real option and an irreversible one. Until it happens, nothing may imply it.
    ok("nothing claims an npm install that has never been published",
      !/npm i(nstall)? -g vraelis|npx vraelis/.test(install)
      && /"private":\s*true/.test(readFileSync("cli/package.json", "utf8")));
  }

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
