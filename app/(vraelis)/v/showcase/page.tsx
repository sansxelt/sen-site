import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "Showcase — Vraelis",
  robots: { index: false, follow: false },
};

// Admin-only. Not linked anywhere public; non-admins are bounced to /account.
// This is an internal page used only to produce ad creative.
const ADMIN_EMAILS = ["sansxeltech@gmail.com"];

const CREATORS = [
  { handle: "tjr", followers: "1.4M" },
  { handle: "brezscales", followers: "920K" },
  { handle: "mrfine", followers: "1.1M" },
  { handle: "paid", followers: "640K" },
  { handle: "fdt", followers: "210K" },
  { handle: "8ball", followers: "780K" },
  { handle: "wogotrich", followers: "1.6M" },
  { handle: "richoffdebtsforlife", followers: "540K" },
];

const COLORS = ["#0E9E6C", "#2563EB", "#7C3AED", "#C2540C", "#0D9488", "#BE185D", "#15803D", "#9333EA"];

export default async function ShowcasePage() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (!ADMIN_EMAILS.includes(email)) redirect("/v/account");

  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 1040 }}>
        <p className="eyebrow">Built on Instagram</p>
        <h1 className="display" style={{ fontSize: "clamp(2rem,4vw,3.2rem)", marginBottom: 12, maxWidth: 760 }}>
          They turned a phone into <span className="em">real money.</span>
        </h1>
        <p style={{ fontSize: 16, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: 600, marginBottom: "clamp(28px,4vw,44px)" }}>
          Creators who built serious income straight off Instagram. The next move is automating the part that actually makes the money.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "clamp(14px,2vw,20px)" }}>
          {CREATORS.map((c, i) => (
            <div
              key={c.handle}
              style={{
                background: "var(--bg-1)",
                border: "1px solid var(--line-2)",
                borderRadius: "var(--r-sm)",
                boxShadow: "var(--shadow-card)",
                padding: "20px 18px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span
                className="av"
                style={{ width: 48, height: 48, flexShrink: 0, background: COLORS[i % COLORS.length], fontSize: 17, fontWeight: 700 }}
              >
                {c.handle.slice(0, 2).toUpperCase()}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--fg-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  @{c.handle}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--fg-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
                    <rect x="2" y="2" width="20" height="20" rx="5.5" />
                    <circle cx="12" cy="12" r="4.2" />
                    <circle cx="17.4" cy="6.6" r="1.1" fill="var(--fg-4)" stroke="none" />
                  </svg>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)" }}>{c.followers} followers</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
