// DOES THE CONTINUITY PROBE MEASURE WHAT IT CLAIMS TO MEASURE?
//
// Three times now that probe has produced a confident, plausible number that was wrong, and each time the
// number sent someone to re-tune an animation that was fine:
//
//   it parsed only rgb(), so a ground resolving in oklab contributed zero to every delta and the busiest
//     stretch of chapter 3 read as five dead notches;
//   it counted a pin's entry and exit frames, where everything translates at scroll speed, so one chapter
//     averaged 22,202 against another's 674 and the comparison meant nothing;
//   it synthesised a touch tap that landed in the nav, followed a link, and then passed every check on the
//     empty page that came back.
//
// None of those failed loudly. A continuity measure that is subtly wrong hands you a number and a list of
// things to fix. So the probe is no longer trusted against the real page until it has been run against
// pages whose behaviour is known by construction, and shown to report it.
//
// Each fixture below is a five-chapter page with the same structure the probe expects and ONE deliberate
// property per chapter: constant motion, a dead interval, a single spike, a graceful exit, an abrupt one.
// The expectations are derived from the fixture, not from a previous run of the probe -- a golden file
// recorded from the instrument under test would only prove it is consistent with its own mistakes.
//
//   node ops/v6-continuity-fixtures.mjs
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

let failures = 0;
const ok = (n, c, d = "") => { console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${d ? `  — ${d}` : ""}`); if (!c) failures++; };

// ── the fixture page ──────────────────────────────────────────────────────────────────────────────────
// --p is driven straight from scroll geometry, with no easing: the point is a known input, not a faithful
// re-implementation of the engine. Each chapter maps --p to its own deliberate profile.
const fixture = (variant) => `<!doctype html><meta charset="utf-8">
<title>continuity fixture: ${variant}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #fff; font: 16px/1.4 system-ui, sans-serif; }
  .v6 { --paper: #ffffff; --graphite: #0a0a0b; }
  .ch { position: relative; height: 400vh; }
  .pinbox { position: ${variant === "fallback" ? "static" : "sticky"}; top: 0; height: 100vh;
            overflow: hidden; display: grid; place-items: center; }
  .stage { width: min(900px, 90vw); margin-inline: auto; text-align: center; }
  .mover { font-size: 40px; font-weight: 600; }
  .note { font-size: 15px; color: #555; }
</style>
<div class="v6">
  <!-- 1. CONSTANT: one element travels linearly across the whole chapter. -->
  <section class="v6-gap ch" id="gap"><div class="v6-gap__pin pinbox"><div class="v6-gap__stage stage">
    <p class="mover" id="gapMover">constant</p><p class="note">linear travel, no holds</p>
  </div></div></section>

  <!-- 2. DEAD INTERVAL: moves for p<0.2 and p>0.8, nothing in between. -->
  <section class="v6-au ch" id="au"><div class="v6-au__pin pinbox"><div class="v6-au__stage stage">
    <p class="mover" id="auMover">dead middle</p><p class="note">still across 0.2 - 0.8</p>
  </div></div></section>

  <!-- 3. SPIKE: small constant travel, plus one large jump in a narrow window at 0.5. -->
  <section class="v6-st ch" id="st"><div class="v6-st__pin pinbox"><div class="v6-st__stage stage">
    <p class="mover" id="stMover">spike</p><p class="note">one lurch at 0.5</p>
  </div></div></section>

  <!-- 4. GRACEFUL EXIT: travels, and is gone by the time the pin releases. -->
  <section class="v6-rg ch" id="rg"><div class="v6-rg__pin pinbox"><div class="v6-rg__stage stage">
    <p class="mover" id="rgMover">fades out</p><p class="note">exit-lit should be low</p>
  </div></div></section>

  <!-- 5. ABRUPT EXIT: travels, and is still fully lit when the pin releases. -->
  <section class="v6-dr ch" id="dr"><div class="v6-dr__pin pinbox"><div class="v6-dr__stage stage">
    <p class="mover" id="drMover">stays lit</p><p class="note">exit-lit should be high</p>
  </div></div></section>
</div>
<script>
  const VARIANT = ${JSON.stringify(variant)};
  const chapters = ["gap", "au", "st", "rg", "dr"];
  function apply() {
    for (const k of chapters) {
      const wrap = document.getElementById(k);
      const pin = wrap.firstElementChild;
      const r = wrap.getBoundingClientRect();
      const denom = Math.max(1, wrap.offsetHeight - pin.offsetHeight);
      const p = Math.min(1, Math.max(0, -r.top / denom));
      wrap.style.setProperty("--p", String(p));
      const mover = document.getElementById(k + "Mover");

      if (VARIANT === "colour") {
        // ONLY the ground moves. Nothing geometric changes at all, and the mix is in oklab exactly as the
        // real chapter 3 does it, so a probe that cannot read oklab reports this page as completely dead.
        wrap.style.background = "color-mix(in oklab, #0a0a0b " + (p * 100).toFixed(2) + "%, #ffffff)";
        mover.style.transform = "none";
        mover.style.opacity = "1";
        continue;
      }
      wrap.style.background = "#fff";

      if (k === "gap") {
        mover.style.transform = "translateY(" + (p * 300).toFixed(2) + "px)";
        mover.style.opacity = "1";
      } else if (k === "au") {
        const q = p < 0.2 ? p / 0.2 : p > 0.8 ? 1 + (p - 0.8) / 0.2 : 1;
        mover.style.transform = "translateY(" + (q * 150).toFixed(2) + "px)";
        mover.style.opacity = "1";
      } else if (k === "st") {
        // Base travel matches the CONSTANT chapter, so this fixture is "smooth motion WITH one lurch"
        // rather than "dead with one lurch". It was built with 20px of base travel, which is near-still
        // across a whole chapter, so the probe called its quiet notches stalls -- correctly. The fixture
        // was wrong, not the instrument, and a fixture that encodes the wrong intent will happily send you
        // to fix a measurement that was right.
        const base = p * 300;
        const spike = p >= 0.5 ? 400 : 0;
        mover.style.transform = "translateY(" + (base + spike).toFixed(2) + "px)";
        mover.style.opacity = "1";
      } else if (k === "rg") {
        // THE WHOLE STAGE FADES, not just the mover. exit-lit averages every part in the pin, so fading
        // one element of three left it at 0.67 -- which is the correct average of a scene that mostly did
        // not leave. A graceful handoff means the SCENE goes, and the fixture has to mean that too.
        mover.style.transform = "translateY(" + (p * 200).toFixed(2) + "px)";
        mover.parentElement.style.opacity = String(Math.max(0, 1 - p / 0.85));
      } else if (k === "dr") {
        mover.style.transform = "translateY(" + (p * 200).toFixed(2) + "px)";
        mover.style.opacity = "1";
      }
    }
  }
  addEventListener("scroll", apply, { passive: true });
  addEventListener("resize", apply);
  apply();
</script>`;

const dir = mkdtempSync(join(tmpdir(), "v6fix-"));
const write = (name, html) => { const p = join(dir, name); writeFileSync(p, html, "utf8"); return pathToFileURL(p).href; };

const run = (url, extra = []) => {
  const r = spawnSync("node", ["ops/v6-continuity-probe.mjs", url, "--only=1366x657", ...extra],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return { out: (r.stdout || "") + (r.stderr || ""), status: r.status };
};

// "  .v6-gap   21 notches  mean    900  peak/med   1.1  stalled  0/21  longest dead run 0  exit-lit 1.00"
//
// The ratio's LABEL is matched as \S+ rather than spelled out. It was spelled out, the probe's label
// changed from peak/mean to peak/med when the reference moved to the median, and this parser then matched
// nothing and reported "saw none" for every chapter -- a harness that silently stops reading its subject
// is the same failure it exists to catch. The numbers are positional; the word between them is not data.
const parse = (out) => {
  const rows = {};
  for (const m of out.matchAll(
    /\.v6-(\w+)\s+(\d+) notches\s+mean\s+(\d+)\s+\S+\s+([\d.]+)\s+stalled\s+(\d+)\/(\d+)\s+longest dead run (\d+)\s+peakw (\d+)(?:\s+exit-lit ([\d.]+))?/g)) {
    rows[m[1]] = { notches: +m[2], mean: +m[3], pm: +m[4], stalls: +m[5], longest: +m[7], peakWidth: +m[8],
                   exitLit: m[9] === undefined ? null : +m[9] };
  }
  return rows;
};

console.log("\n  ── the probe against pages whose behaviour is known by construction ──\n");

const mainUrl = write("main.html", fixture("pinned"));
const main = run(mainUrl);
if (process.argv.includes("--dump")) {
  writeFileSync(join(dir, "probe-output.txt"), main.out, "utf8");
  console.log(`  [dump] fixture dir: ${dir}`);
}
const r = parse(main.out);

// DID THE PROBE ACTUALLY LOAD THE FIXTURE? This is the first thing asked, because the first run of this
// harness did not: the probe's URL argument only matched http(s), so every file:// fixture fell through to
// the default localhost URL and the LIVE HOMEPAGE was measured against the fixtures' expectations. Nine
// checks failed and every one of them was read as a finding about the page.
//
// The fixture is five chapters of 400vh, so its document height is knowable in advance and is nothing like
// the homepage's. Comparing them is how this harness proves it is looking at what it built.
const docOf = (out) => { const m = /([0-9]+)px in a ([0-9]+)px window/.exec(out); return m ? { doc: +m[1], vh: +m[2] } : null; };
{
  const d = docOf(main.out);
  const expected = d ? d.vh * 20 : 0;               // 5 chapters x 400vh
  ok("the probe loaded the FIXTURE, not something else", d !== null && Math.abs(d.doc - expected) < expected * 0.15,
    d ? `document ${d.doc}px, expected about ${expected}px for a 5 x 400vh fixture` : "no document height reported");
}

ok("the probe read all five fixture chapters", Object.keys(r).length === 5,
  `saw ${Object.keys(r).join(", ") || "none"}`);
if (Object.keys(r).length === 5) {
  console.log(`        gap ${JSON.stringify(r.gap)}`);
  console.log(`        au  ${JSON.stringify(r.au)}`);
  console.log(`        st  ${JSON.stringify(r.st)}`);
  console.log(`        rg  ${JSON.stringify(r.rg)}`);
  console.log(`        dr  ${JSON.stringify(r.dr)}`);

  // WAS 5, THEN 3, AND IS NOW 0 -- and the journey is the useful part. The constant chapter first read
  // four stalled notches, which looked like a fixture artifact worth tolerating. Rendering those exact
  // scroll positions showed the chapter ARRIVING rather than held: the pin was not stuck and the scene was
  // moving one notch per notch. Stalls are now only counted while a scene is pinned, and a chapter built
  // to travel continuously reports exactly what it should. Tolerating the four would have hidden that.
  ok("CONSTANT motion reports no dead run at all", r.gap.longest === 0,
    `${r.gap.stalls} stalls, longest run ${r.gap.longest}`);
  // THE DISCRIMINATING TEST, and the one that does not depend on the tail's exact length: a chapter built
  // to hold still across 60% of itself must read as far deader than one built to travel continuously.
  // If the instrument could not tell those apart, every number it produces about the real page is noise.
  ok("a real dead interval is clearly distinguished from a saturated tail",
    r.au.longest >= r.gap.longest * 2,
    `dead-interval run ${r.au.longest} vs constant-motion run ${r.gap.longest}`);
  ok("CONSTANT motion reports a flat peak/median", r.gap.pm < 1.8, `peak/median ${r.gap.pm}`);

  ok("a DEAD INTERVAL is detected as a run of stalls", r.au.longest >= 4,
    `longest dead run ${r.au.longest} (fixture holds still across 60% of the chapter)`);
  ok("the dead interval is roughly the size the fixture built", r.au.stalls >= r.au.notches * 0.35,
    `${r.au.stalls}/${r.au.notches} stalled`);

  ok("a SPIKE is detected by peak/median", r.st.pm >= 4, `peak/median ${r.st.pm}`);
  // Expressed against the constant chapter's own tail rather than a bare number. Every chapter in this
  // fixture ends with the same few saturated frames, so the question worth asking is whether the SPIKE
  // adds any dead run beyond that -- which is what a mean-based threshold used to do, calling 25 of 26
  // notches stalled because one lurch had moved the reference.
  ok("the spike does not drag ordinary travel below the stall floor", r.st.longest === 0,
    `spike run ${r.st.longest}, peak/median ${r.st.pm}`);

  // THE RULE THAT DECIDES A LURCH, calibrated here rather than chosen. A discontinuity is one frame wide;
  // travel is not, however large. If these two ever stop separating, the rule is measuring nothing.
  ok("the deliberate lurch is one frame wide", r.st.peakWidth === 1, `peak width ${r.st.peakWidth}`);
  ok("chapters built to travel spread their peak over many frames",
    r.gap.peakWidth >= 10 && r.rg.peakWidth >= 10 && r.dr.peakWidth >= 10,
    `constant ${r.gap.peakWidth}, graceful ${r.rg.peakWidth}, abrupt ${r.dr.peakWidth}`);

  ok("a GRACEFUL exit reports low exit-lit", r.rg.exitLit !== null && r.rg.exitLit < 0.3,
    `exit-lit ${r.rg.exitLit}`);
  ok("an ABRUPT exit reports high exit-lit", r.dr.exitLit !== null && r.dr.exitLit > 0.8,
    `exit-lit ${r.dr.exitLit}`);
  ok("the two handoffs are distinguished from each other",
    r.rg.exitLit !== null && r.dr.exitLit !== null && r.dr.exitLit - r.rg.exitLit > 0.5,
    `${r.rg.exitLit} vs ${r.dr.exitLit}`);
}

// ── the colour term, which is the failure that cost the most ───────────────────────────────────────────
console.log("\n  ── a page whose only motion is colour ──\n");
const colourUrl = write("colour.html", fixture("colour"));
const colour = parse(run(colourUrl).out);
// Nothing geometric moves on this page at all -- the ONLY thing that changes is the ground, mixed in
// oklab exactly as chapter 3 does it. If the probe cannot read that, the page is dead from end to end.
// The tolerance is the same saturated tail every fixture chapter has, not a free pass: the colour-blind
// mutation below drives these runs to the full length of the chapter, which is what a real failure looks
// like next to this.
const colourRuns = Object.values(colour).map((c) => c.longest);
ok("a ground-only page is NOT reported as dead", colourRuns.length > 0 && Math.max(...colourRuns) <= 5,
  colourRuns.length ? `longest runs: ${colourRuns.join(",")}` : "no chapters read");

// ── the fallback composition is measured, not skipped ──────────────────────────────────────────────────
console.log("\n  ── the fallback composition ──\n");
const fbUrl = write("fallback.html", fixture("fallback"));
const fb = run(fbUrl);
const fbRows = parse(fb.out);
ok("an unpinned page still produces chapter readings", Object.keys(fbRows).length >= 3,
  `${Object.keys(fbRows).length} chapters read`);
ok("the fallback run does not silently pass on nothing",
  !/PASS {2}chapters were actually measured[\s\S]*?only 0 chapter/.test(fb.out));

// ── MUTATION: every guard has to fail when the thing it guards is actually broken ──────────────────────
//
// A guard that has never been seen to fail is a guard nobody has tested. Two in this codebase passed green
// on deliberately broken input before anyone checked -- the height-literal scan (its regex backslashes
// eaten by a shell heredoc, so both sets were empty) and the vacuity check itself. So each guard below is
// run against a probe mutated to break exactly what it watches, and the mutation must FAIL it.
//
// The mutants are written into the repository directory rather than the temp one: they import playwright,
// and Node resolves that from the importing file's location.
console.log("\n  ── mutation: each guard against a probe broken in exactly its own way ──\n");
const { readFileSync, mkdirSync, rmSync } = await import("node:fs");
const MUT = ".tmp-mutants";
mkdirSync(MUT, { recursive: true });
const probeSrc = readFileSync("ops/v6-continuity-probe.mjs", "utf8");

const mutant = (name, fn) => {
  const out = fn(probeSrc);
  if (out === probeSrc) { ok(`mutation "${name}" actually changed the probe`, false, "no-op mutation"); return null; }
  const p = join(MUT, `${name}.mjs`);
  writeFileSync(p, out, "utf8");
  return p;
};
const runMutant = (p, url, extra = []) => {
  const r = spawnSync("node", [p, url, "--only=1366x657", ...extra],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return (r.stdout || "") + (r.stderr || "");
};
const failedOn = (out, check) => new RegExp(`FAIL\\s+${check}`).test(out);

// 1. colour parsing removed -> the ground-only page must stop looking alive
{
  const p = mutant("colour-blind", (s) =>
    s.replace('        const ok = /okla?b?\\(\\s*([\\d.]+)/.exec(s);\n        if (ok) return +ok[1];', "")
     .replace("const ok = /okla?b?\\(\\s*([\\d.]+)/.exec(s);", "const ok = null;"));
  if (p) {
    const out = runMutant(p, colourUrl);
    const rows = parse(out);
    const dead = Object.values(rows).some((c) => c.longest >= 4);
    ok("colour-blind probe reports the ground-only page as dead (so the colour term is load-bearing)",
      dead, dead ? "" : "the mutant still saw motion, so the colour term is not what makes that page pass");
  }
}

// 2. no chapters -> the vacuity guard must fail rather than pass on an empty set
{
  const blank = write("blank.html", "<!doctype html><title>blank</title><body style='height:9000px'>nothing here");
  const out = runMutant("ops/v6-continuity-probe.mjs", blank);
  ok("a page with no chapters FAILS the vacuity guard",
    failedOn(out, "chapters were actually measured"), "it passed on an empty page");
}

// 3. frames starved -> the frame-count floor must fail
{
  const p = mutant("frame-starve", (s) => s.replace("for (let i = 0; i <= steps; i++) {", "for (let i = 0; i <= 2; i++) {"));
  if (p) {
    const out = runMutant(p, mainUrl);
    ok("a starved walk FAILS the frame-count floor",
      failedOn(out, "the walk produced frames for most of the scroll"), "a 2-notch walk was accepted");
  }
}

// 4. navigation away -> the URL guard must fail
{
  const p = mutant("nav-away", (s) =>
    s.replace("      await page.waitForTimeout(200);",
      '      await page.waitForTimeout(200);\n      if (i === 3) await page.goto("about:blank");'));
  if (p) {
    const out = runMutant(p, mainUrl);
    ok("leaving the page under test FAILS the navigation guard",
      failedOn(out, "never navigated away from the page under test"), "the walk left the page and passed");
  }
}

// 5. touch input removed -> a touch geometry must stop producing frames rather than report stillness
{
  const p = mutant("no-touch", (s) =>
    s.replace('          await page.evaluate((n) => window.scrollBy({ top: n, behavior: "instant" }), NOTCH);',
      "          /* input removed */"));
  if (p) {
    const out = runMutant(p, mainUrl, ["--only=360x800"]);
    const stuck = /FAIL/.test(out);
    ok("a touch geometry with its input removed FAILS rather than reporting a still page", stuck,
      "no input produced a clean pass, which means the walk is not what moves the page");
  }
}

rmSync(MUT, { recursive: true, force: true });

console.log(failures === 0 ? "\nALL PASS  0 failed" : `\nFAILURES  ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
