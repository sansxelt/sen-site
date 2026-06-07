import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact sales — Vraelis",
  description: "Talk to the Vraelis team about Agency plans, multiple workspaces, and per-client pipelines.",
};

export default function VraelisContactPage() {
  return (
    <section className="section" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.4 }} />
      <div className="wrap" style={{ position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "clamp(28px, 5vw, 64px)", alignItems: "center" }} className="cols-stack">
          <div>
            <p className="eyebrow">Contact sales</p>
            <h1 className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.2rem)", marginBottom: 16 }}>
              Let&apos;s scope your <span className="mark"><span>rollout.</span></span>
            </h1>
            <p className="lead-copy" style={{ marginBottom: 18 }}>
              For agencies and teams running leads across multiple clients — multiple workspaces, per-client pipelines, shared inboxes, and custom terms.
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)" }}>
              Prefer email? <a href="mailto:sales@vraelis.com" style={{ color: "var(--acc-deep)", fontWeight: 600 }}>sales@vraelis.com</a>
            </p>
          </div>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
