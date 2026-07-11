import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureProfile, getPlan, getSubscription } from "@/lib/v-db";
import { balance } from "@/lib/v-credits";
import { recentAccountEvents } from "@/lib/v-events";
import { SignOutButton } from "../../_components/rank-ui";
import { DeleteAccount } from "./delete-account";
import { AccountRequests } from "./account-requests";

export const metadata: Metadata = { title: "Account" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ACTIVITY_LABEL: Record<string, string> = {
  api_key_created: "API key created", api_key_revoked: "API key revoked",
  webhook_endpoint_created: "Webhook added", webhook_endpoint_updated: "Webhook updated",
  webhook_endpoint_deleted: "Webhook removed", webhook_secret_rotated: "Webhook secret rotated",
  webhook_test_sent: "Webhook test sent", public_report_enabled: "Public report enabled",
  public_report_disabled: "Public report disabled", public_report_regenerated: "Public link regenerated",
  export_downloaded: "Export downloaded", data_export_requested: "Data export requested",
  data_correction_requested: "Correction requested", account_delete_requested: "Account deletion requested",
  privacy_question_submitted: "Privacy question submitted",
};

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Faccount");

  await ensureProfile(email, session.user?.name ?? undefined);
  const [bal, plan, sub, activity] = await Promise.all([balance(email), getPlan(email), getSubscription(email), recentAccountEvents(email, 8)]);
  const planName = plan === "free" ? "Free" : cap(plan);
  const status = sub?.status ?? "active";
  const renews = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;

  const linkCard = (href: string, title: string, desc: string) => (
    <Link href={href} className="acard" style={{ textDecoration: "none", gap: 6 }}>
      <div className="acard__t" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{title}<span style={{ color: "var(--acc-deep)" }} aria-hidden>→</span></div>
      <div className="acard__d">{desc}</div>
    </Link>
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
        <div className="stat"><div className="stat__l">Credit balance</div><div className="stat__v tnum">{bal.toLocaleString()}</div><div className="stat__s">1 credit = 1 AI check</div></div>
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
      </div>

      {/* account activity (your own audit trail) */}
      {activity.length > 0 && (
        <>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Recent account activity</div>
          <div className="card" style={{ marginBottom: 26, padding: "6px 18px" }}>
            {activity.map((e, i) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                <span style={{ fontSize: 13.5, color: "var(--fg-1)" }}>{ACTIVITY_LABEL[e.event_type] ?? e.event_type}{e.metadata?.name ? <span style={{ fontSize: 12, color: "var(--fg-4)", marginLeft: 8 }}>{String(e.metadata.name)}</span> : null}</span>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)" }}>{new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* data & privacy requests */}
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Data &amp; privacy</div>
      <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginTop: -4, marginBottom: 14, maxWidth: 620, lineHeight: 1.55 }}>Submit a request to export, correct, or delete your data. Requests are reviewed manually, and some records may be retained where required. See <Link href="/data-rights" style={{ color: "var(--acc-deep)" }}>Data rights</Link>.</p>
      <div style={{ marginBottom: 26 }}>
        <AccountRequests />
      </div>

      {/* security */}
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Security</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>Sign out</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 2 }}>End your session on this device. You can sign back in anytime.</div>
          </div>
          <SignOutButton />
        </div>
        <DeleteAccount />
      </div>
    </div>
  );
}
