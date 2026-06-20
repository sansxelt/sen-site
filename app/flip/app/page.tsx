"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import { signIn } from "next-auth/react";

type Listing = {
  item_type: string; brand: string; model: string; colorway: string; size: string;
  condition_grade: string; condition_notes: string;
  key_features: string[]; visible_flaws: string[]; measurements_to_take: string[];
  category: string; keywords: string[];
  titles: { ebay: string; poshmark: string; depop: string; mercari: string };
  description: string;
  hashtags: { poshmark: string[]; depop: string[] };
  price: { fast: number; market: number; high: number; confidence: string };
};
type Pic = { url: string; media_type: string; data: string };

// Downscale to ≤1024px JPEG before upload — keeps the request small and the
// vision tokens cheap (full-res images cost ~3x more for no listing benefit).
function resize(file: File, max = 1024): Promise<Pic> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale) || 1;
      const h = Math.round(img.height * scale) || 1;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return reject(new Error("no canvas")); }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ url, media_type: "image/jpeg", data: dataUrl.split(",")[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

const cardStyle: CSSProperties = {
  background: "var(--bg-1)", border: "1px solid var(--line-2)",
  borderRadius: "var(--r-sm)", padding: 16, boxShadow: "var(--shadow-card)",
};
const monoLabel: CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.07em",
  textTransform: "uppercase", color: "var(--fg-4)",
};

function Copyable({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div style={{ ...cardStyle, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
        <span style={monoLabel}>{label}</span>
        <button
          onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1400); }}
          style={{
            border: `1px solid ${done ? "var(--acc)" : "var(--line-3)"}`,
            color: done ? "var(--acc-deep)" : "var(--fg-1)", background: "var(--bg-1)",
            borderRadius: "var(--r-xs)", padding: "4px 11px", fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "var(--font-sans)",
          }}
        >{done ? "Copied ✓" : "Copy"}</button>
      </div>
      <div style={{ fontSize: 13.5, color: "var(--fg-1)", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

export default function FlipApp() {
  const [pics, setPics] = useState<Pic[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Listing | null>(null);
  const [error, setError] = useState<string>("");
  const [limit, setLimit] = useState<"signin" | "upgrade" | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function copyFull(l: Listing) {
    const text = [
      `eBay\n${l.titles.ebay}`,
      `Poshmark\n${l.titles.poshmark}`,
      `Depop\n${l.titles.depop}`,
      `Mercari\n${l.titles.mercari}`,
      `Description\n${l.description}`,
      `Price: $${l.price.fast} fast · $${l.price.market} market · $${l.price.high} high`,
      `Keywords: ${l.keywords.join(", ")}`,
    ].join("\n\n");
    navigator.clipboard?.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  }

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setError("");
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 5 - pics.length);
    try {
      const resized = await Promise.all(list.map((f) => resize(f)));
      setPics((p) => [...p, ...resized].slice(0, 5));
    } catch { setError("Couldn't read one of those images — try a JPG or PNG."); }
  }, [pics.length]);

  async function generate() {
    if (pics.length === 0 || busy) return;
    setBusy(true); setError(""); setLimit(null); setResult(null);
    try {
      const res = await fetch("/api/flip/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: pics.map((p) => ({ media_type: p.media_type, data: p.data })) }),
      });
      if (res.status === 402) {
        const j = await res.json();
        setLimit(j.reason === "signin" ? "signin" : "upgrade");
        return;
      }
      if (!res.ok) { setError("Generation failed — please try again."); return; }
      const j = (await res.json()) as { listing: Listing; creditsLeft: number | null };
      setResult(j.listing);
      setCredits(j.creditsLeft);
    } catch { setError("Network error — please try again."); }
    finally { setBusy(false); }
  }

  async function upgrade() {
    try {
      const res = await fetch("/api/flip/checkout", { method: "POST" });
      if (res.status === 401) { signIn("google", { callbackUrl: "/app" }); return; }
      const j = await res.json();
      if (j.url) window.location.href = j.url;
      else setError("Couldn't start checkout.");
    } catch { setError("Couldn't start checkout."); }
  }

  const ready = pics.length > 0 && !busy;

  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(22px, 3vw, 38px)", paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.6rem, 3vw, 2.1rem)", letterSpacing: "-0.02em", color: "var(--fg-1)", margin: 0 }}>Make a listing</h1>
        {credits !== null && (
          <span style={{ ...monoLabel, color: "var(--fg-3)" }}>{credits} free listing{credits === 1 ? "" : "s"} left</span>
        )}
      </div>
      <p style={{ color: "var(--fg-3)", fontSize: 14.5, margin: "8px 0 22px", lineHeight: 1.5 }}>
        Upload 1–5 photos of your item and generate a finished resale listing.
      </p>

      {/* uploader */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${drag ? "var(--acc)" : "var(--line-3)"}`,
          background: drag ? "var(--acc-soft)" : "var(--bg-1)",
          borderRadius: "var(--r-sm)", padding: "28px 18px", textAlign: "center",
          cursor: "pointer", transition: "border-color .15s ease, background .15s ease",
        }}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => e.target.files && addFiles(e.target.files)} />
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-1)" }}>Drop photos here, or tap to choose</div>
        <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 5 }}>JPG / PNG · up to 5 · front, tag, and any flaws</div>
      </div>

      {pics.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          {pics.map((p, i) => (
            <div key={i} style={{ position: "relative", width: 76, height: 76, borderRadius: "var(--r-xs)", border: "1px solid var(--line-2)", backgroundImage: `url(${p.url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
              <button
                onClick={() => setPics((arr) => arr.filter((_, j) => j !== i))}
                aria-label="remove"
                style={{ position: "absolute", top: -7, right: -7, width: 20, height: 20, borderRadius: "50%", border: "none", background: "var(--fg-1)", color: "var(--bg-1)", fontSize: 12, lineHeight: 1, cursor: "pointer" }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={generate}
        disabled={!ready}
        className="btn btn--lg"
        style={{ marginTop: 18, width: "100%", justifyContent: "center", opacity: ready ? 1 : 0.55, cursor: ready ? "pointer" : "default" }}
      >{busy ? "Reading the photos…" : <>Generate listing <span aria-hidden>→</span></>}</button>

      {error && <p style={{ color: "var(--err)", fontSize: 13.5, marginTop: 12 }}>{error}</p>}

      {/* limit gates */}
      {limit === "signin" && (
        <div style={{ ...cardStyle, marginTop: 16, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, color: "var(--fg-1)", marginBottom: 6 }}>That was your free try.</div>
          <p style={{ color: "var(--fg-3)", fontSize: 14, margin: "0 0 16px" }}>Sign in with Google to keep going — 3 free listings on us.</p>
          <button onClick={() => signIn("google", { callbackUrl: "/app" })} className="btn btn--ghost">Continue with Google</button>
        </div>
      )}
      {limit === "upgrade" && (
        <div style={{ ...cardStyle, marginTop: 16, textAlign: "center", borderColor: "var(--acc-line)", background: "var(--acc-soft)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, color: "var(--fg-1)", marginBottom: 6 }}>You&apos;ve used your 3 free listings.</div>
          <p style={{ color: "var(--fg-3)", fontSize: 14, margin: "0 0 16px" }}>Go Pro for unlimited listings — $19/mo, cancel anytime.</p>
          <button onClick={upgrade} className="btn">Upgrade to Pro <span aria-hidden>→</span></button>
        </div>
      )}

      {/* result */}
      {result && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: "var(--fg-1)", margin: 0, letterSpacing: "-0.02em" }}>
              {result.brand !== "unknown" ? `${result.brand} ` : ""}{result.item_type}
            </h2>
            <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>{result.category} · {result.condition_grade}{result.size !== "unknown" ? ` · ${result.size}` : ""}</span>
          </div>
          <button onClick={() => copyFull(result)} className="btn btn--ghost" style={{ alignSelf: "flex-start" }}>
            {copiedAll ? "Copied full listing ✓" : "Copy full listing"}
          </button>

          {/* price */}
          <div style={{ ...cardStyle, display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ ...monoLabel, marginRight: 4 }}>Price</span>
            {([["fast", result.price.fast], ["market", result.price.market], ["high", result.price.high]] as const).map(([k, v]) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "baseline", gap: 5, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "-0.02em", color: "var(--acc-deep)", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", borderRadius: "var(--r-circle)", padding: "5px 12px" }}>
                ${v} <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--fg-4)", fontSize: 11 }}>{k}</span>
              </span>
            ))}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", marginLeft: "auto" }}>confidence: {result.price.confidence}</span>
          </div>

          {/* titles + content */}
          <Copyable label="eBay title" value={result.titles.ebay} />
          <Copyable label="Poshmark title" value={result.titles.poshmark} />
          <Copyable label="Depop title" value={result.titles.depop} />
          <Copyable label="Mercari title" value={result.titles.mercari} />
          <Copyable label="Description" value={result.description} />
          <Copyable label="Keywords" value={result.keywords.join(", ")} />
          <Copyable label="Poshmark hashtags" value={result.hashtags.poshmark.map((h) => (h.startsWith("#") ? h : "#" + h)).join(" ")} />
          <Copyable label="Depop hashtags" value={result.hashtags.depop.map((h) => (h.startsWith("#") ? h : "#" + h)).join(" ")} />

          {(result.measurements_to_take.length > 0 || result.visible_flaws.length > 0 || result.condition_notes) && (
            <div style={{ ...cardStyle, fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55 }}>
              {result.condition_notes && <div style={{ marginBottom: 8 }}><b style={{ color: "var(--fg-1)" }}>Condition:</b> {result.condition_notes}</div>}
              {result.visible_flaws.length > 0 && <div style={{ marginBottom: 8, color: "var(--money)" }}><b>Flaws to mention:</b> {result.visible_flaws.join("; ")}</div>}
              {result.measurements_to_take.length > 0 && <div style={{ color: "var(--fg-3)" }}><b style={{ color: "var(--fg-1)" }}>Add before posting:</b> {result.measurements_to_take.join("; ")}</div>}
            </div>
          )}

          <button onClick={() => { setResult(null); setPics([]); }} style={{ alignSelf: "center", marginTop: 8, background: "none", border: "none", color: "var(--acc-deep)", fontWeight: 600, cursor: "pointer", fontSize: 14, fontFamily: "var(--font-sans)" }}>+ List another item</button>
        </div>
      )}
    </div>
  );
}
