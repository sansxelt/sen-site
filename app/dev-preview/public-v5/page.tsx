import type { Metadata } from "next";
import Link from "next/link";
import { RankShell } from "@/app/rank/_components/rank-ui";
import { HeroWorld } from "./hero-world";
import { Conflict } from "./conflict";
import { Flagship } from "@/app/dev-preview/public-v4/flagship";

// Not indexable: a framing prototype for the Design 05 public site. The live homepage is untouched; nothing is
// merged. Scene 1 establishes the category and the world; Scene 2 is the conflict; Scene 3 is the v4 Guarantee
// console, now with context; then the beginning of the real production proof.
export const metadata: Metadata = { title: "Vraelis, public-v5 prototype", robots: { index: false, follow: false } };

const monoLbl = { fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const } as const;

function Rec({ verdict, dep, note, tone }: { verdict: string; dep: string; note: string; tone: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 15px", border: "1px solid var(--line-2)", borderRadius: 12, background: "var(--bg-1)", boxShadow: "var(--shadow-sm)" }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: tone, flex: "none", marginTop: 4 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5 }}><span style={{ color: tone, fontWeight: 700 }}>{verdict}</span> <span style={{ color: "var(--fg-3)" }}>on</span> <span style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-2)" }}>{dep}</span></div>
        <div style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, marginTop: 3 }}>{note}</div>
      </div>
    </div>
  );
}

export default function PublicV5() {
  return (
    <RankShell signedIn={false}>
      {/* ── SCENE 1: the category, then the whole world in one sight ── */}
      <section style={{ position: "relative" }}>
        <div className="glow glow--bleed" />
        <div className="grid-faint" style={{ opacity: 0.5 }} />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(24px, 3.2vw, 46px)", paddingBottom: "clamp(30px, 4vw, 56px)" }}>
          <div style={{ maxWidth: 780, marginBottom: "clamp(26px, 3.4vw, 44px)" }}>
            <p className="eyebrow rise" data-d="1">Independent proof for software built with AI</p>
            <h1 className="display rise" data-d="2" style={{ fontSize: "clamp(2.5rem, 5.2vw, 4.5rem)", margin: "0 0 20px", lineHeight: 1.03, textWrap: "balance" }}>
              AI builds. <span className="em">Vraelis proves.</span>
            </h1>
            <p className="lead-copy rise" data-d="3" style={{ fontSize: "clamp(1.08rem, 1.4vw, 1.34rem)", color: "var(--fg-2)", maxWidth: 660, margin: "0 0 26px", lineHeight: 1.5 }}>
              Keep the requirements your company depends on outside the code, then independently verify the live software against them. The agent can change the code. It cannot change what the business requires Vraelis to prove.
            </p>
            <div className="rise" data-d="4" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Verify an application <span aria-hidden>→</span></Link>
              <a href="#product" className="btn btn--ghost btn--lg">See a real verification</a>
            </div>
          </div>
          <div className="rise" data-d="5"><HeroWorld /></div>
        </div>
      </section>

      {/* ── SCENE 2: the conflict ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: "clamp(22px, 3vw, 34px)" }}>
            <p className="eyebrow">The problem only Vraelis solves</p>
            <h2 className="display">The builder cannot be the judge.</h2>
            <p>The agent that writes the software also writes its tests and can declare its own work complete. Vraelis judges from outside that boundary, against what the business requires, not against what the agent asserts.</p>
          </div>
          <Conflict />
        </div>
      </section>

      {/* ── SCENE 3: the product (the v4 Guarantee console, now with context) ── */}
      <section id="product" className="section" style={{ scrollMarginTop: 80 }}>
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: "clamp(22px, 3vw, 34px)" }}>
            <p className="eyebrow">The product</p>
            <h2 className="display">Define a guarantee. Vraelis keeps it proven.</h2>
            <p>State what must always be true, review the exact proof plan, approve it once. Then Vraelis proves it against the live software and preserves every verification as a separate record.</p>
          </div>
          <Flagship />
        </div>
      </section>

      {/* ── The beginning of the real production proof ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap" style={{ maxWidth: 900 }}>
          <div className="sec-head" style={{ marginBottom: "clamp(20px, 2.6vw, 30px)" }}>
            <p className="eyebrow">Proof, not a promise</p>
            <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)" }}>One requirement, three preserved records.</h2>
            <p>The real production lineage behind a paid-access guarantee: a failure caught, an incomplete repair rejected, and the full repair independently verified. Each record is kept.</p>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <Rec verdict="Failed" dep="8f21ad" note="Payment succeeded, but the account still reported Free afterwards." tone="#A8452A" />
            <Rec verdict="Failed" dep="9d20b7" note="Pro applied at checkout, then was lost after signing back in. The incomplete repair was rejected on its own evidence." tone="#A8452A" />
            <Rec verdict="Verified" dep="ff9d6c" note="The full repair held. Access granted and retained across a fresh sign-in." tone="var(--acc-deep)" />
          </div>
          <p style={{ ...monoLbl, color: "var(--fg-4)", marginTop: 14, textTransform: "none", fontWeight: 400, fontSize: 11.5, lineHeight: 1.5 }}>
            Illustrative, reproducing a real production verification lineage. No fabricated customers, logos, or metrics.
          </p>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 720, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.2rem)", marginBottom: 18 }}>Hold the line the agent <span className="em">cannot cross</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 28px", textAlign: "center" }}>
            Put your critical requirements outside the code, and let Vraelis prove the live software against them, verification after verification.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Verify an application <span aria-hidden>→</span></Link>
            <Link href="/how-it-works" className="btn btn--ghost btn--lg">See how it works</Link>
          </div>
        </div>
      </section>
    </RankShell>
  );
}
