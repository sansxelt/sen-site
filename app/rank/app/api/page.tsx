"use client";

import Link from "next/link";
import type { KeyUsage, KeySpendSummary } from "@/lib/preflight/key-usage";
import { useEffect, useState } from "react";
import { WebhooksSection } from "./webhooks-section";
import { CliSection } from "./cli-section";
import { Ic, I, EmptyIcon } from "@/app/rank/_components/icons";

type Key = { id: string; prefix: string; scopes: string[]; last_used: string | null; created_at: string; name?: string | null;
  /** The key's daily spend limit in cents, or null for a key with no limit. Shown beside what it has spent. */
  daily_ceiling_cents?: number | null };
type DevEvent = { id: string; event_type: string; metadata: Record<string, unknown>; created_at: string; test_id: string | null };
type Usage = {
  signedIn: boolean; plan?: string; hasApiAccess?: boolean;
  usage?: { total: number; last24h: number; last7d: number; lastAt: string | null; byEndpoint: { endpoint: string; method: string; count: number }[]; byPrefix: Record<string, number> };
  webhook?: { endpoints: number; total: number; success: number; failed: number; retried: number; lastAt: string | null };
  recent?: DevEvent[];
};

const ENDPOINT_LABEL: Record<string, string> = {
  "runs.create": "Launch a verification", "runs.get": "Get a run", "tests.create": "Launch a verification",
  "tests.get": "Get a run", "tests.export": "Export results", credits: "Check balance", other: "Other",
};
const DEV_EVENT_LABEL: Record<string, string> = {
  api_request_made: "API request", export_downloaded: "Export downloaded", webhook_delivered: "Webhook delivered",
  webhook_failed: "Webhook failed", test_launched: "Verification launched", preflight_run_queued: "Verification launched", api_key_created: "API key created",
};
const shortDate = (s: string | null) => { if (!s) return "-"; try { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return "-"; } };

const CURL = `# 1. Create a verification: does the deployed build actually keep this promise?
curl -X POST https://vraelis.com/api/v1/verifications \\
  -H "X-Api-Key: YOUR_KEY" -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{ "deployment_url": "https://your-preview.example.com",
        "claim": "A customer can upgrade to Pro and still have it after signing back in" }'
# -> { "verification_id": "vrf_...", "state": "running" }

# 2. Poll until a DECISION lands. While it is running the decision is null; keep polling.
curl https://vraelis.com/api/v1/verifications/VERIFICATION_ID -H "X-Api-Key: YOUR_KEY"
# -> { "state": "completed", "decision": "failed", "failures": [ { "title": "...", "reproduce": "..." } ] }

# 3. Gate on the DECISION, never the run state:
#      verified -> exit 0  (ship)     failed -> exit 1  (stop)     blocked -> exit 2  (stop)
#    A finished run is NOT a pass. "state":"completed" with "decision":"failed" must STOP the deploy.
#    Evidence (screenshots, traces) is fetched separately through a short-lived, owner-checked signed URL.`;

// The three Preflight access levels a key can be created with, and the scopes each one grants. Named by
// what the holder can DO, not by the scope strings, because that is the question someone is actually
// answering when they mint a key.
type PreflightAccess = "none" | "read" | "launch";
const PREFLIGHT_ACCESS: { id: PreflightAccess; label: string; hint: string; scopes: string[] }[] = [
  { id: "none", label: "No Preflight access", hint: "Verifications and credits only. The safe default.", scopes: [] },
  { id: "read", label: "Read reports", hint: "Price a verification and read run reports. Cannot launch a run or spend anything.", scopes: ["preflight:preview", "preflight:run:read"] },
  { id: "launch", label: "Launch runs", hint: "Everything above, plus launching a verification. This key can spend your credits.", scopes: ["preflight:preview", "preflight:run:read", "preflight:run:create"] },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [fresh, setFresh] = useState<string>("");
  // What the server reports it ACTUALLY persisted. Shown beside the key so a wrongly scoped key is visible
  // at creation instead of at its first real call.
  const [freshGrant, setFreshGrant] = useState<{ scopes: string[]; dailyCeilingCents: number | null } | null>(null);
  const [err, setErr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [keyName, setKeyName] = useState("");
  // What a new key may do with Preflight. Least privilege by default: a key gets nothing here unless it is
  // asked for, and the level that can spend money is a separate, deliberate choice. Scopes are fixed at
  // creation, so changing a key's access means revoking it and minting a new one.
  const [preflightAccess, setPreflightAccess] = useState<PreflightAccess>("none");
  // Optional daily spend limit for this key, in whole dollars. Empty means no limit.
  const [dailyLimit, setDailyLimit] = useState("");
  const [u, setU] = useState<Usage | null>(null);
  // Which key's usage detail is expanded. Click a key to see what it has actually cost.
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Per-key spend, fetched on expand and cached. Undefined = not asked yet, null = asked and unavailable.
  const [keyUsage, setKeyUsage] = useState<Record<string, KeyUsage | null | undefined>>({});
  // Account-wide key spend. A per-key view cannot account for a revoked key, whose row is deleted, so this
  // is what makes the panels add up to the bill.
  const [spend, setSpend] = useState<KeySpendSummary | null>(null);

  // Money is fetched per key rather than with the list: the list is one query, this is a scan of that key's
  // runs, and nobody should pay for it on a page they opened to copy a prefix.
  function openKeyDetail(id: string) {
    const next = openKey === id ? null : id;
    setOpenKey(next);
    if (next && keyUsage[next] === undefined) {
      setKeyUsage((m) => ({ ...m, [next]: undefined }));
      fetch(`/api/v/keys/${next}/usage`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setKeyUsage((m) => ({ ...m, [next]: j?.usage ?? null })))
        .catch(() => setKeyUsage((m) => ({ ...m, [next]: null })));
    }
  }

  async function load() {
    const r = await fetch("/api/v/keys");
    if (r.ok) { const j = await r.json(); setKeys(j.keys || []); }
    setLoaded(true);
    fetch("/api/v/usage").then((x) => x.json()).then((j) => { if (j.signedIn) setU(j); }).catch(() => {});
    fetch("/api/v/keys/spend").then((x) => (x.ok ? x.json() : null)).then((j) => setSpend(j?.summary ?? null)).catch(() => setSpend(null));
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true); setFresh(""); setErr("");
    try {
      const extra = PREFLIGHT_ACCESS.find((a) => a.id === preflightAccess)?.scopes ?? [];
      const r = await fetch("/api/v/keys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName.trim(),
          scopes: ["tests:write", "tests:read", "credits:read", ...extra],
          daily_ceiling_cents: Number(dailyLimit) > 0 ? Math.round(Number(dailyLimit) * 100) : undefined,
        }),
      });
      const j = await r.json();
      if (j.key) {
        setFresh(j.key);
        setFreshGrant({ scopes: j.scopes ?? [], dailyCeilingCents: j.dailyCeilingCents ?? null });
        setKeyName(""); setPreflightAccess("none"); setDailyLimit(""); load();
      }
      else if (j.error === "plan_required") setErr("The public API is a Scale plan feature. Upgrade to generate keys.");
      else setErr("Couldn't create a key. Try again.");
    } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    await fetch(`/api/v/keys/${id}`, { method: "DELETE" });
    load();
  }

  const slbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "28px 0 12px" } as const;
  const cardHead = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 } as const;

  return (
    <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          {/* The nav says Developers and this is what it opens, so this says Developers. The eyebrow used to
              carry that word while the heading named two of the things on the page, which reads as a
              different destination than the one that was clicked. The CLI is here too, and it is neither an
              API nor a webhook. */}
          <h1 className="display">Developers</h1>
          <p>Operate Vraelis from CI, an agent or a terminal: API keys, the command line, and signed webhooks. Launch verifications, gate the deploy on the decision, and read the evidence back.</p>
        </div>
      </div>

      {/* create */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="field">
          <span className="lbl">Create an API key</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Name it, e.g. Production or Zapier" maxLength={40} onKeyDown={(e) => { if (e.key === "Enter" && !busy) create(); }} style={{ flex: 1, minWidth: 220, padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" }} />
            <button onClick={create} disabled={busy} className="btn" style={{ opacity: busy ? 0.6 : 1 }}>{busy ? "Creating…" : "Create key"}</button>
          </div>
          <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
            <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Preflight access</span>
            {PREFLIGHT_ACCESS.map((a) => (
              <label key={a.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 11px", border: `1px solid ${preflightAccess === a.id ? "var(--acc-line)" : "var(--line-2)"}`, background: preflightAccess === a.id ? "var(--acc-soft)" : "transparent", borderRadius: "var(--r-sm)", cursor: "pointer" }}>
                <input type="radio" name="preflight-access" checked={preflightAccess === a.id} onChange={() => setPreflightAccess(a.id)} style={{ marginTop: 3 }} />
                <span>
                  <span style={{ display: "block", fontSize: 13.5, color: "var(--fg-1)" }}>{a.label}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--fg-4)" }}>{a.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {/*
            Only meaningful for a key that can launch runs. An agent in a retry loop is the reason this
            exists, so it is offered at the moment you decide to hand a credential that power, not buried in
            a settings page you would visit afterwards.
          */}
          {preflightAccess === "launch" && (
            <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
              <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Daily spend limit</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, color: "var(--fg-3)" }}>$</span>
                <input value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="No limit" style={{ width: 120, padding: "9px 11px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" }} />
                <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>per day, resets at midnight UTC</span>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>Caps what this one key can spend, on top of your account limits. Leave empty for no key limit. It can only ever lower what the key can spend, never raise it.</span>
            </div>
          )}
          <span className="hint">Name your keys so you can tell them apart. The full key is shown once at creation. Keep keys server-side only, and rotate or revoke a key if it&apos;s ever exposed. <a href="https://vraelis.com/developers" style={{ color: "var(--acc-deep)" }}>Developer docs →</a></span>
        </div>
      </div>

      {/* Integrate from CI: launch a verification and gate the deploy on the decision. */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div style={cardHead}>Gate your deploys from CI</div>
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 12px" }}>Launch a verification against a preview build, wait for the decision, and ship only when it is Verified. Failed and Blocked stop the release; a run that merely finished is not a pass. One job, real-browser evidence, no dashboard to watch.</p>
            <a href="#ci-gate" className="btn">See the CI gate →</a>
          </div>
        </div>
        {/* "Developer overview" is the PUBLIC docs on the apex host; the host decides which /developers you get
            (see proxy.ts), so this must be an absolute cross-host link, not a relative one that would just
            reload this console. "Webhook signing" and the CI gate are on THIS page (ids below), so they anchor. */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <a href="https://vraelis.com/developers" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Developer overview</a>
          <a href="#webhooks" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Webhook signing</a>
        </div>
      </div>

      {err && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--line-2)" }}>
          <p style={{ fontSize: 14, color: "var(--fg-2)", margin: 0 }}>{err} {err.includes("Scale") && <Link href="/plans" style={{ color: "var(--acc-deep)" }}>See plans →</Link>}</p>
        </div>
      )}

      {fresh && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--acc-line)", background: "var(--acc-soft)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 8 }}>Your new key. Copy it now, it won&apos;t be shown again</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <code style={{ flex: 1, fontFamily: "var(--font-code)", fontSize: 13, color: "var(--fg-1)", wordBreak: "break-all", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-xs)", padding: "10px 12px" }}>{fresh}</code>
            <button onClick={() => { navigator.clipboard?.writeText(fresh); setCopied(true); setTimeout(() => setCopied(false), 1400); }} className="btn btn--ghost" style={{ whiteSpace: "nowrap" }}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
          {/*
            What the server ACTUALLY granted, read back from the create response rather than echoed from the
            request. Two keys were minted without preflight:run:create and there was no way to tell until the
            first real API call failed with a 403, which is a long way from the decision that caused it.
            A key that cannot do what you asked for should say so here, while you are still looking at it.
          */}
          {freshGrant && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--acc-line)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 }}>This key can</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {freshGrant.scopes.map((s) => (
                  <span key={s} style={{ fontFamily: "var(--font-code)", fontSize: 11, padding: "3px 8px", borderRadius: 999, border: "1px solid var(--line-2)", background: "var(--bg-1)", color: s.startsWith("preflight:") ? "var(--acc-deep)" : "var(--fg-4)" }}>{s}</span>
                ))}
              </div>
              {freshGrant.scopes.includes("preflight:run:create") ? (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)" }}>
                  It can launch verifications{freshGrant.dailyCeilingCents ? `, up to $${(freshGrant.dailyCeilingCents / 100).toFixed(2)} per day` : ", with no daily spend limit"}.
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--wait-ink)" }}>
                  This key cannot launch verifications. To give it that, revoke it and create a new one with Preflight access set to &ldquo;Launch runs&rdquo;.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* keys list */}
      {loaded && keys.length === 0 && !fresh && (
        <div className="empty" style={{ marginBottom: 28 }}>
          <EmptyIcon d={I.key} />
          <h3>No API keys yet</h3>
          <p>Create a key to call the Vraelis API from your app. The full key is shown once at creation.</p>
          <button onClick={create} disabled={busy} className="btn">{busy ? "Creating…" : "Create your first key"}</button>
        </div>
      )}
      {keys.length > 0 && (
        <>
        {/* WHAT EVERY KEY HAS COST, TOGETHER. A per-key panel cannot account for a revoked key: the row is
            deleted, and the panel finds keys through the caller's live list. Measured in production, that
            was 9 of 10 key-launched runs and $120 of $135, so adding up the panels gave a number that did
            not match the bill. Losing "which key" after revocation is fair. Losing "does this add up" is not. */}
        {spend && spend.total.runs > 0 ? (
          <div style={{ display: "flex", gap: 26, flexWrap: "wrap", alignItems: "baseline", padding: "12px 16px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-2)", marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-5)" }}>Charged to API keys, all time</div>
              <div style={{ fontSize: 19, fontWeight: 600, color: "var(--fg-1)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>${(spend.total.chargedCents / 100).toFixed(2)}</div>
              <div style={{ fontSize: 11, color: "var(--fg-5)", marginTop: 2 }}>{spend.total.runs} verification{spend.total.runs === 1 ? "" : "s"}{spend.total.flowUnits ? `, ${spend.total.flowUnits} journeys` : ""}</div>
            </div>
            {spend.revokedKeys.chargedCents > 0 || spend.revokedKeys.runs > 0 ? (
              <div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-5)" }}>By keys you have revoked</div>
                <div style={{ fontSize: 19, fontWeight: 600, color: "var(--fg-2)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>${(spend.revokedKeys.chargedCents / 100).toFixed(2)}</div>
                <div style={{ fontSize: 11, color: "var(--fg-5)", marginTop: 2 }}>
                  {spend.revoked.map((r) => r.prefix ?? "a deleted key").slice(0, 3).join(", ")}{spend.revoked.length > 3 ? ` and ${spend.revoked.length - 3} more` : ""}
                </div>
              </div>
            ) : null}
            <p style={{ fontSize: 11, color: "var(--fg-5)", margin: 0, flex: 1, minWidth: 200 }}>
              Revoking a key deletes it, so its own panel goes with it. Its verifications and their charges stay on your record, and are counted here.
            </p>
          </div>
        ) : null}
        <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)", marginBottom: 28, boxShadow: "var(--shadow-sm)" }}>
          {keys.map((k, i) => {
            const reqs = u?.usage?.byPrefix?.[k.prefix] ?? 0;
            const open = openKey === k.id;
            const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString() : null);
            return (
            <div key={k.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px" }}>
                {/* The whole row is the toggle: click a key to open its usage detail. */}
                <button onClick={() => openKeyDetail(k.id)} aria-expanded={open} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{k.name || "Untitled key"}</span>
                    <code style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)" }}>{k.prefix}…</code>
                    <span aria-hidden style={{ display: "inline-block", transition: "transform 120ms", transform: open ? "rotate(90deg)" : "none", color: "var(--fg-5)", fontSize: 11 }}>▸</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 4 }}>Created {fmt(k.created_at)}, {k.last_used ? `last used ${fmt(k.last_used)}` : "never used"}{reqs ? `, ${reqs.toLocaleString()} request${reqs === 1 ? "" : "s"}` : ""}</div>
                  {k.scopes?.length ? <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-5)", marginTop: 3 }}>{k.scopes.join("  ")}</div> : null}
                </button>
                {/* THE WAY INSIDE. The expander is a summary and stays one: four figures without leaving
                    the list. Everything a key can actually be asked (what it decided, how long it takes,
                    when it is used, which endpoints it calls, every verification it launched) needs a page,
                    and until now there was nowhere for it to go. */}
                <Link href={`/developers/keys/${k.id}`} className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5, gap: 6 }} aria-label={`Open ${k.name || "untitled key"}`}>
                  Open<span aria-hidden>→</span>
                </Link>
                <button onClick={() => revoke(k.id)} className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5, gap: 6 }}><Ic d={I.slash} size={12} sw={2.2} />Revoke</button>
              </div>
              {open && (() => {
                const usage = keyUsage[k.id];
                const money = (c: number | null | undefined) => (c == null ? "—" : `$${(c / 100).toFixed(2)}`);
                const ceiling = k.daily_ceiling_cents ?? null;
                return (
                <div style={{ padding: "0 18px 16px" }}>
                  {/* SPEND FIRST. "What has this cost me" is the question people open a key to answer, and it
                      was the one thing this panel did not say. The figure against the limit is produced by
                      the same function the limit enforces, so it cannot read differently from the refusal. */}
                  <div style={{ display: "flex", gap: 28, flexWrap: "wrap", padding: "12px 14px", background: "var(--bg-2)", borderRadius: "var(--r-sm)", border: "1px solid var(--line-1)" }}>
                    {[
                      ["Spent today", usage === undefined ? "…" : money(usage?.spentTodayCents),
                        ceiling == null ? "No daily limit on this key" : `of ${money(ceiling)} daily limit${usage?.remainingTodayCents != null ? `, ${money(usage.remainingTodayCents)} left` : ""}`],
                      ["Charged, last 30 days", usage === undefined ? "…" : money(usage?.last30d.chargedCents),
                        usage ? `${usage.last30d.runs} verification${usage.last30d.runs === 1 ? "" : "s"}` : ""],
                      ["Charged, all time", usage === undefined ? "…" : money(usage?.allTime.chargedCents),
                        usage ? `${usage.allTime.runs} verification${usage.allTime.runs === 1 ? "" : "s"}` : ""],
                      ["Requests (all time)", reqs.toLocaleString(), k.last_used ? `last ${fmt(k.last_used)}` : "never used"],
                    ].map(([l, v, sub]) => (
                      <div key={l} style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-5)" }}>{l}</div>
                        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--fg-1)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                        {sub ? <div style={{ fontSize: 11, color: "var(--fg-5)", marginTop: 2 }}>{sub}</div> : null}
                      </div>
                    ))}
                  </div>

                  {/* A subscriber's key is charged nothing and still consumes something. Saying only the
                      dollars would tell them the key is free. */}
                  {usage && usage.allTime.flowUnits > 0 ? (
                    <p style={{ fontSize: 11.5, color: "var(--fg-4)", margin: "10px 2px 0" }}>
                      This key has also used <strong style={{ color: "var(--fg-2)" }}>{usage.allTime.flowUnits.toLocaleString()} journey{usage.allTime.flowUnits === 1 ? "" : "s"}</strong> of your plan allowance
                      {usage.allTime.chargedCents === 0 ? ", which is what a verification costs on a plan rather than pay as you go." : "."}
                    </p>
                  ) : null}

                  {/* Every charge traceable to the thing it paid for. A total nobody can break down is a
                      number a customer has to take on trust, which is the opposite of this product. */}
                  {usage && usage.recentRuns.length > 0 ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-5)", marginBottom: 6 }}>Verifications this key launched</div>
                      <div style={{ display: "grid", gap: 4 }}>
                        {usage.recentRuns.slice(0, 8).map((r) => (
                          <Link key={r.id} href={`/records/${r.id}`} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--fg-3)", textDecoration: "none", padding: "5px 8px", borderRadius: 6, background: "var(--bg-2)" }}>
                            <span style={{ fontFamily: "var(--font-code)", color: "var(--fg-5)" }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.deploymentUrl || r.id.slice(0, 8)}</span>
                            {r.flowUnits ? <span style={{ color: "var(--fg-5)" }}>{r.flowUnits} journey{r.flowUnits === 1 ? "" : "s"}</span> : null}
                            <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--fg-2)", fontWeight: 600 }}>{r.chargedCents == null ? "on plan" : money(r.chargedCents)}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <p style={{ fontSize: 11, color: "var(--fg-5)", margin: "10px 2px 0" }}>
                    Spend is read from the verifications this key launched, which is the same record the daily
                    limit is enforced against. Requests are counted separately and include calls that launch
                    nothing, such as pricing a verification or reading a report.
                    {usage === null ? " Spend could not be read just now." : ""}
                  </p>
                </div>
                );
              })()}
            </div>
            );
          })}
        </div>
        </>
      )}

      {/* developer usage analytics */}
      {u && (keys.length > 0 || (u.usage && u.usage.total > 0) || (u.webhook && u.webhook.endpoints > 0)) && (
        <>
          {u.usage && (
            <>
              <div style={slbl}>API usage</div>
              <div className="tile-grid cols-4" style={{ marginBottom: 14 }}>
                <div className="stat"><div className="stat__l">Total requests</div><div className="stat__v tnum">{u.usage.total.toLocaleString()}</div></div>
                <div className="stat"><div className="stat__l">Last 24 hours</div><div className="stat__v tnum">{u.usage.last24h.toLocaleString()}</div></div>
                <div className="stat"><div className="stat__l">Last 7 days</div><div className="stat__v tnum">{u.usage.last7d.toLocaleString()}</div></div>
                <div className="stat"><div className="stat__l">Last activity</div><div className="stat__v tnum" style={{ fontSize: 20 }}>{shortDate(u.usage.lastAt)}</div></div>
              </div>
              {u.usage.byEndpoint.length > 0 && (
                <div className="card" style={{ marginBottom: 14 }}>
                  <div style={cardHead}>Endpoints</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {u.usage.byEndpoint.map((e, i) => (
                      <div key={e.method + e.endpoint} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                        <span style={{ fontSize: 13.5, color: "var(--fg-1)" }}><span style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)", marginRight: 8 }}>{e.method}</span>{ENDPOINT_LABEL[e.endpoint] ?? e.endpoint}</span>
                        <span style={{ fontFamily: "var(--font-code)", fontSize: 13, color: "var(--fg-2)" }}>{e.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: 10, marginBottom: 0 }}>Request volume by endpoint. Per-request status and error analytics will appear once status logging is added.</p>
                </div>
              )}
            </>
          )}

          {u.webhook && (
            <>
              <div style={slbl}>Webhook reliability</div>
              {u.webhook.endpoints > 0 ? (
                <div className="tile-grid cols-4" style={{ marginBottom: 14 }}>
                  <div className="stat"><div className="stat__l">Deliveries</div><div className="stat__v tnum">{u.webhook.total.toLocaleString()}</div><div className="stat__s">{u.webhook.endpoints} endpoint{u.webhook.endpoints === 1 ? "" : "s"}</div></div>
                  <div className="stat"><div className="stat__l">Success rate</div><div className="stat__v tnum">{u.webhook.total ? Math.round((u.webhook.success / u.webhook.total) * 100) : 0}%</div><div className="stat__s">{u.webhook.success.toLocaleString()} delivered</div></div>
                  <div className="stat"><div className="stat__l">Failed</div><div className="stat__v tnum">{u.webhook.failed.toLocaleString()}</div><div className="stat__s">{u.webhook.retried.toLocaleString()} retried</div></div>
                  <div className="stat"><div className="stat__l">Last delivery</div><div className="stat__v tnum" style={{ fontSize: 20 }}>{shortDate(u.webhook.lastAt)}</div></div>
                </div>
              ) : (
                <div className="empty" style={{ marginBottom: 14 }}><EmptyIcon d={I.swap} /><h3>No webhooks yet</h3><p>Add an endpoint below to receive a signed verification.completed event the moment a verification finishes. Delivery success, failures, and retries show here.</p></div>
              )}
            </>
          )}

          {u.recent && u.recent.length > 0 && (
            <>
              <div style={slbl}>Recent developer activity</div>
              <div className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {u.recent.map((e, i) => {
                    const detail = e.metadata?.endpoint ? (ENDPOINT_LABEL[String(e.metadata.endpoint)] ?? String(e.metadata.endpoint)) : e.metadata?.format ? String(e.metadata.format).toUpperCase() : "";
                    return (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                        <span style={{ fontSize: 13.5, color: "var(--fg-1)" }}>{DEV_EVENT_LABEL[e.event_type] ?? e.event_type}{detail ? <span style={{ fontSize: 12, color: "var(--fg-4)", marginLeft: 8 }}>{detail}</span> : null}</span>
                        <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)" }}>{shortDate(e.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {u && u.signedIn && !u.hasApiAccess && (
        <div className="card" style={{ marginTop: 8, marginBottom: 24, background: "var(--bg-2)" }}>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0 }}>The public API, webhooks, and usage analytics are part of the <b style={{ color: "var(--fg-1)" }}>Scale</b> plan. <Link href="/plans" style={{ color: "var(--acc-deep)" }}>See plans →</Link></p>
        </div>
      )}

      {/* docs. id="ci-gate" is the target of the "See the CI gate" button above: the CURL below IS the CI
          integration (launch a verification, poll for the decision, ship only when it is Verified). */}
      <div id="ci-gate" style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12, marginTop: 28, scrollMarginTop: 80 }}>Quickstart: gate a deploy from CI</div>
      <div className="codebar"><i /><i /><i /><span>shell</span></div>
      <pre className="codeblock"><code>{CURL}</code></pre>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 14, lineHeight: 1.6 }}>
        Verifications launched over the API draw on the same account balance as the web app. Auth via <code style={{ color: "var(--fg-3)" }}>X-Api-Key</code> or <code style={{ color: "var(--fg-3)" }}>Authorization: Bearer</code>.
      </p>

      <CliSection />

      <div id="webhooks" style={{ scrollMarginTop: 80 }}><WebhooksSection /></div>
    </div>
  );
}
