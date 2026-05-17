// Admin-email gate. Used by /account/content and any other surface
// that should only be visible to operators of Vraelis, not to every
// signed-in user.
//
// Source of truth is the ADMIN_EMAILS env var: comma-separated
// list. Empty/unset means "nobody is admin" (defense-in-depth: a
// fresh deploy with the var missing locks admin pages, doesn't
// open them).
//
// Compared case-insensitively after trimming.

const PARSED = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return PARSED.includes(email.toLowerCase());
}
