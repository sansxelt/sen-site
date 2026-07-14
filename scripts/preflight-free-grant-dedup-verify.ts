// Free-pass abuse controls, verified (revenue-protection blocker 1). Two halves, mirroring the sibling
// entitlements suite: (1) PURE tests of the canonical-cluster rule and the risk-signal hash — the logic
// the dedup rests on; (2) STATIC source checks that lock the security-critical contracts that cannot be
// exercised without a live DB: freePassUsed fails CLOSED, the risk signal is SIGNAL-ONLY (never a denial
// key), OAuth signup now records canonical_email, and no raw IP/device value is ever stored. No DB, no
// network.
import fs from "node:fs";
import path from "node:path";
import { canonicalizeEmail } from "../lib/user-credentials";
import { hashRiskSignal } from "../lib/preflight/free-grant-cluster";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

function main(): void {
  // ── Canonical clustering: the ONE hard-denial key. Every alias of one inbox must collapse to the same
  //    canonical string, so the cluster resolver groups them and the free pass is per real inbox. ──
  const canon = canonicalizeEmail;
  ok("gmail +tag aliases collapse", canon("you+a@gmail.com") === canon("you+b@gmail.com"));
  ok("gmail dots are insignificant", canon("y.o.u@gmail.com") === canon("you@gmail.com"));
  ok("gmail +tag AND dots together collapse", canon("y.o.u+farm@gmail.com") === "you@gmail.com");
  ok("googlemail folds onto gmail (same inbox)", canon("you@googlemail.com") === canon("you@gmail.com"));
  ok("case is folded", canon("You@Gmail.com") === canon("you@gmail.com"));
  ok("the canonical form is the bare inbox", canon("you+x@gmail.com") === "you@gmail.com");
  // Non-gmail: +tag stripped (industry standard) but dots KEPT (significant on most providers).
  ok("non-gmail +tag stripped", canon("bob+promo@fastmail.com") === "bob@fastmail.com");
  ok("non-gmail dots are PRESERVED (significant off gmail)", canon("b.o.b@fastmail.com") === "b.o.b@fastmail.com");
  // Distinct real inboxes must NOT be merged — this is what keeps false positives near zero.
  ok("different real inboxes stay distinct", canon("alice@gmail.com") !== canon("bob@gmail.com"));
  ok("same local part, different domain stays distinct", canon("bob@gmail.com") !== canon("bob@work.com"));

  // ── The OAuth hole this closes: a Google alias and a GitHub account on the same inbox canonicalize
  //    identically, so the cluster resolver treats them as one free-pass owner. ──
  ok("Google alias + GitHub-on-same-inbox share a canonical (the OAuth farm is closed)",
    canon("dev.person+google@gmail.com") === canon("devperson@googlemail.com"));

  // ── Risk signal hash: SIGNAL ONLY, and never stores a raw identifier. ──
  ok("empty / unknown produce NO signal (nothing to correlate)",
    hashRiskSignal("") === null && hashRiskSignal(null) === null && hashRiskSignal("unknown") === null);
  const h = hashRiskSignal("203.0.113.7");
  ok("a real value hashes to a fixed-width hex digest", typeof h === "string" && /^[0-9a-f]{32}$/.test(h!));
  ok("the raw value never appears in the hash (one-way)", (h ?? "").indexOf("203.0.113.7") === -1);
  ok("hashing is deterministic (same input -> same hash, enables velocity correlation)",
    hashRiskSignal("203.0.113.7") === h);
  ok("different inputs -> different hashes", hashRiskSignal("203.0.113.8") !== h);

  // ── STATIC: free-pass eligibility must FAIL CLOSED. The eligibility read lives in freePassEligibility
  //    (freePassUsed is a thin wrapper over it); its fail-closed returns and the override escape valve are
  //    the whole security contract. A regression here silently re-opens the farm. The `reliable` flag on
  //    the fail-closed returns is purely informational (drives the "couldn't verify" UI copy) and NEVER
  //    changes the fail-closed result: every unreliable path still returns used:true. ──
  const ent = read("lib", "preflight", "entitlements-v1.ts");
  ok("freePassUsed is a thin wrapper over freePassEligibility (single source of the fail-closed logic)",
    /freePassUsed\(owner[^)]*\)[\s\S]*?return \(await freePassEligibility\(owner\)\)\.used/.test(ent));
  ok("freePassEligibility resolves the canonical cluster (not just the exact email)",
    /freePassEligibility[\s\S]*?resolveCanonicalCluster\(owner\)/.test(ent));
  ok("freePassEligibility checks the operator comp FIRST (comped user never blocked)",
    /freePassEligibility[\s\S]*?activeFreeGrantOverride\([\s\S]*?return \{ used: false, reliable: true \}/.test(ent));
  ok("fails closed to used:true when cluster resolution is unreliable (!cluster.ok)",
    /if \(!cluster\.ok\) return \{ used: true, reliable: false \}/.test(ent));
  ok("fails closed to used:true when the runs read errors (!ok)",
    /if \(!ok\) return \{ used: true, reliable: false \}/.test(ent));
  ok("both fail-closed returns keep used:true (the flag only marks reliability, never opens the gate)",
    (ent.match(/return \{ used: true, reliable: false \}/g) || []).length >= 2);
  ok("the cluster runs loader surfaces read failure as ok:false (does NOT degrade to empty like loadRuns)",
    /loadRunsForOwners[\s\S]*?if \(error\) return \{ rows: \[\], ok: false \}/.test(ent));

  // ── STATIC: the cluster resolver's own fail-closed contract. ──
  const cl = read("lib", "preflight", "free-grant-cluster.ts");
  ok("resolveCanonicalCluster returns ok:false when the DB is unconfigured", /isDatabaseConfigured\(\)\) return \{ canonical, members: \[self\], ok: false \}/.test(cl));
  ok("resolveCanonicalCluster returns ok:false on a query error (missing column / transient)", /if \(error\) \{[\s\S]*?members: \[self\], ok: false/.test(cl));
  ok("the override is single-use: consumeFreeGrantOverride sets consumed_at guarded by is('consumed_at', null)",
    /consumeFreeGrantOverride[\s\S]*?consumed_at: nowIso[\s\S]*?\.is\("consumed_at", null\)/.test(cl));
  ok("recordFreeGrantRisk is best-effort and swallows errors (never blocks a run)",
    /recordFreeGrantRisk[\s\S]*?try \{[\s\S]*?\} catch \{[\s\S]*?\}/.test(cl));
  ok("the risk table only ever receives a HASHED ip/device (ip_hash / device_hash keys, no raw ip/device)",
    /ip_hash: input\.ipHash/.test(cl) && /device_hash: input\.deviceHash/.test(cl)
      && !/\bip:\s*input\.ip\b/.test(cl) && !/\bdevice:\s*input\.device\b/.test(cl));

  // ── STATIC: OAuth signup now records the cluster key. This is the actual closure of the hole. ──
  const prof = read("lib", "user-profile.ts");
  ok("upsertUserProfile (the path syncUserProfileIdentity/OAuth flows through) writes canonical_email",
    /canonical_email: canonicalizeEmail\(normalizedEmail\)/.test(prof));
  ok("upsertUserProfile retries WITHOUT canonical_email if the column is missing (code-ahead-of-migration safe)",
    /42703[\s\S]*?upsert\(basePayload\)/.test(prof));

  // ── STATIC: both launch routes consume the comp + capture the signal ONLY in free mode, and only AFTER
  //    the run is created (so a failed insert never burns a comp). ──
  for (const route of [["app", "api", "preflight", "apps", "[id]", "runs", "route.ts"], ["app", "api", "preflight", "runs", "[runId]", "rerun", "route.ts"]]) {
    const src = read(...route);
    const label = route.includes("rerun") ? "rerun route" : "app run route";
    ok(`${label}: free mode is flagged and handled after creation`, /gate\.mode === "free"[\s\S]*?usedFreePass = true/.test(src));
    ok(`${label}: consumes the comp + records the signal only when usedFreePass`, /if \(usedFreePass\) \{[\s\S]*?consumeFreeGrantOverride[\s\S]*?recordFreeGrantRisk/.test(src));
    ok(`${label}: passes a HASHED ip/device to the risk signal (never raw)`, /ipHash: hashRiskSignal\(/.test(src) && /deviceHash: hashRiskSignal\(/.test(src));
  }

  // ── STATIC: the operator comp route is admin-gated and audited. ──
  const admin = read("app", "api", "v", "admin", "free-grant", "route.ts");
  ok("operator comp route is admin-gated (isAdmin) on BOTH verbs", (admin.match(/if \(!isAdmin\(/g) ?? []).length >= 2);
  ok("operator comp requires a justification (audit trail)", /reason_required/.test(admin));
  ok("operator comp writes an audit event", /free_grant_override_created/.test(admin));

  // ── STATIC: the atomic free-pass claim closes the concurrent double-spend race (the CRITICAL finding). ──
  ok("claimFreePass inserts on the canonical PK and maps 23505 -> already_claimed (the race guard)",
    /claimFreePass[\s\S]*?\.insert\(\{ canonical_email: canonical[\s\S]*?23505[\s\S]*?return "already_claimed"/.test(cl));
  ok("claimFreePass returns 'unavailable' on a missing table / other error (no worse than pre-migration)",
    /claimFreePass[\s\S]*?return "unavailable"/.test(cl));
  ok("releaseFreePass is owner-scoped and only deletes an UNattached claim (never another live claim)",
    /releaseFreePass[\s\S]*?\.delete\(\)\.eq\("canonical_email", canonical\)\.eq\("user_id", norm\(owner\)\)\.is\("run_id", null\)/.test(cl));
  for (const route of [["app", "api", "preflight", "apps", "[id]", "runs", "route.ts"], ["app", "api", "preflight", "runs", "[runId]", "rerun", "route.ts"]]) {
    const src = read(...route);
    const label = route.includes("rerun") ? "rerun route" : "app run route";
    ok(`${label}: free mode must WIN the atomic claim before it is honored`, /gate\.mode === "free"[\s\S]*?claimFreePass\(owner, cluster\.canonical\)/.test(src));
    ok(`${label}: a lost claim ('already_claimed') RE-PRICES to PAYG (no free double-spend)`, /already_claimed"\)\s*\{[\s\S]*?effectiveMode = "payg"/.test(src));
    ok(`${label}: a won claim is RELEASED if the run insert fails (no lock-out)`, /if \(freeClaimCanonical\) await releaseFreePass\(owner, freeClaimCanonical\)/.test(src));
  }
  ok("claimFreePass self-heals an ORPHANED claim (unattached + stale) and retries the insert once",
    /if \(error\.code !== "23505"\) return "unavailable"[\s\S]*?\.is\("run_id", null\)\.lt\("claimed_at", cutoff\)[\s\S]*?insert\(\{ canonical_email: canonical[\s\S]*?return "won"/.test(cl));
  ok("the stale-claim self-heal only clears UNATTACHED, aged rows (never a live/attached claim)",
    /STALE_CLAIM_MS[\s\S]*?\.is\("run_id", null\)\.lt\("claimed_at", cutoff\)/.test(cl));
  ok("the migration documents the operator/cron orphan sweep as defense-in-depth",
    /delete from public\.v_free_pass_claims where run_id is null and claimed_at < now\(\) - interval '1 hour'/.test(read("sql", "vraelis-preflight-9-free-grant-dedup.sql")));
  ok("the migration creates v_free_pass_claims with canonical_email as PRIMARY KEY (one claim per inbox)",
    /create table if not exists public\.v_free_pass_claims[\s\S]*?canonical_email text primary key/.test(read("sql", "vraelis-preflight-9-free-grant-dedup.sql")));

  // ── STATIC: the migration is additive and the cluster index is NON-UNIQUE (existing aliases keep working). ──
  const mig = read("sql", "vraelis-preflight-9-free-grant-dedup.sql");
  ok("migration adds canonical_email to user_profiles", /alter table public\.user_profiles add column if not exists canonical_email/.test(mig));
  ok("the cluster index is NON-unique (a read key, not a signup block)",
    /create index if not exists user_profiles_canonical_email_idx/.test(mig) && !/create unique index[\s\S]*user_profiles_canonical_email/.test(mig));
  ok("the risk table and the operator-override table both exist", /create table if not exists public\.v_free_grant_risk/.test(mig) && /create table if not exists public\.v_free_grant_overrides/.test(mig));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main();
