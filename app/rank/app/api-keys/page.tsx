"use client";

import { useEffect, useState } from "react";

type Key = { id: string; prefix: string; scopes: string[]; last_used: string | null; created_at: string };

const CURL = `# Create a test
curl -X POST https://vraelis.com/api/v1/tests \\
  -H "X-Api-Key: YOUR_KEY" -H "Content-Type: application/json" \\
  -d '{
    "title": "Which thumbnail?",
    "category": "thumbnail",
    "audience": "gamers",
    "votes": 50,
    "options": [
      { "image_url": "https://your-cdn.com/a.jpg" },
      { "image_url": "https://your-cdn.com/b.jpg" }
    ]
  }'
# -> { "id": "...", "status": "active", "credits_charged": 50 }

# Get status + results (poll until status = "complete")
curl https://vraelis.com/api/v1/tests/TEST_ID -H "X-Api-Key: YOUR_KEY"

# Check your credit balance
curl https://vraelis.com/api/v1/credits -H "X-Api-Key: YOUR_KEY"`;

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [fresh, setFresh] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const r = await fetch("/api/v/keys");
    if (r.ok) { const j = await r.json(); setKeys(j.keys || []); }
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true); setFresh(""); setErr("");
    try {
      const r = await fetch("/api/v/keys", { method: "POST" });
      const j = await r.json();
      if (j.key) { setFresh(j.key); load(); }
      else if (j.error === "plan_required") setErr("The public API is a Scale plan feature. Upgrade to generate keys.");
      else setErr("Couldn't create a key. Try again.");
    } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    await fetch(`/api/v/keys/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <p className="eyebrow">Developers</p>
          <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)" }}>API keys</h1>
        </div>
        <button onClick={create} disabled={busy} className="btn" style={{ opacity: busy ? 0.6 : 1 }}>{busy ? "Creating…" : "Create key"}</button>
      </div>
      <p className="lead-copy" style={{ marginBottom: 24 }}>Add human preference testing to your own app or AI tool. Send creative options, get back a ranked result.</p>

      {err && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--line-2)" }}>
          <p style={{ fontSize: 14, color: "var(--fg-2)", margin: 0 }}>{err} {err.includes("Scale") && <a href="/app/plans" style={{ color: "var(--acc-deep)" }}>See plans →</a>}</p>
        </div>
      )}

      {fresh && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--acc-line)", background: "var(--acc-soft)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 8 }}>Your new key — copy it now, it won&apos;t be shown again</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <code style={{ flex: 1, fontFamily: "var(--font-code)", fontSize: 13, color: "var(--fg-1)", wordBreak: "break-all", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-xs)", padding: "10px 12px" }}>{fresh}</code>
            <button onClick={() => { navigator.clipboard?.writeText(fresh); setCopied(true); setTimeout(() => setCopied(false), 1400); }} className="btn btn--ghost" style={{ whiteSpace: "nowrap" }}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
        </div>
      )}

      {/* keys list */}
      {loaded && keys.length === 0 && !fresh && (
        <div className="card" style={{ textAlign: "center", padding: "clamp(28px,4vw,44px)", marginBottom: 28 }}>
          <p style={{ fontSize: 14, color: "var(--fg-3)" }}>No keys yet. Create one to call the API.</p>
        </div>
      )}
      {keys.length > 0 && (
        <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--bg-1)", marginBottom: 28 }}>
          {keys.map((k, i) => (
            <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
              <div style={{ minWidth: 0 }}>
                <code style={{ fontFamily: "var(--font-code)", fontSize: 13, color: "var(--fg-1)" }}>{k.prefix}…</code>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", marginTop: 3 }}>{k.last_used ? `last used ${new Date(k.last_used).toLocaleDateString()}` : "never used"}</div>
              </div>
              <button onClick={() => revoke(k.id)} className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>Revoke</button>
            </div>
          ))}
        </div>
      )}

      {/* docs */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Quickstart</div>
      <pre style={{ margin: 0, padding: 18, borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-2)", overflowX: "auto", fontFamily: "var(--font-code)", fontSize: 12.5, lineHeight: 1.6, color: "var(--fg-2)" }}>{CURL}</pre>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 14, lineHeight: 1.6 }}>
        Tests cost credits the same as the web app (1 credit = 1 human vote). Image options must be public URLs. Auth via <code style={{ color: "var(--fg-3)" }}>X-Api-Key</code> or <code style={{ color: "var(--fg-3)" }}>Authorization: Bearer</code>.
      </p>
    </div>
  );
}
