"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

type Prospect = { name: string; address: string; phone: string; website: string };

const inputStyle: CSSProperties = {
  flex: 1,
  borderRadius: "var(--r-xs)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  padding: "12px 14px",
  fontSize: 14,
  color: "var(--fg-1)",
  outline: "none",
  fontFamily: "var(--font-sans)",
};

export function FindLeads() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Prospect[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<number, "adding" | "done">>({});

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setAdded({});
    try {
      const res = await fetch("/api/vraelis/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = (await res.json()) as { ok?: boolean; prospects?: Prospect[]; error?: string };
      if (res.status === 503 || json.error === "not_configured") {
        setError("not_configured");
        return;
      }
      if (!res.ok || !json.ok) {
        setError(json.error || "Search failed.");
        return;
      }
      setResults(json.prospects ?? []);
    } catch {
      setError("Search failed — try again.");
    } finally {
      setLoading(false);
    }
  }

  async function add(p: Prospect, i: number) {
    setAdded((a) => ({ ...a, [i]: "adding" }));
    try {
      const res = await fetch("/api/vraelis/find/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const json = (await res.json()) as { ok?: boolean };
      setAdded((a) => ({ ...a, [i]: json.ok ? "done" : "adding" }));
      if (!json.ok) setAdded((a) => { const n = { ...a }; delete n[i]; return n; });
    } catch {
      setAdded((a) => { const n = { ...a }; delete n[i]; return n; });
    }
  }

  return (
    <div>
      <form onSubmit={search} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. roofing Austin Texas"
          style={inputStyle}
        />
        <button type="submit" className="btn" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", marginTop: -10, marginBottom: 18, lineHeight: 1.5 }}>
        Free business search (OpenStreetMap). Best format: <b>service + city + state</b> (e.g. &quot;roofing Austin Texas&quot;). Coverage varies — if you get nothing, try different wording.
      </p>

      {error === "not_configured" ? (
        <div className="win" style={{ padding: "22px 24px" }}>
          <h3 style={{ fontSize: 15, color: "var(--fg-1)", marginBottom: 8 }}>Lead search needs a Google Places key.</h3>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55 }}>
            Add <code style={{ fontFamily: "var(--font-mono)" }}>GOOGLE_PLACES_API_KEY</code> in your Vercel project settings (Google Cloud → Places API), then this will work.
          </p>
        </div>
      ) : error ? (
        <p style={{ fontSize: 13.5, color: "#9F2D2D" }}>{error}</p>
      ) : null}

      {results && results.length === 0 && !error && (
        <p style={{ fontSize: 13.5, color: "var(--fg-3)" }}>No businesses found — try a broader search.</p>
      )}

      {results && results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {results.map((p, i) => (
            <div key={i} className="win" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--fg-1)" }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 2 }}>
                  {[p.phone, p.address].filter(Boolean).join(" · ")}
                </div>
                {p.website && (
                  <a href={p.website} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--acc-deep)", textDecoration: "none" }}>
                    {p.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => add(p, i)}
                disabled={!!added[i]}
                className={added[i] === "done" ? "btn btn--ghost" : "btn"}
                style={{ padding: "8px 14px", fontSize: 13, whiteSpace: "nowrap", flex: "0 0 auto" }}
              >
                {added[i] === "done" ? "Added" : added[i] === "adding" ? "Adding…" : "Add lead"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
