import type { Metadata } from "next";
import Link from "next/link";
import { RankShell } from "@/app/rank/_components/rank-ui";
import { Flagship } from "./flagship";

// Not indexable: a review prototype for the Design 05 public-v4 flagship, not a shipping route. The live
// homepage is untouched; nothing here is merged.
export const metadata: Metadata = { title: "Vraelis, public-v4 prototype", robots: { index: false, follow: false } };

const monoLbl = { fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12 } as const;

function ProofItem({ children }: { children: React.ReactNode }) {
  return <li style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, color: "var(--fg-2)", lineHeight: 1.5 }}><span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, background: "var(--acc-deep)", flex: "none", marginTop: 8 }} />{children}</li>;
}
function NextItem({ children }: { children: React.ReactNode }) {
  return <li style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.5 }}><span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, border: "1px solid var(--fg-4)", flex: "none", marginTop: 8 }} />{children}</li>;
}

export default function PublicV4() {
  return (
    <RankShell signedIn={false}>
      {/* ── First viewport: the flagship Guarantee console leads directly, no separate headline hero ── */}
      <section style={{ position: "relative" }}>
        <div className="glow glow--bleed" />
        <div className="grid-faint" style={{ opacity: 0.5 }} />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(20px, 2.6vw, 36px)", paddingBottom: "clamp(28px, 4vw, 52px)" }}>
          <Flagship />
        </div>
      </section>

      {/* ── What a Guarantee is + what is proven today vs. what is Next (direction, clearly marked) ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: "clamp(24px, 3.5vw, 40px)" }}>
            <p className="eyebrow">What a Guarantee is</p>
            <h2 className="display">A durable business requirement, held outside the code.</h2>
            <p>You state what your product must always do. Vraelis structures it into proof obligations, a human approves the exact plan once, and Vraelis proves it, keeping every verification as a separate record that a later pass never overwrites.</p>
          </div>
          <div className="cols-stack" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(24px, 4vw, 56px)", alignItems: "start" }}>
            <div>
              <div style={{ ...monoLbl, color: "var(--acc-deep)" }}>Proven today</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 11 }}>
                <ProofItem>Connect a system and define its critical guarantees</ProofItem>
                <ProofItem>Vraelis derives the proof plan, a human approves it once</ProofItem>
                <ProofItem>Live browser verification against the deployed system</ProofItem>
                <ProofItem>Evidence, findings, and a repair prompt for the coding agent</ProofItem>
                <ProofItem>Verified, Failed, or Blocked, with every record preserved</ProofItem>
              </ul>
            </div>
            <div>
              <div style={{ ...monoLbl, color: "var(--fg-4)" }}>Next</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 11 }}>
                <NextItem>Reverify every guarantee automatically on each new deployment</NextItem>
                <NextItem>A live coverage map of what the business depends on</NextItem>
                <NextItem>One aggregate release decision across a system's guarantees</NextItem>
                <NextItem>An API loop a coding agent can build and repair against</NextItem>
              </ul>
              <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, margin: "14px 0 0", maxWidth: 420 }}>
                Direction, not today&rsquo;s coverage. Everything under Next is marked so, never shown as shipping.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 720, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.2rem)", marginBottom: 18 }}>Keep what matters <span className="em">proven</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 28px", textAlign: "center" }}>
            Define your critical guarantees, approve their proof once, and let Vraelis prove them, verification after verification.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Define a guarantee <span aria-hidden>→</span></Link>
            <Link href="/how-it-works" className="btn btn--ghost btn--lg">See how it works</Link>
          </div>
        </div>
      </section>
    </RankShell>
  );
}
