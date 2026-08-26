// GitHub sign-in: establish the email from GitHub's authoritative list, and only when GitHub says it is
// verified.
//
// WHAT WAS WRONG. @auth/core's stock GitHub provider reads GET /user and uses profile.email, and only if
// that is empty does it fall back to GET /user/emails — where it picks
//
//     (emails.find((e) => e.primary) ?? emails[0]).email
//
// with no reference to the `verified` flag GitHub returns on every entry. Two ways that admits an address
// the user never proved they own:
//
//   * `emails[0]` is whatever GitHub happened to list first when no entry is marked primary. Anyone can
//     add any address to their GitHub account; it sits there unverified until they click a link in it.
//   * the primary itself is not guaranteed verified — an account mid-email-change can carry an unverified
//     primary.
//
// This system's identity IS the email string. isAdminEmail keys on it, and every owner-scoped row in the
// database keys on it. So an address accepted without proof is not a cosmetic problem: add
// someone@thecompany.com to a throwaway GitHub account, sign in with GitHub, and you are them.
//
// WHAT THIS DOES INSTEAD. It always asks /user/emails — never trusting the public profile email, which is
// a display field — and accepts only an entry GitHub marks `verified: true`, preferring the primary. If
// the list cannot be read, or holds nothing verified, sign-in FAILS. A sign-in that cannot establish a
// proven address must not proceed to guess one.
//
// The GitHub host is fixed and not attacker-influenced, so this is a plain fetch rather than safeFetch —
// but it carries a timeout, because a hung call here hangs the whole sign-in.

const API = "https://api.github.com";
const TIMEOUT_MS = 10_000;

export type GitHubEmailEntry = { email?: unknown; primary?: unknown; verified?: unknown };

export class GitHubEmailUnverifiedError extends Error {
  constructor(public readonly reason: string) {
    super(`github_email_unverified:${reason}`);
    this.name = "GitHubEmailUnverifiedError";
  }
}

/**
 * Choose the address to sign in as, from GitHub's /user/emails payload.
 *
 * Pure and exported so the selection rules can be tested directly against adversarial payloads rather
 * than inferred from the network path.
 *
 * Returns null when nothing in the list is usable — the caller must then refuse.
 */
export function pickVerifiedEmail(entries: unknown): string | null {
  if (!Array.isArray(entries)) return null;
  const usable = entries.filter((e): e is GitHubEmailEntry => {
    if (!e || typeof e !== "object") return false;
    const { email, verified } = e as GitHubEmailEntry;
    // `verified` must be the boolean true. The string "true", 1, and "yes" are not GitHub's shape, and
    // accepting them would let a loose payload through the one check that matters here.
    return typeof email === "string" && email.includes("@") && verified === true;
  });
  if (usable.length === 0) return null;
  const primary = usable.find((e) => e.primary === true);
  const chosen = (primary ?? usable[0]).email as string;
  return chosen.trim().toLowerCase();
}

/** Injectable so the tests can drive the real control flow instead of asserting on its source. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

async function ghFetch(path: string, token: string, f: FetchLike): Promise<Response> {
  return f(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "vraelis-auth",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * Replacement for the provider's userinfo request.
 *
 * THROWS rather than returning a profile whose email is unproven. @auth/core turns that into a failed
 * sign-in, which is the correct outcome: no session is issued.
 */
export async function fetchGitHubProfile(
  accessToken: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<Record<string, unknown>> {
  const userRes = await ghFetch("/user", accessToken, fetchImpl);
  if (!userRes.ok) {
    throw new GitHubEmailUnverifiedError(`user_endpoint_${userRes.status}`);
  }
  const profile = (await userRes.json()) as Record<string, unknown>;

  // ALWAYS asked for, not only when the public profile email is blank. The public email is a display
  // preference; the verified list is the record of what the user actually proved.
  const emailsRes = await ghFetch("/user/emails", accessToken, fetchImpl);
  if (!emailsRes.ok) {
    // 403/404 here is normally the `user:email` scope missing from the grant. Whatever the cause, we
    // cannot establish a verified address, so we do not sign anyone in.
    throw new GitHubEmailUnverifiedError(`emails_endpoint_${emailsRes.status}`);
  }

  const email = pickVerifiedEmail(await emailsRes.json());
  if (!email) {
    throw new GitHubEmailUnverifiedError("no_verified_address");
  }

  // Overwrite whatever /user reported. If GitHub's verified list and the public profile disagree, the
  // verified list wins — that disagreement is exactly the case this exists to handle.
  profile.email = email;
  // Give the shared signIn gate a real claim to read. It refuses an explicit false; for GitHub this was
  // previously always undefined, so the gate was inert on this provider.
  profile.email_verified = true;
  return profile;
}
