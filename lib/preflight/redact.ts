// Pure, dependency-free secret redaction — safe to import from unit-testable modules (the API adapter,
// evidence normalization) that must NOT drag in server-only deps (Supabase, the vault) the way
// connections-db.ts does.
//
// The regex is kept IDENTICAL to lib/preflight/connections-db.ts::SECRETY_VALUE (the live web path). This
// module does not modify connections-db (web-safety rule: don't touch the proven path); the two should
// converge on this file in a later, separately-reviewed cleanup. Until then, if you edit one, edit both.
const SECRETY_VALUE = /(sk|rk)_(live|test)_[A-Za-z0-9]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(password|passwd|pwd)\s*[:=]\s*\S+/i;

// Returns the string UNCHANGED when nothing matched (so callers can compare === to detect a credential
// shape), else replaces every credential-shaped run with a fixed marker. Case-insensitive, global replace.
export function redactSecretyValue(v: string): string {
  return SECRETY_VALUE.test(v)
    ? v.replace(new RegExp(SECRETY_VALUE.source, "gi"), "[redacted by Vraelis: looked like a credential]")
    : v;
}
