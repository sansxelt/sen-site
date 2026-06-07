import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Stripe from "stripe";
import { getOrCreateWorkspace, getPaymentsSummary, getWorkspaceCalendar, getWorkspaceContact, getWorkspaceServices, listLeads, setWorkspaceConnect, setWorkspacePlan, type LeadStatus, type VraelisLead } from "@/lib/vraelis-db";
import { listUpcomingBookings, slotLabel } from "@/lib/vraelis-booking";
import { getAccountStatus } from "@/lib/vraelis-connect";
import { cutRateFor, isCycle, isPlanKey } from "@/lib/vraelis-plans";
import { AddLeadForm } from "./add-lead-form";
import { BusinessForm } from "./business-form";
import { SmsForm } from "./sms-form";
import { DepositForm } from "./deposit-form";
import { CopyField } from "./copy-field";
import { AccountTabs, type Step } from "./account-tabs";
import { vraelisSignOut, sendTestLead } from "./actions";

export const metadata: Metadata = {
  title: "Your account — Vraelis",
  robots: { index: false, follow: false },
};

const ORIGIN = "https://vraelis.com";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New", contacted: "Contacted", qualifying: "Qualifying", qualified: "Qualified",
  booking_ready: "Booking", needs_owner: "Needs you", booked: "Booked", won: "Won", lost: "Lost",
};
const STATUS_CLASS: Record<LeadStatus, string> = {
  new: "st-new", contacted: "st-contacted", qualifying: "st-qualified", qualified: "st-qualified",
  booking_ready: "st-booked", needs_owner: "st-new", booked: "st-booked", won: "st-won", lost: "st-contacted",
};

const AV_COLORS = ["#0E9E6C", "#2563EB", "#7C3AED", "#C2540C", "#0D9488", "#BE185D"];
function initials(s: string) {
  const w = s.replace(/[^a-zA-Z ]/g, "").trim().split(/\s+/);
  return ((w[0]?.[0] || "") + (w[1]?.[0] || "")).toUpperCase() || "·";
}
function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function StatCard({ label, value, sub, subAccent }: { label: string; value: string; sub?: string; subAccent?: boolean }) {
  return (
    <div className="win" style={{ padding: "16px 18px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(23px, 2.4vw, 31px)", lineHeight: 1, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 9, color: subAccent ? "var(--acc)" : "var(--fg-4)" }}>{sub}</div>}
    </div>
  );
}

function FunnelBar({ segments, lost }: { segments: { label: string; count: number; color: string }[]; lost: number }) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  return (
    <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line-1)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Pipeline funnel</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>{total} active{lost > 0 ? ` · ${lost} lost` : ""}</span>
      </div>
      <div style={{ display: "flex", gap: 3, height: 10, marginBottom: 14 }}>
        {total === 0 ? (
          <div style={{ flex: 1, background: "var(--bg-3)", borderRadius: 2 }} />
        ) : segments.filter((s) => s.count > 0).map((s) => (
          <div key={s.label} title={`${s.label}: ${s.count}`} style={{ flex: s.count, background: s.color, borderRadius: 2, minWidth: 6 }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "var(--fg-3)" }}>{s.label}</span>
            <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-1)", fontWeight: 600 }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadRow({ lead, index }: { lead: VraelisLead; index: number }) {
  const title = lead.name || lead.contact_email || lead.contact_phone || "New lead";
  const color = AV_COLORS[index % AV_COLORS.length];
  return (
    <Link href={`/v/account/leads/${lead.id}`} className="leadrow" style={{ display: "block", textDecoration: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span className="av" style={{ width: 36, height: 36, background: color, fontSize: 13.5 }}>{initials(title)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ color: "var(--fg-1)", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
            <span className={`pill ${STATUS_CLASS[lead.status]}`}><span className="dot" />{STATUS_LABEL[lead.status]}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--fg-4)", fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.snippet || "—"}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", whiteSpace: "nowrap" }}>{lead.source} · {timeAgo(lead.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// After a Stripe Checkout redirect (?session_id=...), verify the session
// server-side and record the plan — no webhook needed for the first set.
async function confirmStripeCheckout(email: string, sessionId: string) {
  if (!process.env.STRIPE_SECRET_KEY) return;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const cs = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = cs.payment_status === "paid" || cs.status === "complete";
    const plan = String(cs.metadata?.plan ?? "");
    const cycle = String(cs.metadata?.cycle ?? "");
    if (paid && isPlanKey(plan) && isCycle(cycle)) {
      await setWorkspacePlan(email, { plan, cycle, status: "active", provider: "stripe" });
    }
  } catch (error) {
    console.error("confirmStripeCheckout failed:", error);
  }
}

export default async function VraelisAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin?callbackUrl=%2Faccount");

  const email = session.user.email;
  const params = await searchParams;
  const sessionId = String(Array.isArray(params.session_id) ? params.session_id[0] : params.session_id ?? "");
  if (sessionId) await confirmStripeCheckout(email, sessionId);

  const [workspace, leads, payments, bookings, services, contact, calendar] = await Promise.all([
    getOrCreateWorkspace(email),
    listLeads(email),
    getPaymentsSummary(email),
    listUpcomingBookings(email),
    getWorkspaceServices(email),
    getWorkspaceContact(email),
    getWorkspaceCalendar(email),
  ]);
  const calendarConnected = Boolean(calendar?.gcal_connected);

  // Keep Connect status fresh: if onboarding isn't marked active yet, ask
  // Stripe once and persist (cheap; stops once active).
  let connectStatus = workspace?.connect_status ?? null;
  if (workspace?.connect_account_id && connectStatus !== "active") {
    try {
      const st = await getAccountStatus(workspace.connect_account_id);
      const next = st.chargesEnabled ? "active" : "pending";
      if (next !== connectStatus) {
        await setWorkspaceConnect(email, { status: next });
        connectStatus = next;
      }
    } catch { /* leave as-is */ }
  }
  const connected = connectStatus === "active";

  const cutRate = cutRateFor(workspace?.plan ?? null, workspace?.plan_cycle ?? null);
  // Real money that moved through the platform (cut already taken at payment).
  const collected = payments.grossCents / 100;
  const kept = payments.netCents / 100;
  const feeTaken = payments.feeCents / 100;

  const firstName = (workspace?.business_name || session.user.name || email.split("@")[0]).trim().slice(0, 48);
  const intakeKey = workspace?.intake_key ?? "";
  const formLink = intakeKey ? `${ORIGIN}/f/${intakeKey}` : "";
  const bookingLink = intakeKey ? `${ORIGIN}/book/${intakeKey}` : "";
  const webhookUrl = `${ORIGIN}/api/vraelis/intake`;
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const ageMs = (iso: string) => now - new Date(iso).getTime();
  const thisWeek = leads.filter((l) => ageMs(l.created_at) <= WEEK).length;
  const prevWeek = leads.filter((l) => ageMs(l.created_at) > WEEK && ageMs(l.created_at) <= 2 * WEEK).length;
  const weekDelta = thisWeek - prevWeek;

  const ENGAGED: LeadStatus[] = ["contacted", "qualifying", "qualified", "booking_ready", "needs_owner"];
  const newCount = leads.filter((l) => l.status === "new").length;
  const engaged = leads.filter((l) => ENGAGED.includes(l.status)).length;
  const bookedCount = leads.filter((l) => l.status === "booked").length;
  const wonCount = leads.filter((l) => l.status === "won").length;
  const lostCount = leads.filter((l) => l.status === "lost").length;

  const openLeads = leads.filter((l) => l.status !== "won" && l.status !== "lost");
  const pipelineValue = openLeads.reduce((s, l) => s + (l.value || 0), 0);
  const answered = leads.filter((l) => l.status !== "new").length;
  const answerRate = leads.length ? Math.round((answered / leads.length) * 100) : 0;

  // Outcome analytics (VIE). Uses the labeled `outcome`; falls back to the
  // pipeline status so the summary is useful before anything is hand-labeled.
  const effOutcome = (l: VraelisLead): string => {
    const o = (l.outcome as string) || "open";
    if (o && o !== "open") return o;
    if (l.status === "won" || l.status === "booked") return "booked";
    if (l.status === "lost") return "lost";
    return "open";
  };
  const oc = { open: 0, booked: 0, paid: 0, lost: 0, spam: 0 };
  for (const l of leads) {
    const o = effOutcome(l);
    if (o in oc) (oc as Record<string, number>)[o] += 1;
  }
  const bookedTotal = oc.booked + oc.paid; // a paid lead was also booked
  const conversionRate = leads.length ? Math.round((bookedTotal / leads.length) * 100) : 0;
  const paymentRate = bookedTotal ? Math.round((oc.paid / bookedTotal) * 100) : 0;

  const steps: Step[] = [
    { key: "biz", label: "Add your business details", done: Boolean(workspace?.business_name && workspace?.business_description), action: { type: "tab", tab: "setup", cta: "Add" } },
    { key: "payouts", label: "Turn on payouts (get paid)", done: connected, action: { type: "link", href: "/api/vraelis/connect/start", cta: workspace?.connect_account_id ? "Finish" : "Turn on" } },
    { key: "lead", label: "See it work — get your first lead", done: leads.length > 0, action: { type: "test", cta: "Send test lead" } },
    { key: "pay", label: "Take your first payment", done: payments.paidCount > 0, action: { type: "tab", tab: "inbox", cta: "Open a lead" } },
  ];

  return (
    <section className="section" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.35 }} />
      <div className="wrap" style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: "clamp(22px,3vw,32px)" }}>
          <div>
            <p className="eyebrow">Your workspace</p>
            <h1 className="display" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)", marginBottom: 6 }}>
              Welcome back, <span className="em">{firstName}</span>.
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--fg-3)", display: "flex", alignItems: "center", gap: 8 }}>
              <span className="dot dot--acc pulse" />Vraelis is online — answering your leads 24/7.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/v/account/find" className="btn" style={{ whiteSpace: "nowrap" }}>
              Find leads →
            </Link>
            {formLink && (
              <a href={formLink} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ whiteSpace: "nowrap" }}>
                View your form ↗
              </a>
            )}
          </div>
        </div>

        <AccountTabs
          steps={steps}
          inbox={
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "clamp(12px,1.5vw,16px)", marginBottom: "clamp(16px,2vw,24px)" }}>
                <StatCard
                  label="Leads this week"
                  value={String(thisWeek)}
                  sub={weekDelta > 0 ? `▲ +${weekDelta} vs last week` : weekDelta < 0 ? `▼ ${Math.abs(weekDelta)} vs last week` : "vs last week"}
                  subAccent={weekDelta > 0}
                />
                <StatCard label="Pipeline value" value={`$${pipelineValue.toLocaleString()}`} sub={`${openLeads.length} open deal${openLeads.length === 1 ? "" : "s"}`} />
                <StatCard label="Collected" value={`$${collected.toLocaleString()}`} sub={payments.paidCount > 0 ? `${payments.paidCount} payment${payments.paidCount === 1 ? "" : "s"} on-platform` : "via Vraelis"} subAccent={collected > 0} />
                <StatCard label="Auto-answered" value={`${answerRate}%`} sub={`${answered} of ${leads.length} engaged`} />
              </div>

              {/* Outcomes summary (VIE) */}
              <div className="win" style={{ padding: "clamp(16px,2vw,20px)", marginBottom: "clamp(16px,2vw,24px)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-3)" }}>Outcomes</span>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>Conversion <b style={{ color: "var(--acc-deep)", fontWeight: 700 }}>{conversionRate}%</b></span>
                    <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>Payment rate <b style={{ color: "var(--acc-deep)", fontWeight: 700 }}>{paymentRate}%</b></span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(86px, 1fr))", gap: 10 }}>
                  {([
                    ["Open", oc.open, "#2563EB"],
                    ["Booked", oc.booked, "var(--money)"],
                    ["Paid", oc.paid, "#15803D"],
                    ["Lost", oc.lost, "var(--fg-4)"],
                    ["Spam", oc.spam, "#9F2D2D"],
                  ] as const).map(([label, n, color]) => (
                    <div key={label} style={{ border: "1px solid var(--line-1)", borderRadius: 6, padding: "10px 12px" }}>
                      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, lineHeight: 1, color }}>{n}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)", marginTop: 5 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="win" style={{ overflow: "hidden" }}>
                <div className="win__bar">
                  <div className="win__dots"><i /><i /><i /></div>
                  <span className="win__addr"><span className="dot dot--acc pulse" /> app.vraelis.com/inbox</span>
                  <span style={{ marginLeft: "auto" }} className="pill"><span className="dot dot--acc" />live</span>
                </div>

                <FunnelBar
                  segments={[
                    { label: "New", count: newCount, color: "#2563EB" },
                    { label: "In conversation", count: engaged, color: "var(--acc)" },
                    { label: "Booked", count: bookedCount, color: "var(--money)" },
                    { label: "Won", count: wonCount, color: "#15803D" },
                  ]}
                  lost={lostCount}
                />

                <AddLeadForm />

                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-3)" }}>Live pipeline</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>{leads.length} lead{leads.length === 1 ? "" : "s"}</span>
                </div>

                {leads.length === 0 ? (
                  <div style={{ padding: "44px 28px", textAlign: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", display: "grid", placeItems: "center", margin: "0 auto 16px", color: "var(--acc)", fontSize: 20 }}>✦</div>
                    <div style={{ fontSize: 16, color: "var(--fg-1)", fontWeight: 600, marginBottom: 8 }}>See Vraelis answer a lead.</div>
                    <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, maxWidth: 400, margin: "0 auto 18px" }}>
                      Send yourself a sample lead and watch Vraelis reply instantly — or share your link to get a real one. New leads land here, answered automatically.
                    </p>
                    <form action={sendTestLead} style={{ display: "inline-block" }}>
                      <button type="submit" className="btn">Send a test lead →</button>
                    </form>
                    <p style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 14 }}>
                      Or grab your shareable link in the <b style={{ color: "var(--fg-3)", fontWeight: 600 }}>Setup</b> tab.
                    </p>
                  </div>
                ) : (
                  <div style={{ maxHeight: 560, overflowY: "auto" }}>
                    {leads.map((l, i) => <LeadRow key={l.id} lead={l} index={i} />)}
                  </div>
                )}
              </div>

              {bookings.length > 0 && (
                <div className="win" style={{ padding: "clamp(18px,2.2vw,24px)", marginTop: 16 }}>
                  <h2 style={{ fontSize: 16, letterSpacing: "-0.02em", color: "var(--fg-1)", marginBottom: 12 }}>Upcoming bookings</h2>
                  {bookings.slice(0, 8).map((b) => (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "9px 0", borderTop: "1px solid var(--line-1)" }}>
                      <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 600 }}>{slotLabel(b.slot)}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{b.name || b.contact_email || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          }
          money={
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(16px, 2vw, 24px)", alignItems: "start" }}>
              {/* Payouts — Stripe Connect */}
              <div className="win" style={{ padding: "clamp(18px,2.2vw,24px)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <h2 style={{ fontSize: 16, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>Payouts</h2>
                  {connected ? (
                    <span className="pill st-won"><span className="dot" />Active</span>
                  ) : workspace?.connect_account_id ? (
                    <span className="pill st-booked"><span className="dot" />Finishing setup</span>
                  ) : (
                    <span className="pill st-new"><span className="dot" />Not set up</span>
                  )}
                </div>
                {connected ? (
                  <>
                    <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginBottom: 16 }}>
                      Leads pay you through Vraelis. Vraelis keeps {(cutRate * 100).toFixed(cutRate * 100 % 1 === 0 ? 0 : 1)}% at payment; you receive the rest, deposited automatically — nothing to invoice, nothing to chase. <span style={{ color: "var(--fg-4)" }}>Standard payment processing fees are deducted from your payout.</span>
                    </p>
                    <div style={{ paddingTop: 14, borderTop: "1px solid var(--line-1)" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>Booking deposit</div>
                      <DepositForm initialEnabled={Boolean(workspace?.deposit_enabled)} initialAmount={workspace?.deposit_amount_cents ?? null} />
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginBottom: 16 }}>
                      Get paid on-platform. Connect your bank once and leads can pay you right through Vraelis — your {(100 - cutRate * 100).toFixed((100 - cutRate * 100) % 1 === 0 ? 0 : 1)}% lands in your account automatically, no off-platform chasing.
                    </p>
                    <a href="/api/vraelis/connect/start" className="btn" style={{ width: "100%", justifyContent: "center" }}>
                      {workspace?.connect_account_id ? "Finish payout setup →" : "Set up payouts →"}
                    </a>
                  </>
                )}
              </div>

              {/* Real revenue — money that actually moved through the platform */}
              <div className="win" style={{ padding: "clamp(18px,2.2vw,24px)" }}>
                <h2 style={{ fontSize: 16, letterSpacing: "-0.02em", color: "var(--fg-1)", marginBottom: 14 }}>Revenue</h2>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: "var(--fg-3)" }}>Collected ({payments.paidCount} payment{payments.paidCount === 1 ? "" : "s"})</span>
                  <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--fg-1)", fontWeight: 600 }}>${collected.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--line-1)" }}>
                  <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 600 }}>You kept</span>
                  <span className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--money)" }}>${kept.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, color: "var(--fg-3)" }}>Vraelis fee ({(cutRate * 100).toFixed(cutRate * 100 % 1 === 0 ? 0 : 1)}%)</span>
                  <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--fg-2)" }}>${feeTaken.toLocaleString()}</span>
                </div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)", marginTop: 12, lineHeight: 1.5 }}>
                  {collected > 0
                    ? "Real money paid through Vraelis. The fee is taken automatically at payment — no monthly invoice, no self-reporting."
                    : connected
                      ? "Nothing yet. Revenue shows up here after your first deposit or payment — open a lead in the Inbox and use Request payment."
                      : "Turn on payouts above, then revenue appears here after your first on-platform deposit or payment."}
                </p>
              </div>
            </div>
          }
          setup={
            <div style={{ columns: "320px", columnGap: "clamp(16px, 2vw, 22px)" }}>
              {/* Business profile */}
              <div className="win" style={{ padding: "clamp(18px,2.2vw,24px)", breakInside: "avoid", marginBottom: "clamp(16px,2vw,22px)" }}>
                <h2 style={{ fontSize: 16, letterSpacing: "-0.02em", color: "var(--fg-1)", marginBottom: 4 }}>Business profile</h2>
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginBottom: 16 }}>
                  What Vraelis uses to answer your leads in your voice.
                </p>
                <BusinessForm
                  initialName={workspace?.business_name ?? ""}
                  initialDescription={workspace?.business_description ?? ""}
                  initialServices={services ?? ""}
                />
              </div>

              {/* Lead capture links */}
              <div className="win" style={{ padding: "clamp(18px,2.2vw,24px)", breakInside: "avoid", marginBottom: "clamp(16px,2vw,22px)" }}>
                <h2 style={{ fontSize: 16, letterSpacing: "-0.02em", color: "var(--fg-1)", marginBottom: 4 }}>Lead capture links</h2>
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginBottom: 16 }}>
                  No website needed — share your link in your Instagram bio, Google profile, email signature, or texts.
                </p>
                {formLink && <CopyField label="Your chat link · no code" value={formLink} />}
                {bookingLink && <CopyField label="Your booking link" value={bookingLink} />}
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", letterSpacing: "0.04em" }}>
                    Have a website or developer? Advanced options
                  </summary>
                  <div style={{ marginTop: 14 }}>
                    {intakeKey && (
                      <CopyField
                        label="Add to your website (one line, or send to your web person)"
                        value={`<script src="${ORIGIN}/widget.js" data-vraelis-key="${intakeKey}"></script>`}
                      />
                    )}
                    <CopyField label="Webhook URL (Zapier / forms)" value={webhookUrl} />
                    {intakeKey && <CopyField label="Intake key" value={intakeKey} />}
                  </div>
                </details>
              </div>

              {/* Phone & SMS */}
              <div className="win" style={{ padding: "clamp(18px,2.2vw,24px)", breakInside: "avoid", marginBottom: "clamp(16px,2vw,22px)" }}>
                <h2 style={{ fontSize: 16, letterSpacing: "-0.02em", color: "var(--fg-1)", marginBottom: 4 }}>Phone &amp; SMS</h2>
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginBottom: 16 }}>
                  Get a text on every new lead, and let Vraelis text leads back from your number.
                </p>
                <SmsForm initialOwnerPhone={contact?.owner_phone ?? ""} initialTwilioNumber={contact?.twilio_number ?? ""} />
              </div>

              {/* Calendar */}
              <div className="win" style={{ padding: "clamp(18px,2.2vw,24px)", breakInside: "avoid", marginBottom: "clamp(16px,2vw,22px)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <h2 style={{ fontSize: 16, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>Calendar</h2>
                  {calendarConnected ? (
                    <span className="pill st-won"><span className="dot" />Connected</span>
                  ) : (
                    <span className="pill st-new"><span className="dot" />Not connected</span>
                  )}
                </div>
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginBottom: 14 }}>
                  {calendarConnected
                    ? "Bookings appear on your Google Calendar, and times you're busy there are blocked automatically."
                    : "Connect Google Calendar so bookings auto-create events and your busy times never get double-booked."}
                </p>
                {calendarConnected ? (
                  <a href="/api/vraelis/calendar/disconnect" className="btn btn--ghost" style={{ width: "100%", justifyContent: "center" }}>Disconnect</a>
                ) : (
                  <a href="/api/vraelis/calendar/connect" className="btn" style={{ width: "100%", justifyContent: "center" }}>Connect Google Calendar →</a>
                )}
              </div>

              {/* Payments / payouts */}
              <div className="win" style={{ padding: "clamp(18px,2.2vw,24px)", breakInside: "avoid", marginBottom: "clamp(16px,2vw,22px)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <h2 style={{ fontSize: 16, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>Payments</h2>
                  {connected ? (
                    <span className="pill st-won"><span className="dot" />Active</span>
                  ) : (
                    <span className="pill st-new"><span className="dot" />Not set up</span>
                  )}
                </div>
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginBottom: 14 }}>
                  {connected
                    ? "Payouts are on. Manage deposits, request payments, and see revenue in the Money tab."
                    : "Connect Stripe to collect deposits and payments on-platform — your cut is taken automatically."}
                </p>
                {!connected && (
                  <a href="/api/vraelis/connect/start" className="btn" style={{ width: "100%", justifyContent: "center" }}>Set up payouts →</a>
                )}
              </div>

              {/* Plan & account */}
              <div className="win" style={{ padding: "clamp(18px,2.2vw,24px)", breakInside: "avoid", marginBottom: "clamp(16px,2vw,22px)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 3 }}>Plan</div>
                    {workspace?.plan ? (
                      <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 600, textTransform: "capitalize" }}>
                        {workspace.plan} <span style={{ color: "var(--fg-4)", fontWeight: 400 }}>· {workspace.plan_cycle}</span>
                        <span className="pill st-won" style={{ marginLeft: 8 }}><span className="dot" />Active</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, color: "var(--fg-2)" }}>Starter (free)</div>
                    )}
                  </div>
                  <Link href="/v/pricing" style={{ fontSize: 13, color: "var(--acc-deep)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                    {workspace?.plan ? "Change →" : "Upgrade →"}
                  </Link>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 12, borderTop: "1px solid var(--line-1)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 3 }}>Signed in</div>
                    <div style={{ fontSize: 13, color: "var(--fg-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
                  </div>
                  <form action={vraelisSignOut}>
                    <button type="submit" className="btn btn--ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Sign out</button>
                  </form>
                </div>
              </div>
            </div>
          }
        />
      </div>
    </section>
  );
}
