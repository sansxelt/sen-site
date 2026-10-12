// Every email the codebase can send, captured at the Resend API boundary (fetch intercepted, nothing leaves the
// machine), written out as HTML/text, and checked. Usage: npm run email:census -- [outdir]   (default: .email-census, git-ignored by the leading dot rule if present)
import fs from "node:fs";

process.env.RESEND_API_KEY = "re_harness_not_a_key";
process.env.VRAELIS_FROM_EMAIL = process.env.VRAELIS_FROM_EMAIL || "Vraelis <hello@vraelis.com>";
const out = process.argv[2] || ".email-census"; fs.mkdirSync(out, { recursive: true });
type Sent = { from?: string; to?: string | string[]; subject?: string; html?: string; text?: string; reply_to?: unknown };
const sent: Sent[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("api.resend.com")) {
    sent.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response(JSON.stringify({ id: `harness-${sent.length}` }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return new Response("{}", { status: 503 }); // any other service (DB, SMS) is unavailable in the harness
}) as typeof fetch;
void realFetch;

const MSG = "Hi Vraelis team,\n\nWe ship model updates to a few hundred field units and want to understand approval & what <b>actually</b> loaded.\n\nThanks,\nDana";
async function main() {
  const E = await import("../lib/email");
  const V = await import("../lib/vraelis-email");
  const N = await import("../lib/vraelis-notify");
  const to = "dana@example.com";
  const runs: [string, () => Promise<unknown>][] = [
    ["welcome", () => E.sendWelcomeEmail(to, "Dana Reyes")],
    ["welcome-noname", () => E.sendWelcomeEmail(to)],
    ["check-activation", () => E.sendCheckActivationEmail(to)],
    ["low-credits", () => E.sendLowCreditsEmail(to, 3)],
    ["winback", () => E.sendWinbackEmail(to, 12)],
    ["password-reset", () => E.sendPasswordResetEmail(to, "https://vraelis.com/auth/reset-password/confirm?token=abc")],
    ["two-step-sign-in", () => E.sendTwoStepCodeEmail(to, "482913", "sign_in")],
    ["two-step-enable", () => E.sendTwoStepCodeEmail(to, "482913", "enable_email")],
    ["two-step-confirm", () => E.sendTwoStepCodeEmail(to, "482913", "confirm")],
    ["verify-account", () => E.sendVerifyAccountEmail({ email: to, name: "Dana", verifyUrl: "https://vraelis.com/auth/verify-email?token=abc", expiryLabel: "24 hours" })],
    ["contact-confirm", () => E.sendContactConfirmEmail(to, "Dana Reyes", "Model release workflow", "help@vraelis.com")],
    ["contact-confirm-noname", () => E.sendContactConfirmEmail(to, "", "x", "sales@vraelis.com")],
    ["support-inbox", () => E.sendSupportEmail({ email: to, name: "Dana Reyes", subject: "Model release workflow for our fleet", message: MSG, to: "sales@vraelis.com", channel: "Vraelis Contour" })],
    ["support-inbox-minimal", () => E.sendSupportEmail({ email: to, name: "", subject: "Question", message: "Short message here.", channel: null })],
    ["password-changed", () => E.sendPasswordResetConfirmEmail(to, "Dana")],
    ["account-deleted", () => E.sendAccountDeletedEmail(to, "Dana")],
    ["sub-activated", () => E.sendSubscriptionActivatedEmail({ email: to, name: "Dana", planName: "Pro", cycle: "monthly", amountLabel: "$39.00" })],
    ["sub-cancel-scheduled", () => E.sendSubscriptionCancellationScheduledEmail({ email: to, name: "Dana", planName: "Pro", endsOn: "November 11, 2026" })],
    ["sub-ended", () => E.sendSubscriptionEndedEmail({ email: to, name: "Dana", planName: "Pro" })],
    ["payment-failed", () => E.sendPaymentFailedEmail({ email: to, name: "Dana", planName: "Pro" })],
    ["payment-method-updated", () => E.sendPaymentMethodUpdatedEmail({ email: to, name: "Dana", brand: "Visa", last4: "4242" })],
    ["renewal-succeeded", () => E.sendRenewalSucceededEmail({ email: to, name: "Dana", planName: "Pro", amountLabel: "$39.00", periodEnd: "December 11, 2026", invoiceUrl: "https://pay.stripe.com/invoice/abc" })],
    ["renewal-succeeded-noinvoice", () => E.sendRenewalSucceededEmail({ email: to, name: "", planName: "Pro", amountLabel: "$39.00", periodEnd: "December 11, 2026", invoiceUrl: null })],
    ["renewal-upcoming", () => E.sendRenewalUpcomingEmail({ email: to, name: "Dana", planName: "Pro", amountLabel: "$39.00", chargeDate: "November 11, 2026" })],
    ["newsletter", () => E.sendNewsletterEmail({ to, subject: "What changed this month", bodyHtml: "<p>Hi Dana, here is what changed.</p><h2>Release identity</h2><p>Text with a <a href=\"https://vraelis.com\">link</a>.</p><ul><li>One</li><li>Two</li></ul>" })],
    ["invite-workspace", () => E.sendInviteEmail({ type: "workspace", to, workspaceName: "Acme Robotics", role: "admin", acceptUrl: "https://vraelis.com/invite/abc" })],
    ["invite-project", () => E.sendInviteEmail({ type: "project", to, projectName: "Fleet rollout", role: "viewer", acceptUrl: "https://vraelis.com/invite/abc" })],
    ["owner-notice", () => V.sendOwnerNotice("owner@example.com", { subject: "New lead: Dana", heading: "New lead: Dana", preheader: "Dana asked about a booking.", status: { tone: "success", text: "A new lead arrived" }, paragraphs: ["Dana wrote in through your intake form.", "Reply from your inbox."], quote: MSG, action: { label: "Open the lead", url: "https://vraelis.com/v/leads/1" } })],
    ["booking-confirmation", () => V.sendBookingConfirmation({ businessName: "Acme Dental", slotLabel: "Tue, Nov 3 at 10:00 AM", leadEmail: to, leadName: "Dana", ownerEmail: "owner@example.com" })],
    ["owner-alert-text-only", () => V.sendOwnerAlert({ ownerEmail: "owner@example.com", subject: "Heads up", body: "Plain text body only." })],
    ["lead-reply", () => V.sendLeadReply({ to, businessName: "Acme Dental", replyText: "Hi Dana,\n\nThanks for reaching out. We have Tuesday at 10.\n\nBest,\nAcme", replyTo: "owner@example.com" })],
    ["notify-plan-lapse-past-due", () => N.notifyOwnerPlanLapse("owner@example.com", "past_due")],
    ["notify-plan-lapse-canceled", () => N.notifyOwnerPlanLapse("owner@example.com", "canceled")],
    ["notify-new-lead", () => N.notifyOwnerNewLeadEvent("owner@example.com", { id: "l1", name: "Dana", contact_email: to, contact_phone: "+15555550100", message: MSG })],
    ["notify-status-needs-owner", () => N.notifyOwnerStatusEvent("owner@example.com", { id: "l1", name: "Dana", contact_email: to }, "new", "needs_owner")],
    ["notify-status-booking-ready", () => N.notifyOwnerStatusEvent("owner@example.com", { id: "l1", name: "Dana", contact_email: to }, "needs_owner", "booking_ready")],
  ];
  const report: Record<string, unknown>[] = [];
  for (const [name, run] of runs) {
    const before = sent.length;
    let error: string | null = null;
    try { await run(); } catch (e) { error = (e as Error).message; }
    const mails = sent.slice(before);
    mails.forEach((m, i) => {
      const id = mails.length > 1 ? `${name}-${i + 1}` : name;
      if (m.html) fs.writeFileSync(`${out}/${id}.html`, m.html);
      if (m.text) fs.writeFileSync(`${out}/${id}.txt`, m.text);
      const html = m.html ?? "", text = m.text ?? "";
      const problems: string[] = [];
      if (!m.subject) problems.push("no subject");
      if (html && !html.includes("lockup-ink@2x.png") && name !== "lead-reply") problems.push("no logo");
      if (html && !/&copy; \d{4} Vraelis/.test(html)) problems.push("no footer");
      if (/\b(undefined|NaN|\[object Object\])\b|>null</.test(html + text)) problems.push("undefined/null/NaN in output");
      if (html.includes("<b>actually</b>")) problems.push("unescaped user HTML");
      if (/<p[^>]*>\s*Hi [^<]{0,60}, [a-z]/.test(html)) problems.push("greeting not split");
      if (html && name !== "lead-reply" && !/<div style="display:none[^>]*>[^<&]{3,}/.test(html)) problems.push("empty preheader");
      if (!text) problems.push("no text part"); else if (/<(p|td|tr|table|div|a|strong|h1|span)\b|&(nbsp|middot|copy|amp|zwnj);/i.test(text)) problems.push("email markup in text part");
      report.push({ id, subject: m.subject, from: m.from, to: m.to, htmlKB: Math.round(html.length / 102.4) / 10, text: !!text, problems });
    });
    if (!mails.length) report.push({ id: name, sent: 0, error });
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
  for (const r of report) console.log(`${String(r.id).padEnd(30)} ${r.sent === 0 ? `NOT SENT${r.error ? ` (${r.error})` : ""}` : `${String(r.subject).slice(0, 48).padEnd(48)} ${(r.problems as string[]).join("; ") || "ok"}`}`);
}
main();
