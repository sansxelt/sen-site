// lib/v-content-policy.ts
// TRUST GUARD (#6): candidate content submitted for evaluation is shown to real
// human evaluators, so Vraelis blocks obvious personal data at the door. This is
// a lightweight, dependency-free guardrail — NOT compliance-grade DLP. It scans
// TEXT ONLY (titles, context, text candidates); images are not parsed. It detects
// only structured identifiers (email/phone/SSN/card) — it does NOT try to detect
// names or free-form PII (that needs NLP and would flag ordinary copy); those are
// covered by the submission notice + policy instead. False positives are
// acceptable: we would rather ask a customer to redact than leak an end-user's
// personal data to an evaluator. See docs/data-retention.md.

export type PiiCategory = "email" | "phone" | "us_ssn" | "credit_card";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const US_SSN = /\b\d{3}-\d{2}-\d{4}\b/;
// Phone: require separators or a leading +country code so we don't flag every
// 10-digit number that appears in ordinary copy. Conservative by design.
const PHONE = /(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;
// Card-like digit runs (13–19 digits, optional space/dash grouping), confirmed
// with the Luhn checksum so we don't flag arbitrary long numbers (ids, counts).
const CARD_LIKE = /\b(?:\d[ -]?){13,19}\b/g;

function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function hasCreditCard(text: string): boolean {
  const m = text.match(CARD_LIKE);
  return !!m && m.some((s) => luhnValid(s.replace(/[ -]/g, "")));
}

// Which PII categories appear in one string.
export function scanForPii(text: string): PiiCategory[] {
  const t = String(text ?? "");
  if (!t) return [];
  const found = new Set<PiiCategory>();
  if (EMAIL.test(t)) found.add("email");
  if (US_SSN.test(t)) found.add("us_ssn");
  if (PHONE.test(t)) found.add("phone");
  if (hasCreditCard(t)) found.add("credit_card");
  return [...found];
}

// Scan several fields (title, context, text candidates) at once; unioned result.
export function scanFields(fields: (string | undefined | null)[]): PiiCategory[] {
  const found = new Set<PiiCategory>();
  for (const f of fields) for (const c of scanForPii(f ?? "")) found.add(c);
  return [...found];
}

export const PII_LABELS: Record<PiiCategory, string> = {
  email: "email address",
  phone: "phone number",
  us_ssn: "Social Security number",
  credit_card: "payment card number",
};

// A single human-readable message for a rejected submission.
export function piiMessage(cats: PiiCategory[]): string {
  const list = cats.map((c) => PII_LABELS[c]).join(", ");
  return `Candidate content looks like it contains personal data (${list}). Vraelis shows submitted content to real people — remove or redact personal data before submitting.`;
}
