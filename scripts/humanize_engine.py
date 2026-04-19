"""Readable text humanization utilities.

This module rewrites flat, overly neutral prose into writing that feels
more natural while keeping the original meaning intact. It focuses on:

- perspective injection
- structural variation
- controlled semantic variation
- light style personalization
- coherence cleanup

The implementation is deterministic for a given input so it is easy to
test and reason about.
"""

from __future__ import annotations

import argparse
import hashlib
import random
import re
from dataclasses import dataclass
from typing import List, Literal, Sequence, Tuple

Tone = Literal["adaptive", "formal", "balanced", "conversational"]

SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
PARAGRAPH_SPLIT_RE = re.compile(r"\n\s*\n")
WORD_RE = re.compile(r"\b[\w'-]+\b")
MULTISPACE_RE = re.compile(r"[ \t]{2,}")

COMMON_REWRITES: Sequence[Tuple[re.Pattern[str], str]] = (
    (re.compile(r"\bis effective\b", re.IGNORECASE), "actually works pretty well"),
    (re.compile(r"\bare effective\b", re.IGNORECASE), "actually work pretty well"),
    (re.compile(r"\bis useful\b", re.IGNORECASE), "can be genuinely useful"),
    (re.compile(r"\bare useful\b", re.IGNORECASE), "can be genuinely useful"),
    (re.compile(r"\bis important\b", re.IGNORECASE), "matters more than it might seem"),
    (re.compile(r"\bare important\b", re.IGNORECASE), "matter more than they might seem"),
    (re.compile(r"\bis simple\b", re.IGNORECASE), "is fairly straightforward"),
    (re.compile(r"\bare simple\b", re.IGNORECASE), "are fairly straightforward"),
    (re.compile(r"\bis difficult\b", re.IGNORECASE), "can get tricky"),
    (re.compile(r"\bare difficult\b", re.IGNORECASE), "can get tricky"),
    (re.compile(r"\bis helpful\b", re.IGNORECASE), "can help quite a bit"),
    (re.compile(r"\bare helpful\b", re.IGNORECASE), "can help quite a bit"),
)

PERSPECTIVE_PREFIXES = {
    "formal": (
        "In most cases",
        "From a practical standpoint",
        "More specifically",
    ),
    "balanced": (
        "In most cases",
        "Practically speaking",
        "More often than not",
    ),
    "conversational": (
        "Honestly",
        "The thing is",
        "In practice",
    ),
}

PERSPECTIVE_SUFFIXES = {
    "formal": (
        "depending on the context",
        "once the details are accounted for",
        "when you look at how it plays out",
    ),
    "balanced": (
        "depending on how it is used",
        "when you look at the practical side",
        "once real constraints show up",
    ),
    "conversational": (
        "depending on how you use it",
        "once you get into the details",
        "when it shows up in real work",
    ),
}

SEMANTIC_CLARIFIERS = {
    "formal": (
        "which is really the main point",
        "at least at a high level",
        "once you look at the tradeoff closely",
    ),
    "balanced": (
        "which is really the key idea",
        "at least at a high level",
        "when you look at it in practice",
    ),
    "conversational": (
        "which is really the whole point",
        "if you want the short version",
        "once you get into the real-world version of it",
    ),
}

STYLE_OPENERS = {
    "formal": ("More specifically", "That said"),
    "balanced": ("In most cases", "This matters because"),
    "conversational": ("Honestly", "This matters because"),
}

CONTRACTION_MAP = {
    "do not": "don't",
    "does not": "doesn't",
    "cannot": "can't",
    "it is": "it's",
    "that is": "that's",
    "there is": "there's",
    "they are": "they're",
    "we are": "we're",
}

EXPANDED_MAP = {value: key for key, value in CONTRACTION_MAP.items()}


@dataclass(frozen=True)
class HumanizationProfile:
    tone: Tone = "adaptive"
    strength: float = 0.6


class HumanizationEngine:
    def __init__(self, profile: HumanizationProfile | None = None):
        self.profile = profile or HumanizationProfile()

    def humanize_text(self, input_text: str) -> str:
        """Rewrite text to feel more natural while preserving meaning."""
        text = self.inject_perspective(input_text)
        text = self.vary_structure(text)
        text = self.apply_semantic_variation(text)
        text = self.personalize_style(text)
        text = self.ensure_coherence(text)
        return text

    def inject_perspective(self, input_text: str) -> str:
        tone = self._resolve_tone(input_text)
        rng = self._rng_for("inject_perspective", input_text)
        paragraphs: List[str] = []

        for paragraph in self._split_paragraphs(input_text):
            sentences = self._split_sentences(paragraph)
            rewritten = [
                self._inject_perspective_sentence(sentence, tone, rng)
                for sentence in sentences
            ]
            paragraphs.append(" ".join(rewritten))

        return "\n\n".join(paragraphs)

    def vary_structure(self, input_text: str) -> str:
        rng = self._rng_for("vary_structure", input_text)
        paragraphs: List[str] = []

        for paragraph in self._split_paragraphs(input_text):
            sentences = self._split_sentences(paragraph)
            expanded: List[str] = []

            for sentence in sentences:
                split_version = self._split_long_sentence(sentence, rng)
                if split_version:
                    expanded.extend(split_version)
                else:
                    expanded.append(sentence)

            merged: List[str] = []
            index = 0
            while index < len(expanded):
                current = expanded[index]
                if (
                    index + 1 < len(expanded)
                    and self._can_merge(expanded[index], expanded[index + 1])
                    and rng.random() < 0.28 * self.profile.strength
                ):
                    merged.append(
                        self._merge_sentences(expanded[index], expanded[index + 1], rng)
                    )
                    index += 2
                else:
                    merged.append(current)
                    index += 1

            paragraphs.extend(self._reparagraph(merged, rng))

        return "\n\n".join(paragraphs)

    def apply_semantic_variation(self, input_text: str) -> str:
        tone = self._resolve_tone(input_text)
        rng = self._rng_for("apply_semantic_variation", input_text)
        paragraphs: List[str] = []

        for paragraph in self._split_paragraphs(input_text):
            sentences = self._split_sentences(paragraph)
            rewritten = [
                self._semantic_touch(sentence, tone, rng)
                for sentence in sentences
            ]
            paragraphs.append(" ".join(rewritten))

        return "\n\n".join(paragraphs)

    def personalize_style(self, input_text: str) -> str:
        tone = self._resolve_tone(input_text)
        rng = self._rng_for("personalize_style", input_text)
        paragraphs: List[str] = []

        for paragraph in self._split_paragraphs(input_text):
            sentences = self._split_sentences(paragraph)
            if tone == "conversational":
                sentences = [self._apply_contractions(sentence) for sentence in sentences]
            elif tone == "formal":
                sentences = [self._expand_contractions(sentence) for sentence in sentences]

            opener_added = False
            styled: List[str] = []
            for sentence in sentences:
                if (
                    not opener_added
                    and self._is_declarative(sentence)
                    and self._word_count(sentence) >= 8
                    and rng.random() < 0.18 * self.profile.strength
                ):
                    sentence = self._add_prefix(
                        sentence,
                        rng.choice(STYLE_OPENERS[self._style_bucket(tone)]),
                    )
                    opener_added = True
                styled.append(self._normalize_transition_words(sentence, tone))

            paragraphs.append(" ".join(styled))

        return "\n\n".join(paragraphs)

    def ensure_coherence(self, input_text: str) -> str:
        paragraphs: List[str] = []

        for paragraph in self._split_paragraphs(input_text):
            cleaned_sentences: List[str] = []
            previous = ""
            for sentence in self._split_sentences(paragraph):
                sentence = self._cleanup_sentence(sentence)
                if not sentence:
                    continue
                if sentence.lower() == previous.lower():
                    continue
                cleaned_sentences.append(sentence)
                previous = sentence

            paragraph_text = " ".join(cleaned_sentences)
            paragraph_text = self._dedupe_fillers(paragraph_text)
            paragraph_text = MULTISPACE_RE.sub(" ", paragraph_text).strip()
            if paragraph_text:
                paragraphs.append(paragraph_text)

        return "\n\n".join(paragraphs)

    def _inject_perspective_sentence(
        self,
        sentence: str,
        tone: Tone,
        rng: random.Random,
    ) -> str:
        if not self._is_declarative(sentence):
            return sentence

        body, punctuation = self._split_punctuation(sentence)
        rewritten_body = body

        for pattern, replacement in COMMON_REWRITES:
            next_body, count = pattern.subn(replacement, rewritten_body, count=1)
            if count:
                rewritten_body = next_body
                break

        sentence = rewritten_body + punctuation
        if self._word_count(sentence) < 6:
            return sentence

        style_key = self._style_bucket(tone)
        add_prefix = rng.random() < 0.26 * self.profile.strength
        add_suffix = rng.random() < 0.22 * self.profile.strength

        if add_prefix:
            sentence = self._add_prefix(sentence, rng.choice(PERSPECTIVE_PREFIXES[style_key]))

        if add_suffix and not self._has_discourse_marker(sentence):
            sentence = self._add_suffix(sentence, rng.choice(PERSPECTIVE_SUFFIXES[style_key]))

        return sentence

    def _semantic_touch(
        self,
        sentence: str,
        tone: Tone,
        rng: random.Random,
    ) -> str:
        body, punctuation = self._split_punctuation(sentence)

        replacements = (
            (re.compile(r"^This means\b", re.IGNORECASE), "What that means, in practice, is"),
            (re.compile(r"^This shows\b", re.IGNORECASE), "What this really shows is"),
            (re.compile(r"^This allows\b", re.IGNORECASE), "What this allows you to do is"),
            (re.compile(r"^Therefore,?\s*", re.IGNORECASE), "So, in practical terms, "),
            (re.compile(r"^However,?\s*", re.IGNORECASE), "That said, "),
        )

        for pattern, replacement in replacements:
            body, count = pattern.subn(replacement, body, count=1)
            if count:
                return body + punctuation

        if (
            self._is_declarative(sentence)
            and self._word_count(sentence) >= 10
            and "(" not in sentence
            and rng.random() < 0.18 * self.profile.strength
        ):
            clarifier = rng.choice(SEMANTIC_CLARIFIERS[self._style_bucket(tone)])
            return f"{body}, {clarifier}{punctuation}"

        return body + punctuation

    def _split_long_sentence(
        self,
        sentence: str,
        rng: random.Random,
    ) -> List[str] | None:
        if self._word_count(sentence) < 20 or "," not in sentence:
            return None
        if rng.random() >= 0.32 * self.profile.strength:
            return None

        body, _punctuation = self._split_punctuation(sentence)
        comma_indexes = [match.start() for match in re.finditer(",", body)]
        if not comma_indexes:
            return None

        midpoint = len(body) / 2
        split_at = min(comma_indexes, key=lambda index: abs(index - midpoint))
        left = body[:split_at].strip()
        right = body[split_at + 1 :].strip()

        if self._word_count(left) < 6 or self._word_count(right) < 4:
            return None

        return [self._ensure_terminal_punctuation(left), self._capitalize_sentence(right)]

    def _can_merge(self, first: str, second: str) -> bool:
        return (
            self._is_declarative(first)
            and self._is_declarative(second)
            and self._word_count(first) <= 9
            and self._word_count(second) <= 14
        )

    def _merge_sentences(
        self,
        first: str,
        second: str,
        rng: random.Random,
    ) -> str:
        first_body, _ = self._split_punctuation(first)
        second_body, second_punctuation = self._split_punctuation(second)
        cleaned_second = self._strip_leading_transition(second_body)
        connector = self._choose_connector(second_body, rng)
        return (
            f"{first_body}, {connector} "
            f"{self._decapitalize_if_safe(cleaned_second)}{second_punctuation}"
        )

    def _reparagraph(
        self,
        sentences: Sequence[str],
        rng: random.Random,
    ) -> List[str]:
        if len(sentences) <= 3:
            return [" ".join(sentences)]

        paragraphs: List[str] = []
        index = 0
        while index < len(sentences):
            remaining = len(sentences) - index
            if remaining <= 2:
                size = remaining
            else:
                size = rng.choice((2, 3, 2, 1))
            chunk = sentences[index : index + size]
            paragraphs.append(" ".join(chunk))
            index += size

        return paragraphs

    def _resolve_tone(self, input_text: str) -> Tone:
        if self.profile.tone != "adaptive":
            return self.profile.tone

        words = self._word_count(input_text)
        contractions = len(re.findall(r"\b(?:don't|can't|it's|that's|we're|they're)\b", input_text, re.IGNORECASE))
        formal_markers = len(re.findall(r"\b(?:however|therefore|moreover|furthermore|consequently)\b", input_text, re.IGNORECASE))
        first_person = len(re.findall(r"\b(?:I|you|we)\b", input_text))
        average_length = 0 if words == 0 else len(input_text) / max(words, 1)

        if formal_markers >= 2 or average_length > 7.3:
            return "formal"
        if contractions >= 2 or first_person >= 3:
            return "conversational"
        return "balanced"

    def _rng_for(self, stage: str, input_text: str) -> random.Random:
        payload = f"{stage}\n{self.profile.tone}\n{self.profile.strength}\n{input_text}".encode("utf-8")
        seed = int.from_bytes(hashlib.sha256(payload).digest()[:8], "big")
        return random.Random(seed)

    def _split_paragraphs(self, input_text: str) -> List[str]:
        text = input_text.strip()
        if not text:
            return []
        return [part.strip() for part in PARAGRAPH_SPLIT_RE.split(text) if part.strip()]

    def _split_sentences(self, paragraph: str) -> List[str]:
        candidates = SENTENCE_SPLIT_RE.split(paragraph.strip())
        return [candidate.strip() for candidate in candidates if candidate.strip()]

    def _split_punctuation(self, sentence: str) -> Tuple[str, str]:
        sentence = sentence.strip()
        if not sentence:
            return "", "."
        if sentence[-1] in ".!?":
            return sentence[:-1].strip(), sentence[-1]
        return sentence, "."

    def _style_bucket(self, tone: Tone) -> Literal["formal", "balanced", "conversational"]:
        if tone == "adaptive":
            return "balanced"
        return tone

    def _word_count(self, text: str) -> int:
        return len(WORD_RE.findall(text))

    def _is_declarative(self, sentence: str) -> bool:
        return sentence.strip().endswith(".") or sentence.strip()[-1:] not in "?!"

    def _ensure_terminal_punctuation(self, sentence: str) -> str:
        sentence = sentence.strip()
        if not sentence:
            return sentence
        if sentence[-1] not in ".!?":
            return sentence + "."
        return sentence

    def _capitalize_sentence(self, sentence: str) -> str:
        sentence = sentence.strip()
        if not sentence:
            return sentence
        return sentence[0].upper() + sentence[1:] if sentence[0].islower() else sentence

    def _decapitalize_if_safe(self, sentence: str) -> str:
        if re.match(r"^[A-Z][a-z]", sentence):
            return sentence[0].lower() + sentence[1:]
        return sentence

    def _add_prefix(self, sentence: str, prefix: str) -> str:
        body, punctuation = self._split_punctuation(sentence)
        if body.lower().startswith(prefix.lower()):
            return body + punctuation
        return f"{prefix}, {self._decapitalize_if_safe(body)}{punctuation}"

    def _add_suffix(self, sentence: str, suffix: str) -> str:
        body, punctuation = self._split_punctuation(sentence)
        if suffix.lower() in body.lower():
            return body + punctuation
        return f"{body}, {suffix}{punctuation}"

    def _has_discourse_marker(self, sentence: str) -> bool:
        return bool(
            re.match(
                r"^(Honestly|In most cases|In practice|The thing is|Practically speaking|More often than not)\b",
                sentence,
            )
        )

    def _choose_connector(self, second_body: str, rng: random.Random) -> str:
        lowered = second_body.lower()
        if lowered.startswith(("however", "still", "yet", "but")):
            return "but"
        if lowered.startswith(("therefore", "so", "as a result")):
            return "so"
        return rng.choice(("and", "while", "but"))

    def _strip_leading_transition(self, sentence: str) -> str:
        return re.sub(
            r"^(however|therefore|moreover|furthermore|still|so|also|that said),?\s+",
            "",
            sentence,
            flags=re.IGNORECASE,
        )

    def _apply_contractions(self, sentence: str) -> str:
        updated = sentence
        for expanded, contracted in CONTRACTION_MAP.items():
            updated = re.sub(rf"\b{re.escape(expanded)}\b", contracted, updated, flags=re.IGNORECASE)
        return updated

    def _expand_contractions(self, sentence: str) -> str:
        updated = sentence
        for contracted, expanded in EXPANDED_MAP.items():
            updated = re.sub(rf"\b{re.escape(contracted)}\b", expanded, updated, flags=re.IGNORECASE)
        return updated

    def _normalize_transition_words(self, sentence: str, tone: Tone) -> str:
        if tone == "conversational":
            sentence = re.sub(r"^However,\s+", "But ", sentence, flags=re.IGNORECASE)
            sentence = re.sub(r"^Therefore,\s+", "So, ", sentence, flags=re.IGNORECASE)
        elif tone == "formal":
            sentence = re.sub(r"^But\s+", "However, ", sentence, flags=re.IGNORECASE)
            sentence = re.sub(r"^So,\s+", "As a result, ", sentence, flags=re.IGNORECASE)
        return sentence

    def _cleanup_sentence(self, sentence: str) -> str:
        sentence = sentence.strip()
        sentence = re.sub(r",\s*,+", ", ", sentence)
        sentence = re.sub(r"\s+([,.;:!?])", r"\1", sentence)
        sentence = re.sub(r"([.!?]){2,}", r"\1", sentence)
        sentence = MULTISPACE_RE.sub(" ", sentence)
        if sentence and sentence[-1] not in ".!?":
            sentence += "."
        if sentence:
            sentence = self._capitalize_sentence(sentence)
        return sentence

    def _dedupe_fillers(self, paragraph: str) -> str:
        paragraph = re.sub(r"\b(Honestly),\s+\1,\s+", r"\1, ", paragraph, flags=re.IGNORECASE)
        paragraph = re.sub(r"\b(In most cases),\s+\1,\s+", r"\1, ", paragraph, flags=re.IGNORECASE)
        paragraph = re.sub(r"\b(This matters because),\s+\1,\s+", r"\1, ", paragraph, flags=re.IGNORECASE)
        paragraph = re.sub(r"\s+,", ",", paragraph)
        return paragraph


DEFAULT_ENGINE = HumanizationEngine()


def inject_perspective(input_text: str) -> str:
    return DEFAULT_ENGINE.inject_perspective(input_text)


def vary_structure(text: str) -> str:
    return DEFAULT_ENGINE.vary_structure(text)


def apply_semantic_variation(text: str) -> str:
    return DEFAULT_ENGINE.apply_semantic_variation(text)


def personalize_style(text: str) -> str:
    return DEFAULT_ENGINE.personalize_style(text)


def ensure_coherence(text: str) -> str:
    return DEFAULT_ENGINE.ensure_coherence(text)


def humanize_text(input_text: str) -> str:
    """Takes AI-generated text and rewrites it to sound natural and human."""
    return DEFAULT_ENGINE.humanize_text(input_text)


def _example_text() -> str:
    return (
        "This method is effective. It is important for teams that need a repeatable "
        "process. The structure is clear, and the results are easy to measure. "
        "However, the method can feel rigid when every decision follows the same pattern."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Humanize flat text with deterministic heuristics.")
    parser.add_argument(
        "text",
        nargs="?",
        help="Inline text to rewrite. If omitted, the bundled example is used.",
    )
    parser.add_argument(
        "--tone",
        choices=("adaptive", "formal", "balanced", "conversational"),
        default="adaptive",
        help="Preferred tone profile.",
    )
    args = parser.parse_args()

    profile = HumanizationProfile(tone=args.tone)
    engine = HumanizationEngine(profile=profile)
    source_text = args.text or _example_text()
    output_text = engine.humanize_text(source_text)

    print("INPUT:")
    print(source_text)
    print()
    print("OUTPUT:")
    print(output_text)


if __name__ == "__main__":
    main()
