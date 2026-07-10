// "Reads as AI-written" detection. A DETERMINISTIC lexical layer (no model): one editable config of
// AI-tell patterns, each matched as a VERBATIM span with a plainer human rewrite. A holistic model
// read is added on top in the evaluator; it never creates flags here. These tells are LOW/MEDIUM and
// NEVER touch the pass/fail gate -- sounding AI-written is a credibility issue, not a false-promise
// risk, so the gate stays HIGH-absolutes-only. Tune the lists below.
//
// Tweak discipline (from the spec):
//  - Words match whole-word with common inflections (\b + optional suffix), never as substrings.
//  - The em-dash tell is the em dash only (— / U+2014), never a hyphen (-) or en dash (–).
//  - Individual spans are always flagged, but the section-level VERDICT is driven by DENSITY
//    (tells per 100 words), so one stray "robust" in real copy never cries wolf.

export type AiTellKind = "word" | "phrase" | "em_dash" | "triad";
export type AiTellSeverity = "low" | "medium";
export type AiTell = { span: string; kind: AiTellKind; why: string; fix: string; replacement?: string; severity: AiTellSeverity };

// Overused AI words -> a plainer replacement. `replacement` is a drop-in swap the corrected version
// can apply in place; `word` is matched whole-word (optional inflection suffix added below).
export const AI_TELL_WORDS: { word: string; replacement: string }[] = [
  { word: "delve", replacement: "look at" },
  { word: "leverage", replacement: "use" },
  { word: "seamless", replacement: "smooth" },
  { word: "seamlessly", replacement: "smoothly" },
  { word: "robust", replacement: "solid" },
  { word: "elevate", replacement: "improve" },
  { word: "unlock", replacement: "open up" },
  { word: "tapestry", replacement: "mix" },
  { word: "testament", replacement: "sign" },
  { word: "nestled", replacement: "set" },
  { word: "boasts", replacement: "has" },
  { word: "navigating", replacement: "handling" },
  { word: "realm", replacement: "area" },
  { word: "landscape", replacement: "market" },
  { word: "furthermore", replacement: "also" },
  { word: "moreover", replacement: "also" },
  { word: "underscore", replacement: "show" },
  { word: "underscores", replacement: "shows" },
  { word: "pivotal", replacement: "key" },
  { word: "myriad", replacement: "many" },
];

// Phrase / template tells. `replacement` present -> a drop-in swap (often "" to cut filler);
// absent -> advisory only (shown as a fix, not auto-applied to the corrected version).
export const AI_TELL_PHRASES: { re: RegExp; why: string; fix: string; replacement?: string }[] = [
  { re: /\bit'?s not just [^,.]+,\s*it'?s\b/gi, why: "the \"it's not just X, it's Y\" contrast scaffold", fix: "State the point plainly, without the not-just-X frame." },
  { re: /\bin today'?s (?:fast-paced|ever-changing|digital|modern|competitive) world\b/gi, why: "\"in today's ... world\" opener", fix: "Cut it, or name the specific change.", replacement: "" },
  { re: /\bwhen it comes to\b/gi, why: "\"when it comes to\" filler", fix: "Cut it: say \"for\" or name the thing directly.", replacement: "for" },
  { re: /\bit'?s worth noting that\b/gi, why: "\"it's worth noting\" hedge", fix: "Cut it and state the note directly.", replacement: "" },
  { re: /\bit'?s worth noting\b/gi, why: "\"it's worth noting\" hedge", fix: "Cut it and state the note directly.", replacement: "" },
  { re: /\bdive into\b/gi, why: "\"dive into\" cliche", fix: "Use \"look at\" or \"start\".", replacement: "look at" },
  { re: /\ba game[- ]changer\b/gi, why: "\"game-changer\" hype", fix: "Say what it actually changes." },
  { re: /\bthe world of\b/gi, why: "\"the world of\" filler", fix: "Cut it: name the thing directly.", replacement: "" },
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Detect AI tells in `text`, verbatim. Returns the spans plus a density-driven verdict.
export function findAiTells(text: string): { tells: AiTell[]; density: number; verdict: "clean" | "some" | "reads_ai"; count: number } {
  const src = text || "";
  const tells: AiTell[] = [];
  const seen = new Set<string>(); // dedupe identical (kind|normalized-span) so repeats don't double-count wildly
  const push = (t: AiTell) => {
    const k = `${t.kind}|${norm(t.span)}`;
    if (seen.has(k)) return;
    seen.add(k);
    tells.push(t);
  };

  // 1) Overused words (whole-word, common inflections; seamlessly/underscores/boasts match as-is).
  for (const { word, replacement } of AI_TELL_WORDS) {
    const re = /(s|d|ed|ing|ly)$/.test(word) ? new RegExp(`\\b${word}\\b`, "gi") : new RegExp(`\\b${word}(?:s|d|ed|ing)?\\b`, "gi");
    for (const m of src.matchAll(re)) push({ span: m[0], kind: "word", why: `overused AI word "${m[0].toLowerCase()}"`, fix: `Use a plainer word: ${replacement}.`, replacement, severity: "low" });
  }

  // 2) Phrase / template tells.
  for (const { re, why, fix, replacement } of AI_TELL_PHRASES) {
    for (const m of src.matchAll(new RegExp(re.source, re.flags))) push({ span: m[0], kind: "phrase", why, fix, replacement, severity: "medium" });
  }

  // 3) Em-dash tell: the em dash only (U+2014), never hyphen or en dash. Each occurrence, with a bit
  //    of context for the quote; the drop-in fix swaps the em dash for a comma.
  for (const m of src.matchAll(/[^\s]*\s?—\s?[^\s]*/g)) push({ span: m[0], kind: "em_dash", why: "an em dash, a common AI-writing tell", fix: "Replace the em dash with a period or comma.", replacement: m[0].replace(/\s?—\s?/, ", "), severity: "low" });

  // 4) Corporate triad: three short, LOWERCASE, comma-separated single-word items ending "and Z"
  //    (e.g. "fast, reliable, and secure"). The lowercase constraint is the key false-positive guard:
  //    a corporate triad is three adjectives (lowercase mid-sentence), while a real list is usually
  //    proper nouns ("Slack, Gmail, and Notion" -> Capitalized -> not flagged). Low + density-gated.
  for (const m of src.matchAll(/\b([a-z]\w+),\s([a-z]\w+),?\sand\s([a-z]\w+)\b/g)) {
    if ([m[1], m[2], m[3]].every((w) => w.length >= 4 && w.length <= 14)) push({ span: m[0], kind: "triad", why: "a three-item parallel list (the corporate triad)", fix: "Keep two items, or make each one specific.", severity: "low" });
  }

  const words = (src.trim().match(/\S+/g) || []).length || 1;
  const count = tells.length;
  const density = (count / words) * 100; // tells per 100 words
  // Verdict is DENSITY-driven, not "any tell present": one stray word in real copy stays "clean".
  const verdict: "clean" | "some" | "reads_ai" = density >= 4 ? "reads_ai" : density >= 1.5 ? "some" : "clean";
  return { tells: tells.slice(0, 20), density: Math.round(density * 10) / 10, verdict, count };
}
