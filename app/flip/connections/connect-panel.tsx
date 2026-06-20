"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

type Market = { key: string; name: string; blurb: string; api: boolean };

const MARKETS: Market[] = [
  { key: "ebay", name: "eBay", blurb: "Keyword-stuffed title, item specifics, full description — built to surface in eBay search.", api: true },
  { key: "shopify", name: "Shopify", blurb: "Push finished listings to your own store as products, fields mapped.", api: true },
  { key: "poshmark", name: "Poshmark", blurb: "Posh-voice copy + a ready hashtag set for the share game.", api: false },
  { key: "depop", name: "Depop", blurb: "Casual, trend-aware copy + hashtags tuned to how Depop buyers search.", api: false },
  { key: "mercari", name: "Mercari", blurb: "Tight title + clean description that fit Mercari's shorter limits.", api: false },
];

export function ConnectPanel({ signedIn, initial }: { signedIn: boolean; initial: Record<string, string> }) {
  const [state, setState] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function enroll(platform: string) {
    if (!signedIn) { signIn("google", { callbackUrl: "/connections" }); return; }
    setBusy(platform);
    try {
      const r = await fetch("/api/flip/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform }) });
      if (r.ok) setState((s) => ({ ...s, [platform]: "early_access" }));
    } finally { setBusy(null); }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {MARKETS.map((m) => {
        const status = state[m.key];
        const enrolled = status === "early_access" || status === "connected";
        return (
          <div key={m.key} className="card" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 200 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>{m.name}</span>
              {m.api ? (
                <span className={`pill ${enrolled ? "st-won" : ""}`} style={!enrolled ? { color: "var(--fg-4)" } : undefined}>
                  <span className="dot" />{enrolled ? "On the list" : "Auto-post soon"}
                </span>
              ) : (
                <span className="pill" style={{ color: "var(--fg-4)" }}><span className="dot" />No public API</span>
              )}
            </div>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, flex: 1 }}>{m.blurb}</p>
            {!m.api ? (
              <a href="/app" className="btn btn--ghost" style={{ justifyContent: "center" }}>Generate & copy in</a>
            ) : enrolled ? (
              <span style={{ textAlign: "center", borderRadius: "var(--r-sm)", padding: "11px 18px", fontSize: 14, fontWeight: 600, color: "var(--acc-deep)", border: "1px solid var(--acc-line)", background: "var(--acc-soft)" }}>You&apos;re on the early-access list ✓</span>
            ) : (
              <button onClick={() => enroll(m.key)} disabled={busy === m.key} className="btn" style={{ justifyContent: "center", opacity: busy === m.key ? 0.6 : 1 }}>
                {busy === m.key ? "Adding…" : signedIn ? "Get early access" : "Sign in to connect"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
