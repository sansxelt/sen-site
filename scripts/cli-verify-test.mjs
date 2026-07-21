// The CLI's contract is its EXIT CODE. A release gate reads it far more often than a person reads the
// output, so these are end-to-end tests against a mock API: spawn the real CLI, answer it with a scripted
// server, and assert the process exit code and which stream carried the payload.
//
// Testing this any other way (importing an internal function) would prove the mapping and miss the thing
// that actually breaks a pipeline: a message written to stdout, a nonzero code on success, or a crash
// exiting 0.
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

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
