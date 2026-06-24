"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

const CATEGORIES: [string, string][] = [
  ["ad", "Ad creative"], ["landing", "Landing page hero"], ["ai_image", "AI image / output"],
  ["product_image", "Product image"], ["ui", "UI / screen"], ["logo", "Logo"],
  ["thumbnail", "Thumbnail"], ["app_icon", "App icon"], ["game_icon", "Game icon"],
  ["brand_name", "Brand name"], ["hook", "Copy / hook"], ["other", "Other"],
];
const AUDIENCES: [string, string][] = [
  ["general", "General"], ["gamers", "Gamers"], ["creators", "Creators"], ["designers", "Designers"],
  ["gen_z", "Gen Z"], ["shoppers", "Shoppers"], ["entrepreneurs", "Entrepreneurs"],
];
// Real evaluation types — each prefills the title/question, category, a suggested
// judgment target, and a hover helper. Compact on purpose.
const TEMPLATES: { name: string; title: string; category: string; context: string; votes: number; helper: string }[] = [
  { name: "Ad creative", title: "Which ad creative should we ship?", category: "ad", context: "Which grabs attention and makes you want to click?", votes: 100, helper: "2–4 creatives, ~100 judgments before you spend on ads." },
  { name: "Landing hero", title: "Which landing hero should ship?", category: "landing", context: "Which hero best explains the product at a glance?", votes: 100, helper: "Compare 2–3 hero concepts before a redesign." },
  { name: "AI image output", title: "Which AI output is best?", category: "ai_image", context: "Which generated result looks the most polished and on-brand?", votes: 50, helper: "Pick the strongest generation before you ship it." },
  { name: "Product image", title: "Which product image should we use?", category: "product_image", context: "Which makes you most likely to buy?", votes: 80, helper: "Choose the listing image most likely to convert." },
  { name: "Copy / headline", title: "Which headline is clearest?", category: "hook", context: "Which line is clearest and most compelling?", votes: 60, helper: "Text options — add each headline as a candidate." },
  { name: "App / game icon", title: "Which icon would you tap?", category: "app_icon", context: "Which icon stands out and feels trustworthy on a busy screen?", votes: 80, helper: "Icons fight for attention — test 2–4." },
  { name: "Client creative decision", title: "Which option should we present to the client?", category: "other", context: "Which is the strongest creative direction?", votes: 100, helper: "Back your recommendation with human signal." },
  { name: "General creative", title: "Which option should we ship?", category: "other", context: "Which do you prefer, and why?", votes: 50, helper: "Any creative or AI output — 2 to 8 candidates." },
];

const MAX_FILE_MB = 15;

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

const lab = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", display: "block", marginBottom: 8 } as const;
const inputStyle = { width: "100%", padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14.5, fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box" as const };

function Step({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--acc-soft)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, flex: "none" }}>{n}</span>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--fg-1)", lineHeight: 1.1 }}>{title}</div>
        {hint && <div style={{ fontSize: 12.5, color: "var(--fg-4)" }}>{hint}</div>}
      </div>
    </div>
  );
}

type Ctx = { signedIn: boolean; plan?: string; balance?: number; activeTests?: number; maxOptions?: number; maxVotes?: number; activeTestsPerMonth?: number };

export default function NewTest() {
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [category, setCategory] = useState("ad");
  const [audience, setAudience] = useState("general");
  const [votes, setVotes] = useState(50);
  const [assets, setAssets] = useState<{ url: string; path: string | null }[]>([]);
  const [uploading, setUploading] = useState(0);
  const [texts, setTexts] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [ctx, setCtx] = useState<Ctx>({ signedIn: false });
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/v/launch-context").then((r) => r.json()).then((j) => {
      setCtx(j);
      if (j.maxVotes) setVotes((v) => Math.min(v, j.maxVotes));
    }).catch(() => {});
    fetch("/api/v/projects").then((r) => r.json()).then((j) => setProjects(j.projects || [])).catch(() => {});
    try {
      const pre = new URLSearchParams(window.location.search).get("project");
      if (pre) setProjectId(pre);
    } catch { /* ignore */ }
  }, []);

  const isText = category === "brand_name" || category === "hook";
  const maxOptions = ctx.maxOptions ?? 8;
  const maxVotes = ctx.maxVotes ?? 100;
  const balance = ctx.balance ?? 0;
  const activeCap = ctx.activeTestsPerMonth ?? 1;
  const activeUsed = ctx.activeTests ?? 0;
  const planName = ctx.plan ? ctx.plan.charAt(0).toUpperCase() + ctx.plan.slice(1) : "Free";

  const optionCount = isText ? texts.map((t) => t.trim()).filter(Boolean).length : assets.length;
  const overVotes = votes > maxVotes;
  const atTestCap = ctx.signedIn && activeUsed >= activeCap;
  const lowCredits = ctx.signedIn && votes > balance;
  const ready = !!title.trim() && optionCount >= 2 && !overVotes && !atTestCap && !lowCredits;

  const status: { t: string; tone: "ok" | "warn" | "bad"; cta?: { label: string; href: string } } =
    !title.trim() ? { t: "Add a title", tone: "warn" }
    : optionCount < 2 ? { t: `Add ${2 - optionCount} more option${2 - optionCount === 1 ? "" : "s"}`, tone: "warn" }
    : overVotes ? { t: `Over your plan's ${maxVotes}-judgment cap`, tone: "bad", cta: { label: "Upgrade", href: "/app/plans" } }
    : atTestCap ? { t: `Plan limit: ${activeCap} active evaluation${activeCap === 1 ? "" : "s"}/mo`, tone: "bad", cta: { label: "Upgrade", href: "/app/plans" } }
    : lowCredits ? { t: `Need ${votes - balance} more credits`, tone: "bad", cta: { label: "Buy credits", href: "/app/credits" } }
    : { t: "Ready to launch", tone: "ok" };
  const toneColor = status.tone === "ok" ? "var(--acc-deep)" : status.tone === "warn" ? "var(--money)" : "var(--err)";

  async function addImages(files: FileList) {
    setError("");
    const arr = Array.from(files);
    if (arr.some((f) => !f.type.startsWith("image/"))) { setError("Unsupported file. Use JPG or PNG images."); return; }
    if (arr.some((f) => f.size > MAX_FILE_MB * 1024 * 1024)) { setError(`Image too large. Keep each under ${MAX_FILE_MB}MB.`); return; }
    const list = arr.slice(0, Math.max(0, maxOptions - assets.length));
    if (!list.length) return;
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const dataUrl = await resize(f);
        const r = await fetch("/api/v/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
        const j = await r.json().catch(() => ({}));
        if (r.status === 413) setError("That image is too large. Try a smaller one.");
        else if (j.url) setAssets((p) => (p.length < maxOptions ? [...p, { url: j.url as string, path: (j.path as string) ?? null }] : p));
        else setError("Couldn't upload an image. Try again.");
      } catch { setError("Couldn't read an image. Try JPG or PNG."); }
      finally { setUploading((n) => Math.max(0, n - 1)); }
    }
  }

  function removeAsset(i: number) {
    const a = assets[i];
    setAssets((p) => p.filter((_, j) => j !== i));
    if (a?.path) fetch(`/api/v/upload?path=${encodeURIComponent(a.path)}`, { method: "DELETE" }).catch(() => {});
  }

  async function submit() {
    setError("");
    const options = isText ? texts.map((t) => t.trim()).filter(Boolean).map((t) => ({ label: t })) : assets.map((a) => ({ asset: a.url, path: a.path ?? undefined }));
    if (!title.trim()) return setError("Give your evaluation a title.");
    if (options.length < 2) return setError(isText ? "Add at least 2 text options." : "Upload at least 2 images.");
    setBusy(true);
    try {
      const res = await fetch("/api/v/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, context, category, audience, votesTarget: votes, options, projectId: projectId || undefined, targetAudience: targetAudience || undefined }) });
      if (res.status === 401) { signIn("google", { callbackUrl: "/app/new" }); return; }
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) { setError(`Not enough credits. This evaluation needs ${j.needed}. Earn credits by giving feedback in other evaluations, or top up.`); return; }
      if (res.status === 403 && j.error === "plan_limit") { setError(`You've hit your plan's ${j.limit} active evaluation${j.limit === 1 ? "" : "s"} this month. Upgrade for more.`); return; }
      if (res.status === 413) { setError("One of your images is too large. Try smaller or fewer images."); return; }
      if (!res.ok) { setError("Couldn't launch the evaluation. Try again."); return; }
      window.location.href = `/app/tests/${j.id}/report?launched=1`;
    } catch { setError("Network error. Try again."); }
    finally { setBusy(false); }
  }

  const optLetter = (i: number) => String.fromCharCode(65 + i);

  return (
    <div className="wrap" style={{ maxWidth: 1040, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 100 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">New evaluation</p>
          <h1 className="display">What decision are you making?</h1>
          <p>Submit your candidates — images, AI outputs, copy, UI — collect qualified human signal, and get a decision package: the recommended option, confidence, signal quality, and what to do next.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="stat" style={{ padding: "12px 18px" }}><div className="stat__l">Plan</div><div className="stat__v" style={{ fontSize: 18 }}>{planName}</div></div>
          <div className="stat" style={{ padding: "12px 18px" }}><div className="stat__l">Credits</div><div className="stat__v tnum" style={{ fontSize: 18 }}>{balance.toLocaleString()}</div></div>
        </div>
      </div>

      <div style={{ marginBottom: 26 }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>Start from a template <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--fg-5)" }}>(optional)</span></div>
        <div className="chips">
          {TEMPLATES.map((t) => (
            <button key={t.name} title={t.helper} onClick={() => { setTitle(t.title); setCategory(t.category); setContext(t.context); setVotes(Math.min(t.votes, maxVotes)); }} className="chip" style={{ cursor: "pointer" }}>{t.name}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: "clamp(20px, 3vw, 40px)", alignItems: "start" }} className="cols-stack">
        {/* ── form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Step 1 */}
          <section>
            <Step n={1} title="What you're evaluating" hint="The decision you want made, and what judges should know." />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><span style={lab}>Title</span><input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Which landing hero should we ship?" /></div>
              <div className="cols-2" style={{ display: "grid", gap: 14 }}>
                <div><span style={lab}>Type</span><select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div><span style={lab}>Audience</span><select style={inputStyle} value={audience} onChange={(e) => setAudience(e.target.value)}>{AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              </div>
              <div><span style={lab}>Context for judges (optional)</span><input style={inputStyle} value={context} onChange={(e) => setContext(e.target.value)} placeholder="e.g. for a B2B SaaS landing page. Which is clearest at a glance?" /></div>
              <div><span style={lab}>Target audience (optional)</span><input style={inputStyle} value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="Who is this signal for? e.g. Mobile gamers choosing an app icon" maxLength={200} /><div style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: 6 }}>Define who you want the signal from. Add screening questions on the report to filter unqualified responses.</div></div>
              <div>
                <span style={lab}>Project (optional)</span>
                <select style={inputStyle} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">No project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: 6 }}>Group this evaluation with related ones. <a href="/app/projects" style={{ color: "var(--acc-deep)" }}>Manage projects →</a></div>
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section>
            <Step n={2} title={isText ? "Your candidates" : "Submit candidates"} hint={`${isText ? "Add" : "Upload"} 2–${maxOptions}. Judges see these side by side.`} />
            {isText ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {texts.map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ width: 24, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>{optLetter(i)}</span>
                    <input style={inputStyle} value={t} onChange={(e) => setTexts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${optLetter(i)}`} />
                    {texts.length > 2 && <button onClick={() => setTexts((arr) => arr.filter((_, j) => j !== i))} className="btn btn--ghost" style={{ padding: "0 14px" }}>×</button>}
                  </div>
                ))}
                {texts.length < maxOptions && <button onClick={() => setTexts((a) => [...a, ""])} className="btn btn--ghost" style={{ alignSelf: "flex-start" }}>+ Add option</button>}
              </div>
            ) : (
              <>
                <div
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) addImages(e.dataTransfer.files); }}
                  style={{ border: `1.5px dashed ${drag ? "var(--acc)" : "var(--line-3)"}`, background: drag ? "var(--acc-soft)" : "var(--bg-1)", borderRadius: "var(--r-sm)", padding: "28px 18px", textAlign: "center", cursor: "pointer", transition: "border-color .15s, background .15s" }}
                >
                  <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => e.target.files && addImages(e.target.files)} />
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-1)" }}>Drop images here or tap to choose</div>
                  <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 4 }}>2 to {maxOptions} options. JPG or PNG. Max {MAX_FILE_MB}MB each</div>
                </div>
                {(assets.length > 0 || uploading > 0) && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 10, marginTop: 14 }}>
                    {assets.map((a, i) => (
                      <div key={a.url} style={{ position: "relative", aspectRatio: "1/1", borderRadius: 10, border: "1px solid var(--line-2)", backgroundImage: `url(${a.url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
                        <span style={{ position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>{optLetter(i)}</span>
                        <button onClick={() => removeAsset(i)} aria-label="remove" style={{ position: "absolute", top: -7, right: -7, width: 22, height: 22, borderRadius: "50%", border: "none", background: "var(--fg-1)", color: "var(--bg-1)", fontSize: 13, cursor: "pointer" }}>×</button>
                      </div>
                    ))}
                    {Array.from({ length: uploading }).map((_, i) => (
                      <div key={`up-${i}`} style={{ aspectRatio: "1/1", borderRadius: 10, border: "1px dashed var(--line-3)", display: "grid", placeItems: "center", color: "var(--fg-4)", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>Uploading…</div>
                    ))}
                  </div>
                )}
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: optionCount >= 2 ? "var(--acc-deep)" : "var(--fg-4)", marginTop: 10 }}>{optionCount} / {maxOptions} options{optionCount < 2 ? " (need at least 2)" : " ✓"}</div>
              </>
            )}
          </section>

          {/* Step 3 */}
          <section>
            <Step n={3} title="Audience & judgment target" hint="How many valid human judgments to collect." />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {([["Quick read", 50], ["Balanced", 150], ["Strong signal", 500]] as [string, number][]).map(([label, v]) => {
                const target = Math.min(v, maxVotes);
                return <button key={label} type="button" onClick={() => setVotes(target)} className="chip" style={{ cursor: "pointer", ...(votes === target ? { borderColor: "var(--acc)", color: "var(--acc-deep)" } : {}) }}>{label}</button>;
              })}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>{votes} <span style={{ fontSize: 14, color: "var(--fg-4)", fontWeight: 500 }}>judgments</span></span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>= {votes} credits</span>
            </div>
            <input type="range" min={10} max={maxVotes} step={10} value={Math.min(votes, maxVotes)} onChange={(e) => setVotes(parseInt(e.target.value, 10))} style={{ width: "100%", accentColor: "var(--acc-deep)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)" }}>1 judgment = 1 credit</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)" }}>Plan max {maxVotes.toLocaleString()}. <a href="/app/plans" style={{ color: "var(--acc-deep)" }}>Upgrade</a></span>
            </div>
            <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 8, lineHeight: 1.5 }}>Higher judgment targets create stronger decision confidence — a quick read (~50) for a gut-check, balanced (~150) for most decisions, strong signal (500+) before a big spend.</p>
          </section>
        </div>

        {/* ── sticky launch summary (desktop) ── */}
        <div className="sticky-side" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Launch summary</div>
            {[["Judgment target", `${votes}`], ["Credits required", `${votes}`], ["Your balance", balance.toLocaleString()], ["Balance after", Math.max(0, balance - votes).toLocaleString()], ["Active", `${activeUsed} / ${activeCap}`]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}><span style={{ color: "var(--fg-4)" }}>{k}</span><span style={{ color: "var(--fg-1)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{v}</span></div>
            ))}
            <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: toneColor }}>{status.tone === "ok" ? "✓ " : "• "}{status.t}</span>
              {status.cta && <a href={status.cta.href} className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>{status.cta.label}</a>}
            </div>
            {error && <p style={{ color: "var(--err)", fontSize: 13 }}>{error}</p>}
            <button onClick={submit} disabled={busy || uploading > 0 || !ready} className="btn btn--lg" style={{ justifyContent: "center", opacity: busy || uploading > 0 || !ready ? 0.55 : 1 }}>
              {busy ? "Launching…" : uploading > 0 ? "Uploading…" : <>Launch evaluation, {votes} credits</>}
            </button>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", lineHeight: 1.6 }}>
              Credits held in escrow → real people judge → low-quality filtered → unused credits refunded → decision report generated.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "0 4px" }}>
            {["Low-quality responses are filtered. Only valid judgments count.", "Unused credits are refunded when the evaluation completes.", "Embed an active evaluation anywhere to collect more judgments."].map((x) => (
              <div key={x} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--fg-4)" }}><span style={{ color: "var(--acc)" }}>✓</span>{x}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
