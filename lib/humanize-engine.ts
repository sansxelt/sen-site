import { createHash } from "node:crypto";

export type HumanizationTone =
  | "adaptive"
  | "formal"
  | "balanced"
  | "conversational";

export type HumanizationProfile = {
  tone?: HumanizationTone;
  strength?: number;
};

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+/;
const PARAGRAPH_SPLIT_RE = /\n\s*\n/;
const WORD_RE = /\b[\w'-]+\b/g;
const MULTISPACE_RE = /[ \t]{2,}/g;

const COMMON_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bis effective\b/i, "actually works pretty well"],
  [/\bare effective\b/i, "actually work pretty well"],
  [/\bis useful\b/i, "can be genuinely useful"],
  [/\bare useful\b/i, "can be genuinely useful"],
  [/\bis important\b/i, "matters more than it might seem"],
  [/\bare important\b/i, "matter more than they might seem"],
  [/\bis simple\b/i, "is fairly straightforward"],
  [/\bare simple\b/i, "are fairly straightforward"],
  [/\bis difficult\b/i, "can get tricky"],
  [/\bare difficult\b/i, "can get tricky"],
  [/\bis helpful\b/i, "can help quite a bit"],
  [/\bare helpful\b/i, "can help quite a bit"],
];

const PERSPECTIVE_PREFIXES = {
  formal: [
    "In most cases",
    "From a practical standpoint",
    "More specifically",
  ],
  balanced: [
    "In most cases",
    "Practically speaking",
    "More often than not",
  ],
  conversational: ["Honestly", "The thing is", "In practice"],
} as const;

const PERSPECTIVE_SUFFIXES = {
  formal: [
    "depending on the context",
    "once the details are accounted for",
    "when you look at how it plays out",
  ],
  balanced: [
    "depending on how it is used",
    "when you look at the practical side",
    "once real constraints show up",
  ],
  conversational: [
    "depending on how you use it",
    "once you get into the details",
    "when it shows up in real work",
  ],
} as const;

const SEMANTIC_CLARIFIERS = {
  formal: [
    "which is really the main point",
    "at least at a high level",
    "once you look at the tradeoff closely",
  ],
  balanced: [
    "which is really the key idea",
    "at least at a high level",
    "when you look at it in practice",
  ],
  conversational: [
    "which is really the whole point",
    "if you want the short version",
    "once you get into the real-world version of it",
  ],
} as const;

const STYLE_OPENERS = {
  formal: ["More specifically", "That said"],
  balanced: ["In most cases", "This matters because"],
  conversational: ["Honestly", "This matters because"],
} as const;

const CONTRACTION_MAP: Readonly<Record<string, string>> = {
  "do not": "don't",
  "does not": "doesn't",
  cannot: "can't",
  "it is": "it's",
  "that is": "that's",
  "there is": "there's",
  "they are": "they're",
  "we are": "we're",
};

const EXPANDED_MAP = Object.fromEntries(
  Object.entries(CONTRACTION_MAP).map(([expanded, contracted]) => [
    contracted,
    expanded,
  ]),
) as Record<string, string>;

type StyleBucket = "formal" | "balanced" | "conversational";
type RandomFn = () => number;

export class HumanizationEngine {
  private readonly tone: HumanizationTone;
  private readonly strength: number;

  constructor(profile: HumanizationProfile = {}) {
    this.tone = profile.tone ?? "adaptive";
    this.strength = clamp(profile.strength ?? 0.6, 0.1, 1);
  }

  humanizeText(inputText: string): string {
    let text = this.injectPerspective(inputText);
    text = this.varyStructure(text);
    text = this.applySemanticVariation(text);
    text = this.personalizeStyle(text);
    text = this.ensureCoherence(text);
    return text;
  }

  injectPerspective(inputText: string): string {
    const tone = this.resolveTone(inputText);
    const rng = this.rngFor("injectPerspective", inputText);

    return this.splitParagraphs(inputText)
      .map((paragraph) =>
        this.splitSentences(paragraph)
          .map((sentence) =>
            this.injectPerspectiveSentence(sentence, tone, rng),
          )
          .join(" "),
      )
      .join("\n\n");
  }

  varyStructure(inputText: string): string {
    const rng = this.rngFor("varyStructure", inputText);
    const paragraphs: string[] = [];

    for (const paragraph of this.splitParagraphs(inputText)) {
      const expanded: string[] = [];
      for (const sentence of this.splitSentences(paragraph)) {
        const splitVersion = this.splitLongSentence(sentence, rng);
        if (splitVersion) {
          expanded.push(...splitVersion);
        } else {
          expanded.push(sentence);
        }
      }

      const merged: string[] = [];
      for (let index = 0; index < expanded.length; index += 1) {
        if (
          index + 1 < expanded.length &&
          this.canMerge(expanded[index], expanded[index + 1]) &&
          rng() < 0.28 * this.strength
        ) {
          merged.push(
            this.mergeSentences(expanded[index], expanded[index + 1], rng),
          );
          index += 1;
        } else {
          merged.push(expanded[index]);
        }
      }

      paragraphs.push(...this.reparagraph(merged, rng));
    }

    return paragraphs.join("\n\n");
  }

  applySemanticVariation(inputText: string): string {
    const tone = this.resolveTone(inputText);
    const rng = this.rngFor("applySemanticVariation", inputText);

    return this.splitParagraphs(inputText)
      .map((paragraph) =>
        this.splitSentences(paragraph)
          .map((sentence) => this.semanticTouch(sentence, tone, rng))
          .join(" "),
      )
      .join("\n\n");
  }

  personalizeStyle(inputText: string): string {
    const tone = this.resolveTone(inputText);
    const rng = this.rngFor("personalizeStyle", inputText);

    return this.splitParagraphs(inputText)
      .map((paragraph) => {
        let sentences = this.splitSentences(paragraph);
        if (tone === "conversational") {
          sentences = sentences.map((sentence) =>
            this.applyContractions(sentence),
          );
        } else if (tone === "formal") {
          sentences = sentences.map((sentence) =>
            this.expandContractions(sentence),
          );
        }

        let openerAdded = false;
        const styled: string[] = [];

        for (let sentence of sentences) {
          if (
            !openerAdded &&
            this.isDeclarative(sentence) &&
            this.wordCount(sentence) >= 8 &&
            rng() < 0.18 * this.strength
          ) {
            sentence = this.addPrefix(
              sentence,
              pick(rng, STYLE_OPENERS[this.styleBucket(tone)]),
            );
            openerAdded = true;
          }
          styled.push(this.normalizeTransitionWords(sentence, tone));
        }

        return styled.join(" ");
      })
      .join("\n\n");
  }

  ensureCoherence(inputText: string): string {
    const paragraphs: string[] = [];

    for (const paragraph of this.splitParagraphs(inputText)) {
      const cleanedSentences: string[] = [];
      let previous = "";

      for (const rawSentence of this.splitSentences(paragraph)) {
        const sentence = this.cleanupSentence(rawSentence);
        if (!sentence) {
          continue;
        }
        if (sentence.toLowerCase() === previous.toLowerCase()) {
          continue;
        }
        cleanedSentences.push(sentence);
        previous = sentence;
      }

      const paragraphText = this.dedupeFillers(
        cleanedSentences.join(" ").replace(MULTISPACE_RE, " ").trim(),
      );
      if (paragraphText) {
        paragraphs.push(paragraphText);
      }
    }

    return paragraphs.join("\n\n");
  }

  private injectPerspectiveSentence(
    sentence: string,
    tone: HumanizationTone,
    rng: RandomFn,
  ): string {
    if (!this.isDeclarative(sentence)) {
      return sentence;
    }

    const { body, punctuation } = this.splitPunctuation(sentence);
    let rewrittenBody = body;

    for (const [pattern, replacement] of COMMON_REWRITES) {
      if (pattern.test(rewrittenBody)) {
        rewrittenBody = rewrittenBody.replace(pattern, replacement);
        break;
      }
    }

    let nextSentence = `${rewrittenBody}${punctuation}`;
    if (this.wordCount(nextSentence) < 6) {
      return nextSentence;
    }

    const styleKey = this.styleBucket(tone);
    if (rng() < 0.26 * this.strength) {
      nextSentence = this.addPrefix(
        nextSentence,
        pick(rng, PERSPECTIVE_PREFIXES[styleKey]),
      );
    }

    if (
      rng() < 0.22 * this.strength &&
      !this.hasDiscourseMarker(nextSentence)
    ) {
      nextSentence = this.addSuffix(
        nextSentence,
        pick(rng, PERSPECTIVE_SUFFIXES[styleKey]),
      );
    }

    return nextSentence;
  }

  private semanticTouch(
    sentence: string,
    tone: HumanizationTone,
    rng: RandomFn,
  ): string {
    const { body, punctuation } = this.splitPunctuation(sentence);
    let nextBody = body;

    const replacements: ReadonlyArray<readonly [RegExp, string]> = [
      [/^This means\b/i, "What that means, in practice, is"],
      [/^This shows\b/i, "What this really shows is"],
      [/^This allows\b/i, "What this allows you to do is"],
      [/^Therefore,?\s*/i, "So, in practical terms, "],
      [/^However,?\s*/i, "That said, "],
    ];

    for (const [pattern, replacement] of replacements) {
      if (pattern.test(nextBody)) {
        nextBody = nextBody.replace(pattern, replacement);
        return `${nextBody}${punctuation}`;
      }
    }

    if (
      this.isDeclarative(sentence) &&
      this.wordCount(sentence) >= 10 &&
      !sentence.includes("(") &&
      rng() < 0.18 * this.strength
    ) {
      const clarifier = pick(rng, SEMANTIC_CLARIFIERS[this.styleBucket(tone)]);
      return `${nextBody}, ${clarifier}${punctuation}`;
    }

    return `${nextBody}${punctuation}`;
  }

  private splitLongSentence(
    sentence: string,
    rng: RandomFn,
  ): string[] | null {
    if (this.wordCount(sentence) < 20 || !sentence.includes(",")) {
      return null;
    }
    if (rng() >= 0.32 * this.strength) {
      return null;
    }

    const { body } = this.splitPunctuation(sentence);
    const commaIndexes = [...body.matchAll(/,/g)].map((match) => match.index);
    if (commaIndexes.length === 0) {
      return null;
    }

    const midpoint = body.length / 2;
    const splitAt = commaIndexes.reduce((best, current) =>
      Math.abs(current - midpoint) < Math.abs(best - midpoint) ? current : best,
    );
    const left = body.slice(0, splitAt).trim();
    const right = body.slice(splitAt + 1).trim();

    if (this.wordCount(left) < 6 || this.wordCount(right) < 4) {
      return null;
    }

    return [
      this.ensureTerminalPunctuation(left),
      this.capitalizeSentence(right),
    ];
  }

  private canMerge(first: string, second: string): boolean {
    return (
      this.isDeclarative(first) &&
      this.isDeclarative(second) &&
      this.wordCount(first) <= 9 &&
      this.wordCount(second) <= 14
    );
  }

  private mergeSentences(
    first: string,
    second: string,
    rng: RandomFn,
  ): string {
    const { body: firstBody } = this.splitPunctuation(first);
    const { body: secondBody, punctuation: secondPunctuation } =
      this.splitPunctuation(second);
    const cleanedSecond = this.stripLeadingTransition(secondBody);
    const connector = this.chooseConnector(secondBody, rng);

    return `${firstBody}, ${connector} ${this.decapitalizeIfSafe(cleanedSecond)}${secondPunctuation}`;
  }

  private reparagraph(sentences: string[], rng: RandomFn): string[] {
    if (sentences.length <= 3) {
      return [sentences.join(" ")];
    }

    const paragraphs: string[] = [];
    for (let index = 0; index < sentences.length; ) {
      const remaining = sentences.length - index;
      const size =
        remaining <= 2 ? remaining : pick(rng, [2, 3, 2, 1] as const);
      paragraphs.push(sentences.slice(index, index + size).join(" "));
      index += size;
    }

    return paragraphs;
  }

  private resolveTone(inputText: string): HumanizationTone {
    if (this.tone !== "adaptive") {
      return this.tone;
    }

    const words = this.wordCount(inputText);
    const contractions =
      inputText.match(/\b(?:don't|can't|it's|that's|we're|they're)\b/gi)
        ?.length ?? 0;
    const formalMarkers =
      inputText.match(
        /\b(?:however|therefore|moreover|furthermore|consequently)\b/gi,
      )?.length ?? 0;
    const firstPerson = inputText.match(/\b(?:I|you|we)\b/g)?.length ?? 0;
    const averageLength = words === 0 ? 0 : inputText.length / words;

    if (formalMarkers >= 2 || averageLength > 7.3) {
      return "formal";
    }
    if (contractions >= 2 || firstPerson >= 3) {
      return "conversational";
    }
    return "balanced";
  }

  private rngFor(stage: string, inputText: string): RandomFn {
    const hash = createHash("sha256")
      .update(`${stage}\n${this.tone}\n${this.strength}\n${inputText}`)
      .digest();

    let state = hash.readUInt32BE(0) || 0x9e3779b9;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 0x100000000;
    };
  }

  private splitParagraphs(inputText: string): string[] {
    const trimmed = inputText.trim();
    if (!trimmed) {
      return [];
    }
    return trimmed
      .split(PARAGRAPH_SPLIT_RE)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private splitSentences(paragraph: string): string[] {
    return paragraph
      .trim()
      .split(SENTENCE_SPLIT_RE)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private splitPunctuation(sentence: string): {
    body: string;
    punctuation: string;
  } {
    const trimmed = sentence.trim();
    if (!trimmed) {
      return { body: "", punctuation: "." };
    }
    const last = trimmed.at(-1) ?? ".";
    if (".!?".includes(last)) {
      return { body: trimmed.slice(0, -1).trim(), punctuation: last };
    }
    return { body: trimmed, punctuation: "." };
  }

  private styleBucket(tone: HumanizationTone): StyleBucket {
    if (tone === "adaptive") {
      return "balanced";
    }
    return tone;
  }

  private wordCount(text: string): number {
    return text.match(WORD_RE)?.length ?? 0;
  }

  private isDeclarative(sentence: string): boolean {
    const trimmed = sentence.trim();
    if (!trimmed) {
      return false;
    }
    return trimmed.endsWith(".") || !trimmed.endsWith("?") && !trimmed.endsWith("!");
  }

  private ensureTerminalPunctuation(sentence: string): string {
    const trimmed = sentence.trim();
    if (!trimmed) {
      return trimmed;
    }
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  }

  private capitalizeSentence(sentence: string): string {
    const trimmed = sentence.trim();
    if (!trimmed) {
      return trimmed;
    }
    if (trimmed[0] === trimmed[0].toLowerCase()) {
      return `${trimmed[0].toUpperCase()}${trimmed.slice(1)}`;
    }
    return trimmed;
  }

  private decapitalizeIfSafe(sentence: string): string {
    return /^[A-Z][a-z]/.test(sentence)
      ? `${sentence[0].toLowerCase()}${sentence.slice(1)}`
      : sentence;
  }

  private addPrefix(sentence: string, prefix: string): string {
    const { body, punctuation } = this.splitPunctuation(sentence);
    if (body.toLowerCase().startsWith(prefix.toLowerCase())) {
      return `${body}${punctuation}`;
    }
    return `${prefix}, ${this.decapitalizeIfSafe(body)}${punctuation}`;
  }

  private addSuffix(sentence: string, suffix: string): string {
    const { body, punctuation } = this.splitPunctuation(sentence);
    if (body.toLowerCase().includes(suffix.toLowerCase())) {
      return `${body}${punctuation}`;
    }
    return `${body}, ${suffix}${punctuation}`;
  }

  private hasDiscourseMarker(sentence: string): boolean {
    return /^(Honestly|In most cases|In practice|The thing is|Practically speaking|More often than not)\b/.test(
      sentence,
    );
  }

  private chooseConnector(secondBody: string, rng: RandomFn): string {
    const lowered = secondBody.toLowerCase();
    if (
      lowered.startsWith("however") ||
      lowered.startsWith("still") ||
      lowered.startsWith("yet") ||
      lowered.startsWith("but")
    ) {
      return "but";
    }
    if (
      lowered.startsWith("therefore") ||
      lowered.startsWith("so") ||
      lowered.startsWith("as a result")
    ) {
      return "so";
    }
    return pick(rng, ["and", "while", "but"] as const);
  }

  private stripLeadingTransition(sentence: string): string {
    return sentence.replace(
      /^(however|therefore|moreover|furthermore|still|so|also|that said),?\s+/i,
      "",
    );
  }

  private applyContractions(sentence: string): string {
    let updated = sentence;
    for (const [expanded, contracted] of Object.entries(CONTRACTION_MAP)) {
      updated = updated.replace(
        new RegExp(`\\b${escapeRegExp(expanded)}\\b`, "gi"),
        contracted,
      );
    }
    return updated;
  }

  private expandContractions(sentence: string): string {
    let updated = sentence;
    for (const [contracted, expanded] of Object.entries(EXPANDED_MAP)) {
      updated = updated.replace(
        new RegExp(`\\b${escapeRegExp(contracted)}\\b`, "gi"),
        expanded,
      );
    }
    return updated;
  }

  private normalizeTransitionWords(
    sentence: string,
    tone: HumanizationTone,
  ): string {
    let updated = sentence;
    if (tone === "conversational") {
      updated = updated.replace(/^However,\s+/i, "But ");
      updated = updated.replace(/^Therefore,\s+/i, "So, ");
    } else if (tone === "formal") {
      updated = updated.replace(/^But\s+/i, "However, ");
      updated = updated.replace(/^So,\s+/i, "As a result, ");
    }
    return updated;
  }

  private cleanupSentence(sentence: string): string {
    let updated = sentence.trim();
    updated = updated.replace(/,\s*,+/g, ", ");
    updated = updated.replace(/\s+([,.;:!?])/g, "$1");
    updated = updated.replace(/([.!?]){2,}/g, "$1");
    updated = updated.replace(MULTISPACE_RE, " ");

    if (updated && !/[.!?]$/.test(updated)) {
      updated = `${updated}.`;
    }

    return updated ? this.capitalizeSentence(updated) : updated;
  }

  private dedupeFillers(paragraph: string): string {
    return paragraph
      .replace(/\b(Honestly),\s+\1,\s+/gi, "$1, ")
      .replace(/\b(In most cases),\s+\1,\s+/gi, "$1, ")
      .replace(/\b(This matters because),\s+\1,\s+/gi, "$1, ")
      .replace(/\s+,/g, ",");
  }
}

const DEFAULT_ENGINE = new HumanizationEngine();

export function injectPerspective(inputText: string): string {
  return DEFAULT_ENGINE.injectPerspective(inputText);
}

export function varyStructure(text: string): string {
  return DEFAULT_ENGINE.varyStructure(text);
}

export function applySemanticVariation(text: string): string {
  return DEFAULT_ENGINE.applySemanticVariation(text);
}

export function personalizeStyle(text: string): string {
  return DEFAULT_ENGINE.personalizeStyle(text);
}

export function ensureCoherence(text: string): string {
  return DEFAULT_ENGINE.ensureCoherence(text);
}

export function humanizeText(
  inputText: string,
  profile: HumanizationProfile = {},
): string {
  return new HumanizationEngine(profile).humanizeText(inputText);
}

function pick<const T>(rng: RandomFn, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)] ?? values[0];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
