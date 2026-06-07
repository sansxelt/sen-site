import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLeadWithMessages, getOrCreateWorkspace, type LeadStatus } from "@/lib/vraelis-db";
import { updateLeadDealAction, updateLeadOutcomeAction } from "../../actions";
import { ReplyBox } from "./reply-box";
import { RequestPayment } from "./request-payment";

const OUTCOMES = ["open", "booked", "paid", "lost", "spam"] as const;
const LOST_REASONS = ["No response", "Too expensive", "Not interested", "Booked elsewhere", "Other"];

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

  const { id } = await params;
  const [data, workspace] = await Promise.all([
    getLeadWithMessages(session.user.email, id),
    getOrCreateWorkspace(session.user.email),
  ]);
  if (!data) notFound();
  const { lead, messages } = data;
  const leadName = lead.name || lead.contact_email || lead.contact_phone || "New lead";
  const connected = workspace?.connect_status === "active";

  return (
    <section className="section" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.3 }} />
      <div className="wrap" style={{ position: "relative", maxWidth: 880 }}>
        <Link href="/v/account" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none" }}>
          ← Back to inbox
        </Link>

        <div style={{ margin: "18px 0 22px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 6 }}>{leadName}</h1>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)" }}>
              {[lead.contact_email, lead.contact_phone, lead.source].filter(Boolean).join(" · ")}
            </div>
          </div>
          {/* status + deal value — server-action form */}
          <form action={updateLeadDealAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="hidden" name="leadId" value={lead.id} />
            <select
              name="status"
              defaultValue={lead.status}
              style={{ borderRadius: "var(--r-xs)", border: "1px solid var(--line-2)", background: "var(--bg-1)", padding: "9px 12px", fontSize: 13, color: "var(--fg-1)", fontFamily: "var(--font-sans)" }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--line-2)", borderRadius: "var(--r-xs)", padding: "0 10px", background: "var(--bg-1)" }}>
              <span style={{ color: "var(--fg-4)", fontSize: 13 }}>$</span>
              <input
                name="value"
                type="number"
                min={0}
                defaultValue={lead.value ?? ""}
                placeholder="deal value"
                style={{ width: 92, border: "none", background: "transparent", padding: "9px 2px", fontSize: 13, color: "var(--fg-1)", outline: "none", fontFamily: "var(--font-mono)" }}
              />
            </div>
            <button type="submit" className="btn btn--ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Save</button>
          </form>
        </div>

        {/* Outcome label — VIE training data */}
        <form action={updateLeadOutcomeAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <input type="hidden" name="leadId" value={lead.id} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>Outcome</span>
          <select name="outcome" defaultValue={(lead.outcome as string) || "open"} style={{ borderRadius: "var(--r-xs)", border: "1px solid var(--line-2)", background: "var(--bg-1)", padding: "8px 11px", fontSize: 13, color: "var(--fg-1)", fontFamily: "var(--font-sans)" }}>
            {OUTCOMES.map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
          </select>
          <select name="lostReason" defaultValue={lead.lost_reason ?? ""} style={{ borderRadius: "var(--r-xs)", border: "1px solid var(--line-2)", background: "var(--bg-1)", padding: "8px 11px", fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-sans)" }}>
            <option value="">Lost reason…</option>
            {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="submit" className="btn btn--ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Save</button>
        </form>

        <div className="win" style={{ padding: "20px 22px" }}>
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

        <div className="win" style={{ padding: "20px 22px", marginTop: 16 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>
            Collect payment
          </div>
          <RequestPayment leadId={lead.id} connected={connected} />
        </div>
      </div>
    </section>
  );
}
