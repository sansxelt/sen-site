"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

const PAPER = "#FBFAF8";
const INK = "#16130F";
const MUT = "#6B6258";
const ACC = "#0E8A4F";
const LINE = "#E9E4DB";

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

const card: CSSProperties = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 };

function Copyable({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: MUT }}>{label}</span>
        <button
          onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1400); }}
          style={{ border: `1px solid ${done ? ACC : LINE}`, color: done ? ACC : INK, background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >{done ? "Copied ✓" : "Copy"}</button>
      </div>
      <div style={{ fontSize: 13.5, color: INK, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value}</div>
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
  const inputRef = useRef<HTMLInputElement>(null);

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
      if (res.status === 401) { signIn("google", { callbackUrl: "/flip/app" }); return; }
      const j = await res.json();
      if (j.url) window.location.href = j.url;
      else setError("Couldn't start checkout.");
    } catch { setError("Couldn't start checkout."); }
  }

  return (
    <main style={{ background: PAPER, color: INK, minHeight: "100svh", fontFamily: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <header style={{ maxWidth: 880, margin: "0 auto", padding: "18px clamp(16px,4vw,32px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/flip" style={{ textDecoration: "none", color: INK, fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>Flip<span style={{ color: ACC }}>Engine</span></Link>
        <span style={{ fontSize: 13, color: MUT }}>{credits === null ? "" : `${credits} free listing${credits === 1 ? "" : "s"} left`}</span>
      </header>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "8px clamp(16px,4vw,32px) 64px" }}>
        <h1 style={{ fontSize: "clamp(1.5rem,3.2vw,2rem)", letterSpacing: "-0.02em", fontWeight: 780, margin: "8px 0 4px" }}>Make a listing</h1>
        <p style={{ color: MUT, fontSize: 14.5, margin: "0 0 20px" }}>Upload 1–5 photos of your item and generate a finished resale listing.</p>

        {/* uploader */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          style={{ border: `1.5px dashed ${drag ? ACC : LINE}`, background: drag ? "rgba(14,138,79,0.05)" : "#fff", borderRadius: 16, padding: "26px 18px", textAlign: "center", cursor: "pointer", transition: "all .15s ease" }}
        >
          <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => e.target.files && addFiles(e.target.files)} />
          <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>Drop photos here, or tap to choose</div>
          <div style={{ fontSize: 12.5, color: MUT, marginTop: 4 }}>JPG / PNG · up to 5 · front, tag, and any flaws</div>
        </div>

        {pics.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            {pics.map((p, i) => (
              <div key={i} style={{ position: "relative", width: 76, height: 76, borderRadius: 10, border: `1px solid ${LINE}`, backgroundImage: `url(${p.url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
                <button
                  onClick={() => setPics((arr) => arr.filter((_, j) => j !== i))}
                  aria-label="remove"
                  style={{ position: "absolute", top: -7, right: -7, width: 20, height: 20, borderRadius: "50%", border: "none", background: INK, color: "#fff", fontSize: 12, lineHeight: 1, cursor: "pointer" }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={generate}
          disabled={pics.length === 0 || busy}
          style={{ marginTop: 18, width: "100%", padding: "13px", borderRadius: 12, border: "none", background: pics.length === 0 || busy ? "#A9C9B8" : ACC, color: "#fff", fontWeight: 700, fontSize: 15.5, cursor: pics.length === 0 || busy ? "default" : "pointer" }}
        >{busy ? "Reading the photos…" : "Generate listing →"}</button>

        {error && <p style={{ color: "#B42318", fontSize: 13.5, marginTop: 12 }}>{error}</p>}

        {/* limit gates */}
        {limit === "signin" && (
          <div style={{ ...card, marginTop: 16, textAlign: "center" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>That was your free try.</div>
            <p style={{ color: MUT, fontSize: 14, margin: "0 0 14px" }}>Sign in with Google to keep going — 3 free listings on us.</p>
            <button onClick={() => signIn("google", { callbackUrl: "/flip/app" })} style={{ padding: "11px 20px", borderRadius: 11, border: `1px solid ${LINE}`, background: "#fff", fontWeight: 650, cursor: "pointer" }}>Continue with Google</button>
          </div>
        )}
        {limit === "upgrade" && (
          <div style={{ ...card, marginTop: 16, textAlign: "center", borderColor: ACC }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>You&apos;ve used your 3 free listings.</div>
            <p style={{ color: MUT, fontSize: 14, margin: "0 0 14px" }}>Go Pro for unlimited listings — $19/mo, cancel anytime.</p>
            <button onClick={upgrade} style={{ padding: "11px 22px", borderRadius: 11, border: "none", background: ACC, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Upgrade to Pro →</button>
          </div>
        )}

        {/* result */}
        {result && (
          <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 750, margin: 0 }}>
                {result.brand !== "unknown" ? `${result.brand} ` : ""}{result.item_type}
              </h2>
              <span style={{ fontSize: 12.5, color: MUT }}>{result.category} · {result.condition_grade}{result.size !== "unknown" ? ` · ${result.size}` : ""}</span>
            </div>

            {/* price */}
            <div style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: MUT, marginRight: 4 }}>Price</span>
              {([["fast", result.price.fast], ["market", result.price.market], ["high", result.price.high]] as const).map(([k, v]) => (
                <span key={k} style={{ fontSize: 14, fontWeight: 700, color: ACC, background: "rgba(14,138,79,0.08)", border: "1px solid rgba(14,138,79,0.2)", borderRadius: 999, padding: "5px 12px" }}>
                  ${v} <span style={{ fontWeight: 500, color: MUT, fontSize: 11.5 }}>{k}</span>
                </span>
              ))}
              <span style={{ fontSize: 12, color: MUT, marginLeft: "auto" }}>confidence: {result.price.confidence}</span>
            </div>

            {/* titles */}
            <Copyable label="eBay title" value={result.titles.ebay} />
            <Copyable label="Poshmark title" value={result.titles.poshmark} />
            <Copyable label="Depop title" value={result.titles.depop} />
            <Copyable label="Mercari title" value={result.titles.mercari} />
            <Copyable label="Description" value={result.description} />
            <Copyable label="Keywords" value={result.keywords.join(", ")} />
            <Copyable label="Poshmark hashtags" value={result.hashtags.poshmark.map((h) => (h.startsWith("#") ? h : "#" + h)).join(" ")} />
            <Copyable label="Depop hashtags" value={result.hashtags.depop.map((h) => (h.startsWith("#") ? h : "#" + h)).join(" ")} />

            {(result.measurements_to_take.length > 0 || result.visible_flaws.length > 0 || result.condition_notes) && (
              <div style={{ ...card, fontSize: 13.5, color: INK, lineHeight: 1.55 }}>
                {result.condition_notes && <div style={{ marginBottom: 8 }}><b>Condition:</b> {result.condition_notes}</div>}
                {result.visible_flaws.length > 0 && <div style={{ marginBottom: 8, color: "#9A3412" }}><b>Flaws to mention:</b> {result.visible_flaws.join("; ")}</div>}
                {result.measurements_to_take.length > 0 && <div style={{ color: MUT }}><b>Add before posting:</b> {result.measurements_to_take.join("; ")}</div>}
              </div>
            )}

            <button onClick={() => { setResult(null); setPics([]); }} style={{ alignSelf: "center", marginTop: 6, background: "none", border: "none", color: ACC, fontWeight: 650, cursor: "pointer", fontSize: 14 }}>+ List another item</button>
          </div>
        )}
      </div>
    </main>
  );
}
