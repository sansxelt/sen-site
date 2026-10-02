import Link from "next/link";

/* GET TO YOUR FIRST PROOF: the Overview's setup checklist (console audit, 2026-10-01).

   A new account used to open on a security prompt above a blank form and a static four-step list with no
   progress. This is the Vanta and Linear pattern instead: the real steps, in order, each with one action,
   and a count of how many are done.

   EVERY "DONE" IS READ FROM A STORED ROW, never from a click on this card, so it cannot claim progress that
   did not happen (app/rank/app/page.tsx computes them):
     address    the person has a system (any, including the one the composer files checks under)
     sentence   a reviewed plan exists (v_reviewed_plans, written from their sentence)
     approval   a plan was approved by a person
     run        a verification finished
     agent      an API key has been used (the CLI and the hosted MCP connector both run on one)
   Two-step verification rides along as the optional last step while this card is up, rather than as a banner
   above the only thing a new account can do. The card disappears once the five required steps are done. */
export type SetupState = {
  address: boolean; sentence: boolean; approval: boolean; run: boolean; agent: boolean; twoStep: boolean | null;
  /** Set only when the person said a team or a client looks at the results (onboarding): has anyone been
   *  invited in that role. Null hides the step. */
  people?: boolean | null;
};

/** What the onboarding answers change here (lib/onboarding.ts): a coding-agent builder connects the agent
 *  second rather than last, and a team or an agency gets the step that brings those people in. */
export type SetupShape = { agentFirst?: boolean; audience?: "team" | "client" | null };

type Step = { key: keyof SetupState; t: string; d: string; href: string; cta: string; optional?: boolean };
const PEOPLE: Record<"team" | "client", Step> = {
  team: { key: "people", t: "Invite a teammate", d: "They see the same systems and records. Only a person can approve a plan.", href: "/team", cta: "Invite", optional: true },
  client: { key: "people", t: "Give your client read-only access", d: "A client viewer sees client-ready reports and nothing else, and is free.", href: "/team", cta: "Invite a client", optional: true },
};
const STEPS: Step[] = [
  { key: "address", t: "Add your live app's address", d: "A public https address: production, staging or a preview.", href: "/app?new=1", cta: "Add address" },
  { key: "sentence", t: "Say what should work", d: "One sentence. Vraelis writes the plan that would prove it, free.", href: "/app?new=1", cta: "Write it" },
  { key: "approval", t: "Approve the plan", d: "Nothing runs until a person approves it. Your agent never can.", href: "/review", cta: "Review plans" },
  { key: "run", t: "Read your first record", d: "Every step, a screenshot, and a repair prompt if something broke.", href: "/verifications", cta: "Open records" },
  { key: "agent", t: "Connect your coding agent", d: "Claude Code, Codex, Cursor or Copilot can ask for checks over MCP or the CLI.", href: "/cli", cta: "Set it up" },
  { key: "twoStep", t: "Turn on two-step verification", d: "A code as well as your password at every sign-in.", href: "/account#two-step", cta: "Set it up", optional: true },
];

export function setupComplete(s: SetupState) {
  return s.address && s.sentence && s.approval && s.run && s.agent;
}

function stepsFor(shape: SetupShape): Step[] {
  let steps = STEPS.slice();
  if (shape.agentFirst) {
    const agent = steps.find((x) => x.key === "agent")!;
    steps = steps.filter((x) => x.key !== "agent");
    steps.splice(1, 0, agent);
  }
  if (shape.audience) steps.splice(steps.length - 1, 0, PEOPLE[shape.audience]);
  return steps;
}

export function SetupChecklist({ state, shape = {} }: { state: SetupState; shape?: SetupShape }) {
  const all = stepsFor(shape);
  const required = all.filter((x) => !x.optional);
  const done = required.filter((x) => state[x.key]).length;
  const hidden = (x: Step) => x.optional && (state[x.key] === null || state[x.key] === undefined);
  const next = all.find((x) => !state[x.key] && !hidden(x));
  const rows = all.filter((x) => !hidden(x));
  return (
    <section className="card" aria-labelledby="setup-h" style={{ marginBottom: 28, padding: "clamp(18px, 2.4vw, 24px)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 id="setup-h" style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: "var(--fg-1)" }}>Get to your first proof</h2>
        <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>{`${done} of ${required.length} done`}</span>
      </div>
      <div aria-hidden style={{ height: 3, borderRadius: 3, background: "var(--line-2)", marginTop: 12, overflow: "hidden" }}>
        <div style={{ width: `${(done / required.length) * 100}%`, height: "100%", background: "var(--acc)", transition: "width 300ms ease" }} />
      </div>
      <ol style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
        {rows.map((x, i) => {
          const isDone = !!state[x.key];
          const isNext = next?.key === x.key;
          return (
            <li key={x.key} style={{ display: "grid", gridTemplateColumns: "22px minmax(0, 1fr) auto", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i ? "1px solid var(--line-1)" : "none" }}>
              {/* Numbered, not ticked: the row already says Done in words (no decorative dots, founder). */}
              <span aria-hidden style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: isNext ? "var(--fg-1)" : "var(--fg-4)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: isDone ? "var(--fg-3)" : "var(--fg-1)", textDecoration: isDone ? "line-through" : "none", textDecorationColor: "var(--line-3)" }}>
                  {x.t}{x.optional ? <span style={{ fontWeight: 400, color: "var(--fg-4)" }}>{" (optional)"}</span> : null}
                </span>
                {!isDone ? <span style={{ display: "block", fontSize: 12.5, color: "var(--fg-4)", marginTop: 2, lineHeight: 1.45 }}>{x.d}</span> : null}
              </span>
              {isDone ? <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>Done</span>
                : <Link href={x.href} className={isNext ? "btn" : "btn btn--ghost"} style={{ fontSize: 13, padding: "6px 12px", minHeight: 0, whiteSpace: "nowrap" }}>{x.cta}</Link>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
