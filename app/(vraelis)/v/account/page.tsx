import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Stripe from "stripe";
import { deriveOnboarded, getOrCreateWorkspace, getPaymentsSummary, getWorkspaceCalendar, getWorkspaceContact, getWorkspaceOffer, getWorkspaceServices, listLeads, listPayments, setWorkspaceConnect, setWorkspacePlan, type LeadStatus, type VraelisLead } from "@/lib/vraelis-db";
import { isDatabaseConfigured } from "@/lib/supabase-admin";
import { listUpcomingBookings, slotLabel } from "@/lib/vraelis-booking";
import { getAccountStatus } from "@/lib/vraelis-connect";
import { cutRateFor, isCycle, isPlanKey } from "@/lib/vraelis-plans";
import { AddLeadForm } from "./add-lead-form";
import { OfferForm } from "./offer-form";
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
function leadTitle(lead: Pick<VraelisLead, "name" | "contact_email" | "contact_phone">) {
  return lead.name || lead.contact_email || lead.contact_phone || "New lead";
}
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

function formatMoneyFromCents(cents: number) {
  const dollars = cents / 100;
  const hasCents = cents % 100 !== 0;
  return dollars.toLocaleString(undefined, { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 });
}

function StatCard({ label, value, sub, subAccent }: { label: string; value: string; sub?: string; subAccent?: boolean }) {
  return (
    <div className="win" style={{ padding: "11px 14px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 5 }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(19px, 1.8vw, 24px)", lineHeight: 1, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, marginTop: 5, color: subAccent ? "var(--acc)" : "var(--fg-4)" }}>{sub}</div>}
    </div>
  );
}

// A compact connection row for the Setup checklist: a ✓/⚠ status dot, a
// one-line title + status text, and either a connect/disconnect LINK or an
// inline-expanding form (native <details>, no client JS). `done` toggles the
// green check vs the amber "to do" state.
function ChecklistRow({
  done,
  title,
  doneText,
  todoText,
  href,
  cta,
  expandLabel,
  last,
  children,
}: {
  done: boolean;
  title: string;
  doneText: string;
  todoText: string;
  href?: string;
  cta?: string;
  expandLabel?: string;
  last?: boolean;
  children?: ReactNode;
}) {
  const mark = (
    <span
      aria-hidden
      style={{
        flex: "0 0 auto", width: 18, height: 18, borderRadius: "50%",
        display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700,
        background: done ? "var(--acc-soft)" : "rgba(194,84,12,0.10)",
        color: done ? "var(--acc-deep)" : "#C2540C",
        border: `1px solid ${done ? "var(--acc-line)" : "rgba(194,84,12,0.3)"}`,
      }}
    >
      {done ? "✓" : "!"}
    </span>
  );
  const head = (
    <>
      {mark}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: done ? "var(--fg-3)" : "#C2540C", marginTop: 1 }}>{done ? doneText : todoText}</div>
      </div>
    </>
  );
  const rowStyle: CSSProperties = {
    display: "flex", alignItems: "center", gap: 11, padding: "10px 0",
    borderTop: "1px solid var(--line-1)",
    ...(last ? {} : {}),
  };

  // Expandable variant (SMS, deposit) — native details, opens the form inline.
  if (children) {
    return (
      <details>
        <summary style={{ ...rowStyle, cursor: "pointer", listStyle: "none" }}>
          {head}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--acc-deep)", fontWeight: 600, whiteSpace: "nowrap" }}>{expandLabel ?? (done ? "Edit" : "Set up")} →</span>
        </summary>
        <div style={{ padding: "4px 0 14px 29px" }}>{children}</div>
      </details>
    );
  }

  // Link variant (payments, calendar).
  return (
    <div style={rowStyle}>
      {head}
      {href && cta && (
        <a href={href} style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: done ? "var(--fg-4)" : "var(--acc-deep)", fontWeight: 600, whiteSpace: "nowrap", textDecoration: "none" }}>{cta} →</a>
      )}
    </div>
  );
}

function FunnelBar({ segments, lost }: { segments: { label: string; count: number; color: string }[]; lost: number }) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-1)" }}>
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

function LeadRow({ lead, index, pay }: { lead: VraelisLead; index: number; pay?: "paid" | "pending" }) {
  const title = leadTitle(lead);
  const color = AV_COLORS[index % AV_COLORS.length];
  return (
    <Link href={`/v/account/leads/${lead.id}`} className="leadrow" style={{ display: "block", textDecoration: "none", padding: "9px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="av" style={{ width: 32, height: 32, background: color, fontSize: 12.5 }}>{initials(title)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 3 }}>
            <span style={{ color: "var(--fg-1)", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
              {pay === "paid" && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "#15803D", fontWeight: 700 }}>✓ paid</span>}
              {pay === "pending" && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--money)", fontWeight: 700 }}>$ link sent</span>}
              <span className={`pill ${STATUS_CLASS[lead.status]}`}><span className="dot" />{STATUS_LABEL[lead.status]}</span>
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--fg-4)", fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.snippet || "—"}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", whiteSpace: "nowrap", flexShrink: 0 }}>
              {lead.value ? <b className="tnum" style={{ color: "var(--money)", fontWeight: 600 }}>${lead.value.toLocaleString()} · </b> : null}
              {lead.source} · {timeAgo(lead.created_at)}
            </span>
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
  const requestedTab = String(Array.isArray(params.tab) ? params.tab[0] : params.tab ?? "");
  const initialTab: "inbox" | "money" | "setup" =
    requestedTab === "money" || requestedTab === "setup" || requestedTab === "inbox" ? requestedTab : "inbox";
  if (sessionId) await confirmStripeCheckout(email, sessionId);

  const [workspace, leads, payments, bookings, services, contact, calendar, offer, recentPayments] = await Promise.all([
    getOrCreateWorkspace(email),
    listLeads(email),
    getPaymentsSummary(email),
    listUpcomingBookings(email),
    getWorkspaceServices(email),
    getWorkspaceContact(email),
    getWorkspaceCalendar(email),
    getWorkspaceOffer(email),
    listPayments(email, { limit: 100 }),
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

  const now = Date.now();

  // ── Payment derivations (from listPayments, no extra Stripe calls) ──
  const pendingPayments = recentPayments.filter((p) => p.status === "pending");
  const paidPayments = recentPayments.filter((p) => p.status === "paid");
  // "Awaiting payment" = requests sent but not yet paid (gross of those rows).
  const awaitingCents = pendingPayments.reduce((s, p) => s + (p.amount_cents || 0), 0);
  // "In transit" = your share of payments marked paid in the last 3 days
  // (Stripe is still moving them to your bank).
  const TRANSIT_WINDOW = 3 * 24 * 60 * 60 * 1000;
  const inTransitCents = paidPayments
    .filter((p) => p.paid_at && now - new Date(p.paid_at).getTime() <= TRANSIT_WINDOW)
    .reduce((s, p) => s + ((p.amount_cents || 0) - (p.fee_cents || 0)), 0);
  // Per-lead payment status, newest first, for the "Needs Attention" tiers.
  const leadPayState = new Map<string, "paid" | "pending">();
  for (const p of recentPayments) {
    if (!p.lead_id) continue;
    const cur = leadPayState.get(p.lead_id);
    if (p.status === "paid") leadPayState.set(p.lead_id, "paid");
    else if (p.status === "pending" && cur !== "paid") leadPayState.set(p.lead_id, "pending");
  }
  const leadById = new Map(leads.map((lead) => [lead.id, lead] as const));
  const readyToCollectLeads = leads
    .filter((lead) => (
      (lead.status === "qualified" || lead.status === "booking_ready" || lead.status === "booked")
      && !leadPayState.get(lead.id)
    ))
    .sort((a, b) => (b.value || 0) - (a.value || 0) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const readyToCollectCount = readyToCollectLeads.length;

  const firstName = (workspace?.business_name || session.user.name || email.split("@")[0]).trim().slice(0, 48);
  // The agent's own name (owner-set) or a sensible default tied to the business.
  const agentName = (offer?.agentName || "").trim();
  const agentLabel = agentName || `${(workspace?.business_name || "your").trim()} agent`;
  const intakeKey = workspace?.intake_key ?? "";
  const formLink = intakeKey ? `${ORIGIN}/f/${intakeKey}` : "";
  const bookingLink = intakeKey ? `${ORIGIN}/book/${intakeKey}` : "";
  const webhookUrl = `${ORIGIN}/api/vraelis/intake`;
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

  // ── Needs Attention — revenue-proximity tiers (closest to money first) ──
  // Tier 1: a payment link was sent and is still unpaid (about to pay).
  // Tier 2: qualified / booking-ready but gone quiet (2+ days, no payment yet).
  // Tier 3: the AI explicitly flagged it for the owner (needs_owner).
  // Tier 4: replied recently and engaged (warm, keep momentum).
  // A lead appears once, in its highest tier. Won/lost/paid are excluded.
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  const reason = (l: VraelisLead): { tier: number; label: string } | null => {
    if (l.status === "won" || l.status === "lost") return null;
    if (leadPayState.get(l.id) === "paid") return null;
    if (leadPayState.get(l.id) === "pending") return { tier: 1, label: "Payment sent — awaiting pay" };
    const quiet = ageMs(l.updated_at) >= TWO_DAYS;
    if ((l.status === "qualified" || l.status === "booking_ready") && quiet)
      return { tier: 2, label: "Qualified, gone quiet" };
    if (l.status === "needs_owner") return { tier: 3, label: "Flagged for you" };
    if ((l.status === "qualified" || l.status === "booking_ready") && !quiet)
      return { tier: 4, label: "Qualified — keep momentum" };
    if (l.status === "contacted" && quiet) return { tier: 4, label: "No reply in 2+ days" };
    return null;
  };
  const needsAttention = leads
    .map((l) => ({ lead: l, r: reason(l) }))
    .filter((x): x is { lead: VraelisLead; r: { tier: number; label: string } } => x.r !== null)
    .sort((a, b) => a.r.tier - b.r.tier || (b.lead.value || 0) - (a.lead.value || 0))
    .slice(0, 6);

  const steps: Step[] = [
    { key: "biz", label: "Add your business details", done: Boolean(workspace?.business_name && workspace?.business_description), action: { type: "tab", tab: "setup", cta: "Add" } },
    { key: "payouts", label: "Turn on payouts (get paid)", done: connected, action: { type: "link", href: "/api/vraelis/connect/start", cta: workspace?.connect_account_id ? "Finish" : "Turn on" } },
    { key: "lead", label: "See it work — get your first lead", done: leads.length > 0, action: { type: "test", cta: "Send test lead" } },
    { key: "pay", label: "Take your first payment", done: payments.paidCount > 0, action: { type: "tab", tab: "inbox", cta: "Open a lead" } },
  ];

  // A configured DB that still returned no workspace row means the read
  // failed (getOrCreateWorkspace otherwise always creates one). Don't drop
  // what may be a fully-onboarded account onto a BLANK onboarding form —
  // a hasty re-submit there would overwrite their real offer data.
  if (isDatabaseConfigured() && !workspace) {
    return (
      <section className="section section--app" style={{ position: "relative", overflow: "hidden" }}>
        <div className="gridbg" style={{ opacity: 0.35 }} />
        <div className="wrap" style={{ position: "relative", maxWidth: 560 }}>
          <div className="win" style={{ padding: "clamp(18px,2.4vw,26px)", textAlign: "center" }}>
            <h1 style={{ fontSize: 16, color: "var(--fg-1)", marginBottom: 6 }}>Couldn&apos;t load your workspace.</h1>
            <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, marginBottom: 14 }}>
              Something hiccuped on our side — your data is safe. Refresh to try again.
            </p>
            <a href="/v/account" className="btn" style={{ fontSize: 13, padding: "9px 16px" }}>Refresh →</a>
          </div>
        </div>
      </section>
    );
  }

  // ── Core-onboarding gate ─────────────────────────────────────────────
  // Vraelis can't work until it knows what you sell, what it costs, and
  // how customers pay. Until then (new signups AND existing accounts with
  // missing fields — null reads as incomplete) the workspace shows ONLY
  // the onboarding screen; Inbox/Money/leads unlock on completion, and
  // completing it lands you straight on the Inbox tab below.
  if (!deriveOnboarded(workspace, services, offer)) {
    const offerDone = Boolean(offer?.persona && workspace?.business_name && workspace?.business_description);
    const priceDone = Boolean(services);
    const obSteps = [
      { n: 1, label: "Create your agent", done: offerDone, later: false },
      { n: 2, label: "Price & how customers pay", done: priceDone, later: false },
      { n: 3, label: "Connect channels & payouts", done: false, later: true },
    ];
    return (
      <section className="section section--app" style={{ position: "relative", overflow: "hidden" }}>
        <div className="gridbg" style={{ opacity: 0.35 }} />
        <div className="wrap" style={{ position: "relative", maxWidth: 700 }}>
          <h1 className="display" style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.8rem)", marginBottom: 6 }}>
            Create your <span className="em">revenue agent</span>.
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, marginBottom: 14, maxWidth: 560 }}>
            Vraelis is an AI sales agent that answers every lead, qualifies them, books calls, and collects payment for you — across chat, email, and text. First, tell it what you sell and how customers pay. Takes about two minutes.
          </p>

          <div className="win" style={{ padding: "10px clamp(14px,1.8vw,18px)", marginBottom: 12, display: "flex", alignItems: "center", gap: "8px 22px", flexWrap: "wrap" }}>
            {obSteps.map((s) => (
              <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 17, height: 17, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, flexShrink: 0,
                    background: s.done ? "var(--acc)" : "transparent",
                    border: s.done ? "none" : "1px solid var(--line-3)",
                    color: s.done ? "var(--fg-on-accent)" : "var(--fg-4)",
                  }}
                >
                  {s.done ? "✓" : s.n}
                </span>
                <span style={{ fontSize: 12.5, color: s.later ? "var(--fg-4)" : s.done ? "var(--fg-4)" : "var(--fg-1)", fontWeight: s.later ? 400 : 600 }}>
                  {s.label}
                </span>
                {s.later && <span style={{ fontSize: 10.5, color: "var(--fg-5)" }}>after setup</span>}
              </div>
            ))}
          </div>

          <div className="win" style={{ padding: "clamp(16px,2vw,22px)" }}>
            <OfferForm
              initialName={workspace?.business_name ?? ""}
              initialDescription={workspace?.business_description ?? ""}
              initialServices={services ?? ""}
              initialDepositEnabled={Boolean(workspace?.deposit_enabled)}
              initialDepositAmount={workspace?.deposit_amount_cents ?? null}
              initialQualifying={offer?.qualifyingQuestions ?? ""}
              initialLeadSources={offer?.leadSources ?? ""}
              initialPersona={offer?.persona ?? ""}
              initialAgentName={offer?.agentName ?? ""}
              initialAgentTone={offer?.agentTone ?? ""}
              mode="onboarding"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: 11.5, color: "var(--fg-4)" }}>
            <span style={{ overflowWrap: "anywhere" }}>Signed in as {email}</span>
            <form action={vraelisSignOut}>
              <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-4)", fontSize: 11.5, textDecoration: "underline", padding: 0 }}>Sign out</button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section section--app" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.35 }} />
      <div className="wrap" style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: "clamp(14px,1.8vw,20px)" }}>
          <div>
            <h1 className="display" style={{ fontSize: "clamp(1.25rem, 1.9vw, 1.6rem)", marginBottom: 3 }}>
              Welcome back, <span className="em">{firstName}</span>.
            </h1>
            <p style={{ fontSize: 12.5, color: "var(--fg-3)", display: "flex", alignItems: "center", gap: 7 }}>
              <span className="dot dot--acc pulse" />{agentName ? `${agentName}, your AI agent, is` : "Your AI agent is"} online — working every lead 24/7.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/v/account/find" className="btn" style={{ whiteSpace: "nowrap", padding: "9px 16px", fontSize: 13 }}>
              Find leads →
            </Link>
            {formLink && (
              <a href={formLink} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ whiteSpace: "nowrap", padding: "9px 16px", fontSize: 13 }}>
                Try your agent ↗
              </a>
            )}
          </div>
        </div>

        <AccountTabs
          initialTab={initialTab}
          steps={steps}
          inbox={
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "clamp(10px,1.2vw,14px)", marginBottom: "clamp(12px,1.5vw,16px)" }}>
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

              {/* ── Your agent — what it is, what it's working with ── */}
              <div className="win" style={{ padding: "clamp(12px,1.6vw,16px) clamp(14px,1.8vw,18px)", marginBottom: "clamp(12px,1.5vw,16px)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span className="av" style={{ width: 32, height: 32, background: "var(--acc)", fontSize: 13 }}>{(agentName || "AI")[0].toUpperCase()}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agentLabel}</div>
                      <div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>
                        Qualifies leads · follows up · books calls{connected ? " · collects payment" : ""}
                      </div>
                    </div>
                  </div>
                  <button type="button" data-tab-jump="setup" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--acc-deep)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                    Edit agent →
                  </button>
                </div>
                {/* Channel chips — capabilities, on or off */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {([
                    ["Website & chat", true],
                    ["Email", true],
                    ["Text & voice", Boolean(contact?.twilio_number)],
                    ["Book calls", calendarConnected],
                    ["Take payments", connected],
                  ] as const).map(([label, on]) => (
                    <span
                      key={label}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5,
                        padding: "3px 9px", borderRadius: 999,
                        border: `1px solid ${on ? "var(--acc-line)" : "var(--line-2)"}`,
                        background: on ? "var(--acc-soft)" : "transparent",
                        color: on ? "var(--acc-deep)" : "var(--fg-4)",
                      }}
                    >
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: on ? "var(--acc)" : "var(--line-3)" }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* ── Needs Attention — closest-to-revenue leads, first ── */}
              {needsAttention.length > 0 && (
                <div className="win" style={{ padding: "clamp(12px,1.6vw,16px) clamp(14px,1.8vw,18px)", marginBottom: "clamp(12px,1.5vw,16px)", borderColor: "var(--acc-line)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                    <h2 style={{ fontSize: 14.5, letterSpacing: "-0.02em", color: "var(--fg-1)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="dot dot--acc pulse" />Needs attention
                    </h2>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)" }}>closest to a payment first</span>
                  </div>
                  <div>
                    {needsAttention.map(({ lead: l, r }) => {
                      const title = l.name || l.contact_email || l.contact_phone || "New lead";
                      const tierColor = r.tier === 1 ? "var(--money)" : r.tier === 2 ? "#C2540C" : r.tier === 3 ? "#2563EB" : "var(--acc-deep)";
                      return (
                        <Link key={l.id} href={`/v/account/leads/${l.id}`} style={{ textDecoration: "none", display: "block" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 0", borderTop: "1px solid var(--line-1)" }}>
                            <span style={{ flex: "0 0 auto", width: 8, height: 8, borderRadius: "50%", background: tierColor }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
                              <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 1 }}>
                                <span style={{ color: tierColor, fontWeight: 600 }}>{r.label}</span>
                                {l.snippet ? <span style={{ color: "var(--fg-4)" }}> · {l.snippet}</span> : null}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                              {l.value ? <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--money)", fontWeight: 600 }}>${l.value.toLocaleString()}</span> : null}
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)" }}>{timeAgo(l.updated_at)} →</span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

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
                  <div style={{ padding: "26px 22px", textAlign: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", display: "grid", placeItems: "center", margin: "0 auto 12px", color: "var(--acc)", fontSize: 17 }}>✦</div>
                    <div style={{ fontSize: 15, color: "var(--fg-1)", fontWeight: 600, marginBottom: 6 }}>Watch your agent work a lead.</div>
                    <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5, maxWidth: 400, margin: "0 auto 14px" }}>
                      Send yourself a sample lead and watch your agent reply, qualify, and move it toward payment, or share your link to get a real one.
                    </p>
                    <form action={sendTestLead} style={{ display: "inline-block" }}>
                      <button type="submit" className="btn" style={{ padding: "9px 16px", fontSize: 13 }}>Send a test lead →</button>
                    </form>
                    <p style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 10 }}>
                      Or grab your shareable link in the <b style={{ color: "var(--fg-3)", fontWeight: 600 }}>Setup</b> tab.
                    </p>
                  </div>
                ) : (
                  <div style={{ maxHeight: 480, overflowY: "auto" }}>
                    {leads.map((l, i) => <LeadRow key={l.id} lead={l} index={i} pay={leadPayState.get(l.id)} />)}
                  </div>
                )}
              </div>

              {/* Outcomes — one slim analytics strip, below the live pipeline */}
              <div className="win" style={{ marginTop: "clamp(12px,1.5vw,16px)", padding: "10px clamp(14px,1.8vw,18px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px 18px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px 14px", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Outcomes</span>
                  {([
                    ["Open", oc.open, "#2563EB"],
                    ["Booked", oc.booked, "var(--money)"],
                    ["Paid", oc.paid, "#15803D"],
                    ["Lost", oc.lost, "var(--fg-4)"],
                    ["Spam", oc.spam, "#9F2D2D"],
                  ] as const).map(([label, n, color]) => (
                    <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--fg-3)" }}>
                      <b className="tnum" style={{ color, fontWeight: 700 }}>{n}</b> {label}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "var(--fg-4)" }}>Conversion <b style={{ color: "var(--acc-deep)", fontWeight: 700 }}>{conversionRate}%</b></span>
                  <span style={{ fontSize: 12, color: "var(--fg-4)" }}>Payment rate <b style={{ color: "var(--acc-deep)", fontWeight: 700 }}>{paymentRate}%</b></span>
                </div>
              </div>

              {bookings.length > 0 && (
                <div className="win" style={{ padding: "clamp(12px,1.6vw,16px) clamp(14px,1.8vw,18px)", marginTop: "clamp(12px,1.5vw,16px)" }}>
                  <h2 style={{ fontSize: 14.5, letterSpacing: "-0.02em", color: "var(--fg-1)", marginBottom: 8 }}>Upcoming bookings</h2>
                  {bookings.slice(0, 8).map((b) => (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "7px 0", borderTop: "1px solid var(--line-1)" }}>
                      <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 600 }}>{slotLabel(b.slot)}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{b.name || b.contact_email || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          }
          money={
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(12px, 1.5vw, 16px)" }}>
              {/* ── Revenue KPIs — the money answers, first ─────────────── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "clamp(10px, 1.2vw, 14px)" }}>
                <StatCard label="Revenue collected" value={`$${collected.toLocaleString()}`} sub={`${payments.paidCount} payment${payments.paidCount === 1 ? "" : "s"}`} subAccent={collected > 0} />
                <div className="win" style={{ padding: "11px 14px", borderColor: "var(--acc-line)", background: "var(--acc-soft)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 5 }}>After Vraelis fee</div>
                  <div className="tnum" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(19px, 1.8vw, 24px)", lineHeight: 1, color: "var(--money)", letterSpacing: "-0.02em" }}>${kept.toLocaleString()}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, marginTop: 5, color: "var(--fg-4)" }}>before Stripe processing</div>
                </div>
                <StatCard label={`Vraelis fee · ${(cutRate * 100).toFixed(cutRate * 100 % 1 === 0 ? 0 : 1)}%`} value={`$${feeTaken.toLocaleString()}`} sub="taken automatically at checkout" />
                <StatCard label="Awaiting payment" value={`$${(awaitingCents / 100).toLocaleString()}`} sub={inTransitCents > 0 ? `+ $${(inTransitCents / 100).toLocaleString()} after Vraelis fee in transit` : `${pendingPayments.length} request${pendingPayments.length === 1 ? "" : "s"} sent`} />
              </div>

              {/* ── Payout status strip (no deposit config — that's in Setup) ── */}
              <div className="win" style={{ padding: "11px clamp(14px,1.8vw,18px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <h2 style={{ fontSize: 14.5, letterSpacing: "-0.02em", color: "var(--fg-1)", margin: 0 }}>Payouts</h2>
                  {connected ? (
                    <span className="pill st-won"><span className="dot" />Active</span>
                  ) : workspace?.connect_account_id ? (
                    <span className="pill st-booked"><span className="dot" />Finishing setup</span>
                  ) : (
                    <span className="pill st-new"><span className="dot" />Not set up</span>
                  )}
                  <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                    {connected
                      ? "Payments land automatically after each charge; Stripe deducts card-processing fees from that payout."
                      : `Connect your bank once so leads can pay you. Vraelis takes ${(cutRate * 100).toFixed(cutRate * 100 % 1 === 0 ? 0 : 1)}%; Stripe card-processing fees are separate.`}
                  </span>
                </div>
                {!connected && (
                  <a href="/api/vraelis/connect/start" className="btn" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                    {workspace?.connect_account_id ? "Finish setup →" : "Set up payouts →"}
                  </a>
                )}
              </div>

              {/* ── Recent payments (paid) ──────────────────────────────── */}
              {readyToCollectCount > 0 && (
                <div className="win" style={{ padding: "clamp(12px,1.6vw,16px) clamp(14px,1.8vw,18px)", borderColor: "var(--acc-line)", background: "var(--acc-soft)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <h2 style={{ fontSize: 14.5, letterSpacing: "-0.02em", color: "var(--fg-1)", margin: 0 }}>Ready to collect</h2>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--acc-deep)" }}>
                      {readyToCollectCount} lead{readyToCollectCount === 1 ? "" : "s"} ready now
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, margin: "0 0 10px" }}>
                    These leads are already far enough along to send a payment request. Open one and use Collect payment.
                  </p>
                  <div>
                    {readyToCollectLeads.slice(0, 3).map((lead) => (
                      <Link key={lead.id} href={`/v/account/leads/${lead.id}`} style={{ textDecoration: "none", display: "block" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid var(--acc-line)" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {leadTitle(lead)}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 1 }}>
                              {STATUS_LABEL[lead.status]}{lead.value ? ` - $${lead.value.toLocaleString()}` : ""} - active {timeAgo(lead.updated_at)}
                            </div>
                          </div>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--acc-deep)", flexShrink: 0 }}>
                            Open lead -&gt;
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="win" style={{ padding: "clamp(12px,1.6vw,16px) clamp(14px,1.8vw,18px)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <h2 style={{ fontSize: 14.5, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>Recent payments</h2>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)" }}>paid through Vraelis</span>
                </div>
                {paidPayments.length === 0 ? (
                  <div style={{ padding: "16px 16px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 600, marginBottom: 5 }}>No payments yet.</div>
                    <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, maxWidth: 400, margin: "0 auto 12px" }}>
                      {!connected
                        ? "Set up payouts above, then collect your first payment from any lead. It lands here automatically."
                        : leads.length === 0
                          ? "Send yourself a test lead, or share your lead link from Setup. Once a lead comes in, open it and use Collect payment."
                          : readyToCollectCount > 0
                            ? `You already have ${readyToCollectCount} lead${readyToCollectCount === 1 ? "" : "s"} ready for Collect payment. Open one above to send a secure checkout link.`
                            : "Move a live lead to Qualified or Booking in Inbox, then open it and use Collect payment. It shows up here the moment they pay, with the Vraelis fee already deducted."}
                    </p>
                    {!connected && <a href="/api/vraelis/connect/start" className="btn" style={{ fontSize: 13, padding: "9px 16px" }}>Set up payouts →</a>}
                    {connected && leads.length === 0 && (
                      <form action={sendTestLead} style={{ display: "inline-block" }}>
                        <button type="submit" className="btn" style={{ fontSize: 13, padding: "9px 16px" }}>Send a test lead →</button>
                      </form>
                    )}
                  </div>
                ) : (
                  <div>
                    {paidPayments.slice(0, 12).map((p) => {
                      const ownerLead = p.lead_id ? leadById.get(p.lead_id) : null;
                      const who = ownerLead ? leadTitle(ownerLead) : null;
                      const amt = formatMoneyFromCents(p.amount_cents);
                      const net = formatMoneyFromCents(p.amount_cents - p.fee_cents);
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid var(--line-1)" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.description || (p.kind === "deposit" ? "Deposit" : "Payment")}</div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)", marginTop: 2 }}>
                              {who ? `${who} · ` : ""}{p.kind === "deposit" ? "Deposit" : "Full payment"} · after Vraelis fee ${net}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--fg-1)", fontWeight: 600 }}>${amt}</span>
                            <span className="pill st-won"><span className="dot" />Paid</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Payment requests (sent, awaiting pay) ────────────────── */}
              {pendingPayments.length > 0 && (
                <div className="win" style={{ padding: "clamp(12px,1.6vw,16px) clamp(14px,1.8vw,18px)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <h2 style={{ fontSize: 14.5, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>Waiting on payment</h2>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)" }}>already sent</span>
                  </div>
                  <div>
                    {pendingPayments.map((p) => {
                      const ownerLead = p.lead_id ? leadById.get(p.lead_id) : null;
                      const who = ownerLead ? leadTitle(ownerLead) : null;
                      const amt = formatMoneyFromCents(p.amount_cents);
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid var(--line-1)" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.description || (p.kind === "deposit" ? "Deposit" : "Payment")}</div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)", marginTop: 2 }}>
                              {who ? `${who} · ` : ""}{p.kind === "deposit" ? "Deposit" : "Full payment"} · sent {timeAgo(p.created_at)}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--fg-3)", fontWeight: 600 }}>${amt}</span>
                            <span className="pill st-booked"><span className="dot" />Pending</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)", lineHeight: 1.5, padding: "0 4px" }}>
                Money tab totals show revenue after the Vraelis fee. Stripe card-processing fees are deducted separately from your payout in Stripe, where you can see the exact payout records.
              </p>
            </div>
          }
          setup={
            <div
              className="cols-stack"
              style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)", gap: "clamp(12px, 1.6vw, 18px)", alignItems: "start" }}
            >
              {/* ── Step 1: the agent (identity + what it sells) — left ── */}
              <div className="win" style={{ padding: "clamp(14px,1.8vw,20px)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 4 }}>Step 1 · Your agent</div>
                <h2 style={{ fontSize: 16, letterSpacing: "-0.02em", color: "var(--fg-1)", marginBottom: 3 }}>Your AI sales agent</h2>
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginBottom: 14 }}>
                  Its name, voice, what it sells, and how it gets paid. This is what your agent uses on every lead — connect channels after.
                </p>
                <OfferForm
                  initialName={workspace?.business_name ?? ""}
                  initialDescription={workspace?.business_description ?? ""}
                  initialServices={services ?? ""}
                  initialDepositEnabled={Boolean(workspace?.deposit_enabled)}
                  initialDepositAmount={workspace?.deposit_amount_cents ?? null}
                  initialQualifying={offer?.qualifyingQuestions ?? ""}
                  initialLeadSources={offer?.leadSources ?? ""}
                  initialPersona={offer?.persona ?? ""}
                  initialAgentName={offer?.agentName ?? ""}
                  initialAgentTone={offer?.agentTone ?? ""}
                />
              </div>

              {/* ── Step 2: the agent's channels — right column beside the offer ── */}
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Step 2 · Channels</div>
                  <span style={{ fontSize: 12, color: "var(--fg-3)" }}>Where your agent works leads &amp; how payments land.</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "clamp(10px,1.4vw,14px)" }}>
              {/* Website / link channel */}
              <div className="win" style={{ padding: "clamp(14px,1.8vw,18px)" }}>
                <h2 style={{ fontSize: 14.5, letterSpacing: "-0.02em", color: "var(--fg-1)", marginBottom: 3 }}>Website &amp; link</h2>
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginBottom: 12 }}>
                  Your agent&apos;s own chat and booking links — no website needed. Share them in your Instagram bio, Google profile, email signature, or texts.
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

              {/* Channels & payments checklist — capabilities the agent uses */}
              <div className="win" style={{ padding: "clamp(12px,1.6vw,14px) clamp(14px,1.8vw,18px)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 4 }}>What your agent can do</div>
                {/* Email — always on */}
                <ChecklistRow
                  done
                  title="Email"
                  doneText="On — your agent replies to leads by email automatically"
                  todoText=""
                />
                {/* Payments */}
                <ChecklistRow
                  done={connected}
                  title="Take payments"
                  doneText="On — your agent can collect payment and deposits in the conversation"
                  todoText="Turn on payouts so your agent can collect payment from leads"
                  href={connected ? undefined : "/api/vraelis/connect/start"}
                  cta={connected ? undefined : workspace?.connect_account_id ? "Finish" : "Turn on"}
                />
                {/* Calendar — book calls */}
                <ChecklistRow
                  done={calendarConnected}
                  title="Book calls"
                  doneText="On — bookings sync to your calendar, busy times blocked"
                  todoText="Connect your calendar so the agent can book calls and block busy times"
                  href={calendarConnected ? "/api/vraelis/calendar/disconnect" : "/api/vraelis/calendar/connect"}
                  cta={calendarConnected ? "Disconnect" : "Connect"}
                />
                {/* Text & voice (Twilio underneath, but framed as a capability) */}
                <ChecklistRow
                  done={Boolean(contact?.twilio_number)}
                  title="Text & voice"
                  doneText="On — your agent texts leads back and alerts you to new ones"
                  todoText="Add a number so your agent can text leads and answer missed calls"
                  expandLabel="Turn on"
                >
                  <SmsForm initialOwnerPhone={contact?.owner_phone ?? ""} initialTwilioNumber={contact?.twilio_number ?? ""} />
                </ChecklistRow>
                {/* Booking deposit — moved here from Money (it's setup, not revenue) */}
                <ChecklistRow
                  done={Boolean(workspace?.deposit_enabled)}
                  title="Booking deposit"
                  doneText={`On — $${((workspace?.deposit_amount_cents ?? 0) / 100).toLocaleString()} to confirm a booking`}
                  todoText="Optional — require a deposit to confirm a booking"
                  expandLabel="Configure deposit"
                  last
                >
                  <DepositForm initialEnabled={Boolean(workspace?.deposit_enabled)} initialAmount={workspace?.deposit_amount_cents ?? null} />
                </ChecklistRow>
              </div>

              {/* Plan & account */}
              <div className="win" style={{ padding: "clamp(14px,1.8vw,18px)" }}>
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
              </div>
            </div>
          }
        />
      </div>
    </section>
  );
}
