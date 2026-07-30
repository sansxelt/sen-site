"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mark, ComingLater } from "../_connections/brand";
import { GithubForm, TwoFieldForm, input, lab, help, type Conn } from "../_connections/forms";

// The production-context onboarding workspace. Vraelis assembles a context graph around the application:
// product intent -> source -> deployment -> data/auth -> billing/services -> test boundaries. Three honest
// connection states only: fields on the page (available), MANUAL connection cards (structured metadata the
// owner enters; validated, stored non-secret), and COMING LATER chips (never rendered as working buttons).
// Test-account credentials are the single secret: held in memory, POSTed to the sealed secrets route AFTER
// the app is created, masked everywhere, and deliberately EXCLUDED from the local draft.
//
// Submit: POST /api/preflight/apps (identity + connections + context + boundaries, all non-secret) ->
// POST /api/preflight/apps/:id/secrets per test account -> navigate to the application.

// input / lab / help styles + the manual metadata forms now live in ../_connections/forms (shared with
// the connection management page); the brand marks + coming-later chips in ../_connections/brand.
const secH = { fontFamily: "var(--font-display)", fontWeight: 600 as const, fontSize: 17, color: "var(--fg-1)", margin: 0 };
const secSub = { fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "4px 0 0" };

const BUILDERS: [string, string][] = [
  ["", "Select a builder (optional)"], ["lovable", "Lovable"], ["bolt", "Bolt"], ["replit", "Replit"],
  ["v0", "v0"], ["cursor", "Cursor"], ["claude_code", "Claude Code"], ["windsurf", "Windsurf"], ["other", "Custom / other"],
];
const ROLE_PRESETS = ["Standard user", "Admin user", "New user", "Paid user", "Custom role"];
const DRAFT_KEY = "vraelis-connect-draft-v1";

type TestAccount = { label: string; username: string; password: string; scope: string };
// added: client-side timestamp for the honest "Added just now / Xm ago" line on source cards. Stripped
// before submit (the server stamps its own added_at) and tolerated as absent on old restored drafts.
type Source = { kind: string; name: string; content: string; added?: number };

function friendlyError(code: unknown): string {
  switch (code) {
    case "name_and_url_required": return "Add both a system name and its URL.";
    case "ownership_required": return "Confirm you own or are authorized to test this app.";
    case "invalid_url": return "Enter a public https URL for the deployed app.";
    case "application_limit": return "You've reached your plan's system limit. Delete a system from its Settings, or upgrade your plan, then try again.";
    case "unavailable": return "Preflight isn't available right now. Try again in a moment.";
    default: return "Something went wrong. Try again.";
  }
}

function hostnameOf(url: string): string {
  try { return new URL(url.trim()).hostname; } catch { return ""; }
}
function guessEnvironment(host: string): string {
  if (!host) return "";
  if (/-git-|\.vercel\.app$|preview|\.netlify\.app$/.test(host) && !/^www\./.test(host)) return "preview";
  return "production";
}

function Badge({ kind }: { kind: "required" | "recommended" | "optional" }) {
  const c = kind === "required" ? { color: "var(--stop-ink)", bg: "var(--stop-wash)", bd: "var(--stop-line)" }
    : kind === "recommended" ? { color: "var(--acc-deep)", bg: "var(--acc-soft)", bd: "var(--acc-line)" }
    : { color: "var(--fg-4)", bg: "var(--bg-2)", bd: "var(--line-2)" };
  return <span className="pill" style={{ fontSize: 9.5, color: c.color, background: c.bg, borderColor: c.bd }}>{kind}</span>;
}

// A manual-connection card: monogram + purpose + status, expanding to its metadata form. Connected state
// shows a summary line + Configure/Disconnect. No card ever pretends OAuth exists.
function ConnCard({ mark, title, purpose, badge, connected, summary, open, onToggle, onDisconnect, children }: {
  mark: string; title: string; purpose: string; badge: "required" | "recommended" | "optional";
  connected: boolean; summary?: string; open: boolean; onToggle: () => void; onDisconnect?: () => void; children?: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, borderColor: connected ? "var(--acc-line)" : "var(--line-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Mark text={mark} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>{title}</span>
            <Badge kind={badge} />
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 2, lineHeight: 1.45 }}>{connected && summary ? summary : purpose}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          {connected && onDisconnect ? (
            <button type="button" className="btn btn--ghost" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={onDisconnect}>Disconnect</button>
          ) : null}
          <button type="button" className={connected ? "btn btn--ghost" : "btn"} style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={onToggle} aria-expanded={open}>
            {connected ? "Configure" : "Connect"}
          </button>
        </div>
      </div>
      {open ? <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 14, display: "grid", gap: 12 }}>{children}</div> : null}
    </div>
  );
}

function Section({ n, title, sub, children }: { n: number; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} style={{ borderTop: "1px solid var(--line-1)", paddingTop: 22, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)", flex: "none" }}>{String(n).padStart(2, "0")}</span>
        <div><h2 style={secH}>{title}</h2><p style={secSub}>{sub}</p></div>
      </div>
      {children}
    </section>
  );
}

export default function ConnectWorkspace() {
  const router = useRouter();
  // Section 1: identity
  const [appUrl, setAppUrl] = useState(""); const [name, setName] = useState("");
  const [environment, setEnvironment] = useState(""); const [builder, setBuilder] = useState("");
  const [prompt, setPrompt] = useState("");
  // Section 3 primary field: the short product summary (state + draft key keep the historical name
  // "productDesc" so drafts saved before the redesign restore into the new field).
  const [productDesc, setProductDesc] = useState("");
  // Section 2/4/5: manual connections (null = not connected)
  const [github, setGithub] = useState<Conn | null>(null);
  const [vercel, setVercel] = useState<Conn | null>(null);
  const [customDeploy, setCustomDeploy] = useState<Conn | null>(null);
  const [supabase, setSupabase] = useState<Conn | null>(null);
  const [customAuth, setCustomAuth] = useState<Conn | null>(null);
  const [stripeTest, setStripeTest] = useState<Conn | null>(null);
  const [sentry, setSentry] = useState<Conn | null>(null);
  const [webhooks, setWebhooks] = useState<string[]>([]);
  // Section 3: product definition sources
  const [sources, setSources] = useState<Source[]>([]);
  // Section 4: test accounts (credentials NEVER enter the draft; memory only until sealed server-side)
  const [accounts, setAccounts] = useState<TestAccount[]>([]);
  // Section 6: boundaries (conservative defaults: everything off)
  const [own, setOwn] = useState(false);
  const [domains, setDomains] = useState("");
  const [permits, setPermits] = useState({ account_creation: false, db_writes: false, email: false, test_purchases: false, file_upload: false });

  const [openCard, setOpenCard] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  // Set once the application row exists: submit becomes retry-only (never a duplicate app), and the rail
  // offers "Retry storing test accounts" / "Continue without them" until every secret is safely sealed.
  const [createdAppId, setCreatedAppId] = useState<string | null>(null);

  // Derived defaults, never auto-written into state: the environment select and allowed-domains field fall
  // back to what the URL implies until the owner edits them; an explicit edit always wins.
  const host = hostnameOf(appUrl);
  const envValue = environment || (host ? guessEnvironment(host) : "");
  const domainsValue = domains || host;

  // Draft restore. Test accounts are never included; free-text fields carry whatever the owner typed, so
  // the UI warns against credentials in them. Deferred to a microtask after hydration so the server and
  // first client render match; the restore itself is a one-shot.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const d = JSON.parse(raw);
        if (d.appUrl) setAppUrl(d.appUrl); if (d.name) setName(d.name);
        if (d.environment) setEnvironment(d.environment); if (d.builder) setBuilder(d.builder);
        if (d.prompt) setPrompt(d.prompt); if (d.productDesc) setProductDesc(d.productDesc);
        if (d.github) setGithub(d.github); if (d.vercel) setVercel(d.vercel); if (d.customDeploy) setCustomDeploy(d.customDeploy);
        if (d.supabase) setSupabase(d.supabase); if (d.customAuth) setCustomAuth(d.customAuth);
        if (d.stripeTest) setStripeTest(d.stripeTest); if (d.sentry) setSentry(d.sentry);
        if (Array.isArray(d.webhooks)) setWebhooks(d.webhooks);
        if (Array.isArray(d.sources)) setSources(d.sources.filter((s: unknown): s is { kind: string; name: string; content: string; added: number } =>
          !!s && typeof s === "object" && typeof (s as { content?: unknown }).content === "string"));
        if (d.domains) setDomains(d.domains); if (d.permits) setPermits((p) => ({ ...p, ...d.permits }));
        setDraftNote("Draft restored. Test accounts are never saved in drafts, re-add them before connecting.");
      } catch { /* a corrupt draft is ignored */ }
    });
    return () => { cancelled = true; };
  }, []);

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        appUrl, name, environment, builder, prompt, productDesc,
        github, vercel, customDeploy, supabase, customAuth, stripeTest, sentry, webhooks, sources, domains, permits,
      }));
      setDraftNote("Draft saved on this device. Test accounts are never saved in drafts.");
    } catch { setDraftNote("Couldn't save the draft on this device."); }
  }

  // Progress: the 7 recommended connections (deployment URL is required, so it is not one of them).
  const hasPrd = sources.some((s) => s.kind === "prd" || s.kind === "requirements");
  const recommended: [string, boolean][] = [
    ["GitHub repository", !!github], ["Deployment provider", !!vercel || !!customDeploy],
    ["Original build prompt", prompt.trim().length > 0], ["Product specification", hasPrd],
    ["Test account", accounts.length > 0], ["Supabase", !!supabase], ["Stripe test mode", !!stripeTest],
  ];
  const recDone = recommended.filter(([, v]) => v).length;
  const urlOk = /^https:\/\/.+\..+/.test(appUrl.trim());
  const nameOk = name.trim().length > 0;
  // Application name is REQUIRED to submit (see canSubmit) — count it so the summary can never show
  // "all required complete" while the button is still disabled for a missing name.
  const requiredDone = (urlOk ? 1 : 0) + (nameOk ? 1 : 0) + (own ? 1 : 0);
  const requiredTotal = 3;
  const canSubmit = urlOk && nameOk && own && !busy && !createdAppId;

  function readTextFile(file: File, cb: (name: string, content: string) => void) {
    if (file.size > 300_000) { setErr(`${file.name} is over 300KB. Trim it to the relevant sections.`); return; }
    const r = new FileReader();
    r.onload = () => cb(file.name, String(r.result ?? ""));
    r.readAsText(file);
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setErr(null); setBusy(true);
    try {
      const connections: { provider: string; meta: Record<string, unknown> }[] = [];
      if (github) connections.push({ provider: "github", meta: github });
      if (vercel) connections.push({ provider: "vercel", meta: vercel });
      if (customDeploy) connections.push({ provider: "custom_deploy", meta: customDeploy });
      if (supabase) connections.push({ provider: "supabase", meta: supabase });
      if (customAuth) connections.push({ provider: "custom_auth", meta: customAuth });
      if (stripeTest) connections.push({ provider: "stripe_test", meta: stripeTest });
      if (sentry) connections.push({ provider: "sentry", meta: sentry });
      for (const w of webhooks) connections.push({ provider: "webhook", meta: { url: w } });

      const res = await fetch("/api/preflight/apps", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), app_url: appUrl.trim(), builder: builder || undefined,
          source_prompt: prompt.trim() || undefined, ownership_confirmed: true,
          environment: envValue || undefined,
          context_sources: [
            ...(productDesc.trim() ? [{ kind: "summary", name: "Product summary", content: productDesc.trim() }] : []),
            ...sources.map((s) => ({ kind: s.kind, name: s.name, content: s.content })),
          ],
          test_boundaries: {
            allowed_domains: domainsValue.split(",").map((d) => d.trim()).filter(Boolean),
            permit_account_creation: permits.account_creation, permit_db_writes: permits.db_writes,
            permit_email: permits.email, permit_test_purchases: permits.test_purchases, permit_file_upload: permits.file_upload,
          },
          connections,
        }),
      });
      if (res.status === 401) { router.push(`/signin?callbackUrl=${encodeURIComponent("/systems/new")}`); return; }
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.id) { setErr(typeof j?.message === "string" && j.message ? j.message : friendlyError(j?.error)); setBusy(false); return; }
      setCreatedAppId(j.id);
      await storeAccounts(j.id, accounts);
    } catch {
      setErr("Something went wrong. Check your connection and try again.");
      setBusy(false);
    }
  }

  // Store test accounts against the created app: EVERY account is attempted (never abort on the first
  // failure — the rest would be silently lost, since credentials live only in memory), successes leave
  // state, and on any failure we STAY on this page with the failed accounts intact so a retry can re-send
  // them. Only a fully clean store navigates away (adversarial review finding).
  async function storeAccounts(appId: string, toStore: TestAccount[]) {
    const failed: { account: TestAccount; why: string }[] = [];
    for (const a of toStore) {
      try {
        const sr = await fetch(`/api/preflight/apps/${encodeURIComponent(appId)}/secrets`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ label: a.label, username: a.username, password: a.password, scope: a.scope }),
        });
        if (!sr.ok) {
          const sj = await sr.json().catch(() => ({}));
          failed.push({ account: a, why: typeof sj?.message === "string" ? sj.message : "secure storage failed" });
        }
      } catch { failed.push({ account: a, why: "network error" }); }
    }
    if (failed.length) {
      setAccounts(failed.map((f) => f.account));
      setErr(`System connected, but ${failed.length} test account${failed.length === 1 ? " was" : "s were"} NOT stored (${failed.map((f) => `"${f.account.label}": ${f.why}`).join("; ")}). They are still here. Fix the cause and press Retry, or continue without them.`);
      setBusy(false);
      return;
    }
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* best-effort */ }
    router.push(`/systems/${appId}`); // keep busy: navigating away
  }

  // ── summary rail rows ──
  const summaryRow = (label: string, done: boolean) => (
    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
      <span style={{ color: "var(--fg-3)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: done ? "var(--go-ink)" : "var(--fg-5)" }}>{done ? "Complete" : "Missing"}</span>
    </div>
  );

  return (
    <div>
      {/* header + progress */}
      <div style={{ marginBottom: 22 }}>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "0 0 8px" }}>Connect your system</h1>
        <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
          Give Vraelis the context required to test the exact product, deployment, data layer, and user journeys you intend to ship.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
          <div aria-hidden style={{ flex: "0 1 220px", height: 6, borderRadius: 99, background: "var(--bg-3)", overflow: "hidden" }}>
            <div style={{ width: `${Math.round((recDone / recommended.length) * 100)}%`, height: "100%", background: "var(--acc-deep)", borderRadius: 99, transition: "width 200ms ease" }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)" }}>{recDone} of {recommended.length} recommended connections</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: "clamp(20px, 3vw, 34px)", alignItems: "start" }} className="cols-stack">
        {/* main column */}
        <div style={{ display: "grid", gap: 26 }}>

          <Section n={1} title="System" sub="The deployed product Vraelis will run like production.">
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14 }} className="cols-stack">
              <div>
                <label style={lab} htmlFor="c-url">System URL</label>
                <input id="c-url" type="url" required inputMode="url" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://your-app.vercel.app" maxLength={2000} style={input} />
                {host ? <p style={help}>Detected deployment: <strong style={{ color: "var(--fg-2)" }}>{host}</strong>{envValue ? `, looks like ${envValue}` : ""}.</p> : <p style={help}>The public https URL of the deployment under test.</p>}
              </div>
              <div>
                <label style={lab} htmlFor="c-name">System name</label>
                <input id="c-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme dashboard" maxLength={140} style={input} />
              </div>
              <div>
                <label style={lab} htmlFor="c-env">Environment</label>
                <select id="c-env" value={envValue} onChange={(e) => setEnvironment(e.target.value)} style={{ ...input, appearance: "none", cursor: "pointer" }}>
                  <option value="">Select environment</option>
                  <option value="preview">Preview</option><option value="staging">Staging</option><option value="production">Production</option>
                </select>
              </div>
              <div>
                <label style={lab} htmlFor="c-builder">Builder</label>
                <select id="c-builder" value={builder} onChange={(e) => setBuilder(e.target.value)} style={{ ...input, appearance: "none", cursor: "pointer" }}>
                  {BUILDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={lab} htmlFor="c-prompt">Original build prompt <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--fg-5)" }}>(recommended)</span></label>
              <textarea id="c-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Paste the prompt you built the app with" maxLength={60000} rows={4} style={{ ...input, minHeight: 100, resize: "vertical", lineHeight: 1.55 }} />
            </div>
          </Section>

          <Section n={2} title="Source and deployment" sub="What code, which deployment, which exact version: so a verification tests the build you actually ship.">
            <div style={{ display: "grid", gap: 10 }}>
              <ConnCard mark="github" title="GitHub" purpose="Repository, branch, and commit behind this deployment." badge="recommended"
                connected={!!github} summary={github ? `${github.repo}${github.branch ? ` @ ${github.branch}` : ""}${github.commit ? ` (${github.commit.slice(0, 10)})` : ""}` : undefined}
                open={openCard === "github"} onToggle={() => setOpenCard(openCard === "github" ? null : "github")} onDisconnect={() => { setGithub(null); setOpenCard(null); }}>
                <GithubForm value={github} onSave={(v) => { setGithub(v); setOpenCard(null); }} />
              </ConnCard>
              <ConnCard mark="vercel" title="Vercel" purpose="Project and deployment metadata for the URL under test." badge="recommended"
                connected={!!vercel} summary={vercel ? `${vercel.project}${vercel.deployment_url ? `, ${hostnameOf(vercel.deployment_url)}` : ""}` : undefined}
                open={openCard === "vercel"} onToggle={() => setOpenCard(openCard === "vercel" ? null : "vercel")} onDisconnect={() => { setVercel(null); setOpenCard(null); }}>
                <TwoFieldForm fields={[["project", "Project name", "my-app"], ["deployment_url", "Deployment URL (optional)", "https://my-app-abc.vercel.app"]]} value={vercel} onSave={(v) => { setVercel(v); setOpenCard(null); }} requiredKey="project" />
              </ConnCard>
              <ConnCard mark="deploy" title="Custom deployment" purpose="Any other host: provider, branch, commit, deployment." badge="optional"
                connected={!!customDeploy} summary={customDeploy ? `${customDeploy.provider_name}${customDeploy.commit ? ` (${customDeploy.commit.slice(0, 10)})` : ""}` : undefined}
                open={openCard === "cdeploy"} onToggle={() => setOpenCard(openCard === "cdeploy" ? null : "cdeploy")} onDisconnect={() => { setCustomDeploy(null); setOpenCard(null); }}>
                <TwoFieldForm fields={[["provider_name", "Provider", "Railway / Netlify / Fly / other"], ["branch", "Branch (optional)", "main"], ["commit", "Commit SHA (optional)", "40 hex characters"]]} value={customDeploy} onSave={(v) => { setCustomDeploy(v); setOpenCard(null); }} requiredKey="provider_name" />
              </ConnCard>
            </div>
            <p style={{ fontSize: 12, color: "var(--fg-4)", margin: "10px 0 0", lineHeight: 1.5 }}>
              Prefer to authorize with a token instead of pasting metadata? Connect GitHub with read-only OAuth on the Connections tab once this system is set up.
            </p>
            <ComingLater names={["Vercel OAuth", "Railway", "Netlify"]} />
          </Section>

          <Section n={3} title="Product definition" sub="What the app is supposed to do. A short summary is enough to start; every source strengthens the Production Contract Vraelis derives.">
            <ProductDefinition sources={sources} onAdd={(s) => setSources((prev) => [...prev, s])} onRemove={(i) => setSources((prev) => prev.filter((_, idx) => idx !== i))}
              readTextFile={readTextFile} promptAdded={prompt.trim().length > 0} summary={productDesc} onSummaryChange={setProductDesc} />
          </Section>

          <Section n={4} title="Data and authentication" sub="Where state lives and how users sign in, so verifications can prove persistence and isolation.">
            <div style={{ display: "grid", gap: 10 }}>
              <ConnCard mark="supabase" title="Supabase" purpose="Project metadata (no database credentials): lets verifications reason about persistence." badge="recommended"
                connected={!!supabase} summary={supabase ? supabase.project_url : undefined}
                open={openCard === "supabase"} onToggle={() => setOpenCard(openCard === "supabase" ? null : "supabase")} onDisconnect={() => { setSupabase(null); setOpenCard(null); }}>
                <TwoFieldForm fields={[["project_url", "Project URL", "https://xyzcompany.supabase.co"]]} value={supabase} onSave={(v) => { setSupabase(v); setOpenCard(null); }} requiredKey="project_url" />
              </ConnCard>
              <ConnCard mark="auth" title="Custom auth" purpose="Which auth system the app uses and anything a tester must know." badge="optional"
                connected={!!customAuth} summary={customAuth ? customAuth.system : undefined}
                open={openCard === "cauth"} onToggle={() => setOpenCard(openCard === "cauth" ? null : "cauth")} onDisconnect={() => { setCustomAuth(null); setOpenCard(null); }}>
                <TwoFieldForm fields={[["system", "Auth system", "e.g. NextAuth email links"], ["notes", "Notes for testing (optional)", "e.g. magic links go to the inbox"]]} value={customAuth} onSave={(v) => { setCustomAuth(v); setOpenCard(null); }} requiredKey="system" />
                <p style={help}>Never put a password or key in these notes; they are stored as plain metadata. Credentials belong in Test accounts below, which are encrypted.</p>
              </ConnCard>
            </div>
            <TestAccounts accounts={accounts} onAdd={(a) => setAccounts((prev) => [...prev, a])} onRemove={(i) => setAccounts((prev) => prev.filter((_, idx) => idx !== i))} />
            <ComingLater names={["Firebase", "Postgres", "Clerk", "Auth0", "Better Auth"]} />
          </Section>

          <Section n={5} title="Billing and services" sub="The services the app depends on. Stripe test mode seeds a billing requirement; the rest are recorded as context for now.">
            <div style={{ display: "grid", gap: 10 }}>
              <ConnCard mark="stripe" title="Stripe test mode" purpose="Marks that checkout runs on Stripe test mode. Never enter a secret key here." badge="recommended"
                connected={!!stripeTest} summary={stripeTest ? `Test mode${stripeTest.account_label ? `, ${stripeTest.account_label}` : ""}` : undefined}
                open={openCard === "stripe"} onToggle={() => setOpenCard(openCard === "stripe" ? null : "stripe")} onDisconnect={() => { setStripeTest(null); setOpenCard(null); }}>
                <TwoFieldForm fields={[["account_label", "Account label (optional)", "e.g. Acme test account"]]} value={stripeTest ?? { mode: "test" }} onSave={(v) => { setStripeTest({ ...v, mode: "test" }); setOpenCard(null); }} />
              </ConnCard>
              <ConnCard mark="sentry" title="Sentry" purpose="Error-tracking DSN (a public identifier, not a secret) so failures can be cross-checked." badge="optional"
                connected={!!sentry} summary={sentry ? hostnameOf(sentry.dsn) || "connected" : undefined}
                open={openCard === "sentry"} onToggle={() => setOpenCard(openCard === "sentry" ? null : "sentry")} onDisconnect={() => { setSentry(null); setOpenCard(null); }}>
                <TwoFieldForm fields={[["dsn", "DSN", "https://examplePublicKey@o0.ingest.sentry.io/0"]]} value={sentry} onSave={(v) => { setSentry(v); setOpenCard(null); }} requiredKey="dsn" />
              </ConnCard>
              <WebhookList webhooks={webhooks} onChange={setWebhooks} open={openCard === "webhooks"} onToggle={() => setOpenCard(openCard === "webhooks" ? null : "webhooks")} />
            </div>
            <ComingLater names={["Lemon Squeezy", "Paddle", "Resend", "Twilio", "PostHog", "OpenAPI import"]} />
          </Section>

          <Section n={6} title="Test boundaries" sub="What Vraelis may and may not do. Defaults are conservative; widen them only when you mean it.">
            <label htmlFor="c-own" style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "13px 15px", border: `1px solid ${own ? "var(--acc-line)" : "var(--line-2)"}`, borderRadius: "var(--r-sm)", background: own ? "var(--acc-soft)" : "var(--bg-2)" }}>
              <input id="c-own" type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} style={{ marginTop: 2, accentColor: "var(--acc)", width: 16, height: 16, flex: "none" }} />
              <span style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5, fontWeight: 600 }}>I own this system or am authorized to test it. <span style={{ fontWeight: 400, color: "var(--fg-3)" }}>Required.</span></span>
            </label>
            <div>
              <label style={lab} htmlFor="c-domains">Allowed domains</label>
              <input id="c-domains" type="text" value={domainsValue} onChange={(e) => setDomains(e.target.value)} placeholder="app.example.com, api.example.com" style={input} />
              <p style={help}>Comma-separated. Verifications never navigate outside these hosts.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {([["account_creation", "Permit account creation"], ["db_writes", "Permit test database writes"], ["email", "Permit test email delivery"], ["test_purchases", "Permit test-mode purchases"], ["file_upload", "Permit file upload"]] as const).map(([k, l]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--fg-2)", padding: "10px 12px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", cursor: "pointer" }}>
                  <input type="checkbox" checked={permits[k]} onChange={(e) => setPermits((p) => ({ ...p, [k]: e.target.checked }))} style={{ accentColor: "var(--acc)", width: 15, height: 15 }} />
                  {l}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.6, padding: "12px 14px", borderRadius: "var(--r-sm)", background: "var(--bg-2)", border: "1px solid var(--line-2)" }}>
              Always enforced, not configurable: Vraelis never performs destructive actions, never uses live payment methods, and never deletes production data.
            </div>
          </Section>
        </div>

        {/* sticky summary rail */}
        <aside className="sticky-side" style={{ position: "sticky", top: 84, display: "grid", gap: 14 }}>
          <div className="card" style={{ display: "grid", gap: 12, padding: 18 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Connection summary</div>
            <div style={{ display: "grid", gap: 7 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Required</div>
              {summaryRow("System URL", urlOk)}
              {summaryRow("System name", nameOk)}
              {summaryRow("Ownership authorization", own)}
            </div>
            <div style={{ display: "grid", gap: 7, borderTop: "1px solid var(--line-1)", paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recommended</div>
              {recommended.map(([l, v]) => summaryRow(l, v))}
            </div>
            <p style={{ fontSize: 12, color: "var(--fg-4)", lineHeight: 1.55, margin: 0, borderTop: "1px solid var(--line-1)", paddingTop: 10 }}>
              Vraelis can begin with the current context, but additional connections produce stronger Production Contracts, deeper flows, and better evidence.
            </p>
            {err ? <p role="alert" style={{ fontSize: 12.5, color: "var(--err)", margin: 0, lineHeight: 1.5 }}>{err}</p> : null}
            {draftNote ? <p role="status" style={{ fontSize: 12, color: "var(--fg-4)", margin: 0, lineHeight: 1.5 }}>{draftNote}</p> : null}
            {createdAppId ? (
              <>
                <button type="button" className="btn btn--lg" disabled={busy || accounts.length === 0} onClick={() => { setErr(null); setBusy(true); void storeAccounts(createdAppId, accounts); }} style={{ width: "100%", justifyContent: "center", opacity: busy ? 0.55 : 1 }}>
                  {busy ? "Storing…" : "Retry storing test accounts"}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => router.push(`/systems/${createdAppId}`)} style={{ width: "100%", justifyContent: "center" }}>Continue without them</button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn--lg" disabled={!canSubmit} onClick={onSubmit} style={{ width: "100%", justifyContent: "center", opacity: canSubmit ? 1 : 0.55 }}>
                  {busy ? "Connecting…" : "Connect system"}
                </button>
                {/* Never a dead button with no reason: name the first unmet requirement so the user knows
                    exactly what to do (the recommended connections are NOT required to continue). */}
                {!canSubmit && !busy ? (
                  <p style={{ fontSize: 12, color: "var(--fg-4)", textAlign: "center", margin: "2px 0 0" }}>
                    {!urlOk ? "Add a valid https system URL to continue."
                      : !nameOk ? "Add a system name to continue."
                      : !own ? "Confirm you own or are authorized to test this app."
                      : "Complete the required fields to continue."}
                  </p>
                ) : null}
                <button type="button" className="btn btn--ghost" onClick={saveDraft} style={{ width: "100%", justifyContent: "center" }}>Save draft</button>
              </>
            )}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", textAlign: "center" }}>{requiredDone} of {requiredTotal} required, {recDone} of {recommended.length} recommended</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── sub-forms (GithubForm / TwoFieldForm live in ../_connections/forms, shared with management) ────────

function WebhookList({ webhooks, onChange, open, onToggle }: { webhooks: string[]; onChange: (w: string[]) => void; open: boolean; onToggle: () => void }) {
  const [draft, setDraft] = useState("");
  const ok = /^https:\/\/.+\..+/.test(draft.trim());
  return (
    <ConnCard mark="webhook" title="Webhook endpoints" purpose="Endpoints the app calls out to. Recorded as context; not yet read during verification." badge="optional"
      connected={webhooks.length > 0} summary={`${webhooks.length} endpoint${webhooks.length === 1 ? "" : "s"} recorded`}
      open={open} onToggle={onToggle} onDisconnect={webhooks.length ? () => onChange([]) : undefined}>
      <div style={{ display: "grid", gap: 8 }}>
        {webhooks.map((w, i) => (
          <div key={`${w}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--fg-3)" }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{w}</span>
            <button type="button" className="btn btn--ghost" style={{ padding: "4px 9px", fontSize: 11.5 }} onClick={() => onChange(webhooks.filter((_, idx) => idx !== i))}>Remove</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://hooks.example.com/orders" style={{ ...input, flex: 1 }} />
          <button type="button" className="btn" disabled={!ok} style={{ opacity: ok ? 1 : 0.55, flex: "none" }} onClick={() => { onChange([...webhooks, draft.trim()]); setDraft(""); }}>Add</button>
        </div>
      </div>
    </ConnCard>
  );
}

// ── product definition (section 3): progressive disclosure ─────────────────────────────────────────────
// Primary (always visible): the build-prompt status chip, a short Product summary, and the document
// paste/upload affordance. Advanced: seven guided small fields behind an "Add more context" expander.
// Every entry becomes a bounded context source (the server re-validates kind and caps size); nothing here
// is a secret, and the expander says so where free text is typed. A guided field disappears once its
// source exists; Edit on the card reloads the content into the field, so there is exactly one honest
// place per fact and no dead controls.

const DOC_KINDS: [string, string][] = [["prd", "Product specification / PRD"], ["requirements", "Requirements"], ["readme", "README"]];
const GUIDED_FIELDS: { kind: string; name: string; placeholder: string }[] = [
  { kind: "goal", name: "Core user goal", placeholder: "The job a user hires this app for, e.g. send invoices and get paid" },
  { kind: "roles", name: "Primary user roles", placeholder: "e.g. Owner, staff member, read-only accountant" },
  { kind: "workflows", name: "Critical workflows", placeholder: "e.g. Sign up, create an invoice, send it, mark it paid" },
  { kind: "data", name: "Expected data behavior", placeholder: "e.g. Invoices persist across sessions and never leak between accounts" },
  { kind: "auth_expect", name: "Authentication expectations", placeholder: "e.g. Email and password, sessions persist, no public admin routes" },
  { kind: "billing_expect", name: "Billing expectations", placeholder: "e.g. Stripe test mode, Pro plan gates exports, trial ends on day 14" },
  { kind: "risks", name: "Known risks", placeholder: "e.g. PDF export has broken before, timezone math is fragile" },
];
const KIND_LABELS: Record<string, string> = {
  prompt: "Build prompt", summary: "Summary", prd: "PRD / spec", requirements: "Requirements", readme: "README",
  goal: "User goal", roles: "User roles", workflows: "Workflows", data: "Data behavior",
  auth_expect: "Authentication", billing_expect: "Billing", risks: "Known risks",
};
// The server keeps 12 sources per application; the Product summary field occupies one slot at submit.
const MAX_ADDED_SOURCES = 11;

function charLabel(n: number): string { return n < 1000 ? `${n} chars` : `${(n / 1000).toFixed(1)}k chars`; }
function agoLabel(ts?: number): string {
  if (!ts) return "from a saved draft"; // drafts saved before timestamps existed
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function ProductDefinition({ sources, onAdd, onRemove, readTextFile, promptAdded, summary, onSummaryChange }: {
  sources: Source[]; onAdd: (s: Source) => void; onRemove: (i: number) => void;
  readTextFile: (f: File, cb: (name: string, content: string) => void) => void;
  promptAdded: boolean; summary: string; onSummaryChange: (v: string) => void;
}) {
  const [docKind, setDocKind] = useState("prd");
  const [docText, setDocText] = useState("");
  const [docName, setDocName] = useState<string | null>(null); // survives an Edit so an uploaded file keeps its filename
  const [moreOpen, setMoreOpen] = useState(false);
  const [guided, setGuided] = useState<Record<string, string>>({});
  const full = sources.length >= MAX_ADDED_SOURCES;
  const openGuided = GUIDED_FIELDS.filter((g) => !sources.some((s) => s.kind === g.kind));

  // Edit = reload the source into the field it came from (guided kinds reopen the expander; document
  // kinds land back in the paste area with their name preserved), then drop the card.
  function editSource(i: number) {
    const s = sources[i];
    if (GUIDED_FIELDS.some((g) => g.kind === s.kind)) {
      setGuided((p) => ({ ...p, [s.kind]: s.content }));
      setMoreOpen(true);
    } else {
      setDocKind(DOC_KINDS.some(([v]) => v === s.kind) ? s.kind : "prd");
      setDocName(s.name);
      setDocText(s.content);
    }
    onRemove(i);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* primary: prompt status + product summary */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="pill" style={{ fontSize: 10, color: promptAdded ? "var(--acc-deep)" : "var(--fg-4)", background: promptAdded ? "var(--acc-soft)" : "var(--bg-2)", borderColor: promptAdded ? "var(--acc-line)" : "var(--line-2)" }}>
          Original build prompt: {promptAdded ? "Added" : "Missing"}
        </span>
        {!promptAdded ? <span style={{ fontSize: 12, color: "var(--fg-4)" }}>Paste it in section 01 above; it is the strongest single source.</span> : null}
      </div>
      <div>
        <label style={lab} htmlFor="c-summary">Product summary</label>
        <textarea id="c-summary" value={summary} onChange={(e) => onSummaryChange(e.target.value)} placeholder="One or two sentences: what the product does, who uses it, what must never break" maxLength={2000} rows={2} style={{ ...input, minHeight: 58, resize: "vertical", lineHeight: 1.55 }} />
        <p style={help}>Enough to start: URL, summary, and prompt. Everything below adds depth when you have it.</p>
      </div>

      {/* primary: document paste / upload */}
      <div style={{ display: "grid", gridTemplateColumns: "200px minmax(0,1fr)", gap: 10, alignItems: "start" }} className="cols-stack">
        <div>
          <label style={lab} htmlFor="c-dockind">Document type</label>
          <select id="c-dockind" value={docKind} onChange={(e) => { setDocKind(e.target.value); setDocName(null); }} style={{ ...input, appearance: "none", cursor: "pointer" }}>
            {DOC_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={lab} htmlFor="c-doctext">PRD, README, or requirements</label>
          <div style={{ display: "grid", gap: 8 }}>
            <textarea id="c-doctext" value={docText} onChange={(e) => setDocText(e.target.value)} placeholder="Paste the document, or upload a file below" rows={3} maxLength={120000} style={{ ...input, minHeight: 76, resize: "vertical", lineHeight: 1.55 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" className="btn" disabled={!docText.trim() || full} style={{ opacity: docText.trim() && !full ? 1 : 0.55 }}
                onClick={() => { onAdd({ kind: docKind, name: docName ?? (DOC_KINDS.find(([v]) => v === docKind)?.[1] ?? docKind), content: docText.trim(), added: Date.now() }); setDocText(""); setDocName(null); }}>Add document</button>
              {!full ? (
                <label className="btn btn--ghost" style={{ cursor: "pointer" }}>
                  Upload .md / .txt
                  <input type="file" accept=".md,.markdown,.txt" style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) readTextFile(f, (n, c) => onAdd({ kind: docKind, name: n, content: c, added: Date.now() })); e.target.value = ""; }} />
                </label>
              ) : null}
              <span style={{ fontSize: 11.5, color: "var(--fg-5)" }}>Plain text and Markdown, up to 300KB.</span>
            </div>
          </div>
        </div>
      </div>

      {/* source cards for everything added */}
      {sources.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {sources.map((s, i) => (
            <div key={`${s.kind}-${s.name}-${i}`} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderColor: "var(--acc-line)" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--fg-1)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  <span className="pill" style={{ fontSize: 9.5, color: "var(--fg-4)", background: "var(--bg-2)", borderColor: "var(--line-2)" }}>{KIND_LABELS[s.kind] ?? s.kind}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 2 }}>Added {agoLabel(s.added)}, {charLabel((s.content ?? "").length)}</div>
              </div>
              <button type="button" className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11.5, flex: "none" }} onClick={() => editSource(i)}>Edit</button>
              <button type="button" className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11.5, flex: "none" }} onClick={() => onRemove(i)}>Remove</button>
            </div>
          ))}
        </div>
      ) : null}
      {full ? <p style={help}>Source limit reached ({MAX_ADDED_SOURCES}). Remove a source to add another.</p> : null}

      {/* advanced: guided context behind the expander */}
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn btn--ghost" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", fontSize: 12.5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: moreOpen ? "rotate(90deg)" : "none", transition: "transform 150ms ease" }}><path d="M9 6l6 6-6 6" /></svg>
            Add more context
          </button>
          <span style={{ fontSize: 11.5, color: "var(--fg-5)" }}>Guided fields: goal, roles, workflows, data, auth, billing, risks.</span>
        </div>
        {moreOpen ? (
          <div style={{ display: "grid", gap: 12, padding: "14px 16px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-2)" }}>
            <p style={{ ...help, margin: 0 }}>Each answer is stored as a plain-text context source. No passwords or keys here; test credentials belong in section 04, where they are encrypted.</p>
            {openGuided.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
                {openGuided.map((g) => {
                  const v = guided[g.kind] ?? "";
                  const can = v.trim().length > 0 && !full;
                  return (
                    <div key={g.kind}>
                      <label style={lab} htmlFor={`c-g-${g.kind}`}>{g.name}</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input id={`c-g-${g.kind}`} value={v} onChange={(e) => setGuided((p) => ({ ...p, [g.kind]: e.target.value }))} placeholder={g.placeholder} maxLength={2000} style={{ ...input, flex: 1, minWidth: 0 }} />
                        <button type="button" className="btn" disabled={!can} style={{ opacity: can ? 1 : 0.55, flex: "none" }}
                          onClick={() => { onAdd({ kind: g.kind, name: g.name, content: v.trim(), added: Date.now() }); setGuided((p) => ({ ...p, [g.kind]: "" })); }}>Add</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ ...help, margin: 0 }}>Every guided field has been added. Edit or remove them from the source cards above.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TestAccounts({ accounts, onAdd, onRemove }: { accounts: TestAccount[]; onAdd: (a: TestAccount) => void; onRemove: (i: number) => void }) {
  const [openForm, setOpenForm] = useState(false);
  const [label, setLabel] = useState(ROLE_PRESETS[0]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [scope, setScope] = useState("signed-in flows only");
  const ok = username.trim().length > 0 && password.length > 0;
  const mask = (v: string) => (v.trim() ? `${v.trim().slice(0, 2)}••••` : "••••");
  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Mark text="key" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>Test accounts</span>
            <Badge kind="recommended" />
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 2, lineHeight: 1.45 }}>
            Encrypted server-side (AES-256-GCM), masked everywhere, never in logs or screenshots, removable anytime. Used only inside your approved flows.
          </div>
        </div>
        <button type="button" className={accounts.length ? "btn btn--ghost" : "btn"} style={{ padding: "7px 12px", fontSize: 12.5, flex: "none" }} onClick={() => setOpenForm((o) => !o)} aria-expanded={openForm}>Add securely</button>
      </div>
      {accounts.length ? (
        <div style={{ display: "grid", gap: 6 }}>
          {accounts.map((a, i) => (
            <div key={`${a.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--fg-2)", padding: "8px 10px", border: "1px solid var(--acc-line)", background: "var(--acc-soft)", borderRadius: "var(--r-sm)" }}>
              <strong style={{ flex: "none" }}>{a.label}</strong>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-3)" }}>{mask(a.username)}</span>
              <span style={{ color: "var(--fg-4)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{a.scope}</span>
              <button type="button" className="btn btn--ghost" style={{ padding: "3px 9px", fontSize: 11.5, flex: "none" }} onClick={() => onRemove(i)}>Remove</button>
            </div>
          ))}
        </div>
      ) : null}
      {openForm ? (
        <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="cols-stack">
            <div><label style={lab}>Role</label>
              <select value={label} onChange={(e) => setLabel(e.target.value)} style={{ ...input, appearance: "none", cursor: "pointer" }}>
                {ROLE_PRESETS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><label style={lab}>Usage scope</label><input value={scope} onChange={(e) => setScope(e.target.value)} maxLength={200} style={input} /><p style={help}>Describes where the account may be used. Plain metadata: no passwords here.</p></div>
            <div><label style={lab}>Username / email</label><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" style={input} /></div>
            <div><label style={lab}>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" style={input} /></div>
          </div>
          <p style={help}>Sent once over TLS, sealed server-side, and never shown again, not even to you. Test accounts are excluded from saved drafts.</p>
          <button type="button" className="btn" disabled={!ok} style={{ justifySelf: "start", opacity: ok ? 1 : 0.55 }}
            onClick={() => { onAdd({ label, username: username.trim(), password, scope: scope.trim() || "signed-in flows only" }); setUsername(""); setPassword(""); setOpenForm(false); }}>Add test account</button>
        </div>
      ) : null}
    </div>
  );
}
