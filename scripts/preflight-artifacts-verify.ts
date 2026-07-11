// Tests for the dedicated preflight artifact bucket helpers (lib/preflight/artifacts.ts) + the run decision
// logic (worker/preflight/execute-run.ts). Pure / no real Supabase: covers object-path randomness &
// sanitization, MIME + size validation, the explicit missing-bucket error, the dedicated bucket name (no
// fallback to the check bucket), and the READY/NEEDS_REVIEW/BLOCKED decision. (Signed-URL + ownership are
// exercised against real Supabase in the operator run.)
import { artifactObjectPath, uploadPreflightArtifact, ArtifactBucketMissingError, PREFLIGHT_ARTIFACT_BUCKET } from "../lib/preflight/artifacts";
import { decideRun } from "../worker/preflight/execute-run";
import type { FlowResult, FlowSpec } from "../worker/preflight/types";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
async function threw(fn: () => Promise<unknown>, re: RegExp): Promise<boolean> { try { await fn(); return false; } catch (e) { return re.test((e as Error).message); } }

async function main(): Promise<void> {
  // ── Object paths: random, sanitized, unguessable ──
  const p1 = artifactObjectPath("run-abc", "screenshot", "png");
  ok("path is runs/<runId>/screenshot-<hex>.png", /^runs\/run-abc\/screenshot-[0-9a-f]{32}\.png$/.test(p1), p1);
  ok("two paths never collide (random)", p1 !== artifactObjectPath("run-abc", "screenshot", "png"));
  const p3 = artifactObjectPath("../../etc/passwd", "scr/../shot", "p n g");
  ok("path is traversal-safe + sanitized", /^runs\/[a-z0-9-]+\/[a-z0-9_-]+-[0-9a-f]{32}\.[a-z0-9]+$/.test(p3) && !p3.includes(".."), p3);

  // ── Upload validation (throws before touching storage/DB) ──
  ok("unsupported MIME rejected", await threw(() => uploadPreflightArtifact("x", Buffer.from("a"), "text/html"), /unsupported_artifact_type/));
  ok("empty body rejected", await threw(() => uploadPreflightArtifact("x", Buffer.alloc(0), "image/png"), /empty_artifact/));
  ok("oversize (>10MB) rejected", await threw(() => uploadPreflightArtifact("x", Buffer.alloc(11 * 1024 * 1024), "image/png"), /artifact_too_large/));
  ok("png is an allowed evidence type", !(await threw(() => uploadPreflightArtifact("x", Buffer.from("a"), "image/png"), /unsupported_artifact_type/)));

  // ── Dedicated bucket, no fallback, explicit missing-bucket error ──
  ok("bucket is the dedicated preflight bucket", PREFLIGHT_ARTIFACT_BUCKET === "vraelis-preflight-artifacts");
  ok("bucket is NOT the check-attachments bucket", (PREFLIGHT_ARTIFACT_BUCKET as string) !== "vraelis-check-attachments");
  const bErr = new ArtifactBucketMissingError();
  ok("missing-bucket error is explicit + names the bucket", bErr.name === "ArtifactBucketMissingError" && bErr.message.includes("vraelis-preflight-artifacts"));

  // ── Run decision (report decision): no numeric score, explainable rule ──
  const flows: FlowSpec[] = [
    { flowId: "crit", name: "create+persist", priority: "critical", steps: [], maxMs: 1000, destructiveAllowed: false },
    { flowId: "imp", name: "search", priority: "important", steps: [], maxMs: 1000, destructiveAllowed: false },
  ];
  const mk = (id: string, state: FlowResult["state"]): FlowResult => ({ flowId: id, state, steps: [] });
  ok("critical flow failed -> BLOCKED", decideRun([mk("crit", "failed"), mk("imp", "passed")], flows).decision === "blocked");
  ok("only non-critical failed -> NEEDS_REVIEW", decideRun([mk("crit", "passed"), mk("imp", "failed")], flows).decision === "needs_review");
  ok("all critical passed -> READY", decideRun([mk("crit", "passed"), mk("imp", "passed")], flows).decision === "ready");
  ok("blocked when critical is 'blocked' too", decideRun([mk("crit", "blocked"), mk("imp", "passed")], flows).decision === "blocked");

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(`artifacts test crashed: ${(e as Error).message}`); process.exit(1); });
