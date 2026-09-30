// Pure, dependency-free secret redaction — safe to import from unit-testable modules (the API adapter,
// evidence normalization) that must NOT drag in server-only deps (Supabase, the vault) the way
// connections-db.ts does.
//
// The one copy of the credential-shape guard (2026-09-30). connections-db.ts used to carry an identical
// regex; it now imports and re-exports this one, so there is nothing left to keep in step.
const SECRETY_VALUE = /(sk|rk)_(live|test)_[A-Za-z0-9]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(password|passwd|pwd)\s*[:=]\s*\S+/i;

// Returns the string UNCHANGED when nothing matched (so callers can compare === to detect a credential
// shape), else replaces every credential-shaped run with a fixed marker. Case-insensitive, global replace.
export function redactSecretyValue(v: string): string {
  return SECRETY_VALUE.test(v)
    ? v.replace(new RegExp(SECRETY_VALUE.source, "gi"), "[redacted by Vraelis: looked like a credential]")
    : v;
}
