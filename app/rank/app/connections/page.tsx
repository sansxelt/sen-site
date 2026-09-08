"use client";

// Account-level Connections. Connect a provider ONCE for the whole account (GitHub live; more as they
// ship). The sealed OAuth token lives at the account level; each application links to it and carries its
// own repo/project selection. This page manages the account tokens only — the per-app selection lives on
// each application's Connections tab.

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { I, EmptyIcon } from "@/app/rank/_components/icons";
import { Page, PageHeader } from "@/app/rank/_components/page-header";
import { PROVIDER_LABELS as ALL_PROVIDER_LABELS, featureUse } from "@/lib/preflight/connection-display";

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

// Connections that exist but are NOT account-level OAuth: they are set per application, because each one is
// a value that differs between apps (a channel, an endpoint, a host) rather than an account you authorize
// once. Listed here because this page is named "Connections", and a reader who came looking for Slack and
// saw four OAuth cards would fairly conclude we do not support it. The page was understating the product.
// Labels and descriptions come from connection-display, the one place the honest per-provider copy lives.
// Writing fresh blurbs here would let this page drift into claiming more than the cards do, which is exactly
// how "stored, not yet used in verification" quietly turns into an advertised feature.
const PER_APP_KINDS = ["slack", "webhook", "custom_deploy", "custom_auth", "openapi", "test_account"] as const;

// THE LOCAL `eyebrow` OBJECT IS GONE, AND IT IS THE ONE THE COMPONENT COMMENT NAMES.
//
// There were two unrelated things in this codebase both called "eyebrow": the .eyebrow CLASS (13px Geist,
// weight 600, sentence case) and a local const object (10.5px Inter Tight, uppercase, 0.08em tracked). This
// file rendered the object and Billing, one sidebar click away, rendered the class, so the identical kicker
// in the identical position appeared in two typefaces, two sizes and two cases depending on which page you
// were on. <PageHeader> renders the class, which is the correct one; the object was the drift.
function whenUtc(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; }
}

export default function ConnectionsPage() {
  const search = useSearchParams();
  const [conns, setConns] = useState<AccountConnection[] | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [redirectOnly, setRedirectOnly] = useState<string[]>([]);
  const [popupSizes, setPopupSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // The popup we opened. Held so THIS page can close it once the result arrives: a provider that sends
  // Cross-Origin-Opener-Policy (Vercel) leaves the popup unable to close itself, but the opener keeps that
  // ability, so the window that opened it has to do the closing.
  const popupRef = useRef<Window | null>(null);

  // OAuth callback banner (?oauth=connected|error&provider=&reason=).
  useEffect(() => {
    const o = search.get("oauth");
    if (o !== "connected" && o !== "error") return;
    const provider = search.get("provider") || "";
    const label = PROVIDER_LABELS[provider] ?? provider;
    if (o === "connected") setMsg({ ok: true, text: `${label} connected for your account. Every system can now use it.` });
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
      setPopupSizes(j.popupSizes && typeof j.popupSizes === "object" ? j.popupSizes : {});
    } catch { setConns([]); }
  }
  useEffect(() => { void load(); }, []);

  // Result of a popup authorization, rendered as the same banner as the redirect flow with the list
  // refreshed in place. We listen on THREE channels because window.opener is not reliable: a provider that
  // sends Cross-Origin-Opener-Policy (Vercel's install does) severs it, so postMessage never arrives.
  // BroadcastChannel is same-origin and unaffected; the storage event is the last-resort fallback.
  useEffect(() => {
    let done = false;
    function apply(params: string) {
      if (done) return;
      done = true;
      // Close the popup from here. It already tried to close itself and may have been refused.
      try { popupRef.current?.close(); } catch { /* already gone */ }
      popupRef.current = null;
      const q = new URLSearchParams(params);
      const provider = q.get("provider") || "";
      const label = PROVIDER_LABELS[provider] ?? provider;
      if (q.get("oauth") === "connected") {
        setMsg({ ok: true, text: `${label} connected for your account. Every system can now use it.` });
      } else {
        setMsg({ ok: false, text: `Could not connect ${label}. ${OAUTH_REASONS[q.get("reason") || ""] ?? "Please try again."}` });
      }
      setConnecting(null);
      void load();
      setTimeout(() => { done = false; }, 1000); // allow a later connect in the same session
    }

    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { source?: string; params?: string } | null;
      if (!data || data.source !== "vraelis-oauth" || typeof data.params !== "string") return;
      apply(data.params);
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== "vraelis-oauth" || !e.newValue) return;
      try { const v = JSON.parse(e.newValue) as { params?: string }; if (typeof v.params === "string") apply(v.params); } catch { /* ignore */ }
    }

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("vraelis-oauth");
      bc.onmessage = (e) => {
        const data = e.data as { source?: string; params?: string } | null;
        if (data && data.source === "vraelis-oauth" && typeof data.params === "string") apply(data.params);
      };
    } catch { /* no BroadcastChannel: the other two channels cover it */ }

    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      try { bc?.close(); } catch { /* ignore */ }
    };
  }, []);

  // Start an authorization. Most providers open in a popup so the user stays on this page; providers whose
  // flow needs the full window (Vercel's multi-step install) navigate normally. If a popup is blocked we
  // fall back to navigation too — the callback handles both.
  function connect(kind: string) {
    const base = `/api/preflight/connections/${encodeURIComponent(kind)}/oauth`;
    if (redirectOnly.includes(kind)) { window.location.href = base; return; }

    // Providers with a multi-step authorization (Vercel's install) ask for a bigger window; clamp to the
    // screen so a large popup never opens off-screen on a laptop.
    const want = popupSizes[kind] ?? { w: 620, h: 760 };
    const w = Math.min(want.w, Math.max(420, window.screen.availWidth - 80));
    const h = Math.min(want.h, Math.max(520, window.screen.availHeight - 120));
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 3);
    const win = window.open(`${base}?popup=1`, "vraelis-oauth", `width=${w},height=${h},left=${left},top=${top}`);
    if (!win) { window.location.href = base; return; }
    popupRef.current = win;
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
    // The prose measure: this page is a short stack of provider cards read as sentences, not a table. It was
    // hardcoded to 900, one of fifteen widths in the console. The inline paddingTop is dropped rather than
    // carried over because the shell overrides it with !important and it has never rendered; the tail room
    // moves onto the content, which is where it was actually doing something.
    <Page measure="prose">
      <PageHeader
        eyebrow="Account"
        title="Integrations"
        lead="Authorize a provider once for your whole account. Vraelis holds a read-only token, sealed with AES-256-GCM, never a password. Every system then uses it, choosing its own repo or project."
      />

      <div style={{ paddingBottom: 80 }}>

      {/* THE BANNER WAS PAINTED IN A RED THAT EXISTS NOWHERE ELSE IN THIS PRODUCT.
          The failure branch was rgba(178,58,58,...), a light-theme red carried over from the cream surface,
          used for the border and the wash while the TEXT was --stop-ink (#FF7A55). So the one banner that
          tells you an authorization failed drew its frame in one red and its words in another, neither of
          which matched the Failed pill three inches away. Both halves are --stop-* now, which is the same
          ink/wash/line triple <Verdict> paints Failed with.
          The success branch had the mirror-image bug in the other direction: --go-wash behind --go-ink,
          framed in --acc-line, which is plain 20% white. Green wash, green words, white frame. */}
      {msg ? (
        <div role={msg.ok ? "status" : "alert"} style={{
          borderRadius: "var(--r-sm)", padding: "11px 15px", fontSize: 13.5, lineHeight: 1.5, marginBottom: 20,
          border: `1px solid ${msg.ok ? "var(--go-line)" : "var(--stop-line)"}`,
          background: msg.ok ? "var(--go-wash)" : "var(--stop-wash)",
          color: msg.ok ? "var(--go-ink)" : "var(--stop-ink)",
        }}>{msg.text}</div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {KNOWN_OAUTH.filter((kind) => byProvider.has(kind) || available.includes(kind)).map((kind) => {
          const c = byProvider.get(kind);
          const label = PROVIDER_LABELS[kind] ?? kind;
          return (
            // CONNECTED AND NOT CONNECTED DIFFERED BY 6% OF ONE ALPHA CHANNEL.
            //
            // The card border was --acc-line (rgba(255,255,255,0.20)) when connected and --line-2
            // (rgba(255,255,255,0.14)) when not: the same white, six hundredths apart, which is not a
            // distinction anyone can see and is certainly not one you can see at a glance down a list of five
            // providers. The connected card now carries --go-line, so the difference is a colour rather than
            // an alpha, and it is the SAME green the pill inside it uses.
            <div key={kind} className="card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderColor: c ? "var(--go-line)" : "var(--line-2)" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15.5, color: "var(--fg-1)" }}>{label}</span>
                  {/* NOT a <Verdict>. "Connected" is a fact about an OAuth token, not a conclusion about a
                      deployment, and the vocabulary <Verdict> renders is Verified / Failed / Blocked /
                      In progress / Not yet verified. Putting a sixth word through it would be exactly the
                      drift that component exists to stop.
                      What it does borrow is the signal palette, because the old pill had none: --acc-deep on
                      --acc-soft is #FAFAFA on 6% white, so the badge that says a provider is live was drawn
                      in the headline colour with no colour in it at all, at 9.5px, which is the smallest
                      type on the page. It is the go triple now, at .pill's own size. */}
                  {c ? <span className="pill" style={{ color: "var(--go-ink)", background: "var(--go-wash)", borderColor: "var(--go-line)" }}>Connected</span> : null}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 3, lineHeight: 1.5 }}>
                  {c
                    ? `${c.meta.account ? `${c.meta.account}, ` : ""}token ${c.meta.token_mask ?? "sealed"}${c.created_at ? `, connected ${whenUtc(c.created_at)}` : ""}`
                    : "Not connected. Authorize once and every system can use it."}
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

      {/* A HAND-ROLLED EMPTY STATE THAT PUT A 46px TILE NEXT TO A 13px SENTENCE.
          <EmptyIcon> renders .empty__icon, which is a 46px rounded tile sized for the centred column of the
          .empty block. This laid it out as a flex ROW against a 13px line of body text, so the icon was three
          and a half times the height of the words beside it and read as a broken image rather than a state.
          .empty is the block that tile was drawn for, and it is what the empty key list and the empty webhook
          list on /developers already use. Same words, split at the full stop that was already in them. */}
      {conns !== null && conns.length === 0 ? (
        <div className="empty" style={{ marginTop: 22 }}>
          <EmptyIcon d={I.key} />
          <h3>Nothing connected yet</h3>
          <p>Connecting a provider here makes it available to all of your systems.</p>
        </div>
      ) : null}

      {/* The other half of the surface. These are not buttons: they are set on an application, so sending
          someone to a Connect button here would land them somewhere they cannot finish. */}
      <section aria-labelledby="per-app-heading" style={{ marginTop: 40 }}>
        <h2 id="per-app-heading" style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", margin: 0 }}>
          Set on each system
        </h2>
        <p style={{ fontSize: 13, color: "var(--fg-4)", margin: "6px 0 14px", lineHeight: 1.6, maxWidth: 620 }}>
          These differ between systems, so they live on a system&rsquo;s Connections tab rather than here.
          Open any system and choose Settings, then Connections.
        </p>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {PER_APP_KINDS.map((kind) => (
            <div key={kind} className="card" style={{ padding: "12px 14px", borderColor: "var(--line-2)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13.5, color: "var(--fg-1)" }}>
                {ALL_PROVIDER_LABELS[kind] ?? kind}
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 2, lineHeight: 1.5 }}>{featureUse(kind)}</div>
            </div>
          ))}
        </div>
      </section>
      </div>
    </Page>
  );
}
