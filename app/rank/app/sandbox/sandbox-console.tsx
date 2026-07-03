"use client";

import { useState } from "react";
import Link from "next/link";

type Endpoint = { id: string; url: string; enabled: boolean };
type Pkg = Record<string, unknown> & {
  mode?: string;
  decision?: Record<string, unknown>;
  counts?: Record<string, number>;
  audience?: Record<string, unknown>;
};
type CreateResp = { id: string; status: string; mode: string; credits_charged: number; created_at: string; decision_package: Pkg | null };
type ExportState = { kind: string; status: number; ok: boolean; body: string } | null;
type WhResult = { ok: boolean; status?: number | null; error?: string; at: string } | null;

const CATEGORIES: [string, string][] = [
  ["landing", "Landing page hero"], ["ad", "Ad creative"], ["thumbnail", "Thumbnail"],
  ["ai_image", "AI image output"], ["logo", "Logo"], ["hook", "Copy / headline"],
];

const SDK_SNIPPET = `import { Vraelis } from "@vraelis/sdk"

const vraelis = new Vraelis({ apiKey: process.env.VRAELIS_API_KEY! })

const evaluation = await vraelis.evaluations.create({
  sandbox: true,
  title: "Sandbox hero test",
  category: "landing",
  options: [{ label: "Hero A" }, { label: "Hero B" }],
})

const result = await vraelis.evaluations.get(evaluation.id)
console.log(result.decision_package?.decision.recommended_output)`;

const CURL_CREATE = `curl -X POST https://vraelis.com/api/v1/tests \\
  -H "X-Api-Key: $VRAELIS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Sandbox hero test","category":"landing","sandbox":true,
       "options":[{"text":"Hero A"},{"text":"Hero B"}]}'
# -> { "id": "...", "sandbox": true, "mode": "sandbox", "credits_charged": 0 }`;

const CURL_GET = `curl https://vraelis.com/api/v1/tests/EVAL_ID \\
  -H "X-Api-Key: $VRAELIS_API_KEY"
# -> { ..., "decision_package": { "schema_version": "v2", "mode": "sandbox", ... } }`;

const CURL_EXPORT = `curl "https://vraelis.com/api/v1/tests/EVAL_ID/export?format=json&tier=scale" \\
  -H "X-Api-Key: $VRAELIS_API_KEY"
# CSV: ?format=csv`;

const SDK_WEBHOOK = `import { verifyWebhookSignature } from "@vraelis/sdk"

export async function POST(req: Request) {
  const raw = await req.text() // raw body — required
  const ok = verifyWebhookSignature({
    payload: raw,
    signature: req.headers.get("x-vraelis-signature"),
    timestamp: req.headers.get("x-vraelis-timestamp"),
    secret: process.env.VRAELIS_WEBHOOK_SECRET!,
    toleranceSeconds: 300,
  })
  if (!ok) return new Response("invalid signature", { status: 401 })
  return new Response("ok")
}

// Or verify by hand: sha256=HMAC_SHA256(secret, \`\${timestamp}.\${rawBody}\`)
// compared (constant-time) to the X-Vraelis-Signature header.`;

const lbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "30px 0 12px" } as const;
const cardHead = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 } as const;
const inputStyle = { width: "100%", padding: "10px 13px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" } as const;

function Snippet({ label, text, copied, onCopy }: { label: string; text: string; copied: boolean; onCopy: () => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="codebar"><i /><i /><i /><span>{label}</span></div>
        <button onClick={onCopy} className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11.5, marginBottom: 0 }}>{copied ? "Copied ✓" : "Copy"}</button>
      </div>
      <pre className="codeblock" style={{ marginTop: 0 }}><code>{text}</code></pre>
    </div>
  );
}

export function SandboxConsole({ hasApiAccess, endpoints }: { hasApiAccess: boolean; endpoints: Endpoint[] }) {
  const [title, setTitle] = useState("Sandbox landing page hero test");
  const [category, setCategory] = useState("landing");
  const [optA, setOptA] = useState("Hero A");
  const [optB, setOptB] = useState("Hero B");
  const [creating, setCreating] = useState(false);
  const [ev, setEv] = useState<CreateResp | null>(null);
  const [err, setErr] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState("");
  const [exp, setExp] = useState<ExportState>(null);
  const [expBusy, setExpBusy] = useState("");
  const [whId, setWhId] = useState(endpoints[0]?.id ?? "");
  const [wh, setWh] = useState<WhResult>(null);
  const [whBusy, setWhBusy] = useState(false);

  const copy = (key: string, text: string) => { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 1400); };
  const download = (name: string, text: string, type: string) => { const b = new Blob([text], { type }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); };

  async function createSandbox() {
    setCreating(true); setErr(""); setExp(null); setShowJson(false);
    try {
      const r = await fetch("/api/v/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, category, options: [{ text: optA }, { text: optB }] }) });
      const j = await r.json();
      if (!r.ok) { setErr(j?.error === "plan_required" ? "Sandbox needs API access (Scale plan)." : "Couldn't create the sandbox evaluation."); setEv(null); }
      else setEv(j);
    } catch { setErr("Request failed. Try again."); } finally { setCreating(false); }
  }

  async function doExport(kind: "summary" | "standard" | "scale" | "csv") {
    if (!ev) return;
    setExpBusy(kind); setExp(null);
    const url = kind === "csv" ? `/api/v/tests/${ev.id}/export?format=csv` : `/api/v/tests/${ev.id}/export?format=json&tier=${kind}`;
    try { const r = await fetch(url); const body = await r.text(); setExp({ kind, status: r.status, ok: r.ok, body }); }
    catch { setExp({ kind, status: 0, ok: false, body: "request failed" }); } finally { setExpBusy(""); }
  }

  async function sendWebhook() {
    if (!whId) return;
    setWhBusy(true); setWh(null);
    try { const r = await fetch(`/api/v/webhooks/${whId}/test`, { method: "POST" }); const j = await r.json().catch(() => ({})); setWh({ ok: !!j.ok, status: j.status ?? r.status, error: j.error, at: new Date().toLocaleTimeString() }); }
    catch { setWh({ ok: false, error: "request failed", at: new Date().toLocaleTimeString() }); } finally { setWhBusy(false); }
  }

  const dp = ev?.decision_package ?? null;
  const dec = (dp?.decision ?? {}) as Record<string, unknown>;
  const counts = (dp?.counts ?? {}) as Record<string, number>;
  const aud = (dp?.audience ?? null) as Record<string, unknown> | null;
  const previewBody = (() => { if (!exp) return ""; if (exp.kind === "csv") return exp.body.split("\n").slice(0, 6).join("\n"); try { return JSON.stringify(JSON.parse(exp.body), null, 2).slice(0, 900); } catch { return exp.body.slice(0, 900); } })();

  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Developers · Sandbox</p>
          <h1 className="display">Sandbox console</h1>
          <p>Test your Vraelis integration end-to-end before spending credits — create an evaluation, preview the Decision Package, test exports, and send a signed webhook.</p>
        </div>
        <Link href="/app/api-keys" className="btn btn--ghost">← API &amp; webhooks</Link>
      </div>

      <div className="card" style={{ background: "var(--bg-2)", marginBottom: 22 }}>
        <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: 0, lineHeight: 1.6 }}>Sandbox evaluations use <strong style={{ color: "var(--fg-1)" }}>sample data</strong>, charge <strong style={{ color: "var(--fg-1)" }}>0 credits</strong>, use <strong style={{ color: "var(--fg-1)" }}>0 quota</strong>, and do not appear in production analytics. Production evaluations use real qualified human signal.</p>
      </div>

      {!hasApiAccess && (
        <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc-line)" }}>
          <div style={cardHead}>API access required</div>
          <p style={{ fontSize: 14, color: "var(--fg-2)", margin: "0 0 12px", lineHeight: 1.6 }}>The API, webhooks, and the sandbox console are part of the <b style={{ color: "var(--fg-1)" }}>Scale</b> plan. The snippets and docs below are free to read. Upgrade to create sandbox evaluations and send webhook tests.</p>
          <Link href="/app/plans" className="btn">See plans →</Link>
        </div>
      )}

      {hasApiAccess && (
        <>
          {/* Create */}
          <div style={lbl}>1 · Create a sandbox evaluation</div>
          <div className="card" style={{ marginBottom: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }} className="cols-stack">
              <label style={{ gridColumn: "1 / -1" }}><span style={{ display: "block", fontSize: 12.5, color: "var(--fg-3)", marginBottom: 5 }}>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} style={inputStyle} /></label>
              <label><span style={{ display: "block", fontSize: 12.5, color: "var(--fg-3)", marginBottom: 5 }}>Category</span><select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle as React.CSSProperties}>{CATEGORIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <div />
              <label><span style={{ display: "block", fontSize: 12.5, color: "var(--fg-3)", marginBottom: 5 }}>Option A</span><input value={optA} onChange={(e) => setOptA(e.target.value)} maxLength={120} style={inputStyle} /></label>
              <label><span style={{ display: "block", fontSize: 12.5, color: "var(--fg-3)", marginBottom: 5 }}>Option B</span><input value={optB} onChange={(e) => setOptB(e.target.value)} maxLength={120} style={inputStyle} /></label>
            </div>
            <button onClick={createSandbox} disabled={creating} className="btn" style={{ opacity: creating ? 0.6 : 1 }}>{creating ? "Creating…" : "Create sandbox evaluation"}</button>
            {err && <p style={{ fontSize: 13, color: "var(--money)", margin: "10px 0 0" }}>{err} {err.includes("Scale") && <Link href="/app/plans" style={{ color: "var(--acc-deep)" }}>See plans →</Link>}</p>}
          </div>

          {ev && (
            <>
              <div className="tile-grid cols-4" style={{ marginBottom: 18 }}>
                <div className="stat"><div className="stat__l">Evaluation id</div><div className="stat__v tnum" style={{ fontSize: 13, fontFamily: "var(--font-code)", wordBreak: "break-all" }}>{ev.id.slice(0, 8)}…</div><div className="stat__s">created {new Date(ev.created_at).toLocaleTimeString()}</div></div>
                <div className="stat"><div className="stat__l">Status</div><div className="stat__v" style={{ fontSize: 18 }}>{ev.status}</div></div>
                <div className="stat"><div className="stat__l">Mode</div><div className="stat__v" style={{ fontSize: 18 }}><span className="pill" style={{ background: "var(--acc-soft)", color: "var(--acc-deep)" }}>{ev.mode}</span></div></div>
                <div className="stat"><div className="stat__l">Credits charged</div><div className="stat__v tnum">{ev.credits_charged}</div><div className="stat__s">0 quota used</div></div>
              </div>

              {/* Decision Package preview */}
              <div style={lbl}>2 · Decision Package preview <span className="pill" style={{ marginLeft: 6, fontSize: 10 }}>sample · mode {dp?.mode ?? "sandbox"}</span></div>
              <div className="card" style={{ marginBottom: 18 }}>
                <div className="tile-grid cols-4" style={{ gap: 12, marginBottom: 14 }}>
                  {[
                    ["Recommended", String(dec.recommended_output ?? "—")],
                    ["Pref. margin", dec.preference_margin != null ? `${dec.preference_margin} pts` : "—"],
                    ["Confidence", String(dec.directional_confidence ?? "—")],
                    ["Signal", String(dec.signal_quality ?? "—")],
                    ["Health", String(dec.evaluation_health ?? "—")],
                    ["Valid judgments", String(counts.valid_judgments ?? "—")],
                    ["Filtered", String(counts.filtered_responses ?? "—")],
                    ["Audience fit", aud ? String(aud.audience_fit ?? "—") : "—"],
                  ].map(([k, v]) => (
                    <div key={k}><div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{k}</div><div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--fg-1)", marginTop: 3 }}>{v}</div></div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowJson((s) => !s)} className="btn btn--ghost" style={{ fontSize: 12.5 }}>{showJson ? "Hide raw JSON" : "View raw JSON"}</button>
                  <button onClick={() => copy("pkg", JSON.stringify(dp, null, 2))} className="btn btn--ghost" style={{ fontSize: 12.5 }}>{copied === "pkg" ? "Copied ✓" : "Copy JSON"}</button>
                </div>
                {showJson && <pre className="codeblock" style={{ marginTop: 12, maxHeight: 320, overflow: "auto" }}><code>{JSON.stringify(dp, null, 2)}</code></pre>}
              </div>

              {/* Exports */}
              <div style={lbl}>3 · Test exports</div>
              <div className="card" style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: exp ? 14 : 0 }}>
                  {(["summary", "standard", "scale"] as const).map((t) => <button key={t} onClick={() => doExport(t)} disabled={!!expBusy} className="btn btn--ghost" style={{ fontSize: 12.5 }}>{expBusy === t ? "…" : `Export ${t} JSON`}</button>)}
                  <button onClick={() => doExport("csv")} disabled={!!expBusy} className="btn btn--ghost" style={{ fontSize: 12.5 }}>{expBusy === "csv" ? "…" : "Export CSV"}</button>
                </div>
                {exp && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <span className="pill" style={{ background: exp.ok ? "var(--acc-soft)" : "var(--bg-2)", color: exp.ok ? "var(--acc-deep)" : "var(--money)" }}>{exp.kind} · {exp.status} {exp.ok ? "OK" : "error"}</span>
                      <button onClick={() => download(`sandbox-${ev.id.slice(0, 8)}.${exp.kind === "csv" ? "csv" : "json"}`, exp.body, exp.kind === "csv" ? "text/csv" : "application/json")} className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11.5 }}>Download</button>
                      <button onClick={() => copy("exp", exp.body)} className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11.5 }}>{copied === "exp" ? "Copied ✓" : "Copy"}</button>
                    </div>
                    <pre className="codeblock" style={{ marginTop: 0, maxHeight: 260, overflow: "auto" }}><code>{previewBody}</code></pre>
                  </div>
                )}
              </div>

              {/* Webhook self-test */}
              <div style={lbl}>4 · Send sandbox webhook</div>
              <div className="card" style={{ marginBottom: 18 }}>
                {endpoints.length === 0 ? (
                  <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0 }}>Add a webhook endpoint to send a signed sandbox event. <Link href="/app/api-keys#webhooks" style={{ color: "var(--acc-deep)" }}>Add an endpoint →</Link></p>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 12px" }}>Sends a signed <code style={{ fontFamily: "var(--font-code)" }}>test.completed</code> with <code style={{ fontFamily: "var(--font-code)" }}>test_event: true</code>, <code style={{ fontFamily: "var(--font-code)" }}>mode: &quot;sandbox&quot;</code>, and a compact Decision Package. No real evaluation required.</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <select value={whId} onChange={(e) => setWhId(e.target.value)} style={{ ...inputStyle, width: "auto", flex: "1 1 280px" } as React.CSSProperties}>{endpoints.map((e) => <option key={e.id} value={e.id}>{e.url}{e.enabled ? "" : " (disabled)"}</option>)}</select>
                      <button onClick={sendWebhook} disabled={whBusy} className="btn" style={{ opacity: whBusy ? 0.6 : 1 }}>{whBusy ? "Sending…" : "Send test.completed sandbox event"}</button>
                    </div>
                    {wh && (
                      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span className="pill" style={{ background: wh.ok ? "var(--acc-soft)" : "var(--bg-2)", color: wh.ok ? "var(--acc-deep)" : "var(--money)" }}>{wh.ok ? "Delivered" : "Failed"}{wh.status != null ? ` · HTTP ${wh.status}` : ""}</span>
                        <span style={{ fontSize: 12, color: "var(--fg-4)" }}>{wh.at}</span>
                        {wh.error && <span style={{ fontSize: 12, color: "var(--money)" }}>{wh.error}</span>}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Snippets + links (always shown) */}
      <div style={lbl}>Implementation examples</div>
      <div className="card" style={{ marginBottom: 18 }}>
        <Snippet label="typescript · SDK starter · coming soon to npm" text={SDK_SNIPPET} copied={copied === "sdk"} onCopy={() => copy("sdk", SDK_SNIPPET)} />
        <Snippet label="curl · create sandbox evaluation" text={CURL_CREATE} copied={copied === "cc"} onCopy={() => copy("cc", CURL_CREATE)} />
        <Snippet label="curl · fetch decision package" text={CURL_GET} copied={copied === "cg"} onCopy={() => copy("cg", CURL_GET)} />
        <Snippet label="curl · export JSON" text={CURL_EXPORT} copied={copied === "ce"} onCopy={() => copy("ce", CURL_EXPORT)} />
        <Snippet label="typescript · verify a webhook signature" text={SDK_WEBHOOK} copied={copied === "wv"} onCopy={() => copy("wv", SDK_WEBHOOK)} />
        <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "6px 0 0" }}>Set <code style={{ fontFamily: "var(--font-code)" }}>$VRAELIS_API_KEY</code> to your key. Keep keys server-side only — never ship them to the client. Full reference: the SDK README in the repository.</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/schemas/decision-package-v2.json" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Decision Package schema</Link>
        <Link href="/developers#sdk" className="btn btn--ghost" style={{ fontSize: 12.5 }}>SDK &amp; developer docs</Link>
        <Link href="/app/api-keys" className="btn btn--ghost" style={{ fontSize: 12.5 }}>API keys &amp; webhooks</Link>
      </div>
    </div>
  );
}
