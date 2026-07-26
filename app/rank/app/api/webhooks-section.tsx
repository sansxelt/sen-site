"use client";

import { useEffect, useState } from "react";
import { Ic, I } from "@/app/rank/_components/icons";

type Hook = { id: string; url: string; enabled: boolean; failure_count: number; last_success_at: string | null; last_failure_at: string | null };
type Delivery = { id: string; test_id: string | null; event: string; status: string; response_status: number | null; error: string | null; attempts: number; created_at: string };

export function WebhooksSection() {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fresh, setFresh] = useState<{ url: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<Record<string, string>>({});
  const [delsFor, setDelsFor] = useState<string | null>(null);
  const [dels, setDels] = useState<Delivery[]>([]);

  async function load() { const r = await fetch("/api/v/webhooks"); if (r.ok) setHooks((await r.json()).webhooks || []); setLoaded(true); }
  useEffect(() => { load(); }, []);

  async function create() {
    setErr(""); setBusy(true);
    const r = await fetch("/api/v/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setFresh({ url: j.url, secret: j.secret }); setUrl(""); load(); }
    else setErr(j.error || "Couldn't add webhook.");
  }
  async function patch(h: Hook, body: object) { await fetch(`/api/v/webhooks/${h.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); load(); }
  async function del(h: Hook) { await fetch(`/api/v/webhooks/${h.id}`, { method: "DELETE" }); load(); }
  async function sendTest(h: Hook) {
    setNote((n) => ({ ...n, [h.id]: "Sending…" }));
    const r = await fetch(`/api/v/webhooks/${h.id}/test`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setNote((n) => ({ ...n, [h.id]: j.ok ? `Delivered ✓${j.status ? ` (HTTP ${j.status})` : ""}` : `Failed${j.status ? ` (HTTP ${j.status})` : ""}: ${j.error || "no response"}` }));
    load();
  }
  async function reveal(h: Hook, rotate = false) {
    const r = await fetch(`/api/v/webhooks/${h.id}/secret`, { method: rotate ? "POST" : "GET" });
    const j = await r.json().catch(() => ({}));
    if (j.secret) setFresh({ url: h.url, secret: j.secret });
  }
  async function showDeliveries(h: Hook) {
    if (delsFor === h.id) { setDelsFor(null); return; }
    const r = await fetch(`/api/v/webhooks/${h.id}/deliveries`);
    const j = await r.json().catch(() => ({}));
    setDels(j.deliveries || []); setDelsFor(h.id);
  }
  async function retry(h: Hook, d: Delivery) {
    setNote((n) => ({ ...n, [d.id]: "…" }));
    await fetch(`/api/v/webhooks/${h.id}/deliveries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliveryId: d.id }) });
    const j = await (await fetch(`/api/v/webhooks/${h.id}/deliveries`)).json().catch(() => ({}));
    setDels(j.deliveries || []); load();
  }
  function copySecret() { if (fresh) navigator.clipboard?.writeText(fresh.secret).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }

  return (
    <div style={{ marginTop: 40, borderTop: "1px solid var(--line-1)", paddingTop: 32 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <h2 className="display" style={{ fontSize: "clamp(1.4rem, 2.4vw, 1.8rem)" }}>Webhooks</h2>
      </div>
      <p className="lead-copy" style={{ marginBottom: 18 }}>Get a signed <code style={{ fontFamily: "var(--font-code, monospace)", fontSize: 13 }}>verification.completed</code> event pushed to your app the moment a verification finishes. Then pull results from the export endpoint. <a href="https://vraelis.com/developers" style={{ color: "var(--acc-deep)" }}>Docs →</a></p>

      {fresh && (
        <div className="card" style={{ marginBottom: 18, borderColor: "var(--acc-line)", background: "var(--acc-soft)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 8 }}>Signing secret. Store it now</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <code style={{ flex: 1, fontFamily: "var(--font-code, monospace)", fontSize: 13, color: "var(--fg-1)", wordBreak: "break-all", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "10px 12px" }}>{fresh.secret}</code>
            <button onClick={copySecret} className="btn btn--ghost" style={{ whiteSpace: "nowrap" }}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: 8, marginBottom: 0 }}>Verify each request: <code style={{ fontSize: 11.5 }}>HMAC_SHA256(secret, `${"{timestamp}.{body}"}`)</code> against <code style={{ fontSize: 11.5 }}>X-Vraelis-Signature</code>.</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/webhooks/vraelis" style={{ flex: 1, minWidth: 240, padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" }} />
        <button onClick={create} disabled={busy || !url.trim()} className="btn">{busy ? "Adding…" : "Add webhook"}</button>
      </div>
      {err && <p style={{ color: "var(--err)", fontSize: 13, marginBottom: 12 }}>{err}</p>}

      {loaded && hooks.length === 0 && <p style={{ fontSize: 13.5, color: "var(--fg-4)", marginTop: 8 }}>No webhooks yet. Add an https URL to receive completion events.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {hooks.map((h) => (
          <div key={h.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: "var(--font-code, monospace)", fontSize: 13, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.url}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", marginTop: 4 }}>
                  <span className="pill" style={h.enabled ? { background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" } : { color: "var(--fg-4)" }}>{h.enabled ? "enabled" : "disabled"}</span>
                  {h.last_success_at ? " Last sent " + new Date(h.last_success_at).toLocaleDateString() : h.last_failure_at ? " Last failed " + new Date(h.last_failure_at).toLocaleDateString() : " No deliveries yet"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              <button onClick={() => patch(h, { enabled: !h.enabled })} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>{h.enabled ? "Disable" : "Enable"}</button>
              <button onClick={() => sendTest(h)} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>Send test</button>
              <button onClick={() => reveal(h)} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>Reveal secret</button>
              <button onClick={() => reveal(h, true)} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px", gap: 6 }}><Ic d={I.retry} size={12} sw={2.2} />Rotate</button>
              <button onClick={() => showDeliveries(h)} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>{delsFor === h.id ? "Hide" : "Deliveries"}</button>
              <button onClick={() => del(h)} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px", color: "var(--err)", gap: 6 }}><Ic d={I.trash} size={12} sw={2.2} />Delete</button>
              {note[h.id] && <span style={{ fontSize: 12, color: "var(--fg-3)", alignSelf: "center" }}>{note[h.id]}</span>}
            </div>
            {delsFor === h.id && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--line-1)", paddingTop: 10 }}>
                {dels.length === 0 ? <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>No deliveries yet.</p> : dels.map((d) => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 11.5, padding: "5px 0", color: "var(--fg-3)", borderTop: "1px solid var(--line-1)" }}>
                    <span style={{ color: d.status === "success" ? "var(--go-ink)" : "var(--err)", whiteSpace: "nowrap" }}>{d.status}{d.response_status ? ` ${d.response_status}` : ""}{d.attempts > 1 ? `, try ${d.attempts}` : ""}{d.test_id ? "" : ", test"}</span>
                    <span style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                      <span>{new Date(d.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                      {d.status === "failed" && <button onClick={() => retry(h, d)} className="btn btn--ghost" style={{ fontSize: 11, padding: "2px 9px", gap: 5 }}><Ic d={I.retry} size={11} sw={2.2} />Retry</button>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
