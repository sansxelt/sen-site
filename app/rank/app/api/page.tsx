"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WebhooksSection } from "./webhooks-section";
import { Ic, I, EmptyIcon } from "@/app/rank/_components/icons";

type Key = { id: string; prefix: string; scopes: string[]; last_used: string | null; created_at: string; name?: string | null };
type DevEvent = { id: string; event_type: string; metadata: Record<string, unknown>; created_at: string; test_id: string | null };
type Usage = {
  signedIn: boolean; plan?: string; hasApiAccess?: boolean;
  usage?: { total: number; last24h: number; last7d: number; lastAt: string | null; byEndpoint: { endpoint: string; method: string; count: number }[]; byPrefix: Record<string, number> };
  webhook?: { endpoints: number; total: number; success: number; failed: number; retried: number; lastAt: string | null };
  recent?: DevEvent[];
};

const ENDPOINT_LABEL: Record<string, string> = {
  "runs.create": "Queue a Production Pass", "runs.get": "Get a run", "tests.create": "Queue a Production Pass",
  "tests.get": "Get a run", "tests.export": "Export results", credits: "Check balance", other: "Other",
};
const DEV_EVENT_LABEL: Record<string, string> = {
  api_request_made: "API request", export_downloaded: "Export downloaded", webhook_delivered: "Webhook delivered",
  webhook_failed: "Webhook failed", test_launched: "Production Pass queued", preflight_run_queued: "Production Pass queued", api_key_created: "API key created",
};
const shortDate = (s: string | null) => { if (!s) return "-"; try { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return "-"; } };

const CURL = `# Queue a Production Pass against a build, then read the launch decision.
curl -X POST https://vraelis.com/api/preflight/apps/APP_ID/runs \\
  -H "X-Api-Key: YOUR_KEY" -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{ "deployment_url": "https://your-preview.example.com", "flows": "critical" }'
# -> { "runId": "run_...", "status": "queued" }

# Poll the run until it finishes, then gate your release on the decision.
curl https://vraelis.com/api/preflight/runs/RUN_ID -H "X-Api-Key: YOUR_KEY"
# -> { "run": { "state": "completed", "decision": "ready", "summary": {...} },
#      "issues": [ { "severity": "critical", "title": "...", "repro": "..." } ] }

# Anything but "ready" should stop the deploy. Evidence (screenshots, traces) is
# fetched separately through a short-lived, owner-checked signed URL.`;

// The three Preflight access levels a key can be created with, and the scopes each one grants. Named by
// what the holder can DO, not by the scope strings, because that is the question someone is actually
// answering when they mint a key.
type PreflightAccess = "none" | "read" | "launch";
const PREFLIGHT_ACCESS: { id: PreflightAccess; label: string; hint: string; scopes: string[] }[] = [
  { id: "none", label: "No Preflight access", hint: "Tests and credits only. The safe default.", scopes: [] },
  { id: "read", label: "Read reports", hint: "Price a pass and read run reports. Cannot launch a run or spend anything.", scopes: ["preflight:preview", "preflight:run:read"] },
  { id: "launch", label: "Launch runs", hint: "Everything above, plus launching a Production Pass. This key can spend your credits.", scopes: ["preflight:preview", "preflight:run:read", "preflight:run:create"] },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [fresh, setFresh] = useState<string>("");
  // What the server reports it ACTUALLY persisted. Shown beside the key so a wrongly scoped key is visible
  // at creation instead of at its first real call.
  const [freshGrant, setFreshGrant] = useState<{ scopes: string[]; dailyCeilingCents: number | null } | null>(null);
  const [err, setErr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [keyName, setKeyName] = useState("");
  // What a new key may do with Preflight. Least privilege by default: a key gets nothing here unless it is
  // asked for, and the level that can spend money is a separate, deliberate choice. Scopes are fixed at
  // creation, so changing a key's access means revoking it and minting a new one.
  const [preflightAccess, setPreflightAccess] = useState<PreflightAccess>("none");
  // Optional daily spend limit for this key, in whole dollars. Empty means no limit.
  const [dailyLimit, setDailyLimit] = useState("");
  const [u, setU] = useState<Usage | null>(null);

  async function load() {
    const r = await fetch("/api/v/keys");
    if (r.ok) { const j = await r.json(); setKeys(j.keys || []); }
    setLoaded(true);
    fetch("/api/v/usage").then((x) => x.json()).then((j) => { if (j.signedIn) setU(j); }).catch(() => {});
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true); setFresh(""); setErr("");
    try {
      const extra = PREFLIGHT_ACCESS.find((a) => a.id === preflightAccess)?.scopes ?? [];
      const r = await fetch("/api/v/keys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName.trim(),
          scopes: ["tests:write", "tests:read", "credits:read", ...extra],
          daily_ceiling_cents: Number(dailyLimit) > 0 ? Math.round(Number(dailyLimit) * 100) : undefined,
        }),
      });
      const j = await r.json();
      if (j.key) {
        setFresh(j.key);
        setFreshGrant({ scopes: j.scopes ?? [], dailyCeilingCents: j.dailyCeilingCents ?? null });
        setKeyName(""); setPreflightAccess("none"); setDailyLimit(""); load();
      }
      else if (j.error === "plan_required") setErr("The public API is a Scale plan feature. Upgrade to generate keys.");
      else setErr("Couldn't create a key. Try again.");
    } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    await fetch(`/api/v/keys/${id}`, { method: "DELETE" });
    load();
  }

  const slbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "28px 0 12px" } as const;
  const cardHead = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 } as const;

  return (
    <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Developers</p>
          <h1 className="display">API &amp; webhooks</h1>
          <p>API keys and signed webhooks for your Vraelis integration. Trigger Production Passes from CI, gate the deploy on the launch decision, and read the evidence back; usage analytics and webhook reliability are below.</p>
        </div>
      </div>

      {/* create */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="field">
          <span className="lbl">Create an API key</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Name it, e.g. Production or Zapier" maxLength={40} onKeyDown={(e) => { if (e.key === "Enter" && !busy) create(); }} style={{ flex: 1, minWidth: 220, padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" }} />
            <button onClick={create} disabled={busy} className="btn" style={{ opacity: busy ? 0.6 : 1 }}>{busy ? "Creating…" : "Create key"}</button>
          </div>
          <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
            <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Preflight access</span>
            {PREFLIGHT_ACCESS.map((a) => (
              <label key={a.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 11px", border: `1px solid ${preflightAccess === a.id ? "var(--acc-line)" : "var(--line-2)"}`, background: preflightAccess === a.id ? "var(--acc-soft)" : "transparent", borderRadius: "var(--r-sm)", cursor: "pointer" }}>
                <input type="radio" name="preflight-access" checked={preflightAccess === a.id} onChange={() => setPreflightAccess(a.id)} style={{ marginTop: 3 }} />
                <span>
                  <span style={{ display: "block", fontSize: 13.5, color: "var(--fg-1)" }}>{a.label}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--fg-4)" }}>{a.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {/*
            Only meaningful for a key that can launch runs. An agent in a retry loop is the reason this
            exists, so it is offered at the moment you decide to hand a credential that power, not buried in
            a settings page you would visit afterwards.
          */}
          {preflightAccess === "launch" && (
            <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
              <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Daily spend limit</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, color: "var(--fg-3)" }}>$</span>
                <input value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="No limit" style={{ width: 120, padding: "9px 11px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" }} />
                <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>per day, resets at midnight UTC</span>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>Caps what this one key can spend, on top of your account limits. Leave empty for no key limit. It can only ever lower what the key can spend, never raise it.</span>
            </div>
          )}
          <span className="hint">Name your keys so you can tell them apart. The full key is shown once at creation. Keep keys server-side only, and rotate or revoke a key if it&apos;s ever exposed. <Link href="/developers" style={{ color: "var(--acc-deep)" }}>Developer docs →</Link></span>
        </div>
      </div>

      {/* Integrate from CI: trigger a Production Pass and gate the deploy on the decision. */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div style={cardHead}>Gate your deploys from CI</div>
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 12px" }}>Queue a Production Pass against a preview build, wait for the launch decision, and stop the release on anything but READY. One job, real-browser evidence, no dashboard to watch.</p>
            <Link href="/developers" className="btn">See the CI gate →</Link>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <Link href="/developers" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Developer overview</Link>
          <Link href="/developers#webhooks" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Webhook signing</Link>
        </div>
      </div>

      {err && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--line-2)" }}>
          <p style={{ fontSize: 14, color: "var(--fg-2)", margin: 0 }}>{err} {err.includes("Scale") && <Link href="/plans" style={{ color: "var(--acc-deep)" }}>See plans →</Link>}</p>
        </div>
      )}

      {fresh && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--acc-line)", background: "var(--acc-soft)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 8 }}>Your new key. Copy it now, it won&apos;t be shown again</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <code style={{ flex: 1, fontFamily: "var(--font-code)", fontSize: 13, color: "var(--fg-1)", wordBreak: "break-all", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-xs)", padding: "10px 12px" }}>{fresh}</code>
            <button onClick={() => { navigator.clipboard?.writeText(fresh); setCopied(true); setTimeout(() => setCopied(false), 1400); }} className="btn btn--ghost" style={{ whiteSpace: "nowrap" }}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
          {/*
            What the server ACTUALLY granted, read back from the create response rather than echoed from the
            request. Two keys were minted without preflight:run:create and there was no way to tell until the
            first real API call failed with a 403, which is a long way from the decision that caused it.
            A key that cannot do what you asked for should say so here, while you are still looking at it.
          */}
          {freshGrant && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--acc-line)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 }}>This key can</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {freshGrant.scopes.map((s) => (
                  <span key={s} style={{ fontFamily: "var(--font-code)", fontSize: 11, padding: "3px 8px", borderRadius: 999, border: "1px solid var(--line-2)", background: "var(--bg-1)", color: s.startsWith("preflight:") ? "var(--acc-deep)" : "var(--fg-4)" }}>{s}</span>
                ))}
              </div>
              {freshGrant.scopes.includes("preflight:run:create") ? (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)" }}>
                  It can launch verifications{freshGrant.dailyCeilingCents ? `, up to $${(freshGrant.dailyCeilingCents / 100).toFixed(2)} per day` : ", with no daily spend limit"}.
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: "#B45309" }}>
                  This key cannot launch verifications. To give it that, revoke it and create a new one with Preflight access set to &ldquo;Launch runs&rdquo;.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* keys list */}
      {loaded && keys.length === 0 && !fresh && (
        <div className="empty" style={{ marginBottom: 28 }}>
          <EmptyIcon d={I.key} />
          <h3>No API keys yet</h3>
          <p>Create a key to call the Vraelis API from your app. The full key is shown once at creation.</p>
          <button onClick={create} disabled={busy} className="btn">{busy ? "Creating…" : "Create your first key"}</button>
        </div>
      )}
      {keys.length > 0 && (
        <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)", marginBottom: 28, boxShadow: "var(--shadow-sm)" }}>
          {keys.map((k, i) => (
            <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{k.name || "Untitled key"}</span>
                  <code style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)" }}>{k.prefix}…</code>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 4 }}>Created {new Date(k.created_at).toLocaleDateString()}, {k.last_used ? `last used ${new Date(k.last_used).toLocaleDateString()}` : "never used"}{u?.usage?.byPrefix?.[k.prefix] ? `, ${u.usage.byPrefix[k.prefix].toLocaleString()} request${u.usage.byPrefix[k.prefix] === 1 ? "" : "s"}` : ""}</div>
                {k.scopes?.length ? <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-5)", marginTop: 3 }}>{k.scopes.join("  ")}</div> : null}
              </div>
              <button onClick={() => revoke(k.id)} className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5, gap: 6 }}><Ic d={I.slash} size={12} sw={2.2} />Revoke</button>
            </div>
          ))}
        </div>
      )}

      {/* developer usage analytics */}
      {u && (keys.length > 0 || (u.usage && u.usage.total > 0) || (u.webhook && u.webhook.endpoints > 0)) && (
        <>
          {u.usage && (
            <>
              <div style={slbl}>API usage</div>
              <div className="tile-grid cols-4" style={{ marginBottom: 14 }}>
                <div className="stat"><div className="stat__l">Total requests</div><div className="stat__v tnum">{u.usage.total.toLocaleString()}</div></div>
                <div className="stat"><div className="stat__l">Last 24 hours</div><div className="stat__v tnum">{u.usage.last24h.toLocaleString()}</div></div>
                <div className="stat"><div className="stat__l">Last 7 days</div><div className="stat__v tnum">{u.usage.last7d.toLocaleString()}</div></div>
                <div className="stat"><div className="stat__l">Last activity</div><div className="stat__v tnum" style={{ fontSize: 20 }}>{shortDate(u.usage.lastAt)}</div></div>
              </div>
              {u.usage.byEndpoint.length > 0 && (
                <div className="card" style={{ marginBottom: 14 }}>
                  <div style={cardHead}>Endpoints</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {u.usage.byEndpoint.map((e, i) => (
                      <div key={e.method + e.endpoint} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                        <span style={{ fontSize: 13.5, color: "var(--fg-1)" }}><span style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)", marginRight: 8 }}>{e.method}</span>{ENDPOINT_LABEL[e.endpoint] ?? e.endpoint}</span>
                        <span style={{ fontFamily: "var(--font-code)", fontSize: 13, color: "var(--fg-2)" }}>{e.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: 10, marginBottom: 0 }}>Request volume by endpoint. Per-request status and error analytics will appear once status logging is added.</p>
                </div>
              )}
            </>
          )}

          {u.webhook && (
            <>
              <div style={slbl}>Webhook reliability</div>
              {u.webhook.endpoints > 0 ? (
                <div className="tile-grid cols-4" style={{ marginBottom: 14 }}>
                  <div className="stat"><div className="stat__l">Deliveries</div><div className="stat__v tnum">{u.webhook.total.toLocaleString()}</div><div className="stat__s">{u.webhook.endpoints} endpoint{u.webhook.endpoints === 1 ? "" : "s"}</div></div>
                  <div className="stat"><div className="stat__l">Success rate</div><div className="stat__v tnum">{u.webhook.total ? Math.round((u.webhook.success / u.webhook.total) * 100) : 0}%</div><div className="stat__s">{u.webhook.success.toLocaleString()} delivered</div></div>
                  <div className="stat"><div className="stat__l">Failed</div><div className="stat__v tnum">{u.webhook.failed.toLocaleString()}</div><div className="stat__s">{u.webhook.retried.toLocaleString()} retried</div></div>
                  <div className="stat"><div className="stat__l">Last delivery</div><div className="stat__v tnum" style={{ fontSize: 20 }}>{shortDate(u.webhook.lastAt)}</div></div>
                </div>
              ) : (
                <div className="empty" style={{ marginBottom: 14 }}><EmptyIcon d={I.swap} /><h3>No webhooks yet</h3><p>Add an endpoint below to receive a signed run.completed event the moment a Production Pass finishes. Delivery success, failures, and retries show here.</p></div>
              )}
            </>
          )}

          {u.recent && u.recent.length > 0 && (
            <>
              <div style={slbl}>Recent developer activity</div>
              <div className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {u.recent.map((e, i) => {
                    const detail = e.metadata?.endpoint ? (ENDPOINT_LABEL[String(e.metadata.endpoint)] ?? String(e.metadata.endpoint)) : e.metadata?.format ? String(e.metadata.format).toUpperCase() : "";
                    return (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                        <span style={{ fontSize: 13.5, color: "var(--fg-1)" }}>{DEV_EVENT_LABEL[e.event_type] ?? e.event_type}{detail ? <span style={{ fontSize: 12, color: "var(--fg-4)", marginLeft: 8 }}>{detail}</span> : null}</span>
                        <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)" }}>{shortDate(e.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {u && u.signedIn && !u.hasApiAccess && (
        <div className="card" style={{ marginTop: 8, marginBottom: 24, background: "var(--bg-2)" }}>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0 }}>The public API, webhooks, and usage analytics are part of the <b style={{ color: "var(--fg-1)" }}>Scale</b> plan. <Link href="/plans" style={{ color: "var(--acc-deep)" }}>See plans →</Link></p>
        </div>
      )}

      {/* docs */}
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12, marginTop: 28 }}>Quickstart</div>
      <div className="codebar"><i /><i /><i /><span>shell</span></div>
      <pre className="codeblock"><code>{CURL}</code></pre>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 14, lineHeight: 1.6 }}>
        Production Passes triggered over the API draw on the same account balance as the web app. Auth via <code style={{ color: "var(--fg-3)" }}>X-Api-Key</code> or <code style={{ color: "var(--fg-3)" }}>Authorization: Bearer</code>.
      </p>

      <div id="webhooks"><WebhooksSection /></div>
    </div>
  );
}
