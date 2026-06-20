import type { Metadata } from "next";
import { auth } from "@/auth";
import { getOrCreateFlipAccount, listUserItems, FLIP_FREE_SIGNED_IN } from "@/lib/flip-db";
import { UpgradeButton } from "./upgrade-button";

export const metadata: Metadata = { title: "Your account — Vraelis" };

const MONO = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" } as const;

function fmtDate(s: string): string {
  try { return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return ""; }
}

export default async function FlipAccount() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  // Signed-out gate.
  if (!email) {
    return (
      <section className="section" style={{ borderBottom: "none" }}>
        <div className="wrap" style={{ maxWidth: 520, textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Account</p>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginBottom: 14 }}>
            Your saved <span className="em">listings</span>.
          </h1>
          <p className="lead-copy" style={{ margin: "0 auto 28px" }}>Sign in to keep your listing history, manage your plan, and connect your marketplaces.</p>
          <a href="/signin?callbackUrl=%2Faccount" className="btn btn--lg">Continue with Google</a>
        </div>
      </section>
    );
  }

  const [account, items] = await Promise.all([getOrCreateFlipAccount(email), listUserItems(email, 24)]);
  const isPro = account?.plan === "pro";
  const used = account?.free_used ?? 0;
  const remaining = Math.max(0, FLIP_FREE_SIGNED_IN - used);

  return (
    <div className="wrap" style={{ maxWidth: 1040, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: "clamp(24px, 3vw, 36px)" }}>
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)" }}>Your listings</h1>
          <p style={{ ...MONO, marginTop: 8, textTransform: "none", letterSpacing: 0, fontSize: 13, color: "var(--fg-4)" }}>{email}</p>
        </div>
        <a href="/app" className="btn">Make a listing <span aria-hidden>→</span></a>
      </div>

      {/* plan + quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)", gap: 14, marginBottom: 28 }} className="cols-stack">
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={MONO}>Plan</span>
            <span className={`pill ${isPro ? "st-won" : ""}`}><span className="dot" />{isPro ? "Pro" : "Free"}</span>
          </div>
          {isPro ? (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>Unlimited listings</div>
              <p style={{ fontSize: 13, color: "var(--fg-4)" }}>Thanks for going Pro. List as much as you source.</p>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>{remaining} of {FLIP_FREE_SIGNED_IN} free left</div>
              <UpgradeButton className="btn" />
            </>
          )}
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
          <span style={MONO}>Listings made</span>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--fg-1)", lineHeight: 1 }}>{items.length}{items.length >= 24 ? "+" : ""}</div>
        </div>
        <a href="/connections" className="card card--hover" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, textDecoration: "none" }}>
          <span style={MONO}>Marketplaces</span>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>eBay · Poshmark · Depop · Mercari</div>
          <span style={{ fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600 }}>Manage connections →</span>
        </a>
      </div>

      {/* listings history */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--fg-1)", letterSpacing: "-0.01em" }}>Recent listings</h2>
        <span style={MONO}>{items.length} saved</span>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "clamp(32px, 5vw, 56px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)", marginBottom: 8 }}>No listings yet</div>
          <p style={{ fontSize: 14, color: "var(--fg-3)", marginBottom: 20 }}>Photograph your first item and it&apos;ll show up here.</p>
          <a href="/app" className="btn">Make your first listing <span aria-hidden>→</span></a>
        </div>
      ) : (
        <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--bg-1)", boxShadow: "var(--shadow-card)" }}>
          {items.map((it, i) => {
            const title = it.generated?.titles?.ebay || it.detected?.item_type || "Listing";
            const p = it.suggested_price;
            return (
              <div key={it.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 14, alignItems: "center", padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
                  <div style={{ ...MONO, marginTop: 4, textTransform: "none", letterSpacing: 0, fontSize: 12 }}>
                    {it.detected?.category || "Item"}{it.detected?.condition_grade ? ` · ${it.detected.condition_grade}` : ""}
                  </div>
                </div>
                {p?.market != null ? (
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--acc-deep)", whiteSpace: "nowrap" }}>${p.fast}–${p.high}</span>
                ) : <span />}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", whiteSpace: "nowrap" }}>{fmtDate(it.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
