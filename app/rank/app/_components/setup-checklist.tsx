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
export type SetupState = { address: boolean; sentence: boolean; approval: boolean; run: boolean; agent: boolean; twoStep: boolean | null };

type Step = { key: keyof SetupState; t: string; d: string; href: string; cta: string; optional?: boolean };
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

export function SetupChecklist({ state }: { state: SetupState }) {
  const required = STEPS.filter((x) => !x.optional);
  const done = required.filter((x) => state[x.key]).length;
  const next = STEPS.find((x) => !state[x.key] && !(x.optional && state[x.key] === null));
  const rows = STEPS.filter((x) => !(x.optional && state[x.key] === null));
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
              <span aria-hidden style={{ width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center",
                background: isDone ? "var(--ok)" : "transparent", border: isDone ? "none" : `1.5px solid ${isNext ? "var(--fg-1)" : "var(--line-3)"}` }}>
                {isDone ? <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#0A0A0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg> : null}
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
