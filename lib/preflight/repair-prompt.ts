// The repair prompt: what a run hands to whatever built the app.
//
// This closes the loop. Until now a run told you what broke and stopped there, which left the useful half
// of the work undone: the owner still had to translate a failure into something their coding agent could
// act on.
//
// THE DIVISION OF LABOUR, and why this needs no model call. Vraelis watches from outside and cannot see
// your source, so it must not guess at causes. The agent that built the app HAS the source and is good at
// diagnosis once it knows the symptom. So the prompt's job is not to explain the bug. It is to describe,
// precisely and without invention, what was expected, what happened instead, and exactly how to see it
// again. Everything here comes from the run: no inference, no model, deterministic for the same input.
//
// It deliberately tells the agent what Vraelis does NOT know. Without that, an agent reads a hedged guess
// as a finding and goes off fixing the wrong thing, which is worse than saying nothing.
import type { Issue } from "./issues";

export type RepairPromptContext = {
  appName?: string | null;
  deploymentUrl?: string | null;
};

const MAX_CONSOLE = 5;   // enough to be useful, not enough to bury the ask
const MAX_NETWORK = 5;

function section(title: string, body: string): string {
  return `${title}\n${body}`;
}

export function buildRepairPrompt(issue: Issue, ctx: RepairPromptContext = {}): string {
  const target = (ctx.deploymentUrl ?? "").trim();
  const app = (ctx.appName ?? "").trim();
  const ev = issue.evidence;

  const parts: string[] = [];

  parts.push(
    `A check of ${app || "this application"} failed${target ? ` on ${target}` : ""}. ` +
    `It ran in a real browser against the deployed app, from the outside, as a user would.`,
  );

  parts.push(section("WHAT WAS BEING CHECKED", issue.expected));
  parts.push(section("WHAT HAPPENED INSTEAD", issue.observed));

  if (issue.repro.length) {
    parts.push(section("HOW TO REPRODUCE", issue.repro.join("\n")));
  }

  const whereBits: string[] = [];
  if (typeof ev.failed_step_index === "number") {
    whereBits.push(`Step ${ev.failed_step_index + 1}${ev.failed_action ? ` (${ev.failed_action})` : ""} is where it stopped.`);
  }
  if (ev.current_url) whereBits.push(`URL at the time: ${ev.current_url}`);
  if (whereBits.length) parts.push(section("WHERE IT FAILED", whereBits.join("\n")));

  // Console + network are OBSERVED facts and often the fastest route to the cause, so they go in verbatim
  // and truncated rather than summarised.
  const consoleErrors = (ev.console_errors ?? []).filter(Boolean);
  if (consoleErrors.length) {
    const shown = consoleErrors.slice(0, MAX_CONSOLE);
    const more = consoleErrors.length - shown.length;
    parts.push(section(
      "BROWSER CONSOLE",
      shown.map((e) => `- ${e}`).join("\n") + (more > 0 ? `\n- (${more} more)` : ""),
    ));
  }

  const netFailures = (ev.network_failures ?? []).filter(Boolean);
  if (netFailures.length) {
    const shown = netFailures.slice(0, MAX_NETWORK);
    const more = netFailures.length - shown.length;
    parts.push(section(
      "FAILED NETWORK REQUESTS",
      shown.map((n) => `- ${n.method} ${n.path} returned ${n.status}`).join("\n") + (more > 0 ? `\n- (${more} more)` : ""),
    ));
  }

  // The hedge, stated as a hedge. possible_explanation is a guess by construction, so it is labelled and
  // fenced rather than presented alongside the observations as though it were one of them.
  if (issue.possible_explanation) {
    parts.push(section(
      "ONE GUESS, UNCONFIRMED",
      `${issue.possible_explanation} This was not verified. Ignore it if the code says otherwise.`,
    ));
  }

  parts.push(
    "WHAT I NEED\n" +
    "This was observed from outside the app, so I know the symptom and not the cause. You have the source. " +
    "Find why this happens, fix the underlying cause rather than the symptom, and tell me what you changed " +
    "and why. If reproducing it needs something I have not given you, say what.",
  );

  return parts.join("\n\n");
}
