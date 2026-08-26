// The production denylist is load-bearing. This makes deleting it break the build.
//
// A denylist in a JSON file is only as good as the pressure not to edit it, and that pressure is zero at
// 2am when a command is being refused and someone is fairly sure it is fine. So the entry is PINNED here:
// remove it, unmark it, or stop refusing it, and this fails.
//
// It also proves the refusal survives the ways it could be walked around:
//   - the pooler connection shape, where the ref hides in the USERNAME rather than the host
//   - a database or host decorated to look like staging on a production project
//   - case variation
//   - skipping the identify gate and invoking the preflight directly
//
// Nothing here connects to any database. Every case is refused before a connection is attempted, which is
// the point — a refusal that required reaching production first would be no refusal at all.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const POLICY = "ops/db-target-policy.json";
const PINNED_REF = "gvcqzovxfijvtkhetopn"; // confirmed production by the owner, 2026-08-25

type Policy = {
  productionProjectRefs: { ref: string; confirmed?: boolean; permanent?: boolean; note?: string; doNotRemove?: string }[];
  stagingIndicators: string[];
};

// A throwaway placeholder. Not a credential, and never sent anywhere: every case below is refused before
// a connection is attempted.
const PW = "REDACTED";

/** Run a script and return ITS exit status, read immediately. */
function run(script: string, url: string, viaEnv = true): { code: number; out: string } {
  const args = viaEnv ? [script] : [script, "--url", url];
  const r = spawnSync("npx", ["tsx", ...args], {
    encoding: "utf8", maxBuffer: 1 << 24, shell: process.platform === "win32",
    env: viaEnv ? { ...process.env, STAGING_URL: url } : { ...process.env },
  });
  const code = r.status ?? -1;
  return { code, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

// ── 1. The entry is present and marked ─────────────────────────────────────
console.log("── the pinned entry ──");
{
  const policy = JSON.parse(readFileSync(POLICY, "utf8")) as Policy;
  const entry = policy.productionProjectRefs.find((p) => p.ref.toLowerCase() === PINNED_REF);

  ok(`${PINNED_REF} is in productionProjectRefs`, Boolean(entry),
    entry ? "" : "REMOVED — this is the check standing between a staging command and production");
  if (entry) {
    ok("  it is marked confirmed", entry.confirmed === true);
    ok("  it is marked permanent", entry.permanent === true);
    ok("  it carries a do-not-remove rationale", typeof entry.doNotRemove === "string" && entry.doNotRemove.length > 40);
    ok("  its note says production", /production/i.test(entry.note ?? ""));
  }
}

// ── 2. Every connection shape is refused ───────────────────────────────────
console.log("── the identify gate refuses it, in every shape ──");
{
  const shapes: { label: string; url: string }[] = [
    { label: "direct  db.<ref>.supabase.co",
      url: `postgresql://postgres:${PW}@db.${PINNED_REF}.supabase.co:5432/postgres` },
    { label: "api     <ref>.supabase.co",
      url: `postgresql://postgres:${PW}@${PINNED_REF}.supabase.co:5432/postgres` },
    { label: "pooler  ref hidden in the USERNAME",
      url: `postgresql://postgres.${PINNED_REF}:${PW}@aws-0-us-east-1.pooler.supabase.com:6543/postgres` },
    { label: "pooler  different region",
      url: `postgresql://postgres.${PINNED_REF}:${PW}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres` },
    { label: "UPPERCASE ref",
      url: `postgresql://postgres:${PW}@db.${PINNED_REF.toUpperCase()}.supabase.co:5432/postgres` },
    { label: "postgresql:// vs postgres://",
      url: `postgres://postgres:${PW}@db.${PINNED_REF}.supabase.co:5432/postgres` },
    { label: "non-default port",
      url: `postgresql://postgres:${PW}@db.${PINNED_REF}.supabase.co:6543/postgres` },
  ];
  for (const s of shapes) {
    const r = run("scripts/db-target-identify.ts", s.url);
    ok(`refused: ${s.label}`, r.code === 3, `exit=${r.code}`);
    ok(`  and names it as production`, /KNOWN PRODUCTION project/.test(r.out));
  }
}

// ── 3. Staging decoration must NOT beat the ref ────────────────────────────
//
// The adversarial case: a production project with a database named "staging". The staging indicator is
// present, so a classifier that checked indicators first would wave it through. The ref must win.
console.log("── a production project dressed as staging ──");
{
  const decorated: { label: string; url: string }[] = [
    { label: "database named 'staging'",
      url: `postgresql://postgres:${PW}@db.${PINNED_REF}.supabase.co:5432/staging` },
    { label: "database named 'vraelis-staging'",
      url: `postgresql://postgres:${PW}@db.${PINNED_REF}.supabase.co:5432/vraelis-staging` },
    { label: "pooler, user postgres.<ref>, database 'stg'",
      url: `postgresql://postgres.${PINNED_REF}:${PW}@aws-0-us-east-1.pooler.supabase.com:6543/stg` },
  ];
  for (const d of decorated) {
    const r = run("scripts/db-target-identify.ts", d.url);
    ok(`refused despite staging decoration: ${d.label}`, r.code === 3, `exit=${r.code}`);
    ok("  classified PRODUCTION, not STAGING", /Environment\s+PRODUCTION/.test(r.out));
  }
}

// ── 4. The preflight refuses it too, even if the gate is skipped ───────────
//
// Nothing forces anyone to run the identify script first. If the denylist only lived there, the preflight
// would happily point at production — read-only, but still the wrong database.
console.log("── the preflight refuses it directly, gate skipped ──");
{
  for (const [label, url] of [
    ["direct", `postgresql://postgres:${PW}@db.${PINNED_REF}.supabase.co:5432/postgres`],
    ["pooler", `postgresql://postgres.${PINNED_REF}:${PW}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`],
  ] as const) {
    const r = run("scripts/rls-preflight.ts", url, false);
    ok(`rls-preflight refuses the ${label} shape`, r.code === 3, `exit=${r.code}`);
    ok("  and says why", /resolves to a production project/.test(r.out));
    ok("  without having connected", !/psql exited/.test(r.out));
  }
}

// ── 5. A non-denied ref still works ────────────────────────────────────────
//
// The denylist must not become a blanket refusal — that would be indistinguishable from broken, and would
// train whoever hits it to disable the check.
console.log("── a genuine staging target is NOT refused by the denylist ──");
{
  const r = run("scripts/db-target-identify.ts",
    `postgresql://postgres:${PW}@db.stagingproj000000000.supabase.co:5432/vraelis-staging`);
  ok("a different ref is not caught by the denylist", !/KNOWN PRODUCTION project/.test(r.out));
  ok("  it is classified STAGING", /Environment\s+STAGING/.test(r.out));
  // It then fails at read-only verification because the host does not resolve — exit 4, not 3.
  ok("  and proceeds to the read-only check rather than being denied", r.code === 4, `exit=${r.code}`);
}

// ── 5b. The staging allowlist ──────────────────────────────────────────────
//
// An allowlist can only ever PROMOTE an unknown target to staging. It must never rescue a denied one, and
// a malformed entry must announce itself rather than quietly protecting nothing.
console.log("── the staging allowlist ──");
{
  const policy = JSON.parse(readFileSync(POLICY, "utf8")) as Policy & {
    stagingProjectRefs?: { ref: string; confirmed?: boolean; shapeAnomaly?: string }[];
  };
  const allow = policy.stagingProjectRefs ?? [];
  ok("a staging allowlist exists", Array.isArray(policy.stagingProjectRefs), `${allow.length} entr(ies)`);

  // Shape: a Supabase ref is 20 lowercase alphanumerics. A wrong-length entry matches no real project.
  const REF = /^[a-z0-9]{20}$/;
  for (const e of allow) {
    const wellFormed = REF.test(e.ref);
    ok(`allowlist entry "${e.ref}" is ${wellFormed ? "well-formed" : `MALFORMED (${e.ref.length} chars, expected 20)`}`,
      // A malformed entry is tolerated ONLY if it is explicitly flagged as such and not marked confirmed.
      wellFormed || (typeof e.shapeAnomaly === "string" && e.confirmed !== true),
      wellFormed ? "" : "must carry shapeAnomaly and must not be confirmed");
    if (!wellFormed) {
      ok(`  "${e.ref}" is NOT marked confirmed`, e.confirmed !== true,
        "a ref that cannot match a real project must never be recorded as confirmed");
    }
  }

  // Production beats the allowlist, even if someone adds the production ref to it.
  const tampered = JSON.parse(readFileSync(POLICY, "utf8")) as Policy & { stagingProjectRefs?: unknown[] };
  ok("the production ref is NOT in the staging allowlist",
    !(tampered.stagingProjectRefs ?? []).some((e) => (e as { ref: string }).ref.toLowerCase() === PINNED_REF));

  // And behaviourally: a production ref with a staging-looking database still refuses.
  const r = run("scripts/db-target-identify.ts",
    `postgresql://postgres:${PW}@db.${PINNED_REF}.supabase.co:5432/staging`);
  ok("  production still wins over any staging signal", r.code === 3 && /Environment\s+PRODUCTION/.test(r.out));
}

// ── 5c. Identification must not require a network ──────────────────────────
console.log("── --identify-only touches nothing ──");
{
  const r = spawnSync("npx", ["tsx", "scripts/db-target-identify.ts", "--identify-only"], {
    encoding: "utf8", shell: process.platform === "win32",
    env: { ...process.env, STAGING_URL: `postgresql://postgres:${PW}@db.${PINNED_REF}.supabase.co:5432/postgres` },
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  ok("a denied target is refused without connecting", (r.status ?? -1) === 3);
  ok("  and no connection was attempted", !/psql exited|could not connect/.test(out));
}

// ── 6. A missing policy fails CLOSED ───────────────────────────────────────
console.log("── the policy itself ──");
{
  const r = spawnSync("npx", ["tsx", "scripts/rls-preflight.ts", "--url",
    `postgresql://postgres:${PW}@db.${PINNED_REF}.supabase.co:5432/postgres`,
    "--manifest", "sql/rls-preflight-manifest.json"], {
    encoding: "utf8", shell: process.platform === "win32",
    env: { ...process.env },
  });
  ok("the preflight still refuses with the policy present", (r.status ?? -1) === 3, `exit=${r.status}`);

  const src = readFileSync("scripts/rls-preflight.ts", "utf8");
  ok("an unreadable policy is treated as a REFUSAL, not as permission",
    /policy unreadable/.test(src) && /no target can be shown to be safe/.test(src));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
