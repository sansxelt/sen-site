// IS THE COMPOSITION CONTINUOUS, OR DOES IT STEP?
//
// The other two probes sample named geometries. A page can pass every one of them and still have a cliff
// two pixels outside one of the samples -- a breakpoint that swaps a layout, a max() floor that stops type
// shrinking while the content behind it keeps growing, a width floor that starts pushing the page sideways.
// Nobody owns a 1093x525 screen on purpose; they own a screen and then zoom, rotate, split, or open a
// bookmarks bar, and they travel THROUGH the space rather than landing on points in it.
//
// So this walks the space in small steps and looks at the DERIVATIVE. At each step it fingerprints the
// composition -- layout mode, the type scale of every chapter, the stage measure and centre, whether the
// document has started scrolling sideways -- and compares it with the previous step. A smooth system moves
// a little at every step. A cliff moves a lot at one step and nothing at the others.
//
// Three kinds of finding, and they are not the same thing:
//
//   CLIFF        a fingerprint value jumps between adjacent steps. Some are legitimate and declared below
//                (the 900px composition change is a deliberate re-composition, not a fault); the rest are
//                breakpoints nobody meant to ship.
//   FLOOR+GROW   type has stopped shrinking because it hit a max() floor, while the content it sets keeps
//                getting taller. This is the dangerous one: the system looks stable right up to the point
//                where it silently starts clipping, and the floor is what hides it.
//   SIDEWAYS     the document is wider than the window. A width floor that cannot be honoured does not
//                fail loudly, it just pushes the page off the side of the screen.
//
//   node ops/v6-cliff-sweep.mjs http://localhost:3200/dev-preview/v6
import { chromium } from "playwright";

// THE TARGET URL IS NOT ALLOWED TO FALL BACK SILENTLY.
//
// This read `process.argv.find(a => /^https?:/.test(a))`, so a file:// argument matched nothing and the
// default localhost URL was used instead -- without a word. Every run of the fixture harness, which
// passes
// file:// pages built to have known behaviour, therefore measured the LIVE HOMEPAGE and compared it against
// the fixtures' expectations. The whole instrument-validation exercise tested nothing, and its failures
// were read as findings about the page.
//
// So: file:// is accepted, and an argument that looks like it was meant to be a target but cannot be
// parsed is a hard error rather than a shrug.
const urlArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (urlArg !== undefined) {
  try { new URL(urlArg); } catch {
    console.error(`  not a usable URL: ${urlArg}`);
    process.exit(2);
  }
  if (!/^(https?|file):/.test(urlArg)) {
    console.error(`  unsupported URL scheme: ${urlArg} (expected http, https or file)`);
    process.exit(2);
  }
}
const URL_UNDER_TEST = urlArg || "http://localhost:3200/dev-preview/v6";
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);

let failures = 0;
const ok = (n, c, d = "") => { console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${d ? `  — ${d}` : ""}`); if (!c) failures++; };

// The one re-composition this page declares on purpose: below 900px the chapters change shape (five seals
// become a column, the register drops a track, chapter 3 sets left). Crossing it SHOULD move a lot.
const DECLARED = [{ axis: "w", at: 900, why: "the narrow composition (declared)" }];
// And the two gates, which are re-compositions by design rather than cliffs by accident.
const GATES = [
  { axis: "h", at: 520, why: "wide composition gives out (declared gate)" },
  { axis: "h", at: 660, why: "narrow composition gives out (declared gate)" },
];

const declaredNear = (axis, a, b) =>
  [...DECLARED, ...GATES].some((d) => d.axis === axis && Math.min(a, b) <= d.at && d.at <= Math.max(a, b));

const fingerprint = async (page) =>
  page.evaluate(() => {
    const num = (s, p) => {
      const e = document.querySelector(s);
      return e ? parseFloat(getComputedStyle(e)[p]) || 0 : 0;
    };
    const pinned = (k) => {
      const e = document.querySelector(`.v6-${k} [class*="__pin"]`);
      return e ? getComputedStyle(e).position === "sticky" : false;
    };
    const rect = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { w: b.width, c: (b.left + b.right) / 2 };
    };
    const stage = rect(".v6-gap__stage");
    return {
      pinned: ["gap", "au", "st", "rg", "dr"].map(pinned),
      // the type scale of every chapter: what the density system is actually doing
      type: {
        gapWord: num(".v6-gap__wordt", "fontSize"),
        auH: num(".v6-au__h", "fontSize"),
        auSays: num(".v6-au__says", "fontSize"),
        stH: num(".v6-st__h", "fontSize"),
        stCondt: num(".v6-st__condt", "fontSize"),
        rgT: num(".v6-rg__t", "fontSize"),
        drH: num(".v6-dr__h", "fontSize"),
        drLh: num(".v6-dr__lh", "fontSize"),
        drNow: num(".v6-dr__now", "fontSize"),
      },
      // the content those sizes set: if type stops shrinking and this keeps growing, that is the trap
      grow: {
        auSeals: (document.querySelector(".v6-au__seals") || { getBoundingClientRect: () => ({ height: 0 }) })
          .getBoundingClientRect().height,
        drLayers: (document.querySelector(".v6-dr__layers") || { getBoundingClientRect: () => ({ height: 0 }) })
          .getBoundingClientRect().height,
        stList: (document.querySelector(".v6-st__list") || { getBoundingClientRect: () => ({ height: 0 }) })
          .getBoundingClientRect().height,
      },
      stageW: stage ? stage.w : 0,
      stageOffset: stage ? stage.c - window.innerWidth / 2 : 0,
      drCols: (document.querySelector(".v6-dr__stage") || { style: {} }) &&
        getComputedStyle(document.querySelector(".v6-dr__stage") || document.body).gridTemplateColumns,
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      vw: window.innerWidth, vh: window.innerHeight,
    };
  });

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Walking the space by RESIZING one page rather than reloading per point: a reload costs a second and a
// half and there are hundreds of points, but more importantly a resize is what a real window actually
// does. Dragging a window edge, opening devtools, rotating a tablet and zooming a browser are all resizes.
const sweeps = [];
for (const w of [320, 360, 390, 430, 540, 768, 834, 1024, 1093, 1242, 1280, 1366, 1440, 1680, 2560]) {
  sweeps.push({ label: `width ${w}, height 400..1000`, axis: "h", fixed: w,
    points: Array.from({ length: 31 }, (_, i) => 400 + i * 20) });
}
for (const h of [525, 600, 657, 720, 768, 900, 1050]) {
  sweeps.push({ label: `height ${h}, width 320..1600`, axis: "w", fixed: h,
    points: Array.from({ length: 65 }, (_, i) => 320 + i * 20) });
}

const findings = [];
for (const sw of sweeps) {
  if (only && !sw.label.includes(only)) continue;
  process.stdout.write(`  ${sw.label.padEnd(34)} …`);
  let prev = null, prevPt = null;
  let sidewaysWorst = 0, sidewaysAt = null;
  for (const pt of sw.points) {
    const vp = sw.axis === "h" ? { width: sw.fixed, height: pt } : { width: pt, height: sw.fixed };
    await page.setViewportSize(vp);
    await page.waitForTimeout(160);
    const f = await fingerprint(page);
    if (f.sideways > sidewaysWorst) { sidewaysWorst = f.sideways; sidewaysAt = `${vp.width}x${vp.height}`; }

    if (prev) {
      // layout mode flip
      const pinFlip = f.pinned.some((v, i) => v !== prev.pinned[i]);
      if (pinFlip && !declaredNear(sw.axis, prevPt, pt)) {
        findings.push({ kind: "CLIFF", sweep: sw.label, at: `${prevPt}->${pt}`,
          what: `pin state changed ${prev.pinned.map(Number).join("")} -> ${f.pinned.map(Number).join("")}` });
      }
      if (f.drCols !== prev.drCols && !declaredNear(sw.axis, prevPt, pt)) {
        const a = (prev.drCols || "").split(" ").map((v) => Math.round(parseFloat(v) || 0)).join("/");
        const b = (f.drCols || "").split(" ").map((v) => Math.round(parseFloat(v) || 0)).join("/");
        // a continuous fr split changes every step; only flag a big proportional move
        const pa = parseFloat(prev.drCols) || 0, pb = parseFloat(f.drCols) || 0;
        if (pa && Math.abs(pb - pa) / pa > 0.18) {
          findings.push({ kind: "CLIFF", sweep: sw.label, at: `${prevPt}->${pt}`,
            what: `Direction column split jumped ${a} -> ${b}` });
        }
      }
      // type jumping between adjacent steps
      for (const [k, v] of Object.entries(f.type)) {
        const p0 = prev.type[k];
        if (!p0 || !v) continue;
        const rel = Math.abs(v - p0) / p0;
        if (rel > 0.12 && !declaredNear(sw.axis, prevPt, pt)) {
          findings.push({ kind: "CLIFF", sweep: sw.label, at: `${prevPt}->${pt}`,
            what: `${k} ${p0.toFixed(1)}px -> ${v.toFixed(1)}px (${(rel * 100).toFixed(0)}%)` });
        }
      }
      // FLOOR + GROW: on the shrinking direction, type held still while its content got taller
      const shrinking = sw.axis === "h" ? pt < prevPt : pt < prevPt;
      if (shrinking) {
        const pairs = [["auSays", "auSeals"], ["drLh", "drLayers"], ["drNow", "drLayers"], ["stCondt", "stList"]];
        for (const [t, gkey] of pairs) {
          const tSame = prev.type[t] > 0 && Math.abs(f.type[t] - prev.type[t]) < 0.01;
          const grew = f.grow[gkey] - prev.grow[gkey];
          if (tSame && grew > 6) {
            findings.push({ kind: "FLOOR+GROW", sweep: sw.label, at: `${prevPt}->${pt}`,
              what: `${t} pinned at ${f.type[t].toFixed(1)}px while ${gkey} grew ${grew.toFixed(0)}px` });
          }
        }
      }
    }
    prev = f; prevPt = pt;
  }
  if (sidewaysWorst > 1) {
    findings.push({ kind: "SIDEWAYS", sweep: sw.label, at: sidewaysAt, what: `${sidewaysWorst}px of horizontal overflow` });
  }
  process.stdout.write("\r" + " ".repeat(44) + "\r");
  const mine = findings.filter((x) => x.sweep === sw.label);
  console.log(`  ${sw.label.padEnd(34)} ${mine.length ? mine.length + " finding(s)" : "continuous"}`);
}
await browser.close();

console.log("");
const byKind = (k) => findings.filter((f) => f.kind === k);
for (const kind of ["CLIFF", "FLOOR+GROW", "SIDEWAYS"]) {
  const list = byKind(kind);
  ok(`no ${kind} findings`, list.length === 0, `${list.length}`);
  // dedupe for readability: the same cliff shows up on every sweep that crosses it
  const seen = new Set();
  for (const f of list) {
    const key = f.kind + f.what.replace(/[\d.]+/g, "#");
    if (seen.has(key) && seen.size > 6) continue;
    seen.add(key);
    console.log(`        ${f.sweep}  @ ${f.at}:  ${f.what}`);
  }
}
console.log(failures === 0 ? `\n${only ? "SUBSET PASS" : "ALL PASS"}  0 failed` : `\nFAILURES  ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
