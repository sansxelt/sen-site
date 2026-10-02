"use client";

/* SET UP VRAELIS: three one-tap questions, asked once, on the Overview of an account that has not finished
   setting up (console audit, onboarding design). Every question can be left alone and the whole card can be
   skipped; either way it never comes back. What the answers change is decided on the server
   (app/rank/app/page.tsx): the checklist's order and steps, and the example sentence in the composer.

   The surfaces are held to what is Live (_content/coverage.ts). A desktop or mobile app is not built yet,
   so choosing it says that plainly and only records the interest. */
import { useState } from "react";
import { useRouter } from "next/navigation";

type Answer = { surface: string | null; builder: string | null; audience: string | null };

const SURFACE: [string, string][] = [["web", "A web app"], ["panel", "A device's control panel"], ["native", "A desktop or mobile app"]];
const BUILDER: [string, string][] = [
  ["lovable", "Lovable"], ["bolt", "Bolt"], ["replit", "Replit"], ["v0", "v0"], ["cursor", "Cursor"], ["claude_code", "Claude Code"],
  ["codex", "Codex"], ["copilot", "Copilot"], ["windsurf", "Windsurf"], ["own", "We write it ourselves"],
];
const AUDIENCE: [string, string][] = [["me", "Just me"], ["team", "My team"], ["client", "A client (I'm an agency)"]];

function Chips({ label, options, value, onPick }: { label: string; options: [string, string][]; value: string | null; onPick: (v: string | null) => void }) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <legend style={{ padding: 0, fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)", marginBottom: 8 }}>{label}</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map(([v, t]) => {
          const on = value === v;
          return (
            <button key={v} type="button" aria-pressed={on} onClick={() => onPick(on ? null : v)}
              style={{ padding: "7px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer", fontWeight: on ? 600 : 500,
                color: on ? "#0A0A0B" : "var(--fg-2)", background: on ? "#FAFAFA" : "var(--bg-2)",
                border: `1px solid ${on ? "#FAFAFA" : "var(--line-2)"}` }}>
              {t}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function OnboardingCard() {
  const router = useRouter();
  const [a, setA] = useState<Answer>({ surface: "web", builder: null, audience: null });
  const [busy, setBusy] = useState(false);

  const send = async (body: Answer) => {
    setBusy(true);
    try {
      await fetch("/api/v/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    } finally {
      router.refresh();
    }
  };

  return (
    <section className="card" aria-labelledby="onb-h" style={{ marginBottom: 20, padding: "clamp(18px, 2.4vw, 24px)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 id="onb-h" style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: "var(--fg-1)" }}>Set up Vraelis</h2>
        <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>Three taps, all optional. Asked once.</span>
      </div>
      <div style={{ display: "grid", gap: 18, marginTop: 16 }}>
        <Chips label="What do you want to check first?" options={SURFACE} value={a.surface} onPick={(v) => setA({ ...a, surface: v })} />
        {a.surface === "native" ? (
          <p style={{ margin: "-8px 0 0", fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5 }}>
            Not built yet: today Vraelis checks what a real browser can open. Your answer is recorded, and it tells us what to build next.
          </p>
        ) : null}
        <Chips label="How do you build?" options={BUILDER} value={a.builder} onPick={(v) => setA({ ...a, builder: v })} />
        <Chips label="Who looks at the results?" options={AUDIENCE} value={a.audience} onPick={(v) => setA({ ...a, audience: v })} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void send(a)}>{busy ? "Saving" : "Save"}</button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void send({ surface: null, builder: null, audience: null })}>Skip</button>
      </div>
    </section>
  );
}
