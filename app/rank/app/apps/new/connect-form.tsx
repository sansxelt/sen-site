"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Connect-an-app form for Vraelis Preflight. Records the deployed app + the build prompt and the
// ownership attestation; it does NOT run anything (no discovery, no browser execution in Phase 1).
// Posts to /api/preflight/apps; on { id } it lands on the app's page. Styling mirrors checks/new.

const inputStyle = { width: "100%", padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14.5, fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box" as const };
const lab = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "var(--fg-4)", display: "block", marginBottom: 8 };
const optional = { textTransform: "none" as const, letterSpacing: 0, color: "var(--fg-5)" };
const help = { fontSize: 12, color: "var(--fg-4)", margin: "6px 0 0", lineHeight: 1.5 };

// values match the Builder type in lib/v-applications.ts
const BUILDERS: [string, string][] = [
  ["", "Select a builder (optional)"],
  ["claude_code", "Claude Code"],
  ["cursor", "Cursor"],
  ["lovable", "Lovable"],
  ["bolt", "Bolt"],
  ["replit", "Replit"],
  ["v0", "v0"],
  ["other", "Other"],
];

// The API only sends a human `message` for ownership_required / invalid_url. Map the rest to plain copy.
function friendlyError(code: unknown): string {
  switch (code) {
    case "name_and_url_required": return "Add both an application name and its URL.";
    case "ownership_required": return "Confirm you own or are authorized to test this app.";
    case "invalid_url": return "Enter a public https URL for the deployed app.";
    case "insert_failed": return "We couldn't save this app. Try again.";
    case "unavailable": return "Preflight isn't available right now. Try again in a moment.";
    default: return "Something went wrong. Try again.";
  }
}

// Disabled "coming soon" affordance — signals what's next without pretending it works yet.
function SoonButton({ label }: { label: string }) {
  return (
    <button type="button" disabled aria-disabled="true" title="Coming soon"
      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-2)", color: "var(--fg-4)", fontSize: 13, fontFamily: "var(--font-sans)", cursor: "not-allowed" }}>
      <span aria-hidden style={{ fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1 }}>+</span>
      {label}
      <span className="pill" style={{ fontSize: 10, padding: "1px 7px" }}>Soon</span>
    </button>
  );
}

export default function ConnectForm() {
  const router = useRouter();
  const [appUrl, setAppUrl] = useState("");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [builder, setBuilder] = useState("");
  const [own, setOwn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const canSubmit = own && !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/preflight/apps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          app_url: appUrl.trim(),
          builder: builder || undefined,
          source_prompt: prompt.trim() || undefined,
          ownership_confirmed: true,
        }),
      });
      if (res.status === 401) { router.push(`/signin?callbackUrl=${encodeURIComponent("/app/apps/new")}`); return; }
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.id) { router.push(`/app/apps/${j.id}`); return; } // navigating away; keep busy to block a double-submit
      setErr(typeof j?.message === "string" && j.message ? j.message : friendlyError(j?.error));
      setBusy(false);
    } catch {
      setErr("Something went wrong. Check your connection and try again.");
      setBusy(false);
    }
  }

  // focus ring matching the check form's inputs
  const ring = (k: string) => ({ borderColor: focused === k ? "var(--acc)" : "var(--line-2)", boxShadow: focused === k ? "0 0 0 3px var(--acc-soft)" : "none" });

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 20, padding: "clamp(18px, 2.6vw, 26px)" }}>
        <div>
          <label style={lab} htmlFor="app-url">Application URL</label>
          <input id="app-url" type="url" required inputMode="url" autoComplete="off" value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)} onFocus={() => setFocused("url")} onBlur={() => setFocused((f) => (f === "url" ? null : f))}
            placeholder="https://your-app.vercel.app" maxLength={2000} style={{ ...inputStyle, ...ring("url") }} />
          <p style={help}>The public https URL of your deployed app.</p>
        </div>

        <div>
          <label style={lab} htmlFor="app-name">Application name</label>
          <input id="app-name" type="text" required value={name}
            onChange={(e) => setName(e.target.value)} onFocus={() => setFocused("name")} onBlur={() => setFocused((f) => (f === "name" ? null : f))}
            placeholder="e.g. Acme dashboard" maxLength={140} style={{ ...inputStyle, ...ring("name") }} />
          <p style={help}>A short label so you can tell your apps apart.</p>
        </div>

        <div>
          <label style={lab} htmlFor="app-prompt">Original build prompt <span style={optional}>(recommended)</span></label>
          <textarea id="app-prompt" value={prompt}
            onChange={(e) => setPrompt(e.target.value)} onFocus={() => setFocused("prompt")} onBlur={() => setFocused((f) => (f === "prompt" ? null : f))}
            placeholder="Paste the prompt or spec you used to build it" maxLength={20000} rows={5}
            style={{ ...inputStyle, ...ring("prompt"), minHeight: 120, resize: "vertical", lineHeight: 1.55 }} />
          <p style={help}>Vraelis uses this to understand what the app was meant to do. You can add or edit it later.</p>
        </div>

        <div>
          <label style={lab} htmlFor="app-builder">Builder <span style={optional}>(optional)</span></label>
          <select id="app-builder" value={builder} onChange={(e) => setBuilder(e.target.value)}
            onFocus={() => setFocused("builder")} onBlur={() => setFocused((f) => (f === "builder" ? null : f))}
            style={{ ...inputStyle, ...ring("builder"), appearance: "none", cursor: "pointer" }}>
            {BUILDERS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <p style={help}>What you built the app with.</p>
        </div>
      </div>

      {/* Not wired yet — these connect deeper inputs in a later phase. */}
      <div>
        <div style={lab as React.CSSProperties}>More inputs</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <SoonButton label="Connect GitHub" />
          <SoonButton label="Upload requirements" />
          <SoonButton label="Add test account" />
        </div>
        <p style={help}>These sharpen the preflight. They&apos;re coming soon and aren&apos;t needed to connect.</p>
      </div>

      <label htmlFor="app-own" style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "14px 16px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-2)" }}>
        <input id="app-own" type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)}
          style={{ marginTop: 2, accentColor: "var(--acc)", width: 16, height: 16, flex: "none" }} />
        <span style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5 }}>I own this application or am authorized to test it.</span>
      </label>

      {err ? <p role="alert" style={{ fontSize: 13.5, color: "var(--err)", margin: 0 }}>{err}</p> : null}

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button type="submit" className="btn btn--lg" disabled={!canSubmit}
          style={{ opacity: canSubmit ? 1 : 0.55, cursor: canSubmit ? "pointer" : "not-allowed" }}>
          {busy ? "Connecting…" : "Connect app"}
        </button>
        {!own ? <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>Confirm ownership above to continue.</span> : null}
      </div>
    </form>
  );
}
