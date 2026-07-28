// IS THE RING ACTUALLY TELLING THE SAME STORY AS THE TEXT?
//
// chapters.css claims it: "Statement i is centred at travel = (i + 0.5) / 4, which is exactly where bar
// 2i+1 completes: the bars ARE the text." That is a claim about two independently defined variables, and
// they are defined with DIFFERENT rates:
//
//   --ring:   (p - 0.05) / 0.62
//   --travel: (p - 0.05) / 0.70
//
// which cannot stay in step. This computes, for each refusal, the scroll position where its statement is
// centred and where its ring segment completes, and reports the gap. Arithmetic, not rendering: the CSS is
// parsed out of the stylesheet so the numbers cannot drift from what ships.
import { readFileSync } from "node:fs";

const css = readFileSync("app/dev-preview/v6/_system/chapters.css", "utf8");
const st = css.slice(css.indexOf(".v6-st {"), css.indexOf(".v6-st__pin"));

const num = (name) => {
  // The optional trailing "- 0.125" is the whole point of this probe now: it is what shifts one ramp onto
  // the other. Parsing without it reports a constant gap that is the probe's own arithmetic, not the
  // stylesheet's, which would look exactly like the defect it exists to detect.
  const m = new RegExp(
    `--${name}:\\s*clamp\\([^,]+,\\s*calc\\(\\(var\\(--p\\) - ([\\d.]+)\\) / ([\\d.]+)\\s*(?:([-+])\\s*([\\d.]+))?`,
  ).exec(st);
  if (!m) return null;
  // travel = (p - start)/span + offset, so travel = t at p = start + span * (t - offset).
  const offset = m[3] ? (m[3] === "-" ? -Number(m[4]) : Number(m[4])) : 0;
  return { start: Number(m[1]), span: Number(m[2]), offset };
};
const ring = num("ring");
const travel = num("travel");
if (!ring || !travel) { console.log("could not parse --ring / --travel from chapters.css"); process.exit(2); }

// The chapter is pinned, so p maps onto (height - 100vh) of scrolling.
const heightVh = Number(/\.v6-st \{[^}]*height:\s*(\d+)vh/.exec(css)?.[1] ?? 430);
const scrollVh = heightVh - 100;
const N = 4; // STANDARD.length

// Does travel subtract a constant offset from the ring's own ramp? That is the shape that locks them.
const linked = /--travel:[^;]*var\(--ring\)/.test(st) || travel.span === ring.span;

console.log(`--ring   starts ${ring.start}, spans ${ring.span}, offset ${ring.offset}`);
console.log(`--travel starts ${travel.start}, spans ${travel.span}, offset ${travel.offset}`);
console.log(`chapter ${heightVh}vh pinned, so p covers ${scrollVh}vh of scrolling\n`);

console.log("refusal   statement centred    segment completes    gap");
let worst = 0;
for (let i = 0; i < N; i++) {
  // statement i is centred where slot = 0, i.e. travel*N = i + 0.5
  const pText = travel.start + travel.span * ((i + 0.5) / N - travel.offset);
  // segment i is fully lit where ring*N - i = 1, i.e. ring = (i + 1) / N
  const pRing = ring.start + ring.span * ((i + 1) / N - ring.offset);
  const gap = Math.abs(pText - pRing);
  worst = Math.max(worst, gap);
  console.log(`  0${i + 1}      p=${pText.toFixed(4)}           p=${pRing.toFixed(4)}          ${(gap * scrollVh).toFixed(1)}vh`);
}

console.log(`\nworst drift: ${(worst * scrollVh).toFixed(1)}vh of scrolling`);
console.log(linked
  ? "travel is derived from the ring's ramp, so the lock is structural."
  : "travel and ring use INDEPENDENT rates, so the claimed lock is coincidence and does not hold.");
process.exit(worst * scrollVh < 2 ? 0 : 1);
