// v0.1.4 i18n scaffold, server-side language plumbing.
//
// Two axes:
//   1. system language (manual, controls UI text, read from prefs)
//   2. response language (auto-detected per message, server-side, used
//      to nudge the model to reply in the same language the user typed)
//
// This module owns the LANGUAGES catalog + a tiny detectLanguage()
// heuristic. The detector is intentionally cheap: script-range checks
// for non-Latin scripts, plus a tiny common-word dictionary for the
// big Latin-script European languages. Nothing fancy. The chat route
// uses it to pick whether to inject a "respond in <lang>" note into
// the system prompt.

export type LanguageCode =
  | "en" | "es" | "fr" | "de" | "ja"
  | "zh" | "pt" | "ko" | "hi" | "ar";

export type LanguageEntry = {
  code: LanguageCode;
  label: string;   // English label shown in pickers when the UI is in English
  native: string;  // Native-script self-label
};

export const LANGUAGES: ReadonlyArray<LanguageEntry> = [
  { code: "en", label: "English",    native: "English"    },
  { code: "es", label: "Spanish",    native: "Español"    },
  { code: "fr", label: "French",     native: "Français"   },
  { code: "de", label: "German",     native: "Deutsch"    },
  { code: "ja", label: "Japanese",   native: "日本語"      },
  { code: "zh", label: "Chinese",    native: "中文"        },
  { code: "pt", label: "Portuguese", native: "Português"  },
  { code: "ko", label: "Korean",     native: "한국어"      },
  { code: "hi", label: "Hindi",      native: "हिन्दी"       },
  { code: "ar", label: "Arabic",     native: "العربية"     },
];

const LANGUAGE_LABELS: Record<LanguageCode, string> = LANGUAGES.reduce(
  (acc, l) => {
    acc[l.code] = l.label;
    return acc;
  },
  {} as Record<LanguageCode, string>,
);

export function langLabel(code: string): string {
  return LANGUAGE_LABELS[code as LanguageCode] ?? "English";
}

// Tiny common-word dictionary. Only used as a tiebreaker for
// Latin-script languages, character-range checks below win first
// for any text that contains CJK / Cyrillic / Devanagari / Arabic.
// Keep these short, lowercase, and surrounded by word boundaries so
// they don't match inside other words.
const COMMON_WORDS: Record<Exclude<LanguageCode, "en" | "ja" | "zh" | "ko" | "hi" | "ar">, string[]> = {
  es: ["el", "la", "los", "las", "que", "de", "y", "en", "es", "por", "para", "con", "una", "uno", "pero", "como", "más", "muy", "qué", "sí", "no", "hola", "gracias"],
  fr: ["le", "la", "les", "des", "un", "une", "et", "est", "que", "qui", "pour", "dans", "avec", "mais", "très", "merci", "bonjour", "oui", "pas", "ça", "où"],
  de: ["der", "die", "das", "und", "ist", "nicht", "ein", "eine", "den", "dem", "mit", "für", "auf", "ich", "du", "wir", "sie", "es", "auch", "wie", "was", "danke", "hallo"],
  pt: ["o", "a", "os", "as", "um", "uma", "de", "do", "da", "em", "para", "por", "com", "que", "não", "sim", "obrigado", "obrigada", "olá", "muito", "está"],
};

// English stop words used to suppress collisions. Without this, a
// prompt like "can u make a short video of a cat" gets classified
// as Portuguese because "a" matches Portuguese's definite-article-
// fem. entry twice, clearing the >=2 hit threshold even though the
// rest of the prompt is obviously English.
const ENGLISH_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were",
  "be", "been", "being", "do", "does", "did", "have", "has", "had",
  "of", "in", "on", "to", "for", "with", "by", "at", "from", "as",
  "this", "that", "these", "those", "it", "its", "i", "me", "my",
  "you", "your", "we", "us", "our", "he", "she", "they", "them",
  "can", "could", "will", "would", "should", "may", "might",
  "what", "how", "why", "when", "where", "who", "which",
  "make", "made", "go", "get", "got", "want", "need", "like",
  "yes", "no", "ok", "okay", "thanks", "please", "hi", "hey", "hello",
  "u", "ur", "lol", "tbh", "rn",
]);

// Count tokens that are in `words` AND NOT in the English stop-word
// set. The English exclusion stops common cross-language particles
// (mostly "a" / "o") from inflating the score for romance languages
// when the input is plain English with a few collisions.
function countWordHits(tokens: string[], words: string[]): number {
  const set = new Set(words);
  let hits = 0;
  for (const tok of tokens) {
    if (ENGLISH_WORDS.has(tok)) continue;
    if (set.has(tok)) hits += 1;
  }
  return hits;
}

// detectLanguage, best-effort language ID. Returns "en" as fallback.
// Does NOT need to be perfect; a wrong call here means the model gets
// a slightly off "respond in X" hint. The model itself usually still
// matches the user's language regardless. This is just a nudge.
export function detectLanguage(text: string): LanguageCode {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "en";

  // Script-range checks first, these are cheap and unambiguous.
  // If the text contains characters from these scripts, that script
  // wins immediately. We do NOT require ALL characters to be in the
  // script (mixed text is normal); a single match is enough.
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(trimmed)) return "ja"; // hiragana/katakana
  if (/[\uAC00-\uD7AF]/.test(trimmed)) return "ko";              // hangul
  if (/[\u4E00-\u9FFF]/.test(trimmed)) {
    // CJK Unified, could be ja or zh, but if we got here neither
    // hiragana nor hangul matched, so call it Chinese.
    return "zh";
  }
  if (/[\u0900-\u097F]/.test(trimmed)) return "hi"; // devanagari
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(trimmed)) return "ar"; // arabic

  // Latin-script tiebreaker via common-word counting.
  const tokens = trimmed
    .toLowerCase()
    .replace(/[^\p{L}\s'’-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return "en";

  const scores: Array<[LanguageCode, number]> = [];
  for (const code of ["es", "fr", "de", "pt"] as const) {
    scores.push([code, countWordHits(tokens, COMMON_WORDS[code])]);
  }
  scores.sort((a, b) => b[1] - a[1]);

  const [topCode, topHits] = scores[0];
  // Require at least 2 stop-word hits to call it; otherwise fall back
  // to English. This avoids classifying single-word prompts like
  // "code" as German just because "code"… isn't even in the list, but
  // similar collisions exist. Two hits = a real signal.
  if (topHits >= 2) return topCode;

  return "en";
}
