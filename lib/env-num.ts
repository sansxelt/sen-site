// ONE bounded-positive-integer parser for numeric environment overrides.
//
// WHY. The pattern `Number(process.env.X || 25) || 25` was repeated across several files and is wrong in
// four ways that all fail OPEN rather than closed:
//
//   Number("-5")   -> -5, truthy, accepted. A negative cap disables the thing it caps.
//   Number("2.5")  -> 2.5, truthy, accepted. A fractional count is meaningless and can behave oddly in
//                     comparisons and slices.
//   Number("1e99") -> 1e99, truthy, accepted. An "unlimited" cap written as a plausible-looking string.
//   Number("0")    -> 0, FALSY, so it silently becomes the default. An operator who sets a cap to 0
//                     intending "off" gets the default instead, which is the opposite of what they asked.
//
// This parser accepts only a finite, safe, positive integer inside a documented [min, max], and otherwise
// returns the default and says why. Bounds are mandatory arguments, not optional, so a caller has to state
// what range it actually supports.

export type EnvNumOpts = {
  /** Smallest accepted value. */
  min: number;
  /** Largest accepted value. Prevents "effectively unlimited" being set by accident. */
  max: number;
  /** Used when the variable is unset, malformed, or out of range. Must itself be within [min, max]. */
  fallback: number;
};

/**
 * Read a bounded positive integer from the environment.
 *
 * An out-of-range or malformed value is REJECTED and logged once — it never silently becomes the value
 * the operator typed, and never becomes an unbounded one.
 */
export function envInt(name: string, opts: EnvNumOpts): number {
  const { min, max, fallback } = opts;
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return fallback;

  // Reject anything that is not a plain run of digits BEFORE Number() sees it. Number() happily accepts
  // "1e99", " 12 ", "0x10", "Infinity" and "-5"; a digit-only test accepts none of them.
  if (!/^\d+$/.test(raw)) {
    warnOnce(name, `"${raw}" is not a plain positive integer; using ${fallback}`);
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isSafeInteger(n)) {
    warnOnce(name, `"${raw}" is not a safe integer; using ${fallback}`);
    return fallback;
  }
  if (n < min || n > max) {
    warnOnce(name, `${n} is outside [${min}, ${max}]; using ${fallback}`);
    return fallback;
  }
  return n;
}

// One line per variable per process, so a misconfiguration is visible in logs without flooding them.
const warned = new Set<string>();
function warnOnce(name: string, detail: string): void {
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(`[env] ${name}: ${detail}`);
}

/** Test seam. */
export function _resetEnvWarnings(): void {
  warned.clear();
}
