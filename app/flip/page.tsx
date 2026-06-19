import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flip Engine — list a thrift find in 10 seconds",
  description:
    "Snap your item, get a finished resale listing — platform titles for eBay, Poshmark, Depop & Mercari, a clean description, keywords, and a price range. Free for 3 listings.",
};

const PAPER = "#FBFAF8";
const INK = "#16130F";
const MUT = "#6B6258";
const ACC = "#0E8A4F";
const LINE = "#E9E4DB";

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={{ flex: "1 1 220px" }}>
      <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, color: ACC, fontWeight: 700, marginBottom: 8 }}>{n}</div>
      <div style={{ fontSize: 17, fontWeight: 650, color: INK, marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 14.5, color: MUT, lineHeight: 1.55, margin: 0 }}>{body}</p>
    </div>
  );
}

export default function FlipLanding() {
  return (
    <main style={{ background: PAPER, color: INK, minHeight: "100svh", fontFamily: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <style>{FLIP_CSS}</style>

      {/* nav */}
      <header style={{ maxWidth: 1080, margin: "0 auto", padding: "20px clamp(18px,4vw,40px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/flip" style={{ textDecoration: "none", color: INK, fontWeight: 800, fontSize: 19, letterSpacing: "-0.02em" }}>
          Flip<span style={{ color: ACC }}>Engine</span>
        </Link>
        <Link href="/flip/app" className="flip-btn flip-btn--ghost">Try it free</Link>
      </header>

      {/* hero */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(28px,5vw,64px) clamp(18px,4vw,40px) clamp(40px,6vw,72px)", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: "clamp(28px,5vw,56px)", alignItems: "center" }} className="flip-hero">
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: ACC, background: "rgba(14,138,79,0.08)", border: "1px solid rgba(14,138,79,0.22)", padding: "5px 11px", borderRadius: 999, marginBottom: 18 }}>
            For resellers, by the photo
          </div>
          <h1 style={{ fontSize: "clamp(2.1rem, 5.2vw, 3.5rem)", lineHeight: 1.04, letterSpacing: "-0.03em", fontWeight: 800, margin: "0 0 16px" }}>
            List a thrift find in <span style={{ color: ACC }}>10 seconds</span>.
          </h1>
          <p style={{ fontSize: "clamp(1.02rem,1.5vw,1.18rem)", color: MUT, lineHeight: 1.55, maxWidth: 480, margin: "0 0 26px" }}>
            Snap your item. Flip Engine writes the whole listing — keyword-tuned titles for eBay, Poshmark, Depop & Mercari, a clean description, hashtags, and a fast/market/high price range.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/flip/app" className="flip-btn flip-btn--solid">Try it free →</Link>
            <a href="#how" className="flip-btn flip-btn--ghost">How it works</a>
          </div>
          <p style={{ fontSize: 13, color: MUT, marginTop: 14 }}>3 listings free · no card to start.</p>
        </div>

        {/* before/after visual */}
        <div className="flip-ba" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ borderRadius: 16, border: `1px solid ${LINE}`, background: "#fff", overflow: "hidden", boxShadow: "0 30px 60px -34px rgba(22,19,15,0.35)" }}>
            <div style={{ aspectRatio: "3/4", background: "repeating-linear-gradient(45deg,#F1ECE3,#F1ECE3 12px,#EDE7DD 12px,#EDE7DD 24px)", display: "grid", placeItems: "center", color: MUT, fontSize: 13 }}>your photo</div>
            <div style={{ padding: "10px 12px", fontSize: 11.5, color: MUT, borderTop: `1px solid ${LINE}` }}>before</div>
          </div>
          <div style={{ borderRadius: 16, border: `1px solid ${LINE}`, background: "#fff", overflow: "hidden", boxShadow: "0 30px 60px -34px rgba(22,19,15,0.35)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 14, fontSize: 12, lineHeight: 1.5, color: INK, flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12.5 }}>Patagonia Better Sweater 1/4 Zip Mens M Gray Fleece Pullover EUC</div>
              <div style={{ color: MUT }}>Cozy classic fleece, barely worn…</div>
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["$48 fast", "$62 market", "$78 high"].map((p) => (
                  <span key={p} style={{ fontSize: 10.5, fontWeight: 600, color: ACC, background: "rgba(14,138,79,0.08)", border: "1px solid rgba(14,138,79,0.2)", borderRadius: 999, padding: "3px 8px" }}>{p}</span>
                ))}
              </div>
            </div>
            <div style={{ padding: "10px 12px", fontSize: 11.5, color: ACC, fontWeight: 600, borderTop: `1px solid ${LINE}` }}>after · ready to post</div>
          </div>
        </div>
      </section>

      {/* how */}
      <section id="how" style={{ background: "#fff", borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(40px,6vw,72px) clamp(18px,4vw,40px)" }}>
          <h2 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", letterSpacing: "-0.02em", fontWeight: 750, margin: "0 0 28px" }}>From shelf to sold, three steps.</h2>
          <div style={{ display: "flex", gap: "clamp(20px,3vw,40px)", flexWrap: "wrap" }}>
            <Step n="01" title="Upload 1–5 photos" body="Drag in phone shots of your item — front, tag, any flaws. No lightbox required." />
            <Step n="02" title="Generate the listing" body="One click. You get four platform titles, a description, keywords, hashtags, and a price range." />
            <Step n="03" title="Copy & post" body="Tap to copy each field into eBay, Poshmark, Depop, or Mercari. Done." />
          </div>
        </div>
      </section>

      {/* pricing */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(40px,6vw,72px) clamp(18px,4vw,40px)" }}>
        <h2 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", letterSpacing: "-0.02em", fontWeight: 750, margin: "0 0 28px", textAlign: "center" }}>Start free. Go Pro when it pays for itself.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, maxWidth: 720, margin: "0 auto" }} className="flip-price">
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 18, padding: 26, background: "#fff" }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Free</div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", margin: "6px 0 2px" }}>$0</div>
            <div style={{ color: MUT, fontSize: 13.5, marginBottom: 16 }}>3 listings to try it.</div>
            <Link href="/flip/app" className="flip-btn flip-btn--ghost" style={{ width: "100%", justifyContent: "center" }}>Start free</Link>
          </div>
          <div style={{ border: `1.5px solid ${ACC}`, borderRadius: 18, padding: 26, background: "#fff", boxShadow: "0 30px 60px -38px rgba(14,138,79,0.5)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: ACC }}>Pro</div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", margin: "6px 0 2px" }}>$19<span style={{ fontSize: 15, fontWeight: 500, color: MUT }}>/mo</span></div>
            <div style={{ color: MUT, fontSize: 13.5, marginBottom: 16 }}>Unlimited listings.</div>
            <Link href="/flip/app" className="flip-btn flip-btn--solid" style={{ width: "100%", justifyContent: "center" }}>Get Pro</Link>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${LINE}`, padding: "26px clamp(18px,4vw,40px)", textAlign: "center", color: MUT, fontSize: 12.5 }}>
        Flip Engine · <Link href="/flip/app" style={{ color: ACC }}>Try it free</Link>
      </footer>
    </main>
  );
}

const FLIP_CSS = `
.flip-btn{ display:inline-flex; align-items:center; gap:8px; padding:11px 20px; border-radius:11px; font-size:14.5px; font-weight:650; text-decoration:none; cursor:pointer; transition:transform .12s ease, background .15s ease, border-color .15s ease; }
.flip-btn--solid{ background:#0E8A4F; color:#fff; border:1px solid #0E8A4F; }
.flip-btn--solid:hover{ background:#0B7340; border-color:#0B7340; }
.flip-btn--ghost{ background:#fff; color:#16130F; border:1px solid #E0DACF; }
.flip-btn--ghost:hover{ border-color:#16130F; }
@media (max-width:780px){ .flip-hero{ grid-template-columns:1fr !important; } .flip-ba{ max-width:420px; } .flip-price{ grid-template-columns:1fr !important; } }
`;
