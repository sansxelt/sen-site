import { buildSearchIndex } from "./text";
import type { SearchEntry } from "./types";

// RETRIEVAL FOR THE DOCS ASSISTANT. Plain lexical scoring over the same section index the search modal uses: BM25
// over each section's text, plus a boost when a word is in the section heading or the page title. Earlier references
// (the retired browser-testing product) are left out: the assistant answers about Vraelis Contour and the research.
// The index is built once per server instance, from the same PAGES as every docs page, so it cannot drift.

const STOP = new Set(("a an and are as at be been being but by can could did do does doing for from had has have how i if in into is it its " +
  "me my of on or our so that the their them then there these they this those to was we were what when where which who whom why will with " +
  "would you your about any all also am get got just more most much no not now only other over same should some such than too up very vs " +
  "tell explain describe give show please know want need use using").split(" "));

/** Everyday words for the things the docs name in their own words (mostly what Vraelis does not claim), so a
 *  question about "cost" meets "pricing". Applied to the docs and the question alike. */
const SAME: Record<string, string> = Object.fromEntries([
  ...["cost", "costs", "price", "prices", "priced", "pay", "paid", "payment", "subscription", "license", "licence", "fee", "fees"].map((w) => [w, "pricing"]),
  ...["certified", "certify", "certifications", "compliance", "compliant", "accredited", "accreditation", "fedramp", "iso"].map((w) => [w, "certification"]),
  ...["client", "clients", "buyers", "adoption"].map((w) => [w, "customers"]),
  ...["available", "launch", "launched", "ga"].map((w) => [w, "availability"]),
]);

/** Lowercase words with a light suffix fold, so "approved", "approves" and "approval" meet at "approv". */
export function terms(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().match(/[\p{L}\p{N}]+(?:[.'][\p{L}\p{N}]+)*/gu) ?? []) {
    const w0 = raw.replace(/'s$/, "");
    const w = SAME[w0] ?? w0;
    if (STOP.has(w) || w.length < 2) continue;
    out.push(fold(w));
  }
  return out;
}
function fold(w: string): string {
  if (/^\d/.test(w) || w.length <= 3) return w;
  let s = w;
  if (s.endsWith("ies") && s.length > 4) s = s.slice(0, -3) + "y";
  else if (/(ing|ed)$/.test(s) && s.length > 5) s = s.replace(/(ing|ed)$/, "");
  else if (s.endsWith("es") && s.length > 4 && !s.endsWith("ses")) s = s.slice(0, -2);
  else if (s.endsWith("s") && !s.endsWith("ss") && s.length > 3) s = s.slice(0, -1);
  if (s.endsWith("al") && s.length > 6) s = s.slice(0, -2);
  if (s.endsWith("e") && s.length > 4) s = s.slice(0, -1);
  return s;
}

type Doc = { e: SearchEntry; head: Set<string>; page: Set<string>; tf: Map<string, number>; len: number };
let cached: { docs: Doc[]; df: Map<string, number>; avg: number } | null = null;

function index() {
  if (cached) return cached;
  const docs: Doc[] = [];
  const df = new Map<string, number>();
  for (const e of buildSearchIndex()) {
    if (e.tab === "earlier") continue;
    const body = terms(e.text);
    const tf = new Map<string, number>();
    for (const t of body) tf.set(t, (tf.get(t) ?? 0) + 1);
    const head = new Set(terms(e.title));
    for (const t of new Set([...tf.keys(), ...head])) df.set(t, (df.get(t) ?? 0) + 1);
    docs.push({ e, head, page: new Set(terms(e.page)), tf, len: body.length });
  }
  const avg = docs.reduce((n, d) => n + d.len, 0) / Math.max(1, docs.length);
  cached = { docs, df, avg };
  return cached;
}

export type Hit = { e: SearchEntry; score: number };

/** The best sections for a question. `context` (the previous question, for a follow-up) counts at half weight. */
/** Each query word with its weight: 1 for the question, .5 for the previous one, times how rare it is in the docs. */
function queryWeights(question: string, context: string): Map<string, number> {
  const { docs, df } = index();
  const N = docs.length;
  const raw = new Map<string, number>();
  for (const t of terms(context)) raw.set(t, Math.max(raw.get(t) ?? 0, 0.5));
  for (const t of terms(question)) raw.set(t, 1);
  const out = new Map<string, number>();
  for (const [t, w] of raw) {
    const n = df.get(t);
    if (n) out.set(t, w * Math.log(1 + (N - n + 0.5) / (n + 0.5)));
  }
  return out;
}

export function retrieve(question: string, context = "", k = 6): Hit[] {
  const { docs, df, avg } = index();
  const weights = queryWeights(question, context);
  if (!weights.size) return [];
  // A question whose distinctive words appear nowhere in the docs, matched only by words that are everywhere
  // ("Vraelis", "Contour"), is not covered: better to say so than to quote the overview at it.
  const own = [...new Set(terms(question))];
  const unknown = own.filter((t) => !df.has(t));
  const rarest = Math.min(...own.filter((t) => df.has(t)).map((t) => df.get(t)! / docs.length));
  if (unknown.length && !(rarest < 0.2)) return [];
  const K1 = 1.2, B = 0.75;
  const hits: Hit[] = [];
  for (const d of docs) {
    let score = 0;
    for (const [t, wIdf] of weights) {
      const f = d.tf.get(t) ?? 0;
      const bm25 = f ? (f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / avg)) : 0;
      const boost = (d.head.has(t) ? 1.6 : 0) + (d.page.has(t) ? 0.5 : 0);
      score += wIdf * (bm25 + boost);
    }
    if (score > 0) hits.push({ e: d.e, score });
  }
  hits.sort((a, b) => b.score - a.score);
  // Keep sections that are at least a fifth as relevant as the best one, so one strong match is not padded out
  // with noise that the model might then quote.
  const top = hits[0]?.score ?? 0;
  return hits.filter((h) => h.score >= top * 0.2).slice(0, k);
}

/** A section as the model sees it: Markdown with link targets and image addresses removed. */
export function sectionText(e: SearchEntry, max = 2400): string {
  const md = e.md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "(Capture: $1)")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim();
  return md.length > max ? `${md.slice(0, max).replace(/\s+\S*$/, "")} …` : md;
}

// ── THE FREE MODE: passages, not generation ─────────────────────────────────────────────────────────────
//
// With no model switched on (the default), the assistant answers with the documentation's own words: the most
// relevant sentences, list items and table rows of the best sections, verbatim, each cited by its section number.
// Nothing leaves the server and nothing is paraphrased, so it cannot say anything the docs do not.

/** A section's Markdown as quotable units: paragraphs (long ones split into sentences), list items, table rows. */
function units(md: string): string[] {
  const out: string[] = [];
  const lines = md.split("\n");
  let code = false;
  let label = ""; // a list's lead-in ("**Not claimed**", "Three things:"), carried onto each of its items
  for (let n = 0; n < lines.length; n++) {
    const rawLine = lines[n];
    if (rawLine.startsWith("```")) { code = !code; continue; }
    if (code) continue;
    const line = rawLine.trim();
    if (!line || /^\|?\s*-{3}/.test(line) || line.startsWith("![") || /^#{1,6} /.test(line) || /^\*[^*].*\*$/.test(line)) continue;
    // A table's header row says nothing on its own.
    if (line.startsWith("|") && /^\|?\s*-{3}/.test(lines[n + 1]?.trim() ?? "")) continue;
    let t = line.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
    const bold = /^\*\*([^*]+)\*\*:?$/.exec(t);
    if (bold) { label = bold[1].replace(/[.:]$/, ""); continue; }
    if (/^[-*] |^\d+\. /.test(t)) {
      t = t.replace(/^[-*] |^\d+\. /, "");
      if (label && !t.startsWith("**")) t = `${label}: ${t}`;
    } else if (!t.startsWith("|")) label = t.endsWith(":") && t.length < 120 ? t.slice(0, -1) : "";
    if (t.startsWith("|")) {
      const cells = t.replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|")).filter(Boolean);
      t = cells.length > 1 ? `${cells[0]}: ${cells.slice(1).join("; ")}` : cells[0] ?? "";
    } else t = t.replace(/^> /, "");
    if (!t || (t.endsWith(":") && t.length < 120)) continue;
    if (t.length > 320) out.push(...(t.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [t]).map((x) => x.trim()).filter(Boolean));
    else out.push(t);
  }
  return out;
}

/** The answer in the free mode: the best passages of the retrieved sections, each ending with its [n] citation. */
export function extractAnswer(question: string, context: string, hits: Hit[]): string {
  const weights = queryWeights(question, context);
  type U = { n: number; i: number; text: string; score: number };
  const all: U[] = [];
  hits.slice(0, 4).forEach((h, s) => {
    units(h.e.md).forEach((text, i) => {
      const found = new Set(terms(text).filter((t) => weights.has(t)));
      let score = 0;
      for (const t of found) score += weights.get(t)!;
      if (found.size >= 2) score *= 1.25;
      score /= 1 + Math.max(0, text.length - 260) / 400;
      score *= 1 - s * 0.08; // a slight preference for the better section
      all.push({ n: s + 1, i, text, score });
    });
  });
  const best = Math.max(0, ...all.map((u) => u.score));
  let picked: U[];
  if (best <= 0) {
    // The words matched headings only: quote the opening of the best section.
    picked = all.filter((u) => u.n === 1).slice(0, 2);
  } else {
    const per = new Map<number, number>();
    picked = all.filter((u) => u.score >= best * 0.45).sort((a, b) => b.score - a.score).filter((u) => {
      const c = per.get(u.n) ?? 0;
      if (c >= 2) return false;
      per.set(u.n, c + 1);
      return true;
    }).slice(0, 5);
  }
  picked.sort((a, b) => a.n - b.n || a.i - b.i);
  return picked.map((u) => `${u.text} [${u.n}]`).join("\n\n");
}
