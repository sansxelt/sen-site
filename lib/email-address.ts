// ONE strict recipient validator, for every path that hands an address to a mail API.
//
// WHY THIS EXISTS. There were three near-copies of this rule and they did not agree. The weakest,
// on /api/vraelis/book, was a single character-class regex:
//
//     /^[\x21-\x7e]{1,64}@[\x21-\x7e]{1,190}$/
//
// which its own comment claimed excluded RFC5322 delimiters. It does not. `@` is inside \x21-\x7e, so is
// `<`, `>`, `,`, `;`, `(`, `)`, `[`, `]`, `\` and `"`, and nothing required a dot in the domain. It
// accepted a@b@c.com, victim@example.com>, and a@localhost. A route-specific copy of a security rule is
// how that happens; there is now one implementation and every caller uses it.
//
// The rule is deliberately stricter than RFC5322 permits. These addresses are passed to a mail provider as
// a recipient and a Reply-To, so the cost of rejecting an exotic-but-legal address is a user retyping it,
// and the cost of accepting a malformed one is a header injection or a smuggled second recipient.
// Internationalised (non-ASCII) addresses are therefore NOT accepted — that is a product decision, made
// explicit here rather than hidden in a regex.

/** Longest local part and domain we accept. RFC caps are 64 and 255; the total is capped at 254. */
const MAX_LOCAL = 64;
const MAX_DOMAIN = 190;
const MAX_TOTAL = 254;

// Printable ASCII only: everything outside \x21-\x7e is rejected, which covers NUL, every C0 control,
// DEL, U+0085 (NEL), U+2028/U+2029, and every non-ASCII character including Unicode look-alikes.
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;

// Characters that must never appear in either half. `,` and `;` separate recipients for some mail APIs;
// `< > ( ) [ ] \ "` are RFC5322 delimiters and quoting syntax; `@` is handled separately (exactly one).
const FORBIDDEN = /[,;<>()[\]\\"@]/;

/**
 * True when `value` is an address safe to hand to a mail API as a recipient or Reply-To.
 *
 * Rejects, by construction:
 *   - any character outside printable ASCII (controls, NUL, NEL, U+2028/9, all non-ASCII)
 *   - more or fewer than exactly one `@`
 *   - the RFC5322 delimiters and quoting characters listed above, in either half
 *   - a domain with no dot, a leading/trailing dot, or consecutive dots
 *   - a leading or trailing dot in the local part
 *   - anything over the length caps
 */
export function isSafeRecipient(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v || v.length > MAX_TOTAL) return false;
  if (!PRINTABLE_ASCII.test(v)) return false;

  // Exactly one @ — split(), not indexOf, so "a@b@c.com" is rejected rather than silently split.
  const parts = v.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;

  if (!local || local.length > MAX_LOCAL) return false;
  if (!domain || domain.length > MAX_DOMAIN) return false;
  if (FORBIDDEN.test(local) || FORBIDDEN.test(domain)) return false;

  // A dot may not lead, trail, or repeat in either half.
  for (const half of [local, domain]) {
    if (half.startsWith(".") || half.endsWith(".") || half.includes("..")) return false;
  }
  // The domain must have at least one dot and a plausible TLD.
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (tld.length < 2 || !/^[A-Za-z]+$/.test(tld)) return false;
  // Each label must be non-empty and may not start or end with a hyphen.
  if (labels.some((l) => !l || l.startsWith("-") || l.endsWith("-"))) return false;

  return true;
}

/** Normalised form for storage and sending: trimmed and lowercased. Validate BEFORE calling this. */
export function normalizeRecipient(value: string): string {
  return value.trim().toLowerCase();
}
