"use client";

import { useState, type ReactNode } from "react";
import { sendTestLead } from "./actions";

const TABS = [
  { key: "inbox", label: "Inbox" },
  { key: "money", label: "Money" },
  { key: "setup", label: "Setup" },
] as const;
type Key = (typeof TABS)[number]["key"];

export type StepAction =
  | { type: "tab"; tab: Key; cta: string }
  | { type: "link"; href: string; cta: string }
  | { type: "test"; cta: string }
  | { type: "copy"; value: string; cta: string }
  | null;
export type Step = { key: string; label: string; done: boolean; action: StepAction };

// Checklist action that copies a value (the shareable agent link) to the
// clipboard and confirms inline — the real activation step for an inbound
// product, so the user shares their link rather than only firing a test lead.
function CopyAction({ value, cta, style }: { value: string; cta: string; style: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      style={style}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — ignore */
        }
      }}
    >
      {copied ? "Copied" : cta} →
    </button>
  );
}

// Account shell: an actionable setup checklist + the three tab panels.
// Server-rendered panels are passed as props; we just toggle visibility
// (display:none, not unmount → keeps form state, no refetch). Checklist
// steps can jump tabs, link out, or fire the test-lead server action.
export function AccountTabs({
  inbox,
  money,
  setup,
  steps,
  initialTab = "inbox",
}: {
  inbox: ReactNode;
  money: ReactNode;
  setup: ReactNode;
  steps: Step[];
  initialTab?: Key;
}) {
  const [tab, setTab] = useState<Key>(initialTab);

  // Server-rendered panels (passed as props) can't call setTab directly, so
  // they request a tab jump via a `data-tab-jump="<key>"` attribute on any
  // clickable element; we delegate the click here.
  function onPanelClick(e: React.MouseEvent<HTMLDivElement>) {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tab-jump]");
    const key = el?.dataset.tabJump;
    if (key === "inbox" || key === "money" || key === "setup") {
      e.preventDefault();
      setTab(key);
    }
  }

  const done = steps.filter((s) => s.done).length;
  const allDone = done === steps.length;
  const pct = Math.round((done / steps.length) * 100);

  const actionBtn: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.02em",
    color: "var(--acc-deep)", background: "none", border: "none", cursor: "pointer",
    textDecoration: "none", whiteSpace: "nowrap", padding: 0,
  };
  function Action({ a }: { a: StepAction }) {
    if (!a) return null;
    if (a.type === "tab") return <button type="button" style={actionBtn} onClick={() => setTab(a.tab)}>{a.cta} →</button>;
    if (a.type === "link") return <a style={actionBtn} href={a.href}>{a.cta} →</a>;
    if (a.type === "copy") return <CopyAction value={a.value} cta={a.cta} style={actionBtn} />;
    return (
      <form action={sendTestLead}>
        <button type="submit" style={actionBtn}>{a.cta} →</button>
      </form>
    );
  }

  return (
    <div>
      {!allDone && (
        <div className="win" style={{ padding: "clamp(12px,1.6vw,16px) clamp(14px,1.8vw,18px)", marginBottom: "clamp(12px,1.5vw,16px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 600, marginBottom: 1 }}>Your agent is live. Next: get paid</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>{done} of {steps.length} done. These get you to your first paid lead.</div>
            </div>
            <div style={{ flex: "1 1 180px", maxWidth: 340, minWidth: 140 }}>
              <div style={{ height: 5, background: "var(--bg-3)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--acc)", borderRadius: 99, transition: "width 400ms var(--ease)" }} />
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
            {steps.map((s) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", border: "1px solid var(--line-1)", borderRadius: 4 }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontSize: 10, border: s.done ? "none" : "1px solid var(--line-3)", background: s.done ? "var(--acc)" : "transparent", color: s.done ? "var(--fg-on-accent)" : "transparent" }}>✓</span>
                <span style={{ flex: 1, fontSize: 12.5, color: s.done ? "var(--fg-4)" : "var(--fg-1)", textDecoration: s.done ? "line-through" : "none" }}>{s.label}</span>
                {!s.done && <Action a={s.action} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "clamp(16px,2.5vw,26px)", borderBottom: "1px solid var(--line-2)", marginBottom: "clamp(14px,1.8vw,18px)" }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                border: "none", background: "none", cursor: "pointer",
                padding: "0 1px 9px", marginBottom: -1,
                fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.01em",
                color: on ? "var(--fg-1)" : "var(--fg-4)", fontWeight: on ? 600 : 500,
                borderBottom: `2px solid ${on ? "var(--acc)" : "transparent"}`,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div onClick={onPanelClick} style={{ display: tab === "inbox" ? "block" : "none" }}>{inbox}</div>
      <div onClick={onPanelClick} style={{ display: tab === "money" ? "block" : "none" }}>{money}</div>
      <div style={{ display: tab === "setup" ? "block" : "none" }}>{setup}</div>
    </div>
  );
}
