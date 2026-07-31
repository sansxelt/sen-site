// IS THERE ANYTHING AT THE OTHER END, BEFORE ANY MONEY MOVES?
//
// A verification was launched against https://my-safe-note.loveable.app — the real host is lovable.app, one
// letter different. The domain does not resolve at all. The run queued, the worker drove a browser at
// nothing, every flow failed, the verdict came back BLOCKED, and the hold was retained as a $15 charge. The
// product took payment to report that a typo is not a website.
//
// Worse than the money: on a free-tier account that same launch consumes the LIFETIME free pass. A reviewer
// who mistypes a URL on their first attempt spends the one free run they were given, on nothing.
//
// So the launch path asks one question first, and it is deliberately the narrowest question that can be
// answered without judgement: DOES THE HOSTNAME RESOLVE. Not "is it healthy", not "does it return 200" — a
// perfectly good deployment can answer 404, 401 or 503 at its root, and refusing those would block real
// customers to prevent a typo.
//
// FAIL OPEN ON EVERYTHING ELSE. A timeout, a TLS error, a slow host, or a failure inside our own probe all
// ALLOW the launch. This check exists to catch a definitively dead target, and a launch gate that can refuse
// a paying customer because our probe had a bad second is a worse bug than the one it prevents.
import { safeFetch, blockedFetchReason } from "../safe-fetch";

/** How long the probe may take before we stop caring. Short: this sits in front of a button click. */
export const REACH_TIMEOUT_MS = 4000;

export type ReachVerdict =
  /** DNS says this host does not exist. The only verdict that refuses a launch. */
  | "unresolved"
  /** Anything reached the host, or we could not tell. Launch proceeds. */
  | "reachable";

/**
 * The decision, split out from the network call so it can be tested without one.
 *
 * `blockedReason` is safeFetch's classification when it rejected; `httpStatus` is set when a response came
 * back at all. Everything that is not an explicit unresolved-host rejection is treated as reachable.
 */
export function classifyReach(input: { blockedReason?: string | null; httpStatus?: number | null; errored?: boolean }): ReachVerdict {
  if (input.blockedReason === "unresolved_host") return "unresolved";
  // A response of ANY status proves the host exists, which is the whole question here.
  if (typeof input.httpStatus === "number") return "reachable";
  // Timeouts, TLS failures, aborted sockets, and our own bugs: not evidence of absence.
  return "reachable";
}

/**
 * Probe a deployment URL. Never throws: every failure path resolves to a verdict, because a launch must not
 * depend on this succeeding.
 */
export async function probeDeployment(url: string): Promise<ReachVerdict> {
  if (!url) return "reachable";                    // nothing to check; other validation owns empty URLs
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REACH_TIMEOUT_MS);
  try {
    // GET, not HEAD: some hosts answer HEAD with 405 or refuse it outright, and a redirect chain is normal
    // for a deployment root. The body is never read — only that a status arrived at all.
    const res = await safeFetch(url, { method: "GET", redirect: "follow", signal: ctl.signal });
    return classifyReach({ httpStatus: res.status });
  } catch (e) {
    return classifyReach({ blockedReason: blockedFetchReason(e), errored: true });
  } finally {
    clearTimeout(timer);
  }
}
