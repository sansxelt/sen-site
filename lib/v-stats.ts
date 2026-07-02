// lib/v-stats.ts
// Real statistical estimators for the Decision Package. Pure functions, no DB, no
// side effects — unit-testable and reproducible.
//
// The honesty contract:
//   * The "win probability" is a POSTERIOR probability under a uniform prior
//     (Beta(1,1) for 2 options, Dirichlet(1,…) for k options) over the options'
//     true preference shares, computed from the judgments collected. It answers
//     "how likely is the recommended option to keep winning if we collected more
//     judgments of the same kind?" — never a guarantee of a business outcome.
//   * Reputation weighting can shift WHICH option is recommended, but precision is
//     always driven by the Kish EFFECTIVE sample size (n_eff ≤ raw N). So weighting
//     can move the point estimate but can never inflate confidence.
//   * The Strong/Moderate/Tentative label is DERIVED from the probability, so the
//     label can never overstate what the number says.

export const Z95 = 1.959963984540054; // two-sided 95% normal quantile

// ── Seeded PRNG (mulberry32): deterministic Monte Carlo so a given report's
// package is reproducible across reads (Math.random would make it drift). ──
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── log Gamma (Lanczos). ──
const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];
export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < LANCZOS.length; i++) a += LANCZOS[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// ── Regularized incomplete beta I_x(a,b) = CDF of Beta(a,b) at x (Numerical
// Recipes continued fraction). ──
function betacf(x: number, a: number, b: number): number {
  const FPMIN = 1e-300, EPS = 1e-12, MAXIT = 300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

export function regIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const bt = Math.exp(lbt);
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(x, a, b)) / a;
  return 1 - (bt * betacf(1 - x, b, a)) / b;
}

// Beta(a,b) quantile via bisection on the CDF.
export function betaQuantile(q: number, a: number, b: number): number {
  if (q <= 0) return 0;
  if (q >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (regIncompleteBeta(mid, a, b) < q) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── 2-option: Beta-binomial posterior for the winner's true share p. ──
export type BetaResult = { mean: number; lo: number; hi: number; probAboveHalf: number };
export function betaBinom(x: number, n: number, prior: [number, number] = [1, 1]): BetaResult {
  const a = prior[0] + Math.max(0, x);
  const b = prior[1] + Math.max(0, n - x);
  return {
    mean: a / (a + b),
    lo: betaQuantile(0.025, a, b),
    hi: betaQuantile(0.975, a, b),
    probAboveHalf: 1 - regIncompleteBeta(0.5, a, b), // P(true share > 0.5)
  };
}

// ── k-option: Dirichlet-multinomial posterior via seeded Monte Carlo. ──
function gaussian(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function sampleGamma(shape: number, rng: () => number): number {
  if (shape < 1) return sampleGamma(1 + shape, rng) * Math.pow(rng() || 1e-12, 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = gaussian(rng); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export type DirichletResult = {
  winnerIndex: number;
  pWinnerIsTop: number;         // P(winner has the max true share)
  pWinnerBeatsRunner: number;   // P(winner > current runner-up)
  winnerShareCI: [number, number];
  topTwoMarginCI: [number, number]; // margin of winner over the best competitor
};
export function dirichletTopProbs(
  counts: number[],
  opts: { draws?: number; seed?: number; prior?: number } = {},
): DirichletResult {
  const draws = opts.draws ?? 10000;
  const prior = opts.prior ?? 1;
  const rng = mulberry32(opts.seed ?? 0x9e3779b9);
  const k = counts.length;
  const alpha = counts.map((c) => Math.max(0, c) + prior);
  let winner = 0;
  for (let i = 1; i < k; i++) if (counts[i] > counts[winner]) winner = i;
  let runner = -1;
  for (let i = 0; i < k; i++) if (i !== winner && (runner < 0 || counts[i] > counts[runner])) runner = i;

  let pTop = 0, pBeat = 0;
  const wShares = new Array<number>(draws);
  const margins = new Array<number>(draws);
  const g = new Array<number>(k);
  for (let d = 0; d < draws; d++) {
    let sum = 0;
    for (let i = 0; i < k; i++) { g[i] = sampleGamma(alpha[i], rng); sum += g[i]; }
    const wShare = g[winner] / sum;
    let maxOther = 0;
    for (let i = 0; i < k; i++) { if (i === winner) continue; const s = g[i] / sum; if (s > maxOther) maxOther = s; }
    if (wShare >= maxOther) pTop++;
    if (runner >= 0 && wShare > g[runner] / sum) pBeat++;
    wShares[d] = wShare;
    margins[d] = wShare - maxOther;
  }
  wShares.sort((a, b) => a - b);
  margins.sort((a, b) => a - b);
  const pctl = (arr: number[], q: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(q * (arr.length - 1))))];
  return {
    winnerIndex: winner,
    pWinnerIsTop: pTop / draws,
    pWinnerBeatsRunner: runner >= 0 ? pBeat / draws : 1,
    winnerShareCI: [pctl(wShares, 0.025), pctl(wShares, 0.975)],
    topTwoMarginCI: [pctl(margins, 0.025), pctl(margins, 0.975)],
  };
}

// ── Kish effective sample size: (Σw)² / Σw². Always ≤ N. This is how reputation
// weighting is prevented from inflating confidence. ──
export function kishEffectiveN(weights: number[]): number {
  let s = 0, s2 = 0;
  for (const w of weights) { s += w; s2 += w * w; }
  return s2 > 0 ? (s * s) / s2 : 0;
}

// ── Reputation weight for one voter: shrink their reliability toward the pool mean
// (Beta prior, strength alpha), then bound it so weighting NUDGES, never swings.
// A voter with no history gets weight 1 (neutral). ──
export function reputationWeight(valid: number, rejected: number, poolMean: number, alpha = 5): number {
  const seen = valid + rejected;
  if (seen <= 0 || poolMean <= 0) return 1;
  const reliability = (valid + alpha * poolMean) / (seen + alpha);
  return Math.min(1.5, Math.max(0.5, reliability / poolMean));
}

// ── Consensus concentration: P(two random raters chose the same option) = Σ pᵢ².
// The honest "how much do people agree" read for a single-decision run (NOT
// Krippendorff's alpha, which needs repeated items — that's Phase 2). ──
export function observedAgreement(shares: number[]): number {
  return shares.reduce((acc, p) => acc + p * p, 0);
}

// ── Fixed-N power: judgments needed to pin the winner's share to a ±halfWidth 95%
// interval. Fixed-N only — no sequential/adaptive stopping (Phase 2). ──
export function recommendedSampleSize(p: number, targetHalfWidth = 0.1, z = Z95): number {
  const pv = Math.min(Math.max(p, 0.01), 0.99);
  return Math.ceil(pv * (1 - pv) * (z / targetHalfWidth) ** 2);
}

export type ConfidenceLabel = "Strong" | "Moderate" | "Tentative" | "None";
// The label is DERIVED from the probability, so it can never overstate the number.
export function confidenceLabelFromProb(prob: number | null | undefined): ConfidenceLabel {
  if (prob == null) return "None";
  if (prob >= 0.95) return "Strong";
  if (prob >= 0.8) return "Moderate";
  return "Tentative";
}

// Wilson score-interval lower bound (moved here from v-intelligence; still used by
// the secondary "signal convergence" measure).
export function wilsonLowerBound(successes: number, n: number, z = Z95): number {
  if (n <= 0) return 0;
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const half = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return Math.max(0, (center - half) / denom);
}
