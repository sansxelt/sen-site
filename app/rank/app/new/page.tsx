"use client";

import { useRef, useState } from "react";
import { signIn } from "next-auth/react";

const CATEGORIES: [string, string][] = [
  ["thumbnail", "Thumbnail"], ["ad", "Ad"], ["logo", "Logo"], ["game_icon", "Game icon"],
  ["app_icon", "App icon"], ["ui", "UI design"], ["product_image", "Product image"],
  ["landing", "Landing page"], ["ai_image", "AI image"], ["brand_name", "Brand name"],
  ["hook", "Text / hook"], ["other", "Other"],
];
const AUDIENCES: [string, string][] = [
  ["general", "General"], ["gamers", "Gamers"], ["creators", "Creators"], ["designers", "Designers"],
  ["gen_z", "Gen Z"], ["shoppers", "Shoppers"], ["entrepreneurs", "Entrepreneurs"],
];

function resize(file: File, max = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale) || 1, h = Math.round(img.height * scale) || 1;
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d"); if (!ctx) { URL.revokeObjectURL(url); return reject(new Error("no ctx")); }
      ctx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

const label = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", display: "block", marginBottom: 8 } as const;
const inputStyle = { width: "100%", padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14.5, fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box" as const };

export default function NewTest() {
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [category, setCategory] = useState("thumbnail");
  const [audience, setAudience] = useState("general");
  const [votes, setVotes] = useState(50);
  const [images, setImages] = useState<string[]>([]);
  const [texts, setTexts] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isText = category === "brand_name" || category === "hook";

  async function addImages(files: FileList) {
    setError("");
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 8 - images.length);
    try { const out = await Promise.all(list.map((f) => resize(f))); setImages((p) => [...p, ...out].slice(0, 8)); }
    catch { setError("Couldn't read an image — try JPG or PNG."); }
  }

  async function submit() {
    setError("");
    const options = isText
      ? texts.map((t) => t.trim()).filter(Boolean).map((t) => ({ label: t }))
      : images.map((a) => ({ asset: a }));
    if (!title.trim()) return setError("Give your test a title.");
    if (options.length < 2) return setError(isText ? "Add at least 2 text options." : "Upload at least 2 images.");
    setBusy(true);
    try {
      const res = await fetch("/api/v/tests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, context, category, audience, votesTarget: votes, options }),
      });
      if (res.status === 401) { signIn("google", { callbackUrl: "/app/new" }); return; }
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) { setError(`Not enough credits — this test needs ${j.needed}. Vote on others' tests to earn more, or top up.`); return; }
      if (res.status === 403 && j.error === "plan_limit") { setError(`You've hit your plan's ${j.limit} active test${j.limit === 1 ? "" : "s"} this month. Upgrade for more.`); return; }
      if (res.status === 413) { setError("One of your images is too large. Try smaller or fewer images."); return; }
      if (!res.ok) { setError("Couldn't launch the test. Try again."); return; }
      window.location.href = `/app/tests/${j.id}/report`;
    } catch { setError("Network error — try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <p className="eyebrow">New test</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 24 }}>What should we test?</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <span style={label}>Title</span>
          <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Which thumbnail for my new video?" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="cols-2">
          <div>
            <span style={label}>Category</span>
            <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <span style={label}>Audience</span>
            <select style={inputStyle} value={audience} onChange={(e) => setAudience(e.target.value)}>
              {AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* options */}
        <div>
          <span style={label}>{isText ? "Text options (2–8)" : "Options (upload 2–8 images)"}</span>
          {isText ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {texts.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <input style={inputStyle} value={t} onChange={(e) => setTexts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                  {texts.length > 2 && <button onClick={() => setTexts((arr) => arr.filter((_, j) => j !== i))} className="btn btn--ghost" style={{ padding: "0 14px" }}>×</button>}
                </div>
              ))}
              {texts.length < 8 && <button onClick={() => setTexts((a) => [...a, ""])} className="btn btn--ghost" style={{ alignSelf: "flex-start" }}>+ Add option</button>}
            </div>
          ) : (
            <>
              <div onClick={() => inputRef.current?.click()} style={{ border: "1.5px dashed var(--line-3)", background: "var(--bg-1)", borderRadius: "var(--r-sm)", padding: "26px 18px", textAlign: "center", cursor: "pointer" }}>
                <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => e.target.files && addImages(e.target.files)} />
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-1)" }}>Drop images or tap to choose</div>
                <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 4 }}>2–8 versions · JPG / PNG</div>
              </div>
              {images.length > 0 && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  {images.map((src, i) => (
                    <div key={i} style={{ position: "relative", width: 84, height: 84, borderRadius: "var(--r-xs)", border: "1px solid var(--line-2)", backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" }}>
                      <button onClick={() => setImages((a) => a.filter((_, j) => j !== i))} aria-label="remove" style={{ position: "absolute", top: -7, right: -7, width: 20, height: 20, borderRadius: "50%", border: "none", background: "var(--fg-1)", color: "var(--bg-1)", fontSize: 12, cursor: "pointer" }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <span style={label}>How many votes? ({votes} credits)</span>
          <input type="range" min={10} max={300} step={10} value={votes} onChange={(e) => setVotes(parseInt(e.target.value, 10))} style={{ width: "100%", accentColor: "var(--acc-deep)" }} />
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", marginTop: 4 }}>1 credit = 1 real human vote. You can close the test early anytime.</div>
        </div>

        <div>
          <span style={label}>Context (optional)</span>
          <input style={inputStyle} value={context} onChange={(e) => setContext(e.target.value)} placeholder="Anything voters should know" />
        </div>

        {error && <p style={{ color: "var(--err)", fontSize: 13.5 }}>{error}</p>}

        <button onClick={submit} disabled={busy} className="btn btn--lg" style={{ justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Launching…" : <>Launch test ({votes} credits) <span aria-hidden>→</span></>}
        </button>
      </div>
    </div>
  );
}
