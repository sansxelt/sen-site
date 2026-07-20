"use client";

// Account-level Connections. Connect a provider ONCE for the whole account (GitHub live; more as they
// ship). The sealed OAuth token lives at the account level; each application links to it and carries its
// own repo/project selection. This page manages the account tokens only — the per-app selection lives on
// each application's Connections tab.

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { I, EmptyIcon } from "@/app/rank/_components/icons";

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub", vercel: "Vercel", supabase: "Supabase", stripe_test: "Stripe", sentry: "Sentry",
};

const OAUTH_REASONS: Record<string, string> = {
  denied: "You cancelled the authorization, or the provider declined it.",
  server_misconfigured: "This provider isn't configured yet on our side. Nothing was connected.",
  bad_state: "The authorization link expired or was tampered with. Try connecting again.",
  state_mismatch: "The authorization couldn't be verified in this browser. Try connecting again.",
  owner_mismatch: "That authorization didn't match your account. Nothing was connected.",
  exchange_failed: "The provider didn't complete the token exchange. Try again in a moment.",
  vault_unconfigured: "Secure storage isn't configured, so the token couldn't be sealed.",
  migration_required: "Account connections aren't fully set up yet. Please try again shortly.",
  no_code: "The provider didn't return an authorization code. Try connecting again.",
};

type AccountConnection = {
  id: string; provider: string; status: string;
  meta: { token_mask?: string; scopes?: string[]; account?: string; expires_at?: string };
  last_verified_at: string | null; created_at: string;
};

// Providers we KNOW may support account OAuth. Which ones actually render a Connect button is decided
// server-side (configured env + not gated) and returned as `available`; a connected provider always shows
// even if newly gated.
const KNOWN_OAUTH = ["github", "vercel", "sentry", "stripe_test", "supabase"] as const;

const eyebrow = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 } as const;

function whenUtc(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; }
}

export default function ConnectionsPage() {
  const search = useSearchParams();
  const [conns, setConns] = useState<AccountConnection[] | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [redirectOnly, setRedirectOnly] = useState<string[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // OAuth callback banner (?oauth=connected|error&provider=&reason=).
  useEffect(() => {
    const o = search.get("oauth");
    if (o !== "connected" && o !== "error") return;
    const provider = search.get("provider") || "";
    const label = PROVIDER_LABELS[provider] ?? provider;
    if (o === "connected") setMsg({ ok: true, text: `${label} connected for your account. Every application can now use it.` });
    else setMsg({ ok: false, text: `Could not connect ${label}. ${OAUTH_REASONS[search.get("reason") || ""] ?? "Please try again."}` });
  }, [search]);

  async function load() {
    try {
      const res = await fetch("/api/preflight/connections", { cache: "no-store" });
      if (!res.ok) { setConns([]); return; }
      const j = await res.json();
      setConns(Array.isArray(j.connections) ? j.connections : []);
      setAvailable(Array.isArray(j.available) ? j.available : []);
      setRedirectOnly(Array.isArray(j.redirectOnly) ? j.redirectOnly : []);
    } catch { setConns([]); }
  }
  useEffect(() => { void load(); }, []);

  // Result of a popup authorization. The callback page posts {source:"vraelis-oauth", params} to this
  // window and closes itself; we render the same banner as the redirect flow and refresh the list in place,
  // so the user never leaves this page. Origin is checked before trusting the message.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { source?: string; params?: string } | null;
      if (!data || data.source !== "vraelis-oauth" || typeof data.params !== "string") return;
      const q = new URLSearchParams(data.params);
      const provider = q.get("provider") || "";
      const label = PROVIDER_LABELS[provider] ?? provider;
      if (q.get("oauth") === "connected") {
        setMsg({ ok: true, text: `${label} connected for your account. Every application can now use it.` });
      } else {
        setMsg({ ok: false, text: `Could not connect ${label}. ${OAUTH_REASONS[q.get("reason") || ""] ?? "Please try again."}` });
      }
      setConnecting(null);
      void load();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Start an authorization. Most providers open in a popup so the user stays on this page; providers whose
  // flow needs the full window (Vercel's multi-step install) navigate normally. If a popup is blocked we
  // fall back to navigation too — the callback handles both.
  function connect(kind: string) {
    const base = `/api/preflight/connections/${encodeURIComponent(kind)}/oauth`;
    if (redirectOnly.includes(kind)) { window.location.href = base; return; }

    const w = 620, h = 760;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 3);
    const win = window.open(`${base}?popup=1`, "vraelis-oauth", `width=${w},height=${h},left=${left},top=${top}`);
    if (!win) { window.location.href = base; return; }
    win.focus();
    // Show progress on the button: an already-authorized provider (GitHub) completes almost instantly, so
    // without this the popup flashes and it's unclear anything happened. Cleared by the result message, or
    // when the popup closes without one (user dismissed it).
    setConnecting(kind);
    const poll = setInterval(() => {
      if (win.closed) { clearInterval(poll); setConnecting((c) => (c === kind ? null : c)); void load(); }
    }, 500);
  }

  async function revoke(id: string, label: string) {
    if (busy) return;
    setBusy(id); setMsg(null);
    try {
      const res = await fetch(`/api/preflight/connections?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) { setMsg({ ok: true, text: `${label} disconnected.` }); await load(); }
      else setMsg({ ok: false, text: `Could not disconnect ${label}. Try again.` });
    } catch { setMsg({ ok: false, text: "Network error. Nothing was changed." }); }
    finally { setBusy(null); }
  }

  const byProvider = new Map((conns ?? []).map((c) => [c.provider, c]));

  return (
    <div className="wrap" style={{ maxWidth: 900, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <p style={eyebrow}>Account</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "0 0 10px" }}>Connections</h1>
      <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, margin: "0 0 24px", maxWidth: 620 }}>
        Authorize a provider once for your whole account. Vraelis holds a read-only token, sealed with
        AES-256-GCM, never a password. Every application then uses it, choosing its own repo or project.
      </p>

      {msg ? (
        <div role={msg.ok ? "status" : "alert"} style={{
          borderRadius: "var(--r-sm)", padding: "11px 15px", fontSize: 13.5, lineHeight: 1.5, marginBottom: 20,
          border: `1px solid ${msg.ok ? "var(--acc-line)" : "rgba(178,58,58,0.25)"}`,
          background: msg.ok ? "var(--acc-soft)" : "rgba(178,58,58,0.08)",
          color: msg.ok ? "var(--acc-deep)" : "#9F2D2D",
        }}>{msg.text}</div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {KNOWN_OAUTH.filter((kind) => byProvider.has(kind) || available.includes(kind)).map((kind) => {
          const c = byProvider.get(kind);
          const label = PROVIDER_LABELS[kind] ?? kind;
          return (
            <div key={kind} className="card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderColor: c ? "var(--acc-line)" : "var(--line-2)" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15.5, color: "var(--fg-1)" }}>{label}</span>
                  {c ? <span className="pill" style={{ fontSize: 9.5, color: "var(--acc-deep)", background: "var(--acc-soft)", borderColor: "var(--acc-line)" }}>Connected</span> : null}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 3, lineHeight: 1.5 }}>
                  {c
                    ? `${c.meta.account ? `${c.meta.account}, ` : ""}token ${c.meta.token_mask ?? "sealed"}${c.created_at ? `, connected ${whenUtc(c.created_at)}` : ""}`
                    : "Not connected. Authorize once and every application can use it."}
                </div>
                {/* What was actually granted — so "read-only" is verifiable, not just claimed. */}
                {c && Array.isArray(c.meta.scopes) && c.meta.scopes.length > 0 ? (
                  <div style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: 3, lineHeight: 1.5, wordBreak: "break-word" }}>
                    Access: {c.meta.scopes.join(", ")}
                  </div>
                ) : null}
              </div>
              {c ? (
                <button type="button" className="btn btn--ghost" disabled={busy === c.id} style={{ flex: "none", opacity: busy === c.id ? 0.6 : 1 }} onClick={() => void revoke(c.id, label)}>
                  {busy === c.id ? "Disconnecting…" : "Disconnect"}
                </button>
              ) : (
                <button type="button" className="btn" style={{ flex: "none", opacity: connecting === kind ? 0.6 : 1 }}
                  disabled={connecting === kind} onClick={() => connect(kind)}>
                  {connecting === kind ? "Connecting…" : `Connect ${label}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {conns !== null && conns.length === 0 ? (
        <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 10, color: "var(--fg-4)", fontSize: 13 }}>
          <EmptyIcon d={I.key} />
          <span>Nothing connected yet. Connecting a provider here makes it available to all of your applications.</span>
        </div>
      ) : null}
    </div>
  );
}
