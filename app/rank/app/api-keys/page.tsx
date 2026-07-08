"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WebhooksSection } from "./webhooks-section";

type Key = { id: string; prefix: string; scopes: string[]; last_used: string | null; created_at: string; name?: string | null };
type DevEvent = { id: string; event_type: string; metadata: Record<string, unknown>; created_at: string; test_id: string | null };
type Usage = {
  signedIn: boolean; plan?: string; hasApiAccess?: boolean;
  usage?: { total: number; last24h: number; last7d: number; lastAt: string | null; byEndpoint: { endpoint: string; method: string; count: number }[]; byPrefix: Record<string, number> };
  webhook?: { endpoints: number; total: number; success: number; failed: number; retried: number; lastAt: string | null };
  recent?: DevEvent[];
};

const ENDPOINT_LABEL: Record<string, string> = {
  "tests.create": "Create test", "tests.get": "Get test", "tests.export": "Export results", credits: "Check credits", other: "Other",
};
const DEV_EVENT_LABEL: Record<string, string> = {
  api_request_made: "API request", export_downloaded: "Export downloaded", webhook_delivered: "Webhook delivered",
  webhook_failed: "Webhook failed", test_launched: "Test launched", api_key_created: "API key created",
};
const shortDate = (s: string | null) => { if (!s) return "—"; try { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return "—"; } };

const CURL = `# Create an evaluation
curl -X POST https://vraelis.com/api/v1/tests \\
  -H "X-Api-Key: YOUR_KEY" -H "Content-Type: application/json" \\
  -d '{
    "title": "Which response is more helpful, accurate, and safe?",
    "category": "ai_image",
    "audience": "general",
    "votes": 50,
    "options": [
      { "text": "Response A — paste model output A here" },
      { "text": "Response B — paste model output B here" }
    ]
  }'
# -> { "id": "...", "status": "active", "credits_charged": 50 }

# Get status + results (poll until status = "complete")
curl https://vraelis.com/api/v1/tests/TEST_ID -H "X-Api-Key: YOUR_KEY"

# Check your credit balance
curl https://vraelis.com/api/v1/credits -H "X-Api-Key: YOUR_KEY"

# Export preference data (JSON or CSV) for dashboards / training pipelines
curl "https://vraelis.com/api/v1/tests/TEST_ID/export?format=json" -H "X-Api-Key: YOUR_KEY"
curl "https://vraelis.com/api/v1/tests/TEST_ID/export?format=csv"  -H "X-Api-Key: YOUR_KEY"`;

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [fresh, setFresh] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [keyName, setKeyName] = useState("");
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
      const r = await fetch("/api/v/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: keyName.trim() }) });
      const j = await r.json();
      if (j.key) { setFresh(j.key); setKeyName(""); load(); }
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
          <p>The AI output check API for your app. POST your output, get per-criterion scores, the version to ship, and line-level fixes, with usage analytics and webhook reliability below.</p>
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
          <span className="hint">Name your keys so you can tell them apart. The full key is shown once at creation. Keep keys server-side only, and rotate or revoke a key if it&apos;s ever exposed. <Link href="/developers" style={{ color: "var(--acc-deep)" }}>Developer docs →</Link></span>
        </div>
      </div>

      <div className="card cta-band" style={{ marginBottom: 14, background: "var(--bg-2)", borderRadius: "var(--r-xl)", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Preference data exports</div>
          <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>Export completed results as JSON or CSV. Winner, breakdown, quality, comments, and AI analysis.</p>
        </div>
        <Link href="/app/sandbox" className="btn btn--ghost" style={{ whiteSpace: "nowrap" }}>Test exports →</Link>
      </div>

      {/* Test your integration — opens the in-app sandbox console */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div style={cardHead}>Test your integration</div>
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 12px" }}>Use the sandbox console to create a sandbox evaluation, preview a Decision Package, test exports, and send a signed webhook event — with sample data, 0 credits, 0 quota, and nothing in your production analytics.</p>
            <Link href="/app/sandbox" className="btn">Open sandbox console →</Link>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <Link href="/developers" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Developer overview</Link>
          <a href="/schemas/decision-package-v2.json" className="btn btn--ghost" style={{ fontSize: 12.5 }}>JSON Schema</a>
          <Link href="/developers#sdk" className="btn btn--ghost" style={{ fontSize: 12.5 }}>SDK starter</Link>
          <Link href="/developers#webhooks" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Webhook signing</Link>
        </div>
      </div>

      {err && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--line-2)" }}>
          <p style={{ fontSize: 14, color: "var(--fg-2)", margin: 0 }}>{err} {err.includes("Scale") && <Link href="/app/plans" style={{ color: "var(--acc-deep)" }}>See plans →</Link>}</p>
        </div>
      )}

      {fresh && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--acc-line)", background: "var(--acc-soft)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 8 }}>Your new key. Copy it now, it won&apos;t be shown again</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <code style={{ flex: 1, fontFamily: "var(--font-code)", fontSize: 13, color: "var(--fg-1)", wordBreak: "break-all", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-xs)", padding: "10px 12px" }}>{fresh}</code>
            <button onClick={() => { navigator.clipboard?.writeText(fresh); setCopied(true); setTimeout(() => setCopied(false), 1400); }} className="btn btn--ghost" style={{ whiteSpace: "nowrap" }}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
        </div>
      )}

      {/* keys list */}
      {loaded && keys.length === 0 && !fresh && (
        <div className="empty" style={{ marginBottom: 28 }}>
          <div className="empty__icon">⌘</div>
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
              <button onClick={() => revoke(k.id)} className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>Revoke</button>
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
                <div className="empty" style={{ marginBottom: 14 }}><div className="empty__icon">⇄</div><h3>No webhooks yet</h3><p>Add an endpoint below to receive a signed test.completed event the moment a test finishes. Delivery success, failures, and retries show here.</p></div>
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
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0 }}>The public API, webhooks, and usage analytics are part of the <b style={{ color: "var(--fg-1)" }}>Scale</b> plan. <Link href="/app/plans" style={{ color: "var(--acc-deep)" }}>See plans →</Link></p>
        </div>
      )}

      {/* docs */}
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12, marginTop: 28 }}>Quickstart</div>
      <div className="codebar"><i /><i /><i /><span>shell</span></div>
      <pre className="codeblock"><code>{CURL}</code></pre>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 14, lineHeight: 1.6 }}>
        Evaluations cost credits the same as the web app (1 credit = 1 valid judgment). Image candidates must be public URLs. Auth via <code style={{ color: "var(--fg-3)" }}>X-Api-Key</code> or <code style={{ color: "var(--fg-3)" }}>Authorization: Bearer</code>.
      </p>

      <div id="webhooks"><WebhooksSection /></div>
    </div>
  );
}
