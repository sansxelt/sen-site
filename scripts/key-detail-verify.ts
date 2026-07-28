// THE NUMBERS ON A KEY'S PAGE, TESTED AS ARITHMETIC.
//
// Every figure a customer reads about one API key is decided by a pure function in key-detail.ts. That was
// the point of splitting them out: a number about money that only a live database can exercise is a number
// nobody exercises. These run the arithmetic directly, with rows shaped like the ones production actually
// holds, plus static checks on the page that renders them.
//
// The four properties that matter most, and each is a way this page could lie:
//
//   A WITHDRAWN VERDICT MUST NOT BE SCORED. 14 of 43 production runs are invalidated. They charged what
//   they charged, so they count for money; their conclusion was formally retracted, so counting them in a
//   pass rate would republish a verdict the company took back.
//
//   A PLAN-COVERED RUN IS NOT A FREE RUN. It costs 0 dollars and a real number of journeys. Averaging it
//   into cost-per-verification reports a price no PAYG customer will ever be charged.
//
//   THE VERDICT VOCABULARY IS NOT THIS FILE'S TO INVENT. The decision column says ready / needs_review /
//   blocked / repair_verified / infra_failure. What a customer's CI exited on is verified / failed /
//   blocked, from ONE translator. A pass rate computed off the raw column would disagree with the exit
//   code the customer saw, which is the exact class of defect this product exists to catch.
//
//   DURATION IS MEASURED. The cost governor estimates browser time as flow_units * 60. Production's median
//   run is 9 seconds, so that estimate is out by roughly 6x. It is a deliberately conservative bound for
//   capping spend and would be a lie on a customer's page.
import { readFileSync } from "node:fs";
import {
  durationSecondsOf, durationStats, verdictTally, costStats, bucketByDay, bucketByHour, dayKey,
  type DetailRunRow,
} from "../lib/preflight/key-detail";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const NOW = Date.parse("2026-07-27T12:00:00.000Z");
const day = (n: number) => new Date(NOW - n * 86400000).toISOString();

function row(o: Partial<DetailRunRow> & { id: string }): DetailRunRow {
  return {
    id: o.id, created_at: o.created_at ?? day(0), started_at: o.started_at ?? o.created_at ?? day(0),
    completed_at: o.completed_at ?? null, state: o.state ?? "completed", decision: o.decision ?? null,
    held_cents: o.held_cents ?? null, credits_held: o.credits_held ?? 0, flow_units: o.flow_units ?? null,
    deployment_url: o.deployment_url ?? null, invalidated_at: o.invalidated_at ?? null,
    guarantee_id: o.guarantee_id ?? null,
  };
}

console.log("── duration is measured, never derived from flow count ──");
{
  const r = row({ id: "a", started_at: "2026-07-27T10:00:00.000Z", completed_at: "2026-07-27T10:00:09.000Z" });
  ok("start to finish, in seconds", durationSecondsOf(r) === 9);
  ok("no completion means no duration, not zero",
    durationSecondsOf(row({ id: "b", completed_at: null })) === null);
  // A zero would be counted in the median and drag "typical" toward a time no run ever took.
  ok("a clock artefact is refused rather than reported as negative time",
    durationSecondsOf(row({ id: "c", started_at: "2026-07-27T10:00:09.000Z", completed_at: "2026-07-27T10:00:00.000Z" })) === null);

  const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 155].map((s, i) =>
    row({ id: `d${i}`, started_at: "2026-07-27T10:00:00.000Z", completed_at: new Date(Date.parse("2026-07-27T10:00:00.000Z") + s * 1000).toISOString() }));
  const st = durationStats(rows);
  ok("median, not mean: one 155s run does not become the typical run", st.medianSeconds === 6, `got ${st.medianSeconds}`);
  ok("the tail is reported rather than hidden", st.longestSeconds === 155 && (st.p95Seconds ?? 0) >= 9, `p95 ${st.p95Seconds}`);
  ok("runs with no duration are excluded from the count", durationStats([...rows, row({ id: "z" })]).count === 10);
  ok("no completed runs means no figure, not 0s", durationStats([row({ id: "z" })]).medianSeconds === null);
}

console.log("\n── a withdrawn verdict is never scored ──");
{
  const rows = [
    row({ id: "1", state: "completed", decision: "ready" }),
    row({ id: "2", state: "completed", decision: "ready" }),
    row({ id: "3", state: "completed", decision: "needs_review" }),
    row({ id: "4", state: "completed", decision: "blocked" }),
    row({ id: "5", state: "completed", decision: "ready", invalidated_at: day(0) }),
  ];
  const t = verdictTally(rows);
  ok("an invalidated run is counted as invalidated", t.invalidated === 1);
  ok("and excluded from every verdict bucket", t.verified + t.failed + t.blocked + t.inProgress + t.unproven === 4,
    JSON.stringify(t));
  ok("so it cannot inflate the pass rate", t.decided === 4 && t.verified === 2 && Math.abs((t.passRate ?? 0) - 0.5) < 1e-9,
    `passRate ${t.passRate}`);
  ok("no decided runs means no pass rate, not 0%", verdictTally([]).passRate === null);
  // 0% would accuse a key that has never run anything of failing everything.
  ok("a key with only in-flight runs has no pass rate",
    verdictTally([row({ id: "x", state: "running", decision: null })]).passRate === null);
}

console.log("\n── the verdict vocabulary comes from the one translator ──");
{
  // repair_verified is the case that matters: a targeted repair rerun did NOT pass the full scope, and the
  // API, the webhook and the CI gate all report it as blocked. Counting it as a pass here would inflate
  // this figure with precisely the claim the product refuses.
  const t = verdictTally([row({ id: "r", state: "completed", decision: "repair_verified" })]);
  ok("repair_verified is blocked, not verified", t.blocked === 1 && t.verified === 0, JSON.stringify(t));
  ok("ready is the verified case", verdictTally([row({ id: "r", state: "completed", decision: "ready" })]).verified === 1);
  // THE INVERSION THAT WILL TRIP THE NEXT READER, PINNED SO IT CANNOT DRIFT.
  //
  // The engine's decision column and the public vocabulary share the word "blocked" and do not mean the
  // same thing by it. decision "blocked" means the deployment did not keep the promise, which is a public
  // FAILED. "needs_review" means no verdict was reached, which is the public BLOCKED. Writing this test
  // from the column name gave the wrong answer, which is the whole argument for delegating to one
  // translator instead of reading the column anywhere a number is displayed.
  ok('decision "blocked" is the public FAILED',
    verdictTally([row({ id: "b", state: "completed", decision: "blocked" })]).failed === 1);
  ok('decision "needs_review" is the public BLOCKED',
    verdictTally([row({ id: "n", state: "completed", decision: "needs_review" })]).blocked === 1);
  ok("a run that never completed cannot have verified anything",
    verdictTally([row({ id: "f", state: "failed", decision: "ready" })]).verified === 0);
  const src = readFileSync("lib/preflight/key-detail.ts", "utf8");
  ok("it delegates rather than reading the decision column itself",
    /from "\.\/home-verdict"/.test(src) && /runVerdict\(/.test(src)
    && !/decision === "ready"|decision === "blocked"/.test(src));
}

console.log("\n── a plan-covered run is not a free run ──");
{
  const rows = [
    row({ id: "p1", held_cents: 1500 }),
    row({ id: "p2", held_cents: 500 }),
    row({ id: "s1", held_cents: null, flow_units: 3 }),   // subscription: 0 money, real allowance
    row({ id: "f1", held_cents: null, flow_units: null }), // neither
  ];
  const c = costStats(rows);
  ok("only charged runs count toward cost per verification", c.paidRuns === 2);
  ok("the plan-covered run is counted as its own thing", c.planRuns === 1, JSON.stringify(c));
  ok("mean is over paid runs only, never diluted by the zeroes",
    c.meanCentsPerPaidRun === 1000, `got ${c.meanCentsPerPaidRun}`);
  ok("the total is every charge", c.totalCents === 2000);
  ok("nothing charged means no per-verification figure, not $0.00",
    costStats([row({ id: "s", held_cents: null, flow_units: 2 })]).meanCentsPerPaidRun === null);
}

console.log("\n── a sparse history looks sparse ──");
{
  const rows = [
    row({ id: "a", created_at: day(0), decision: "ready", state: "completed", held_cents: 100 }),
    row({ id: "b", created_at: day(14), decision: "blocked", state: "completed" }),
    row({ id: "c", created_at: day(29), decision: "ready", state: "completed" }),
    row({ id: "old", created_at: day(90), decision: "ready", state: "completed", held_cents: 999 }),
  ];
  const b = bucketByDay(rows, { nowMs: NOW, days: 30 });
  ok("every day in the window is emitted, including the empty ones", b.length === 30);
  ok("gaps are actually gaps", b.filter((x) => x.runs === 0).length === 27, `${b.filter((x) => x.runs === 0).length} empty`);
  ok("the buckets are in order, oldest first", b[0].day < b[29].day);
  ok("today is the last bucket", b[29].day === dayKey(day(0)));
  ok("a run outside the window is not folded into the edge",
    b.reduce((s, x) => s + x.runs, 0) === 3 && b.reduce((s, x) => s + x.chargedCents, 0) === 100);
  // b[15] is the day(14) run, whose decision "blocked" is the public FAILED (see the inversion above).
  ok("verdicts are bucketed too", b[29].verified === 1 && b[15].failed === 1, JSON.stringify([b[29], b[15]]));

  const inv = bucketByDay([row({ id: "i", created_at: day(0), decision: "ready", state: "completed", held_cents: 250, invalidated_at: day(0) })], { nowMs: NOW, days: 30 });
  ok("an invalidated run still counts as a run and a charge", inv[29].runs === 1 && inv[29].chargedCents === 250);
  ok("but never as a verdict", inv[29].verified === 0);

  const h = bucketByHour([row({ id: "h", created_at: "2026-07-27T13:30:00.000Z" })]);
  ok("hours are always all 24", h.length === 24);
  ok("and land in the right one, in UTC", h[13] === 1 && h.reduce((s, n) => s + n, 0) === 1);
}

console.log("\n── the page cannot invent what is not recorded ──");
{
  const page = readFileSync("app/rank/app/developers/keys/[id]/page.tsx", "utf8");
  const lib = readFileSync("lib/preflight/key-detail.ts", "utf8");
  // Production carries 0 ai_tokens across 62 ledger rows and 43 runs. Any token figure here is fabricated.
  //
  // The word is BANNED OUTRIGHT in the rendered code, with one sanctioned exception: the sentence that
  // tells a reader there is no such figure. An earlier version looked for `token:` or `tokens=` shapes and
  // a mutation adding `<Stat k="Tokens" v={String(d.runs * 1200)} />` walked straight past it. A guard
  // against fabrication that only catches one spelling of the fabrication is not a guard.
  const DISCLOSURE = /No token counts here\.[\s\S]*?this page\./;
  const pageCode = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok("the page says there is no token figure, rather than staying silent about it", DISCLOSURE.test(page));
  ok("and renders no token figure anywhere else",
    !/token/i.test(pageCode(page).replace(DISCLOSURE, "")),
    (pageCode(page).replace(DISCLOSURE, "").match(/.{0,30}token.{0,30}/i) ?? [""])[0]);
  ok("neither file reads ai_tokens", !/ai_tokens/.test(page) && !/select\([^)]*ai_tokens/.test(lib));
  // flow_units * 60 is the cost governor's bound for capping spend, not a duration anyone measured.
  // CODE ONLY, COMMENTS STRIPPED. Both files explain in prose that they refuse the cost governor's
  // flow_units * 60 derivation, so any check that reads the raw text finds the phrase it is banning inside
  // the explanation of why it is banned. An earlier version also banned "* 60" anywhere, which matched the
  // DAY_MS constant (24 * 60 * 60 * 1000) and reported correct code as broken. Twice now a guard in this
  // repo has failed by searching prose; strip first, then assert.
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok("duration is not the flow-count estimate",
    !/flow_?[uU]nits\s*\*\s*60|flowCount\s*\*\s*60/.test(code(lib) + code(page)));
  ok("it is measured from the run's own timestamps instead",
    /completed_at/.test(code(lib)) && /started_at/.test(code(lib)));

  ok("ownership comes from the caller's own key list, not the id in the URL",
    /listApiKeys\(email\)/.test(page) && /keys\.find\(\(k\) => k\.id === id\)/.test(page) && /notFound\(\)/.test(page));
  ok("an unauthenticated visitor is sent to sign in, keeping their destination",
    /redirect\(`\/signin\?callbackUrl=/.test(page));
  // The run read is filtered by user_id AND api_key_id; either alone is a cross-tenant leak.
  ok("the run read is scoped by owner as well as key",
    /\.eq\("user_id", uid\)[\s\S]{0,80}\.eq\("api_key_id", key\.id\)/.test(lib));

  const list = readFileSync("app/rank/app/api/page.tsx", "utf8");
  ok("the key list actually links into the page", /href=\{`\/developers\/keys\/\$\{k\.id\}`\}/.test(list));
}

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
