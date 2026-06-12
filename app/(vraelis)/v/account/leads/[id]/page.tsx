import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLeadWithMessages, getOrCreateWorkspace, isWorkspaceOnboarded, listPayments, type LeadStatus } from "@/lib/vraelis-db";
import { cutRateFor } from "@/lib/vraelis-plans";
import { updateLeadDealAction, updateLeadOutcomeAction } from "../../actions";
import { ReplyBox } from "./reply-box";
import { RequestPayment } from "./request-payment";

const OUTCOMES = ["open", "booked", "paid", "lost", "spam"] as const;
const LOST_REASONS = ["No response", "Too expensive", "Not interested", "Booked elsewhere", "Other"];

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatMoneyFromCents(cents: number) {
  const dollars = cents / 100;
  const hasCents = cents % 100 !== 0;
  return dollars.toLocaleString(undefined, { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 });
}

export const metadata: Metadata = {
  title: "Lead — Vraelis",
  robots: { index: false, follow: false },
};

const STATUSES: LeadStatus[] = ["new", "contacted", "qualifying", "qualified", "booking_ready", "needs_owner", "booked", "won", "lost"];

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New", contacted: "Contacted", qualifying: "Qualifying", qualified: "Qualified",
  booking_ready: "Booking ready", needs_owner: "Needs you", booked: "Booked", won: "Won", lost: "Lost",
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin?callbackUrl=%2Faccount");
  // Core onboarding first — /v/account shows the setup screen until done.
  if (!(await isWorkspaceOnboarded(session.user.email))) redirect("/v/account");

  const { id } = await params;
  const [data, workspace, leadPayments] = await Promise.all([
    getLeadWithMessages(session.user.email, id),
    getOrCreateWorkspace(session.user.email),
    listPayments(session.user.email, { leadId: id, limit: 10 }),
  ]);
  if (!data) notFound();
  const { lead, messages } = data;
  const leadName = lead.name || lead.contact_email || lead.contact_phone || "New lead";
  const connected = workspace?.connect_status === "active";
  const cutRate = cutRateFor(workspace?.plan ?? null, workspace?.plan_cycle ?? null);
  const pendingPayment = leadPayments.find((payment) => payment.status === "pending") ?? null;
  const paidPayment = leadPayments.find((payment) => payment.status === "paid") ?? null;
  const readyForPayment = lead.status === "qualified" || lead.status === "booking_ready" || lead.status === "booked";

  const lastMsg = messages.length ? messages[messages.length - 1] : null;
  const lastActivity = timeAgo(lastMsg?.created_at ?? lead.created_at);
  const outcome = (lead.outcome as string) || "open";
  const outcomeClass =
    outcome === "paid" ? "st-won" : outcome === "booked" ? "st-booked" : outcome === "lost" || outcome === "spam" ? "st-contacted" : "st-new";
  const moneyState = paidPayment
    ? {
        eyebrow: "Paid through Vraelis",
        title: `This lead already paid $${formatMoneyFromCents(paidPayment.amount_cents)}.`,
        body: `Marked paid ${timeAgo(paidPayment.paid_at ?? paidPayment.created_at)}. Your Money tab now shows $${formatMoneyFromCents(paidPayment.amount_cents - paidPayment.fee_cents)} after the Vraelis fee, before Stripe processing fees.`,
        tone: { borderColor: "rgba(21,128,61,0.22)", background: "rgba(21,128,61,0.08)", eyebrow: "#15803D" },
        pill: <span className="pill st-won"><span className="dot" />Paid</span>,
      }
    : pendingPayment
      ? {
          eyebrow: "Payment request sent",
          title: `Waiting on $${formatMoneyFromCents(pendingPayment.amount_cents)} from this lead.`,
          body: `Sent ${timeAgo(pendingPayment.created_at)}. When they pay, Vraelis marks the lead paid and moves the charge into Money automatically. The checkout link is saved in the conversation below.`,
          tone: { borderColor: "rgba(194,84,12,0.25)", background: "rgba(194,84,12,0.08)", eyebrow: "#C2540C" },
          pill: <span className="pill st-booked"><span className="dot" />Pending</span>,
        }
      : !connected
        ? {
            eyebrow: "Turn on payouts first",
            title: "Set up your payment rail before you ask for money.",
            body: "Open the Money tab to finish payouts. Once that is live, you can send this lead a secure checkout link right from here.",
            tone: { borderColor: "var(--line-2)", background: "var(--bg-1)", eyebrow: "var(--fg-4)" },
            pill: <Link href="/v/account?tab=money" className="btn btn--ghost" style={{ padding: "8px 14px", fontSize: 13, textDecoration: "none" }}>Open Money</Link>,
          }
        : readyForPayment
          ? {
              eyebrow: "Next step",
              title: "This lead is ready for a payment request.",
              body: "If the amount looks right, send the checkout link below. Once they pay, Vraelis updates the lead and your Money tab automatically.",
              tone: { borderColor: "var(--acc-line)", background: "var(--acc-soft)", eyebrow: "var(--acc-deep)" },
              pill: <span className={`pill st-${lead.status}`}><span className="dot" />{lead.status === "booked" ? "Booked" : "Ready"}</span>,
            }
          : {
              eyebrow: "Keep qualifying",
              title: "Still early to ask this lead for payment.",
              body: "Move the lead to Qualified or Booking ready once they are a real fit. Then this page becomes the clean handoff to a payment request.",
              tone: { borderColor: "var(--line-2)", background: "var(--bg-1)", eyebrow: "var(--fg-4)" },
              pill: <span className={`pill st-${lead.status}`}><span className="dot" />{STATUS_LABEL[lead.status]}</span>,
            };

  return (
    <section className="section section--app" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.3 }} />
      <div className="wrap" style={{ position: "relative", maxWidth: 820 }}>
        <Link href="/v/account" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none" }}>
          ← Back to inbox
        </Link>

        {/* ── Deal summary: who, status, value, source, last activity ── */}
        <div className="win" style={{ padding: "clamp(14px,1.8vw,18px)", margin: "12px 0 12px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <h1 className="display" style={{ fontSize: "clamp(1.3rem, 2vw, 1.7rem)", marginBottom: 5, overflowWrap: "anywhere" }}>{leadName}</h1>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className={`pill st-${lead.status}`}><span className="dot" />{STATUS_LABEL[lead.status]}</span>
                {outcome !== "open" && <span className={`pill ${outcomeClass}`} style={{ textTransform: "capitalize" }}><span className="dot" />{outcome}</span>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 4 }}>Deal value</div>
              <div className="tnum" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(20px,2.4vw,28px)", lineHeight: 1, color: lead.value ? "var(--money)" : "var(--fg-4)" }}>
                {lead.value ? `$${lead.value.toLocaleString()}` : "—"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-1)" }}>
            {lead.contact_email && <span style={{ overflowWrap: "anywhere" }}>✉ {lead.contact_email}</span>}
            {lead.contact_phone && <span style={{ overflowWrap: "anywhere" }}>☎ {lead.contact_phone}</span>}
            {lead.source && <span>via {lead.source}</span>}
            <span>active {lastActivity}</span>
          </div>
        </div>

        {/* ── Next best action: status / value / outcome controls ────── */}
        <div
          className="win"
          style={{
            padding: "clamp(14px,1.8vw,18px)",
            marginBottom: 12,
            borderColor: moneyState.tone.borderColor,
            background: moneyState.tone.background,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: moneyState.tone.eyebrow, marginBottom: 8 }}>
                {moneyState.eyebrow}
              </div>
              <h2 style={{ fontSize: 18, letterSpacing: "-0.03em", color: "var(--fg-1)", marginBottom: 5 }}>
                {moneyState.title}
              </h2>
              <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: 0, maxWidth: 560 }}>
                {moneyState.body}
              </p>
            </div>
            <div style={{ flexShrink: 0 }}>
              {moneyState.pill}
            </div>
          </div>
        </div>

        <div className="win" style={{ padding: "clamp(14px,1.8vw,18px)", marginBottom: 12 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 14 }}>
            Update this deal
          </div>
          <div style={{ display: "flex", gap: "clamp(12px,3vw,28px)", flexWrap: "wrap" }}>
            {/* Stage + deal value */}
            <form action={updateLeadDealAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="hidden" name="leadId" value={lead.id} />
              <select name="status" defaultValue={lead.status} style={{ borderRadius: "var(--r-xs)", border: "1px solid var(--line-2)", background: "var(--bg-1)", padding: "9px 12px", fontSize: 13, color: "var(--fg-1)", fontFamily: "var(--font-sans)" }}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--line-2)", borderRadius: "var(--r-xs)", padding: "0 10px", background: "var(--bg-1)" }}>
                <span style={{ color: "var(--fg-4)", fontSize: 13 }}>$</span>
                <input name="value" type="number" min={0} defaultValue={lead.value ?? ""} placeholder="deal value" style={{ width: 92, border: "none", background: "transparent", padding: "9px 2px", fontSize: 13, color: "var(--fg-1)", outline: "none", fontFamily: "var(--font-mono)" }} />
              </div>
              <button type="submit" className="btn btn--ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Save</button>
            </form>
            {/* Outcome (won/lost) */}
            <form action={updateLeadOutcomeAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="hidden" name="leadId" value={lead.id} />
              <select name="outcome" defaultValue={outcome} style={{ borderRadius: "var(--r-xs)", border: "1px solid var(--line-2)", background: "var(--bg-1)", padding: "9px 11px", fontSize: 13, color: "var(--fg-1)", fontFamily: "var(--font-sans)" }}>
                {OUTCOMES.map((o) => <option key={o} value={o}>{o === "open" ? "Mark outcome…" : o[0].toUpperCase() + o.slice(1)}</option>)}
              </select>
              <select name="lostReason" defaultValue={lead.lost_reason ?? ""} style={{ borderRadius: "var(--r-xs)", border: "1px solid var(--line-2)", background: "var(--bg-1)", padding: "9px 11px", fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-sans)" }}>
                <option value="">Lost reason…</option>
                {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button type="submit" className="btn btn--ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Save</button>
            </form>
          </div>
        </div>

        {/* ── Collect payment — the money action ──────────────────────── */}
        <div
          className="win"
          style={{
            padding: "clamp(14px,1.8vw,18px)",
            marginBottom: 12,
            borderColor: paidPayment
              ? "rgba(21,128,61,0.22)"
              : pendingPayment
                ? "rgba(194,84,12,0.25)"
                : connected
                  ? "var(--acc-line)"
                  : "var(--line-2)",
            background: paidPayment
              ? "rgba(21,128,61,0.08)"
              : pendingPayment
                ? "rgba(194,84,12,0.08)"
                : connected
                  ? "var(--acc-soft)"
                  : "var(--bg-1)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: paidPayment ? "#15803D" : pendingPayment ? "#C2540C" : connected ? "var(--acc-deep)" : "var(--fg-4)",
              marginBottom: 14,
            }}
          >
            {paidPayment ? "Paid through Vraelis" : pendingPayment ? "Payment request sent" : "Collect payment"}
          </div>
          {paidPayment ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div className="tnum" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(22px,2.4vw,28px)", color: "#15803D", lineHeight: 1 }}>
                  ${formatMoneyFromCents(paidPayment.amount_cents)}
                </div>
                <span className="pill st-won"><span className="dot" />Paid</span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.55, margin: 0 }}>
                {paidPayment.description ? `${paidPayment.description}. ` : ""}After the Vraelis fee, you kept ${formatMoneyFromCents(paidPayment.amount_cents - paidPayment.fee_cents)} before Stripe processing fees. Paid {timeAgo(paidPayment.paid_at ?? paidPayment.created_at)} and already reflected in Money.
              </p>
            </div>
          ) : pendingPayment ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div className="tnum" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(22px,2.4vw,28px)", color: "#C2540C", lineHeight: 1 }}>
                  ${formatMoneyFromCents(pendingPayment.amount_cents)}
                </div>
                <span className="pill st-booked"><span className="dot" />Pending</span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.55, margin: 0 }}>
                {pendingPayment.description ? `${pendingPayment.description}. ` : ""}Sent {timeAgo(pendingPayment.created_at)}. When they pay, Vraelis marks this lead paid and moves the charge into Money automatically. Need the link again? It is saved in the conversation below.
              </p>
            </div>
          ) : (
            <RequestPayment leadId={lead.id} connected={connected} cutRate={cutRate} />
          )}
        </div>

        <div className="win" style={{ padding: "clamp(14px,1.8vw,18px)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 16 }}>
            Conversation
          </div>
          {messages.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--fg-3)" }}>No messages yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((m) => (
                <div key={m.id} className={`bub ${m.role === "agent" ? "bub--out" : "bub--in"}`} style={{ maxWidth: "80%", alignSelf: m.role === "agent" ? "flex-end" : "flex-start" }}>
                  <div className="bub__who">
                    {m.role === "agent" ? "Vraelis" : leadName.split(" ")[0]}
                    {m.role === "agent" && m.channel === "chat" ? " · chat" : ""}
                    {m.role === "agent" && !m.delivered && m.channel !== "chat" ? " · draft (not emailed)" : ""}
                  </div>
                  {m.body}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line-1)" }}>
            <ReplyBox leadId={lead.id} />
          </div>
        </div>
      </div>
    </section>
  );
}
