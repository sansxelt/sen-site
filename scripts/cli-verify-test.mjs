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
function mock(terminal, { createStatus = 202, creditsStatus = 200 } = {}) {
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
      // login and status validate a key against GET /v1/credits, an endpoint that already existed.
      if (req.url && req.url.startsWith("/v1/credits")) {
        res.writeHead(creditsStatus);
        res.end(JSON.stringify(creditsStatus >= 400
          ? { error: { code: creditsStatus === 401 ? "invalid_key" : "forbidden", message: "nope" } }
          : { balance: 640 }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(terminal));
    });
  });
  return { server, seen };
}

function run(args, env, port, stdin) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, VRAELIS_API_KEY: "vr_live_test", VRAELIS_BASE_URL: `http://127.0.0.1:${port}`, ...env },
    });
    // stdin is a pipe here, never a terminal, which is exactly the automation path login has to support.
    if (stdin !== undefined) {
      if (typeof stdin !== "string") throw new TypeError(`run(): stdin must be a string, got ${typeof stdin}`);
      p.stdin.write(stdin);
    }
    p.stdin.end();
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
    // ISOLATED HOME, or this test asks the machine it runs on. Since the CLI falls back to
    // ~/.vraelis/config.json, a developer who has run `vraelis login` would supply a real key here and the
    // assertion would silently stop testing anything. "No key" has to mean no key from any source.
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const empty = mkdtempSync(join(tmpdir(), "vraelis-nokey-"));
    const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c"],
      { VRAELIS_API_KEY: "", HOME: empty, USERPROFILE: empty }, 1);
    // /developers, not /api. /api was the console's name for the page until it was renamed; it still
    // redirects, so the old text worked and cost every reader a hop to a page whose heading did not match
    // the address they were sent to.
    ok("a missing API key exits 2 and says where to get one",
      r.code === 2 && /app\.vraelis\.com\/developers/.test(r.err), r.err.slice(0, 200));
    ok("and points at login as well as the environment variable", /vraelis login/.test(r.err));
    rmSync(empty, { recursive: true, force: true });
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

  // ── login / logout / status ───────────────────────────────────────────────────────────────────────
  //
  // Behavioural, against a real temporary HOME and a real config file, because every interesting property
  // here is about WHERE the key comes from and that cannot be read off the source.
  //
  // The one that matters most is precedence. A build machine with both an environment key and a developer's
  // stored login must use the environment: it is the credential the pipeline owns, and a login left behind
  // by a person is exactly the one you do not want spending an organisation's balance.
  console.log("\n── the key comes from the right place ──");
  {
    const { mkdtempSync, existsSync, readFileSync: rf, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    // HOME and USERPROFILE both, because homedir() reads whichever the platform uses.
    const home = mkdtempSync(join(tmpdir(), "vraelis-home-"));
    const asHome = (extra = {}) => ({ HOME: home, USERPROFILE: home, ...extra });
    const configPath = join(home, ".vraelis", "config.json");
    const stored = () => (existsSync(configPath) ? JSON.parse(rf(configPath, "utf8")) : {});

    await withServer(VERIFIED, {}, async (port) => {
      // Signed out: exit 2, because "no credential" is a state a pipeline must be able to branch on.
      let r = await run(["status"], asHome({ VRAELIS_API_KEY: "" }), port);
      ok("status with no key exits 2 and says so", r.code === 2 && /Not signed in/.test(r.err));
      ok("and nothing was written just by asking", !existsSync(configPath));

      // stdin is a pipe here, which is the automation path. The key is read as a line.
      r = await run(["login"], asHome({ VRAELIS_API_KEY: "", VRAELIS_STDIN: "" }), port, "vr_live_test");
      ok("login stores the key", r.code === 0 && stored().apiKey === "vr_live_test", JSON.stringify(stored()));
      // A credential printed in full ends up in a terminal buffer, a screenshot and a CI log.
      ok("login never prints the whole key", !r.err.includes("vr_live_test") && /vr_live_\.\.\./.test(r.err), r.err.slice(0, 200));

      r = await run(["status"], asHome({ VRAELIS_API_KEY: "" }), port);
      ok("status then reads the stored key", r.code === 0 && /Signed in/.test(r.err));
      ok("and names the config file as the source", r.err.includes(configPath));
      ok("status never prints the whole key either", !r.err.includes("vr_live_test"));

      // THE PRECEDENCE RULE.
      r = await run(["status"], asHome({ VRAELIS_API_KEY: "vr_live_fromenv" }), port);
      ok("VRAELIS_API_KEY beats the stored key", /VRAELIS_API_KEY/.test(r.err) && !r.err.includes(configPath.slice(0, 8) + "zzz"));
      ok("and status says the environment is winning", /environment wins/.test(r.err));

      // logout removes the credential and NOTHING else in the file.
      r = await run(["logout"], asHome({ VRAELIS_API_KEY: "" }), port);
      ok("logout removes the stored key", r.code === 0 && !stored().apiKey);
      ok("and says it did", /Signed out/.test(r.err));

      // It cannot unset an environment variable, and must not imply otherwise.
      r = await run(["logout"], asHome({ VRAELIS_API_KEY: "vr_live_fromenv" }), port);
      ok("logout admits it cannot clear an environment variable",
        /still set in this environment/.test(r.err) && /cannot unset/.test(r.err), r.err.slice(0, 240));
    });

    // A key the API rejects must not be stored, or the next command fails for a reason nobody remembers.
    await withServer(VERIFIED, { creditsStatus: 401 }, async (port) => {
      const r = await run(["login"], asHome({ VRAELIS_API_KEY: "" }), port, "vr_live_bad");
      ok("a rejected key is refused", r.code === 2 && /rejected/.test(r.err));
      ok("and is NOT stored", stored().apiKey !== "vr_live_bad", JSON.stringify(stored()));
    });

    // 403 means the key is real but lacks credits:read, which is a legitimate CI key. Storing it while
    // saying it could not be checked is the honest outcome; refusing it would reject a valid credential.
    await withServer(VERIFIED, { creditsStatus: 403 }, async (port) => {
      const r = await run(["login"], asHome({ VRAELIS_API_KEY: "" }), port, "vr_live_scoped");
      ok("a key that cannot read credits is stored anyway", r.code === 0 && stored().apiKey === "vr_live_scoped");
      ok("and is labelled as not verified rather than reported as signed in",
        /not verified/.test(r.err) && !/^\s*Signed in/m.test(r.err), r.err.slice(0, 240));
    });

    rmSync(home, { recursive: true, force: true });
  }

  // ── COLOUR IS DECORATION, AND DECORATION MUST NEVER REACH A PIPE ──────────────────────────────────
  //
  // Every human line goes to stderr, so styling is safe by construction. That is only true while it stays
  // true, and the failure is silent: escape codes in a JSON payload break a caller's parser, and escape
  // codes in a repair prompt get pasted into a coding agent as if they were instructions.
  console.log("\n── the output is styled without contaminating anything ──");
  {
    // FORCE_COLOR is the strongest possible signal to colour, so if stdout survives THIS, it survives.
    await withServer(VERIFIED, {}, async (port) => {
      const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait", "--json"],
        { FORCE_COLOR: "1" }, port);
      ok("--json emits no escape codes even with FORCE_COLOR set", !/\x1b\[/.test(r.out), JSON.stringify(r.out.slice(0, 80)));
      ok("and is still exactly one parseable object", (() => {
        try { return JSON.parse(r.out.trim()).decision === "verified"; } catch { return false; }
      })());
    });
    await withServer(FAILED, {}, async (port) => {
      const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait", "--repair-prompt"],
        { FORCE_COLOR: "1" }, port);
      ok("--repair-prompt emits no escape codes either", !/\x1b\[/.test(r.out), JSON.stringify(r.out.slice(0, 80)));
      ok("and is still only the prompt", r.out.trim() === "REPAIR PROMPT BODY");
    });
    // NO_COLOR is a convention, and honouring it is the difference between a tool people keep and one they
    // replace. It has to beat FORCE_COLOR: an explicit request for less always wins over one for more.
    await withServer(VERIFIED, {}, async (port) => {
      const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait"],
        { NO_COLOR: "1", FORCE_COLOR: "1" }, port);
      ok("NO_COLOR wins over FORCE_COLOR", !/\x1b\[/.test(r.err), JSON.stringify(r.err.slice(0, 80)));
      ok("and the verdict word survives without any colour to carry it", /VERIFIED/.test(r.err));
    });
    // A spinner in a build log is fifteen minutes of animation frames nobody can read.
    await withServer(VERIFIED, {}, async (port) => {
      const r = await run(["verify", "--url", "https://x.example.com", "--claim", "c", "--wait"], {}, port);
      ok("no spinner frames when the output is not a terminal", !/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(r.err));
      ok("and no carriage returns redrawing a line nobody is watching", !/\r/.test(r.err));
    });
  }

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

    // "cli" IS NOW AN APP ROOT, and that is a collision waiting to happen.
    //
    // The console has a Command line page at /cli, so "cli" was added to APP_ROOTS. isAppPath is
    // host-agnostic, so on vraelis.com every /cli path is now something the proxy wants to bounce to
    // app.vraelis.com behind a sign-in wall. The download survives only because the proxy's matcher skips
    // a fixed list of asset extensions and .mjs is one of them, so /cli/vraelis.mjs never reaches the
    // routing at all. That is load-bearing and entirely non-obvious: remove .mjs from that matcher and the
    // installer starts redirecting a CI runner to a login page, while everything else keeps working.
    const routes = readFileSync("lib/app-routes.ts", "utf8");
    const proxySrc = readFileSync("proxy.ts", "utf8");
    if (/"cli"/.test(routes)) {
      ok("the proxy still skips .mjs, which is the only reason the download survives /cli being an app root",
        /matcher:[\s\S]{0,400}mjs/.test(proxySrc));
    }
    // ── PUBLISHED IS A FACT, NOT AN INTENTION ────────────────────────────────────────────────────────
    //
    // This used `"private": true` as a stand-in for "not on npm". That was a fair proxy while nothing was
    // ever going to be published and became wrong the moment the package was prepared: private: true is
    // exactly what BLOCKS `npm publish`, so removing it is a prerequisite for publishing rather than
    // evidence of having published.
    //
    // Nothing here can check the registry; a test that reaches the network is a test that fails on a
    // train. So the rule is the one that actually protects a reader: the CONSOLE docs, which customers
    // read today, must not claim an install that may not work yet. When the name is claimed, this
    // assertion and that copy change together, in one commit, with the tarball as the evidence.
    const pkg = JSON.parse(readFileSync("cli/package.json", "utf8"));
    ok("the console docs do not claim an npm install", !/npm i(nstall)? -g vraelis|npx vraelis/.test(install));
    ok("but the package is ready to be published, so the claim can become true",
      pkg.private !== true && !!pkg.bin?.vraelis && Array.isArray(pkg.files) && pkg.name === "vraelis");
    // files lists README.md, and a tarball missing it publishes a blank page on the registry.
    ok("everything the package promises to ship exists",
      pkg.files.every((f) => existsSync(`cli/${f}`)), pkg.files.filter((f) => !existsSync(`cli/${f}`)).join(", "));
  }

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
