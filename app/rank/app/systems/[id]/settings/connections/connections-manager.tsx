"use client";

// The interactive half of the connection management surface. Everything here talks ONLY to the
// owner-gated first-party routes (/api/preflight/apps/:id/connections*, /secrets) and re-syncs the
// server-rendered page with router.refresh() after every successful action, so what the owner sees is
// always what the database holds: results render natively, in place, and the application context is
// never abandoned for a generic dashboard.
//
// Honest-state rules carried from the connect workspace: manual connections are labeled manual, unbuilt
// providers are compact chips (never buttons), test-account credentials are sealed write-only (replace
// re-seals through the secrets route; nothing is ever displayed back), and every failure message states
// what did and did not happen.

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mark, ComingLater, PROVIDER_MARK } from "../../../_connections/brand";
import { GithubForm, TwoFieldForm, input, lab, help, type Conn } from "../../../_connections/forms";
import {
  PROVIDER_LABELS, PROVIDER_GROUP, MANUAL_ADD_KINDS, MANUAL_FIELDS, COMING_LATER_PROVIDERS,
  connectionState, stateLabel, featureUse, neverAccesses, metaSummary, whenUtc, isStoredNotYetUsed, type ConnectionState,
} from "@/lib/preflight/connection-display";

// Human-readable OAuth callback outcomes (?oauth=connected|error&provider=&reason=). Reasons map to the
// exact failure codes the callback route emits; anything unknown falls back to a generic line.
const OAUTH_REASONS: Record<string, string> = {
  denied: "You cancelled the authorization, or the provider declined it.",
  server_misconfigured: "This provider isn't configured yet on our side. Nothing was connected.",
  bad_state: "The authorization link expired or was tampered with. Try connecting again.",
  state_mismatch: "The authorization couldn't be verified in this browser. Try connecting again.",
  forbidden: "You need editor access on this system to connect an account.",
  owner_mismatch: "That authorization didn't match this system. Nothing was connected.",
  exchange_failed: "The provider didn't complete the token exchange. Try again in a moment.",
  vault_unconfigured: "Secure storage isn't configured, so the token couldn't be sealed.",
  no_code: "The provider didn't return an authorization code. Try connecting again.",
};

// A quiet, honest chip for a connection whose metadata is saved but which no verification step reads
// yet. It keeps a connected-but-inert integration from reading as if it were feeding a pass.
function StoredNotUsedChip({ provider }: { provider: string }) {
  if (!isStoredNotYetUsed(provider)) return null;
  return (
    <span className="pill" style={{ fontSize: 9.5, flex: "none", color: "var(--fg-4)", background: "var(--bg-2)", borderColor: "var(--line-2)" }}>
      Stored, not yet used in verification
    </span>
  );
}
import type { SafeConnection } from "@/lib/preflight/connections-db";

const STATE_PILL: Record<string, { color: string; bg: string; bd: string }> = {
  connected: { color: "var(--acc-deep)", bg: "var(--acc-soft)", bd: "var(--acc-line)" },
  connected_manually: { color: "var(--acc-deep)", bg: "var(--acc-soft)", bd: "var(--acc-line)" },
  needs_attention: { color: "var(--wait-ink)", bg: "var(--wait-wash)", bd: "var(--wait-line)" },
  verification_failed: { color: "var(--stop-ink)", bg: "var(--stop-wash)", bd: "var(--stop-line)" },
};

function StatePill({ state }: { state: ConnectionState }) {
  const c = STATE_PILL[state] ?? { color: "var(--fg-4)", bg: "var(--bg-2)", bd: "var(--line-2)" };
  return <span className="pill" style={{ fontSize: 9.5, flex: "none", color: c.color, background: c.bg, borderColor: c.bd }}>{stateLabel(state)}</span>;
}

const ghostBtn = { padding: "6px 11px", fontSize: 12 } as const;
const headLbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };

type Msg = { kind: "ok" | "err"; text: string };

function strMeta(meta: Record<string, unknown>): Conn {
  const out: Conn = {};
  for (const [k, v] of Object.entries(meta)) if (typeof v === "string") out[k] = v;
  return out;
}

// Sealed-credential form, used both for "Add test account" and "Replace credential". The password is
// held in memory only until the POST; it is never echoed, never drafted, never shown again.
function TestAccountForm({ initialLabel, initialScope, submitLabel, busy, onSubmit }: {
  initialLabel: string; initialScope: string; submitLabel: string; busy: boolean;
  onSubmit: (v: { label: string; username: string; password: string; scope: string }) => void;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [scope, setScope] = useState(initialScope);
  const ok = username.trim().length > 0 && password.length > 0 && !busy;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="cols-stack">
        <div><label style={lab}>Role label</label><input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} style={input} /></div>
        <div><label style={lab}>Usage scope</label><input value={scope} onChange={(e) => setScope(e.target.value)} maxLength={200} style={input} /><p style={help}>Plain metadata: no passwords here.</p></div>
        <div><label style={lab}>Username / email</label><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" style={input} /></div>
        <div><label style={lab}>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" style={input} /></div>
      </div>
      <p style={help}>Sent once over TLS, sealed server-side (AES-256-GCM), and never shown again, not even to you.</p>
      <button type="button" className="btn" disabled={!ok} style={{ justifySelf: "start", opacity: ok ? 1 : 0.55 }}
        onClick={() => onSubmit({ label: label.trim() || "Standard user", username: username.trim(), password, scope: scope.trim() || "signed-in flows only" })}>
        {busy ? "Sealing credential" : submitLabel}
      </button>
    </div>
  );
}

// A read-only card: identical facts to the interactive card (kind, state, metadata, "used for", never
// accesses, connected/last-checked), but NO action row, editor, or message state. Rendered for members
// without canManageConnections (viewer / client_viewer), whose mutations the server would 403 anyway.
function ReadOnlyCard({ c }: { c: SafeConnection }) {
  const isTestAccount = c.provider === "test_account";
  const m = strMeta(c.meta);
  const state = connectionState(c.provider, c.status, c.meta as { oauth?: boolean });
  const summary = isTestAccount ? null : metaSummary(c.provider, c.meta);
  const note = typeof c.meta.last_check_note === "string" ? c.meta.last_check_note : "";
  return (
    <div key={c.id} className="card" style={{ padding: 16, display: "grid", gap: 9, alignContent: "start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Mark text={PROVIDER_MARK[c.provider] ?? "code"} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>
              {isTestAccount ? (m.label || "Test account") : (PROVIDER_LABELS[c.provider] ?? c.provider)}
            </span>
            <span className="pill" style={{ fontSize: 9.5, flex: "none" }}>{PROVIDER_GROUP[c.provider] ?? "Connection"}</span>
            {!isTestAccount ? <StoredNotUsedChip provider={c.provider} /> : null}
          </div>
        </div>
        <StatePill state={state} />
      </div>

      {isTestAccount ? (
        <div style={{ display: "grid", gap: 4 }}>
          {m.username_mask ? <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", wordBreak: "break-all" }}>{m.username_mask}</div> : null}
          <div style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5 }}>Scope: {m.scope || "signed-in flows only"}</div>
        </div>
      ) : summary ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", wordBreak: "break-all" }}>{summary}</div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--fg-4)" }}>No metadata recorded</div>
      )}

      <div style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.55 }}>
        <span style={{ color: "var(--fg-4)" }}>Used by Vraelis for:</span> {featureUse(c.provider, c.meta as { oauth?: boolean } | null)}
      </div>
      <div style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.55 }}>
        <span style={{ color: "var(--fg-4)" }}>Data Vraelis never accesses:</span> {neverAccesses(c.provider, c.meta as { oauth?: boolean } | null)}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>
        Connected {whenUtc(c.created_at)}{c.last_verified_at ? `, last checked ${whenUtc(c.last_verified_at)}` : ", never checked"}
      </div>
      {note ? <div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>Last check: {note}</div> : null}
    </div>
  );
}

// The read-only variant of the whole surface: the same two grids (connections, test accounts) as facts,
// with a muted view-only note and NO "Add connection" section. The page still renders the audit history
// below this component for everyone.
function ReadOnlyConnections({ connections }: { connections: SafeConnection[] }) {
  const testAccounts = connections.filter((c) => c.provider === "test_account");
  const others = connections.filter((c) => c.provider !== "test_account");
  return (
    <div style={{ display: "grid", gap: 26 }}>
      <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0, lineHeight: 1.5 }}>
        View-only: you can see every connection this system has, but adding, editing, verifying, or
        removing connections is limited to editors and the owner.
      </p>
      <section aria-label="Connections">
        <div style={{ ...headLbl, marginBottom: 10 }}>Connections ({others.length})</div>
        {others.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {others.map((c) => <ReadOnlyCard key={c.id} c={c} />)}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>
            No connections recorded. Verifications run with only the system URL until an editor adds source,
            deployment, data, or service context.
          </p>
        )}
      </section>

      <section aria-label="Test accounts">
        <div style={{ ...headLbl, marginBottom: 10 }}>Test accounts ({testAccounts.length})</div>
        {testAccounts.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {testAccounts.map((c) => <ReadOnlyCard key={c.id} c={c} />)}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>
            No test accounts on file. An encrypted test account is what will unlock signed-in flows when
            authenticated verifications ship.
          </p>
        )}
      </section>
    </div>
  );
}

export function ConnectionsManager({ appId, connections, canManage = true }: { appId: string; connections: SafeConnection[]; canManage?: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  // OAuth callback outcome (?oauth=connected|error&provider=&reason=), rendered as a one-time banner.
  const oauthResult = (() => {
    const o = search.get("oauth");
    if (o !== "connected" && o !== "error") return null;
    const provider = search.get("provider") || "";
    const label = PROVIDER_LABELS[provider] ?? provider;
    if (o === "connected") return { ok: true, text: `${label} connected. Its token is sealed and ready.` };
    const reason = search.get("reason") || "";
    return { ok: false, text: `Could not connect ${label}. ${OAUTH_REASONS[reason] ?? "Please try again."}` };
  })();
  const [editing, setEditing] = useState<string | null>(null);       // connection id with an open editor
  const [confirming, setConfirming] = useState<string | null>(null); // connection id awaiting disconnect confirm
  const [busy, setBusy] = useState<string | null>(null);             // "<id>:<action>" while a request runs
  const [msgs, setMsgs] = useState<Record<string, Msg>>({});
  const [adding, setAdding] = useState<string | null>(null);         // manual kind or "test_account"
  const [addMsg, setAddMsg] = useState<Msg | null>(null);

  const base = `/api/preflight/apps/${encodeURIComponent(appId)}`;
  const setMsg = (id: string, m: Msg | null) => setMsgs((p) => { const n = { ...p }; if (m) n[id] = m; else delete n[id]; return n; });

  async function call(path: string, init: RequestInit): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
    try {
      const res = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
      if (res.status === 401) { router.push(`/signin?callbackUrl=${encodeURIComponent(`/systems/${appId}/settings/connections`)}`); return { ok: false, status: 401, body: {} }; }
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: res.ok, status: res.status, body };
    } catch {
      return { ok: false, status: 0, body: { message: "Network error. Nothing was changed on the server that you can see here; reload to confirm." } };
    }
  }
  const failText = (body: Record<string, unknown>, fallback: string) => (typeof body.message === "string" && body.message ? body.message : fallback);

  async function verify(c: SafeConnection) {
    setBusy(`${c.id}:verify`); setMsg(c.id, null);
    const r = await call(`${base}/connections/${encodeURIComponent(c.id)}/verify`, { method: "POST" });
    setBusy(null);
    if (!r.ok) { setMsg(c.id, { kind: "err", text: failText(r.body, "The health check could not run. Nothing was recorded.") }); return; }
    setMsg(c.id, { kind: r.body.status === "connected" ? "ok" : "err", text: `Health check: ${String(r.body.note ?? "recorded.")}` });
    router.refresh();
  }

  async function saveEdit(c: SafeConnection, meta: Record<string, unknown>) {
    setBusy(`${c.id}:edit`); setMsg(c.id, null);
    const expected = typeof c.meta.updated_at === "string" ? c.meta.updated_at : null;
    const r = await call(`${base}/connections/${encodeURIComponent(c.id)}`, { method: "PATCH", body: JSON.stringify({ meta, expected_updated_at: expected }) });
    setBusy(null);
    if (!r.ok) { setMsg(c.id, { kind: "err", text: failText(r.body, "The edit was not saved.") }); return; }
    setEditing(null);
    setMsg(c.id, { kind: "ok", text: "Metadata updated." });
    router.refresh();
  }

  async function disconnect(c: SafeConnection) {
    setBusy(`${c.id}:delete`); setMsg(c.id, null);
    const r = await call(`${base}/connections/${encodeURIComponent(c.id)}`, { method: "DELETE" });
    setBusy(null); setConfirming(null);
    if (!r.ok) { setMsg(c.id, { kind: "err", text: failText(r.body, "Nothing was disconnected.") }); return; }
    router.refresh();
  }

  async function replaceCredential(c: SafeConnection, v: { label: string; username: string; password: string; scope: string }) {
    setBusy(`${c.id}:replace`); setMsg(c.id, null);
    const stored = await call(`${base}/secrets`, { method: "POST", body: JSON.stringify(v) });
    if (!stored.ok) { setBusy(null); setMsg(c.id, { kind: "err", text: failText(stored.body, "The new credential was NOT stored. The existing one is unchanged.") }); return; }
    const removed = await call(`${base}/connections/${encodeURIComponent(c.id)}`, { method: "DELETE" });
    setBusy(null); setEditing(null);
    if (!removed.ok) {
      setMsg(c.id, { kind: "err", text: "The new credential was sealed, but the old one could not be revoked. Revoke it below." });
    }
    router.refresh();
  }

  async function addManual(kind: string, meta: Record<string, unknown>) {
    setBusy(`add:${kind}`); setAddMsg(null);
    const r = await call(`${base}/connections`, { method: "POST", body: JSON.stringify({ provider: kind, meta }) });
    setBusy(null);
    if (!r.ok) { setAddMsg({ kind: "err", text: failText(r.body, "The connection was not added.") }); return; }
    setAdding(null);
    setAddMsg({ kind: "ok", text: r.body.existing === true ? "That connection already exists; no duplicate was created." : "Connection added." });
    router.refresh();
  }

  async function addTestAccount(v: { label: string; username: string; password: string; scope: string }) {
    setBusy("add:test_account"); setAddMsg(null);
    const r = await call(`${base}/secrets`, { method: "POST", body: JSON.stringify(v) });
    setBusy(null);
    if (!r.ok) { setAddMsg({ kind: "err", text: failText(r.body, "The test account was NOT stored.") }); return; }
    setAdding(null);
    setAddMsg({ kind: "ok", text: "Test account sealed and stored." });
    router.refresh();
  }

  function editorFor(c: SafeConnection) {
    if (c.provider === "test_account") {
      return (
        <TestAccountForm initialLabel={strMeta(c.meta).label || "Standard user"} initialScope={strMeta(c.meta).scope || "signed-in flows only"}
          submitLabel="Replace credential" busy={busy === `${c.id}:replace`} onSubmit={(v) => void replaceCredential(c, v)} />
      );
    }
    if (c.provider === "github") {
      return <GithubForm value={strMeta(c.meta)} saveLabel="Save changes" busy={busy === `${c.id}:edit`} onSave={(v) => void saveEdit(c, v)} />;
    }
    const def = MANUAL_FIELDS[c.provider];
    if (!def) return <p style={help}>This connection kind has no editable metadata.</p>;
    return (
      <TwoFieldForm fields={def.fields} value={strMeta(c.meta)} requiredKey={def.requiredKey} saveLabel="Save changes" busy={busy === `${c.id}:edit`}
        onSave={(v) => void saveEdit(c, c.provider === "stripe_test" ? { ...v, mode: "test" } : v)} />
    );
  }

  function card(c: SafeConnection) {
    const isTestAccount = c.provider === "test_account";
    const m = strMeta(c.meta);
    const state = connectionState(c.provider, c.status, c.meta as { oauth?: boolean });
    const summary = isTestAccount ? null : metaSummary(c.provider, c.meta);
    const note = typeof c.meta.last_check_note === "string" ? c.meta.last_check_note : "";
    const msg = msgs[c.id];
    const anyBusy = busy?.startsWith(`${c.id}:`) ?? false;
    return (
      <div key={c.id} className="card" style={{ padding: 16, display: "grid", gap: 9, alignContent: "start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Mark text={PROVIDER_MARK[c.provider] ?? "code"} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>
                {isTestAccount ? (m.label || "Test account") : (PROVIDER_LABELS[c.provider] ?? c.provider)}
              </span>
              <span className="pill" style={{ fontSize: 9.5, flex: "none" }}>{PROVIDER_GROUP[c.provider] ?? "Connection"}</span>
              {!isTestAccount ? <StoredNotUsedChip provider={c.provider} /> : null}
            </div>
          </div>
          <StatePill state={state} />
        </div>

        {isTestAccount ? (
          <div style={{ display: "grid", gap: 4 }}>
            {m.username_mask ? <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", wordBreak: "break-all" }}>{m.username_mask}</div> : null}
            <div style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5 }}>Scope: {m.scope || "signed-in flows only"}</div>
          </div>
        ) : summary ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", wordBreak: "break-all" }}>{summary}</div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--fg-4)" }}>No metadata recorded</div>
        )}

        <div style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.55 }}>
          <span style={{ color: "var(--fg-4)" }}>Used by Vraelis for:</span> {featureUse(c.provider, c.meta as { oauth?: boolean } | null)}
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.55 }}>
          <span style={{ color: "var(--fg-4)" }}>Data Vraelis never accesses:</span> {neverAccesses(c.provider, c.meta as { oauth?: boolean } | null)}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>
          Connected {whenUtc(c.created_at)}{c.last_verified_at ? `, last checked ${whenUtc(c.last_verified_at)}` : ", never checked"}
        </div>
        {note ? <div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>Last check: {note}</div> : null}
        {msg ? <p role={msg.kind === "err" ? "alert" : "status"} style={{ fontSize: 12, color: msg.kind === "err" ? "var(--err)" : "var(--acc-deep)", margin: 0, lineHeight: 1.5 }}>{msg.text}</p> : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--line-1)", paddingTop: 10 }}>
          {confirming === c.id ? (
            <>
              <span style={{ fontSize: 12.5, color: "var(--fg-2)", alignSelf: "center" }}>
                {isTestAccount ? "Revoke this credential? The sealed ciphertext is destroyed with it." : "Disconnect this connection? Its metadata is deleted."}
              </span>
              <button type="button" className="btn" style={ghostBtn} disabled={anyBusy} onClick={() => void disconnect(c)}>
                {busy === `${c.id}:delete` ? "Removing" : (isTestAccount ? "Revoke" : "Disconnect")}
              </button>
              <button type="button" className="btn btn--ghost" style={ghostBtn} disabled={anyBusy} onClick={() => setConfirming(null)}>Cancel</button>
            </>
          ) : (
            <>
              {isTestAccount ? (
                <button type="button" className="btn btn--ghost" style={ghostBtn} disabled={anyBusy} aria-expanded={editing === c.id}
                  onClick={() => { setEditing(editing === c.id ? null : c.id); setMsg(c.id, null); }}>Replace credential</button>
              ) : (
                <button type="button" className="btn btn--ghost" style={ghostBtn} disabled={anyBusy} aria-expanded={editing === c.id}
                  onClick={() => { setEditing(editing === c.id ? null : c.id); setMsg(c.id, null); }}>Edit metadata</button>
              )}
              <button type="button" className="btn btn--ghost" style={ghostBtn} disabled={anyBusy} onClick={() => void verify(c)}>
                {busy === `${c.id}:verify` ? "Checking" : "Verify health"}
              </button>
              <button type="button" className="btn btn--ghost" style={ghostBtn} disabled={anyBusy} onClick={() => { setConfirming(c.id); setMsg(c.id, null); }}>
                {isTestAccount ? "Revoke" : "Disconnect"}
              </button>
            </>
          )}
        </div>

        {editing === c.id ? (
          <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 12 }}>
            {editorFor(c)}
          </div>
        ) : null}
      </div>
    );
  }

  // Read-only members (viewer / client_viewer) see the facts, never the mutation surface. The server
  // gates connections + secrets + verify at editor+, so this mirrors that exactly.
  if (!canManage) return <ReadOnlyConnections connections={connections} />;

  const testAccounts = connections.filter((c) => c.provider === "test_account");
  const others = connections.filter((c) => c.provider !== "test_account");
  const addBusy = busy?.startsWith("add:") ?? false;

  return (
    <div style={{ display: "grid", gap: 26 }}>
      {oauthResult ? (
        <div role={oauthResult.ok ? "status" : "alert"} style={{
          borderRadius: "var(--r-sm)", padding: "11px 15px", fontSize: 13.5, lineHeight: 1.5,
          border: `1px solid ${oauthResult.ok ? "var(--acc-line)" : "rgba(178,58,58,0.25)"}`,
          background: oauthResult.ok ? "var(--go-wash)" : "rgba(178,58,58,0.08)",
          color: oauthResult.ok ? "var(--go-ink)" : "var(--stop-ink)",
        }}>{oauthResult.text}</div>
      ) : null}
      <section aria-label="Connections">
        <div style={{ ...headLbl, marginBottom: 10 }}>Connections ({others.length})</div>
        {others.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {others.map(card)}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>
            No connections recorded. Verifications run with only the system URL until you add source,
            deployment, data, or service context below.
          </p>
        )}
      </section>

      <section aria-label="Test accounts">
        <div style={{ ...headLbl, marginBottom: 10 }}>Test accounts ({testAccounts.length})</div>
        {testAccounts.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {testAccounts.map(card)}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>
            No test accounts on file. An encrypted test account is what will unlock signed-in flows when
            authenticated verifications ship.
          </p>
        )}
      </section>

      <section aria-label="Connect an account" style={{ borderTop: "1px solid var(--line-1)", paddingTop: 22 }}>
        <div style={{ ...headLbl, marginBottom: 4 }}>Connect an account</div>
        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "0 0 12px", maxWidth: 640 }}>
          Authorize a provider on its own site. Vraelis receives a read-only access token, sealed with
          AES-256-GCM, never a password. You can disconnect any time.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
          <a href="/connections" className="btn" style={{ padding: "9px 16px", fontSize: 13.5, textDecoration: "none" }}>
            Connect an account
          </a>
          <span style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5 }}>
            Providers are connected once at the account level, then used across all your apps.
          </span>
        </div>

        <div style={{ ...headLbl, marginBottom: 4 }}>Or add manually</div>
        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "0 0 12px", maxWidth: 640 }}>
          Manual connections carry metadata only; never enter a password or key in them. Test-account
          credentials are the single exception and are sealed with AES-256-GCM.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[...MANUAL_ADD_KINDS, "test_account"].map((kind) => (
            <button key={kind} type="button" className={adding === kind ? "btn" : "btn btn--ghost"} style={{ padding: "7px 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 8 }}
              aria-expanded={adding === kind} disabled={addBusy}
              onClick={() => { setAdding(adding === kind ? null : kind); setAddMsg(null); }}>
              {PROVIDER_LABELS[kind] ?? kind}
            </button>
          ))}
        </div>
        {addMsg ? <p role={addMsg.kind === "err" ? "alert" : "status"} style={{ fontSize: 12.5, color: addMsg.kind === "err" ? "var(--err)" : "var(--acc-deep)", margin: "10px 0 0", lineHeight: 1.5 }}>{addMsg.text}</p> : null}
        {adding ? (
          <div className="card" style={{ padding: 16, marginTop: 12, display: "grid", gap: 12, maxWidth: 640 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Mark text={PROVIDER_MARK[adding] ?? "code"} />
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>{PROVIDER_LABELS[adding] ?? adding}</span>
            </div>
            {adding === "test_account" ? (
              <TestAccountForm initialLabel="Standard user" initialScope="signed-in flows only" submitLabel="Add test account"
                busy={busy === "add:test_account"} onSubmit={(v) => void addTestAccount(v)} />
            ) : adding === "github" ? (
              <GithubForm value={null} busy={busy === "add:github"} onSave={(v) => void addManual("github", v)} />
            ) : MANUAL_FIELDS[adding] ? (
              <TwoFieldForm fields={MANUAL_FIELDS[adding].fields} value={null} requiredKey={MANUAL_FIELDS[adding].requiredKey} busy={busy === `add:${adding}`}
                onSave={(v) => void addManual(adding, adding === "stripe_test" ? { ...v, mode: "test" } : v)} />
            ) : null}
          </div>
        ) : null}
        <div style={{ marginTop: 14 }}>
          <ComingLater names={COMING_LATER_PROVIDERS} />
        </div>
      </section>
    </div>
  );
}
