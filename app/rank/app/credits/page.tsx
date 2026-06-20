import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { ensureSignupGrant, balance } from "@/lib/v-credits";

export const metadata: Metadata = { title: "Credits — Vraelis" };

const PACKS: { sku: string; credits: number; price: string; tag?: string }[] = [
  { sku: "pack_100", credits: 100, price: "$9" },
  { sku: "pack_500", credits: 500, price: "$39", tag: "Popular" },
  { sku: "pack_1000", credits: 1000, price: "$69" },
  { sku: "pack_5000", credits: 5000, price: "$299" },
  { sku: "pack_10000", credits: 10000, price: "$499", tag: "Best value" },
];

export default async function CreditsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fcredits");
  await ensureProfile(email, session.user?.name ?? undefined);
  await ensureSignupGrant(email);
  const bal = await balance(email);

  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <p className="eyebrow">Credits</p>
          <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)" }}>Top up</h1>
        </div>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--fg-1)" }}>{bal}<span style={{ fontSize: 13, color: "var(--fg-4)", fontWeight: 500, marginLeft: 6 }}>credits</span></span>
      </div>
      <p className="lead-copy" style={{ marginBottom: 28 }}>1 credit = 1 real human vote. Buy a pack — credits don&apos;t expire, and you can also earn them by voting.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {PACKS.map((p) => (
          <div key={p.sku} className="card" style={{ display: "flex", flexDirection: "column", gap: 6, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--fg-1)" }}>{p.credits.toLocaleString()}</span>
              {p.tag && <span className="pill st-won"><span className="dot" />{p.tag}</span>}
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>credits</span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--acc-deep)" }}>{p.price}</span>
              <a href={`/app/checkout?sku=${p.sku}`} className="btn" style={{ padding: "8px 16px", fontSize: 13.5 }}>Buy</a>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", marginTop: 22 }}>
        Out of credits and don&apos;t want to pay? <a href="/vote" style={{ color: "var(--acc-deep)" }}>Vote on others&apos; tests to earn them →</a>
      </p>
    </div>
  );
}
