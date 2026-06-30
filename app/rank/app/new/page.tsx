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
// Evaluation workflows — each prefills the brief (title/question, criteria context),
// the default candidate mode (text vs image), category, a suggested signal target,
// and a one-line description. "AI output evaluation" is the primary/default workflow.
type Workflow = { name: string; desc: string; title: string; category: string; context: string; mode: "text" | "image"; votes: number };
const WORKFLOWS: Workflow[] = [
  { name: "AI output evaluation", desc: "Compare model responses for helpfulness, accuracy, and safety.", title: "Which model response is more helpful, accurate, and safe?", category: "ai_image", context: "Example: compare two support-agent responses for accuracy, clarity, and policy safety.", mode: "text", votes: 100 },
  { name: "Prompt / agent review", desc: "Evaluate whether an agent response follows instructions and completes the task.", title: "Which response better follows the instructions and completes the task?", category: "ai_image", context: "Example: did the agent answer the question, stay on policy, and finish the task?", mode: "text", votes: 100 },
  { name: "Messaging / copy evaluation", desc: "Compare positioning, headlines, or product copy before shipping.", title: "Which version is clearest and most compelling?", category: "hook", context: "Example: which headline explains the product most clearly to a first-time visitor?", mode: "text", votes: 80 },
  { name: "Product concept validation", desc: "Test which product direction is clearest, most useful, or most trusted.", title: "Which product direction is clearest and most useful?", category: "other", context: "Example: which concept do people understand fastest and trust most?", mode: "text", votes: 100 },
  { name: "Creative direction review", desc: "Compare creative candidates using qualified human signal.", title: "Which creative direction should we ship?", category: "ad", context: "Example: which concept best grabs attention for the target audience?", mode: "image", votes: 100 },
  { name: "AI image output", desc: "Pick the strongest generation before you ship it.", title: "Which AI output is best?", category: "ai_image", context: "Which generated result looks the most polished and on-brand?", mode: "image", votes: 50 },
];

// Sample model outputs so a new user can run a real eval without thinking up their own.
// Fills the Response A / Response B text candidates for the "AI output evaluation" flow.
const EXAMPLE_RESPONSES = [
  "Yes, you can cancel anytime. Go to Settings and click Cancel — your plan ends immediately and you won't be charged again. Refunds are issued automatically for any unused time.",
  "Yes — you can cancel anytime from Settings → Billing → Cancel plan. Your access continues until the end of the current billing period, and you won't be charged again after that. We don't auto-refund unused time, but reach out if your situation is unusual and we'll take a look.",
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
  const [workflow, setWorkflow] = useState(0);
  const [title, setTitle] = useState(WORKFLOWS[0].title);
  const [context, setContext] = useState("");
  const [category, setCategory] = useState(WORKFLOWS[0].category);
  const [mode, setMode] = useState<"text" | "image">(WORKFLOWS[0].mode);
  const [audience, setAudience] = useState("general");
  const [votes, setVotes] = useState(WORKFLOWS[0].votes);
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
      // Cap the target by BOTH the plan max AND the user's balance, so a Free user with
      // 25 credits doesn't land on an unlaunchable 100. Server floor is MIN_VOTES (10).
      const cap = j.signedIn && (j.balance ?? 0) > 0 ? Math.min(j.maxVotes ?? 100, j.balance) : (j.maxVotes ?? 100);
      setVotes((v) => Math.max(10, Math.min(v, cap)));
    }).catch(() => {});
    fetch("/api/v/projects").then((r) => r.json()).then((j) => setProjects(j.projects || [])).catch(() => {});
    try {
      const pre = new URLSearchParams(window.location.search).get("project");
      if (pre) setProjectId(pre);
    } catch { /* ignore */ }
  }, []);

  const isText = mode === "text";
  const maxOptions = ctx.maxOptions ?? 8;
  const maxVotes = ctx.maxVotes ?? 100;
  const balance = ctx.balance ?? 0;
  // The target ceiling respects the user's balance too: a signed-in user with credits can't
  // be asked for more judgments than they can pay for. Floored at MIN_VOTES (10) so the
  // slider is always usable. Signed-out (pre-context) falls back to the plan max.
  const effectiveMax = Math.max(10, ctx.signedIn && balance > 0 ? Math.min(maxVotes, balance) : maxVotes);
  const activeCap = ctx.activeTestsPerMonth ?? 1;
  const activeUsed = ctx.activeTests ?? 0;
  const planName = ctx.plan ? ctx.plan.charAt(0).toUpperCase() + ctx.plan.slice(1) : "Free";

  const optionCount = isText ? texts.map((t) => t.trim()).filter(Boolean).length : assets.length;
  const overVotes = votes > maxVotes;
  const atTestCap = ctx.signedIn && activeUsed >= activeCap;
  const lowCredits = ctx.signedIn && votes > balance;
  const ready = !!title.trim() && optionCount >= 2 && !overVotes && !atTestCap && !lowCredits;

  const status: { t: string; tone: "ok" | "warn" | "bad"; cta?: { label: string; href: string } } =
    !title.trim() ? { t: "Add an evaluation name", tone: "warn" }
    : optionCount < 2 ? { t: `Add ${2 - optionCount} more candidate${2 - optionCount === 1 ? "" : "s"}`, tone: "warn" }
    : overVotes ? { t: `Over your plan's ${maxVotes}-judgment cap`, tone: "bad", cta: { label: "Upgrade", href: "/app/plans" } }
    : atTestCap ? { t: `You've used your ${activeCap} run${activeCap === 1 ? "" : "s"} this month`, tone: "bad", cta: { label: "Upgrade", href: "/app/plans" } }
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
    if (!title.trim()) return setError("Add an evaluation name or question.");
    if (options.length < 2) return setError(isText ? "Add at least 2 candidate outputs." : "Add at least 2 candidate images.");
    setBusy(true);
    try {
      const res = await fetch("/api/v/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, context, category, audience, votesTarget: votes, options, projectId: projectId || undefined, targetAudience: targetAudience || undefined }) });
      if (res.status === 401) { signIn("google", { callbackUrl: "/app/new" }); return; }
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) { setError(`Not enough credits. This evaluation needs ${j.needed}. Earn credits by giving feedback in other evaluations, or top up.`); return; }
      if (res.status === 403 && j.error === "plan_limit") { setError(`You've used your plan's ${j.limit} run${j.limit === 1 ? "" : "s"} this month (completed runs count too). Upgrade to run more.`); return; }
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
          <p className="eyebrow">New evaluation run</p>
          <h1 className="display">Configure an AI evaluation workflow</h1>
          <p>Submit model outputs, prompts, creative candidates, or product directions. Vraelis collects quality-filtered human judgment and returns a structured Decision Package.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="stat" style={{ padding: "12px 18px" }}><div className="stat__l">Plan</div><div className="stat__v" style={{ fontSize: 18 }}>{planName}</div></div>
          <div className="stat" style={{ padding: "12px 18px" }}><div className="stat__l">Credits</div><div className="stat__v tnum" style={{ fontSize: 18 }}>{balance.toLocaleString()}</div></div>
        </div>
      </div>

      {/* Workflow selector — pick the kind of evaluation run */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Choose a workflow</div>
        <div className="tile-grid cols-3">
          {WORKFLOWS.map((w, i) => {
            const sel = workflow === i;
            return (
              <button
                key={w.name}
                onClick={() => { setWorkflow(i); setTitle(w.title); setCategory(w.category); setContext(w.context); setMode(w.mode); setVotes(Math.min(w.votes, maxVotes)); }}
                style={{ textAlign: "left", cursor: "pointer", padding: "14px 16px", borderRadius: "var(--r-md)", border: `1.5px solid ${sel ? "var(--acc)" : "var(--line-2)"}`, background: sel ? "var(--acc-soft)" : "var(--bg-1)", display: "flex", flexDirection: "column", gap: 5, transition: "border-color .15s, background .15s" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>{w.name}</span>
                  {sel ? <span style={{ width: 16, height: 16, flex: "none", borderRadius: "50%", background: "var(--acc)", color: "#fff", display: "grid", placeItems: "center", fontSize: 10 }}>✓</span> : null}
                </div>
                <span style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5 }}>{w.desc}</span>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 9.5, letterSpacing: "0.05em", textTransform: "uppercase", color: sel ? "var(--acc-deep)" : "var(--fg-5)", marginTop: 2 }}>{w.mode === "text" ? "Text candidates" : "Image candidates"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: "clamp(20px, 3vw, 40px)", alignItems: "start" }} className="cols-stack">
        {/* ── form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Step 1 — the brief */}
          <section>
            <Step n={1} title="Define the evaluation brief" hint="What you want judged, and the criteria judges should apply." />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><span style={lab}>Evaluation name / question</span><input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Which model response is more helpful, accurate, and safe?" /></div>
              <div className="cols-2" style={{ display: "grid", gap: 14 }}>
                <div><span style={lab}>Type</span><select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div><span style={lab}>Audience</span><select style={inputStyle} value={audience} onChange={(e) => setAudience(e.target.value)}>{AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              </div>
              <div><span style={lab}>Judgment criteria (optional)</span><input style={inputStyle} value={context} onChange={(e) => setContext(e.target.value)} placeholder="Example: compare two support-agent responses for accuracy, clarity, and policy safety." /></div>
              <div><span style={lab}>Target audience (optional)</span><input style={inputStyle} value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="Example: B2B SaaS users, developers, customer-support leads, or general consumers." maxLength={200} /><div style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: 6 }}>Define who you want the signal from. Add screening questions on the report to filter unqualified responses.</div></div>
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

          {/* Step 2 — candidate outputs */}
          <section>
            <Step n={2} title="Add candidate outputs" hint={`2–${maxOptions} candidates. Judges compare these side by side.`} />
            {/* candidate-type segmented control — text first */}
            <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: "var(--r-sm)", background: "var(--bg-2)", border: "1px solid var(--line-2)", marginBottom: 14 }}>
              {([["text", "Text outputs"], ["image", "Images / creative"]] as ["text" | "image", string][]).map(([m, label]) => (
                <button key={m} type="button" onClick={() => setMode(m)} style={{ cursor: "pointer", padding: "6px 14px", borderRadius: "calc(var(--r-sm) - 3px)", border: "none", fontSize: 13, fontWeight: 600, background: mode === m ? "var(--bg-1)" : "transparent", color: mode === m ? "var(--fg-1)" : "var(--fg-4)", boxShadow: mode === m ? "var(--shadow-sm)" : "none" }}>{label}</button>
              ))}
            </div>
            {isText ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {texts.map((t, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>Response {optLetter(i)}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: t.length > 600 ? "var(--err)" : "var(--fg-5)" }}>{t.length}/600</span>
                        {texts.length > 2 && <button onClick={() => setTexts((arr) => arr.filter((_, j) => j !== i))} className="btn btn--ghost" style={{ padding: "2px 10px", fontSize: 12 }}>Remove</button>}
                      </span>
                    </div>
                    <textarea style={{ ...inputStyle, minHeight: 84, resize: "vertical", lineHeight: 1.5 }} value={t} maxLength={600} onChange={(e) => setTexts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} placeholder={i === 0 ? "Paste model response A…" : i === 1 ? "Paste model response B…" : `Paste candidate ${optLetter(i)}…`} />
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {texts.length < maxOptions && <button onClick={() => setTexts((a) => [...a, ""])} className="btn btn--ghost" style={{ alignSelf: "flex-start" }}>+ Add candidate</button>}
                  <button onClick={() => { setTexts([EXAMPLE_RESPONSES[0], EXAMPLE_RESPONSES[1]]); if (!title.trim()) setTitle("Which model response is more helpful, accurate, and safe?"); if (!context.trim()) setContext("Example: compare two support-agent responses for accuracy, clarity, and policy safety."); }} className="btn btn--ghost" style={{ alignSelf: "flex-start" }}>Use example AI responses</button>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--fg-5)", lineHeight: 1.5 }}>Candidates are concise text — model responses, prompts, or copy, up to 600 characters each. New here? Tap <strong style={{ color: "var(--fg-3)" }}>Use example AI responses</strong> to try a real eval in seconds. For longer artifacts, link to them or use the images / creative tab.</div>
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
                  <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 4 }}>2 to {maxOptions} candidates. JPG or PNG. Max {MAX_FILE_MB}MB each</div>
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
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: optionCount >= 2 ? "var(--acc-deep)" : "var(--fg-4)", marginTop: 10 }}>{optionCount} / {maxOptions} candidates{optionCount < 2 ? " (need at least 2)" : " ✓"}</div>
              </>
            )}
          </section>

          {/* Step 3 — signal target */}
          <section>
            <Step n={3} title="Set signal target" hint="How many qualified human judgments to collect." />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {(() => {
                // Presets are capped by effectiveMax (plan AND balance). A low-balance user
                // gets a "Starter check" at their ceiling so the free 25 credits are usable.
                const raw: [string, number][] = [["Starter check", Math.min(25, effectiveMax)], ["Quick signal check", 50], ["Balanced evaluation", 150], ["High-confidence evaluation", 500]];
                const seen = new Set<number>();
                const presets = raw.map(([label, v]) => [label, Math.min(v, effectiveMax)] as [string, number]).filter(([, t]) => t >= 10 && !seen.has(t) && (seen.add(t), true));
                return presets.map(([label, target]) => (
                  <button key={label} type="button" onClick={() => setVotes(target)} className="chip" style={{ cursor: "pointer", ...(votes === target ? { borderColor: "var(--acc)", color: "var(--acc-deep)" } : {}) }}>{label} <span style={{ color: "var(--fg-5)" }}>({target})</span></button>
                ));
              })()}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>{votes} <span style={{ fontSize: 14, color: "var(--fg-4)", fontWeight: 500 }}>qualified judgments</span></span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>= {votes} credits</span>
            </div>
            <input type="range" min={10} max={effectiveMax} step={Math.min(10, effectiveMax)} value={Math.min(votes, effectiveMax)} onChange={(e) => setVotes(parseInt(e.target.value, 10))} style={{ width: "100%", accentColor: "var(--acc-deep)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)" }}>1 qualified judgment = 1 credit</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)" }}>{ctx.signedIn && balance < maxVotes ? <>Your balance {balance.toLocaleString()}. <a href="/app/credits" style={{ color: "var(--acc-deep)" }}>Add credits</a></> : <>Plan max {maxVotes.toLocaleString()}. <a href="/app/plans" style={{ color: "var(--acc-deep)" }}>Upgrade</a></>}</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 8, lineHeight: 1.5 }}>Higher targets improve confidence and readiness — a starter check (10–25) is directional only (good for a first run, not high-confidence), ~50 for a gut read, ~150 for most evaluations, 500+ before a big call. Vraelis tells you whether the signal is <strong style={{ color: "var(--fg-3)" }}>ready to act on</strong>, not just which candidate is leading. You&apos;re only charged for judgments that pass quality filtering, and unused credits are refunded.</p>
          </section>
        </div>

        {/* ── sticky launch summary (desktop) ── */}
        <div className="sticky-side" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Evaluation run summary</div>
            {[["Workflow", WORKFLOWS[workflow].name], ["Signal target", `${votes}`], ["Credits required", `${votes}`], ["Your balance", balance.toLocaleString()], ["Balance after", Math.max(0, balance - votes).toLocaleString()], ["Runs this month", `${activeUsed} / ${activeCap}`]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}><span style={{ color: "var(--fg-4)" }}>{k}</span><span style={{ color: "var(--fg-1)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{v}</span></div>
            ))}
            <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: toneColor }}>{status.tone === "ok" ? "✓ " : "• "}{status.t}</span>
              {status.cta && <a href={status.cta.href} className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>{status.cta.label}</a>}
            </div>
            {atTestCap && <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: 0, lineHeight: 1.5 }}>This is a monthly run limit — it resets at the start of next month. Completed and closed runs still count, so finishing your current run won&apos;t free up a slot. <a href="/app/plans" style={{ color: "var(--acc-deep)" }}>Upgrade</a> to run more now.</p>}
            <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Output: Decision Package</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["Recommendation", "Preference margin", "Signal quality", "Readiness", "Filtered-response summary"].map((x) => (
                  <span key={x} style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 999, background: "var(--bg-2)", border: "1px solid var(--line-2)", color: "var(--fg-3)" }}>{x}</span>
                ))}
              </div>
            </div>
            {error && <p style={{ color: "var(--err)", fontSize: 13 }}>{error}</p>}
            <button onClick={submit} disabled={busy || uploading > 0 || !ready} className="btn btn--lg" style={{ justifyContent: "center", opacity: busy || uploading > 0 || !ready ? 0.55 : 1 }}>
              {busy ? "Launching…" : uploading > 0 ? "Uploading…" : <>Launch evaluation run, {votes} credits</>}
            </button>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", lineHeight: 1.6 }}>
              Credits held in escrow → real people judge → low-quality filtered → unused credits refunded → Decision Package generated.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "0 4px" }}>
            {["Low-quality and gamed responses are filtered. Only qualified judgments count.", "You're only charged for judgments that pass quality filtering.", "Collect more signal anytime by sharing or embedding the run."].map((x) => (
              <div key={x} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--fg-4)" }}><span style={{ color: "var(--acc)" }}>✓</span>{x}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
