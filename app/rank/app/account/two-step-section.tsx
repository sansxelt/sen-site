"use client";

// Two-step verification on the Account page: status, the two methods (authenticator app, email codes), the
// recovery codes, and turning it off. Talks to /api/v/two-step; every rule (what needs a code, rate limits,
// single use) is enforced there and in lib/two-step-db.ts, so this component only sequences screens.
//
// ONE PANEL AT A TIME opens under the method rows:
//   proof  "Confirm it is you": once two-step verification is on, every change needs a current code first
//   totp   scan the QR code (or type the key), then enter a code from the app to turn it on
//   email  enter the code we just emailed to turn email codes on
//   codes  the recovery codes, shown exactly once, with Copy and Download
//
// The section is anchored at #two-step so the Overview nudge can link straight to it.

import { useState, type FormEvent, type ReactNode } from "react";
import { SECTION_TITLE } from "@/app/rank/_components/page-header";

type Status = {
  enabled: boolean;
  totp: boolean;
  email: boolean;
  enrolledAt: string | null;
  totpEnrolledAt: string | null;
  emailEnrolledAt: string | null;
  recoveryRemaining: number;
  recoveryGeneratedAt: string | null;
};
type ProofMethod = "totp" | "email" | "recovery";
type Action = "totp_begin" | "email_begin" | "remove_totp" | "remove_email" | "disable" | "recovery_new";
type Setup = { ticket: string; secret: string; displaySecret: string; uri: string; qr: { size: number; path: string } };
type Panel =
  | { kind: "idle" }
  | { kind: "proof"; action: Action }
  | { kind: "totp"; setup: Setup }
  | { kind: "email"; ticket: string }
  | { kind: "codes"; codes: string[]; reason: "enabled" | "regenerated" };
type Msg = { kind: "ok" | "err"; text: string } | null;
type Reply = { ok: boolean; error?: string; status?: Status; recoveryCodes?: string[] | null; setup?: Setup; ticket?: string; issuedAt?: number };

const ERRORS: Record<string, string> = {
  invalid: "That code did not work. Check it and try again.",
  expired: "That code or setup has expired. Start again to get a new one.",
  rate_limited: "Too many attempts. Wait a few minutes, then try again.",
  unavailable: "We could not complete that just now. Try again in a moment.",
  not_enabled: "Email codes are not on for this account, so a code cannot be emailed.",
  network: "Network error. Check your connection and try again.",
};

// What the proof panel says it is confirming.
const ACTION_TEXT: Record<Action, string> = {
  totp_begin: "To set up an authenticator app,",
  email_begin: "To turn on email codes,",
  remove_totp: "To remove your authenticator app,",
  remove_email: "To turn off email codes,",
  disable: "To turn off two-step verification,",
  recovery_new: "To get new recovery codes,",
};

async function call(body: Record<string, unknown>): Promise<Reply> {
  try {
    const res = await fetch("/api/v/two-step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await res.json().catch(() => ({}))) as Reply;
    return { ...j, ok: res.ok && j.ok !== false };
  } catch {
    return { ok: false, error: "network" };
  }
}

// UTC so the server render and the browser agree on the day.
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";

const label = { fontSize: 13, fontWeight: 500, color: "var(--fg-2)" } as const;
const fieldStyle = { width: "100%", maxWidth: 260, boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, borderWidth: 1, borderStyle: "solid", fontSize: 15, color: "var(--fg-1)" } as const;
const codeFieldStyle = { ...fieldStyle, fontFamily: "var(--font-brand-mono), ui-monospace, monospace", letterSpacing: "0.2em" } as const;
const rowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "16px 20px", borderTop: "1px solid var(--line-1)" } as const;
const smallBtn = { padding: "8px 14px", fontSize: 13.5 } as const;

function MethodRow({ title, desc, state, children }: { title: string; desc: string; state: string; children: ReactNode }) {
  return (
    <div style={rowStyle}>
      <div style={{ flex: "1 1 280px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>{title}</span>
          <span className="pill">{state}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
      </div>
      <div style={{ display: "flex", gap: 8, flex: "none" }}>{children}</div>
    </div>
  );
}

export function TwoStepSection({ email, initial }: { email: string; initial: Status | null }) {
  const [status, setStatus] = useState<Status | null>(initial);
  const [panel, setPanel] = useState<Panel>({ kind: "idle" });
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [proofMethod, setProofMethod] = useState<ProofMethod>("totp");
  const [proofIssuedAt, setProofIssuedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState<"key" | "codes" | null>(null);

  const heading = <h2 id="two-step" style={{ ...SECTION_TITLE, margin: "32px 0 6px", scrollMarginTop: 90 }}>Two-step verification</h2>;
  const intro = (
    <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 14px", maxWidth: 640, lineHeight: 1.55 }}>
      Ask for a code as well as your password, or after Google or GitHub, every time someone signs in to this account. A leaked password is then not enough on its own.
    </p>
  );

  if (!status) {
    return (
      <section aria-labelledby="two-step">
        {heading}
        <div className="card" style={{ marginBottom: 26, fontSize: 13.5, color: "var(--fg-3)" }}>
          We could not load your two-step verification settings. Reload the page to try again.
        </div>
      </section>
    );
  }

  const on = status.enabled;
  const reset = (next: Panel = { kind: "idle" }) => { setPanel(next); setCode(""); setProofIssuedAt(null); setCopied(null); };
  const fail = (r: Reply) => setMsg({ kind: "err", text: ERRORS[r.error ?? ""] ?? "Something went wrong. Try again." });

  // Off: setting up needs nothing more than the new method's own code. On: every change asks for a current
  // code first (the server refuses without one), so open the proof panel.
  function start(action: Action) {
    setMsg(null);
    if (!on) { void run(action, null); return; }
    setProofMethod(status!.totp ? "totp" : "email");
    reset({ kind: "proof", action });
  }

  async function run(action: Action, proof: { method: ProofMethod; code: string; issuedAt: number | null } | null) {
    setBusy(true);
    setMsg(null);
    let r: Reply;
    if (action === "totp_begin" || action === "email_begin") {
      r = await call({ action, proof });
      if (r.ok && action === "totp_begin" && r.setup) reset({ kind: "totp", setup: r.setup });
      if (r.ok && action === "email_begin" && r.ticket) reset({ kind: "email", ticket: r.ticket });
    } else if (action === "recovery_new") {
      r = await call({ action, proof });
      if (r.ok && r.status && r.recoveryCodes) { setStatus(r.status); reset({ kind: "codes", codes: r.recoveryCodes, reason: "regenerated" }); }
    } else {
      r = action === "disable"
        ? await call({ action: "disable", proof })
        : await call({ action: "remove", method: action === "remove_totp" ? "totp" : "email", proof });
      if (r.ok && r.status) {
        setStatus(r.status);
        reset();
        setMsg({ kind: "ok", text: !r.status.enabled ? "Two-step verification is off." : action === "remove_totp" ? "Authenticator app removed." : "Email codes are off." });
      }
    }
    if (!r.ok) { fail(r); setCode(""); }
    setBusy(false);
  }

  async function submitProof(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (panel.kind !== "proof" || !code.trim()) return;
    await run(panel.action, { method: proofMethod, code, issuedAt: proofMethod === "email" ? proofIssuedAt : null });
  }

  async function sendConfirmCode() {
    setBusy(true);
    setMsg(null);
    const r = await call({ action: "send_code" });
    if (r.ok && typeof r.issuedAt === "number") { setProofIssuedAt(r.issuedAt); setMsg({ kind: "ok", text: `Code sent to ${email}.` }); }
    else fail(r);
    setBusy(false);
  }

  async function confirmSetup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if ((panel.kind !== "totp" && panel.kind !== "email") || !code.trim()) return;
    setBusy(true);
    setMsg(null);
    const r = panel.kind === "totp"
      ? await call({ action: "totp_confirm", ticket: panel.setup.ticket, code })
      : await call({ action: "email_confirm", ticket: panel.ticket, code });
    if (r.ok && r.status) {
      const was = panel.kind;
      setStatus(r.status);
      if (r.recoveryCodes?.length) reset({ kind: "codes", codes: r.recoveryCodes, reason: "enabled" });
      else { reset(); setMsg({ kind: "ok", text: was === "totp" ? "Authenticator app added." : "Email codes are on." }); }
    } else { fail(r); setCode(""); }
    setBusy(false);
  }

  async function resendSetupEmail() {
    if (panel.kind !== "email") return;
    setBusy(true);
    setMsg(null);
    const r = await call({ action: "email_resend", ticket: panel.ticket });
    if (r.ok && r.ticket) { setPanel({ kind: "email", ticket: r.ticket }); setMsg({ kind: "ok", text: `New code sent to ${email}.` }); }
    else fail(r);
    setBusy(false);
  }

  async function copy(text: string, what: "key" | "codes") {
    try { await navigator.clipboard.writeText(text); setCopied(what); } catch { setMsg({ kind: "err", text: "Copy did not work in this browser. Select the text and copy it instead." }); }
  }

  function download(codes: string[]) {
    const body = [
      "Vraelis recovery codes",
      `Account: ${email}`,
      `Created: ${new Date().toISOString().slice(0, 10)}`,
      "",
      ...codes,
      "",
      "Each code works once. Use one when you cannot get a code from your authenticator app or email.",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "vraelis-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const cancel = <button type="button" className="btn btn--ghost" style={smallBtn} onClick={() => { reset(); setMsg(null); }} disabled={busy}>Cancel</button>;
  const idle = panel.kind === "idle";

  const codeInput = (id: string, numeric: boolean) => (
    <input
      id={id}
      type="text"
      value={code}
      onChange={(e) => setCode(numeric ? e.target.value.replace(/[^0-9 ]/g, "") : e.target.value)}
      inputMode={numeric ? "numeric" : "text"}
      autoComplete={numeric ? "one-time-code" : "off"}
      autoCapitalize="none"
      spellCheck={false}
      maxLength={numeric ? 7 : 24}
      placeholder={numeric ? "123456" : "abcde-fghjk"}
      style={numeric ? codeFieldStyle : fieldStyle}
      autoFocus
      required
    />
  );

  return (
    <section aria-labelledby="two-step">
      {heading}
      {intro}
      <div className="card" style={{ padding: 0, marginBottom: 26, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>Status</span>
              <span className="pill" style={on ? { background: "var(--fg-1)", color: "#FFFFFF" } : undefined}>{on ? "On" : "Off"}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4, lineHeight: 1.5 }}>
              {on
                ? `On since ${day(status.enrolledAt)}. Every sign-in to this account asks for a code.`
                : "Anyone with your password can sign in. Choose a method below to turn two-step verification on. It takes about a minute."}
            </div>
          </div>
        </div>

        <MethodRow
          title="Authenticator app"
          state={status.totp ? `On since ${day(status.totpEnrolledAt)}` : "Not set up"}
          desc="A 6-digit code from an app on your phone, such as Google Authenticator, Microsoft Authenticator, 1Password or Authy. Works without signal."
        >
          {status.totp
            ? <button type="button" className="btn btn--ghost" style={smallBtn} onClick={() => start("remove_totp")} disabled={busy || !idle}>Remove</button>
            : <button type="button" className={on ? "btn btn--ghost" : "btn"} style={smallBtn} onClick={() => start("totp_begin")} disabled={busy || !idle}>Set up</button>}
        </MethodRow>

        <MethodRow
          title="Email codes"
          state={status.email ? `On since ${day(status.emailEnrolledAt)}` : "Off"}
          desc={`A 6-digit code sent to ${email} each time you sign in.`}
        >
          {status.email
            ? <button type="button" className="btn btn--ghost" style={smallBtn} onClick={() => start("remove_email")} disabled={busy || !idle}>Turn off</button>
            : <button type="button" className="btn btn--ghost" style={smallBtn} onClick={() => start("email_begin")} disabled={busy || !idle}>Turn on</button>}
        </MethodRow>

        {on ? (
          <MethodRow
            title="Recovery codes"
            state={`${status.recoveryRemaining} of 10 left`}
            desc={status.recoveryRemaining <= 2
              ? "You are running low. Get new codes so you can still sign in if you lose your phone or email."
              : "One-time codes that sign you in when you cannot use your phone or email."}
          >
            <button type="button" className="btn btn--ghost" style={smallBtn} onClick={() => start("recovery_new")} disabled={busy || !idle}>Get new codes</button>
          </MethodRow>
        ) : null}

        {panel.kind === "proof" ? (
          <form onSubmit={submitProof} style={{ ...rowStyle, display: "block", background: "#FAFAFA" }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>Confirm it is you</div>
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "4px 0 12px", lineHeight: 1.5 }}>{ACTION_TEXT[panel.action]} enter a current code.</p>
            <div role="radiogroup" aria-label="How to confirm" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {([...(status.totp ? ["totp"] : []), ...(status.email ? ["email"] : []), "recovery"] as ProofMethod[]).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={proofMethod === m} className={proofMethod === m ? "btn" : "btn btn--ghost"} style={{ padding: "6px 11px", fontSize: 13 }}
                  onClick={() => { setProofMethod(m); setCode(""); setMsg(null); }} disabled={busy}>
                  {m === "totp" ? "Authenticator app" : m === "email" ? "Email code" : "Recovery code"}
                </button>
              ))}
            </div>
            {proofMethod === "email" && !proofIssuedAt ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn" style={smallBtn} onClick={() => void sendConfirmCode()} disabled={busy}>{busy ? "Sending…" : `Email a code to ${email}`}</button>
                {cancel}
              </div>
            ) : (
              <>
                <label htmlFor="two-step-proof" style={{ ...label, display: "block", marginBottom: 6 }}>
                  {proofMethod === "totp" ? "Code from your authenticator app" : proofMethod === "email" ? "Code from your email" : "Recovery code"}
                </label>
                {codeInput("two-step-proof", proofMethod !== "recovery")}
                {proofMethod === "email" ? (
                  <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 6 }}>
                    Sent to {email}. <button type="button" className="two-step__inline" onClick={() => void sendConfirmCode()} disabled={busy}>Send a new code</button>
                  </div>
                ) : proofMethod === "recovery" ? (
                  <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 6 }}>Using a recovery code uses it up.</div>
                ) : null}
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button type="submit" className="btn" style={smallBtn} disabled={busy || !code.trim()}>{busy ? "Checking…" : "Continue"}</button>
                  {cancel}
                </div>
              </>
            )}
          </form>
        ) : null}

        {panel.kind === "totp" ? (
          <form onSubmit={confirmSetup} style={{ ...rowStyle, display: "block", background: "#FAFAFA" }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>Set up your authenticator app</div>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-start", marginTop: 12 }}>
              <svg className="two-step-qr" viewBox={`0 0 ${panel.setup.qr.size} ${panel.setup.qr.size}`} role="img" aria-label="QR code to add Vraelis to your authenticator app" shapeRendering="crispEdges">
                <rect width={panel.setup.qr.size} height={panel.setup.qr.size} fill="#FFFFFF" />
                <path d={panel.setup.qr.path} fill="#0A0A0B" />
              </svg>
              <ol style={{ flex: "1 1 260px", minWidth: 0, margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, display: "grid", gap: 10 }}>
                <li>Open your authenticator app, add an account, and scan this QR code.</li>
                <li>
                  Cannot scan it? Enter this key instead, and choose time based if the app asks.
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    <code style={{ fontFamily: "var(--font-brand-mono), ui-monospace, monospace", fontSize: 13, color: "var(--fg-1)", background: "#FFFFFF", border: "1px solid var(--line-2)", borderRadius: 6, padding: "4px 8px", wordBreak: "break-all" }}>{panel.setup.displaySecret}</code>
                    <button type="button" className="btn btn--ghost" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={() => void copy(panel.setup.secret, "key")}>{copied === "key" ? "Copied" : "Copy key"}</button>
                  </div>
                </li>
                <li>
                  <label htmlFor="two-step-totp" style={{ ...label, display: "block", marginBottom: 6 }}>Enter the 6-digit code the app shows</label>
                  {codeInput("two-step-totp", true)}
                </li>
              </ol>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button type="submit" className="btn" style={smallBtn} disabled={busy || !code.trim()}>{busy ? "Checking…" : "Turn on"}</button>
              {cancel}
            </div>
          </form>
        ) : null}

        {panel.kind === "email" ? (
          <form onSubmit={confirmSetup} style={{ ...rowStyle, display: "block", background: "#FAFAFA" }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>Turn on email codes</div>
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "4px 0 12px", lineHeight: 1.5 }}>
              We sent a 6-digit code to {email}. Enter it to confirm the emails reach you. It works for 10 minutes.
            </p>
            <label htmlFor="two-step-email" style={{ ...label, display: "block", marginBottom: 6 }}>Email code</label>
            {codeInput("two-step-email", true)}
            <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 6 }}>
              Not there? Check spam, or <button type="button" className="two-step__inline" onClick={() => void resendSetupEmail()} disabled={busy}>send a new code</button>.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="submit" className="btn" style={smallBtn} disabled={busy || !code.trim()}>{busy ? "Checking…" : "Turn on"}</button>
              {cancel}
            </div>
          </form>
        ) : null}

        {panel.kind === "codes" ? (
          <div style={{ ...rowStyle, display: "block", background: "#FAFAFA" }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>
              {panel.reason === "enabled" ? "Two-step verification is on. Save your recovery codes." : "Your new recovery codes"}
            </div>
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "4px 0 12px", lineHeight: 1.55, maxWidth: 620 }}>
              If you lose your phone or cannot get email, a recovery code signs you in. Each code works once. Keep them somewhere you can reach without your phone, such as a password manager.
              {panel.reason === "regenerated" ? " Your previous codes no longer work." : ""} We will not show these codes again.
            </p>
            <ul className="two-step-codes" aria-label="Recovery codes">
              {panel.codes.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" className="btn btn--ghost" style={smallBtn} onClick={() => void copy(panel.codes.join("\n"), "codes")}>{copied === "codes" ? "Copied" : "Copy"}</button>
              <button type="button" className="btn btn--ghost" style={smallBtn} onClick={() => download(panel.codes)}>Download .txt</button>
              <button type="button" className="btn" style={smallBtn} onClick={() => { reset(); setMsg(null); }}>I saved them</button>
            </div>
          </div>
        ) : null}

        {on && idle ? (
          <div style={{ ...rowStyle, justifyContent: "flex-start" }}>
            <button type="button" className="btn btn--ghost" style={{ ...smallBtn, color: "var(--err)", borderColor: "rgba(180,35,24,0.3)" }} onClick={() => start("disable")} disabled={busy}>
              Turn off two-step verification
            </button>
          </div>
        ) : null}

        {msg ? (
          <div role={msg.kind === "err" ? "alert" : "status"} style={{ padding: "10px 20px 14px", fontSize: 13, color: msg.kind === "err" ? "var(--err)" : "var(--fg-2)" }}>{msg.text}</div>
        ) : null}
      </div>
    </section>
  );
}
