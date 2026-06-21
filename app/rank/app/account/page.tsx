import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureProfile, getPlan, getSubscription } from "@/lib/v-db";
import { balance } from "@/lib/v-credits";
import { SignOutButton } from "../../_components/rank-ui";

export const metadata: Metadata = { title: "Account" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Faccount");

  await ensureProfile(email, session.user?.name ?? undefined);
  const [bal, plan, sub] = await Promise.all([balance(email), getPlan(email), getSubscription(email)]);
  const planName = plan === "free" ? "Free" : cap(plan);
  const status = sub?.status ?? "active";
  const renews = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;

  const linkCard = (href: string, title: string, desc: string) => (
    <a href={href} className="acard" style={{ textDecoration: "none", gap: 6 }}>
      <div className="acard__t" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{title}<span style={{ color: "var(--acc-deep)" }} aria-hidden>→</span></div>
      <div className="acard__d">{desc}</div>
    </a>
  );

  return (
    <div className="wrap" style={{ maxWidth: 940, paddingTop: "clamp(24px, 3vw, 36px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="display">Your account</h1>
        </div>
      </div>

      {/* identity */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <span aria-hidden style={{ width: 52, height: 52, borderRadius: 14, flex: "none", background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22 }}>{email.slice(0, 1).toUpperCase()}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
          <div style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 2 }}>Signed in with Google</div>
        </div>
        <span className="badge-now" style={{ marginLeft: "auto" }}>{planName} plan</span>
      </div>

      {/* stats */}
      <div className="tile-grid cols-3" style={{ marginBottom: 26 }}>
        <div className="stat"><div className="stat__l">Plan</div><div className="stat__v">{planName}</div><div className="stat__s">{plan === "free" ? "No subscription" : `Status: ${status}`}{renews ? `, renews ${renews}` : ""}</div></div>
        <div className="stat"><div className="stat__l">Credit balance</div><div className="stat__v tnum">{bal.toLocaleString()}</div><div className="stat__s">1 credit = 1 valid human judgment</div></div>
        <div className="stat"><div className="stat__l">Monthly credits</div><div className="stat__v tnum">{(sub?.monthly_credits ?? 0).toLocaleString()}</div><div className="stat__s">{plan === "free" ? "Upgrade for monthly credits" : "Refreshed each cycle"}</div></div>
      </div>

      {/* manage */}
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Manage</div>
      <div className="tile-grid cols-2" style={{ marginBottom: 26 }}>
        {linkCard("/app/plans", "Plan", plan === "free" ? "Upgrade to unlock monthly credits and higher limits." : "Change plan, see what's included, or switch cycle.")}
        {linkCard("/app/billing", "Billing", "Subscription status, renewal, cancel or resume, payment.")}
        {linkCard("/app/credits", "Credits", "Top up your balance with packs or a custom amount.")}
        {linkCard("/app/api-keys", "API & webhooks", "Create API keys, manage webhook endpoints and deliveries.")}
        {linkCard("/app/data", "Data & exports", "Aggregate results and JSON / CSV exports of your tests.")}
        {linkCard("/vote", "Vote & earn", "Vote on other tests and earn credits back.")}
      </div>

      {/* security */}
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Security</div>
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>Sign out of Vraelis</div>
          <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 2 }}>End your session on this device. You can sign back in anytime.</div>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
