import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * Account-flavored sender — welcome, password reset, account-lifecycle
 * confirmations.  Warm, first-person tone.  The mailbox doesn't need to
 * exist to SEND from (Resend only verifies the domain); we set reply-to
 * to help@ so if the user hits Reply, it actually lands somewhere real.
 */
const fromAccount = "sansxel <hello@sansxel.ai>";

/**
 * Transactional / billing sender — subscription activation, payment
 * events, cancellations, etc.  Intentionally cold (noreply@) so it
 * reads as an automated system notification, not a conversation.
 */
const fromBilling = "sansxel billing <noreply@sansxel.ai>";

/**
 * Every automated send uses help@ as reply-to so Reply goes to a real
 * inbox even when the sender is noreply@ / hello@ / etc.
 */
const REPLY_TO = "help@sansxel.ai";


/**
 * Departmental sender.  For contact-form traffic the `from` address should
 * match the inbox the message was routed to, so both sides of the thread
 * (the support email and the confirmation to the user) read as coming
 * from that department — sales@ writes to the user about sales inquiries,
 * privacy@ writes about privacy, help@ for everything else.
 */
function fromForInbox(inbox: SupportInbox): string {
  switch (inbox) {
    case "sales@sansxel.ai":   return "sansxel sales <sales@sansxel.ai>";
    case "privacy@sansxel.ai": return "sansxel privacy <privacy@sansxel.ai>";
    case "help@sansxel.ai":
    default:                   return "sansxel <help@sansxel.ai>";
  }
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function baseHtml(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding-bottom:20px;">
          <span style="font-size:17px;font-weight:700;color:#0a0a0a;letter-spacing:-0.02em;">sansxel</span>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;padding:36px;">
          ${content}
        </td></tr>
        <tr><td style="padding-top:20px;font-size:12px;color:#a3a3a3;line-height:1.6;">
          sansxel · <a href="https://sansxel.ai/privacy" style="color:#a3a3a3;text-decoration:none;">Privacy</a> · <a href="https://sansxel.ai/contact" style="color:#a3a3a3;text-decoration:none;">Support</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function welcomeHtml(name?: string) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Welcome</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;line-height:1.3;">Your sansxel account is ready.</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#404040;">${greeting} your account is set up. Sign in any time to manage your workspace, track your invite status, and keep your setup preferences saved.</p>
    <a href="https://sansxel.ai/account" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:500;padding:12px 24px;border-radius:14px;text-decoration:none;">Open workspace</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#737373;">If you didn't create this account, you can safely ignore this email.</p>
  `);
}

function earlyAccessHtml(name: string) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Early Access</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;line-height:1.3;">Your invite request is on file.</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#404040;">${greeting} we've saved your place in the rollout. We review access carefully and will reach out directly as access opens for your account.</p>
    <a href="https://sansxel.ai/account" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:500;padding:12px 24px;border-radius:14px;text-decoration:none;">View your account</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#737373;">Questions? Reply to this email or visit <a href="https://sansxel.ai/contact" style="color:#525252;">sansxel.ai/contact</a>.</p>
  `);
}

function passwordResetHtml(resetUrl: string) {
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Password Reset</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;line-height:1.3;">Reset your password.</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#404040;">We received a request to reset the password on your sansxel account. Click the button below to choose a new one. This link expires in one hour.</p>
    <a href="${resetUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:500;padding:12px 24px;border-radius:14px;text-decoration:none;">Reset password</a>
    <p style="margin:24px 0 8px;font-size:13px;line-height:1.6;color:#737373;">If you didn't request this, you can safely ignore this email — your password will not change.</p>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#737373;word-break:break-all;">Or copy this link: ${resetUrl}</p>
  `);
}

function contactConfirmHtml(name: string, subject: string) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Message Received</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;line-height:1.3;">We got your message.</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#404040;">${greeting} we received your message about <strong style="color:#0a0a0a;">${subject}</strong> and will follow up to your email address directly. For urgent issues, reply to this email.</p>
    <a href="https://sansxel.ai/contact" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:500;padding:12px 24px;border-radius:14px;text-decoration:none;">Back to contact</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#737373;">If you didn't submit this form, you can safely ignore this email.</p>
  `);
}

function supportHtml(opts: {
  email:    string;
  name:     string;
  subject:  string;
  message:  string;
  channel?: string | null;
}) {
  const channelRow = opts.channel
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#737373;">Channel</td><td style="padding:4px 0;font-size:13px;color:#0a0a0a;">${opts.channel}</td></tr>`
    : "";
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Support Request</p>
    <h1 style="margin:0 0 24px;font-size:20px;font-weight:600;color:#0a0a0a;line-height:1.3;">${opts.subject}</h1>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${channelRow}
      <tr><td style="padding:4px 0;font-size:13px;color:#737373;width:80px;">From</td><td style="padding:4px 0;font-size:13px;color:#0a0a0a;">${opts.name || "—"}</td></tr>
      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Email</td><td style="padding:4px 0;font-size:13px;color:#0a0a0a;">${opts.email}</td></tr>
    </table>
    <div style="background:#f5f5f5;border:1px solid #e5e5e5;border-radius:14px;padding:16px;">
      <p style="margin:0;font-size:14px;line-height:1.7;color:#404040;white-space:pre-wrap;">${opts.message}</p>
    </div>
  `);
}

// ---------------------------------------------------------------------------
// Send helpers — all fire-and-forget safe (never throw to callers)
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(email: string, name?: string) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from:    fromAccount,
      replyTo: REPLY_TO,
      to:      email,
      subject: "Welcome to sansxel",
      html:    welcomeHtml(name),
    });
  } catch (error) {
    console.error("sendWelcomeEmail failed:", error);
  }
}

export async function sendEarlyAccessEmail(email: string, name: string) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from:    fromAccount,
      replyTo: REPLY_TO,
      to:      email,
      subject: "Your sansxel invite request is on file",
      html:    earlyAccessHtml(name),
    });
  } catch (error) {
    console.error("sendEarlyAccessEmail failed:", error);
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from:    fromAccount,
      replyTo: REPLY_TO,
      to:      email,
      subject: "Reset your sansxel password",
      html:    passwordResetHtml(resetUrl),
    });
  } catch (error) {
    console.error("sendPasswordResetEmail failed:", error);
  }
}

export async function sendContactConfirmEmail(
  email:   string,
  name:    string,
  subject: string,
  /** Inbox the message was routed to — controls the `from` so the
      confirmation comes from the same department the user contacted. */
  inbox:   SupportInbox = "help@sansxel.ai",
) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: fromForInbox(inbox),
      to: email,
      subject: `We received your message — ${subject}`,
      html: contactConfirmHtml(name, subject),
    });
  } catch (error) {
    console.error("sendContactConfirmEmail failed:", error);
  }
}

/**
 * Allowlist of inboxes the contact form may route to.  Any value coming
 * from the client must match one of these — otherwise we silently fall
 * back to help@ so a stray/malicious payload can't be used to spam a
 * third-party address.
 */
export const SUPPORT_INBOXES = [
  "help@sansxel.ai",
  "sales@sansxel.ai",
  "privacy@sansxel.ai",
] as const;
export type SupportInbox = (typeof SUPPORT_INBOXES)[number];

export function resolveSupportInbox(candidate: string | null | undefined): SupportInbox {
  const v = (candidate ?? "").trim().toLowerCase();
  return SUPPORT_INBOXES.find((addr) => addr === v) ?? "help@sansxel.ai";
}

/**
 * Send the actual support email.  Routes to one of the three support
 * inboxes (defaults to help@ if no routing supplied).
 *
 * Throws on Resend failure — the caller (the API route) surfaces the
 * error back to the client so the UI doesn't lie about having sent.
 */
export async function sendSupportEmail(opts: {
  email:   string;
  name:    string;
  subject: string;
  message: string;
  /** One of SUPPORT_INBOXES.  Unsupported values fall back to help@. */
  to?:      string;
  /** Human-readable channel label surfaced inside the email body. */
  channel?: string | null;
}) {
  const resend = getResend();
  if (!resend) {
    throw new Error("Email service is not configured (RESEND_API_KEY missing).");
  }

  const toAddress = resolveSupportInbox(opts.to);
  // Subject is the user's raw subject — no "[Support]" prefix (the
  // destination inbox is already a support inbox) and no "[Channel]"
  // prefix (that lives in the body now).  `from` matches the target
  // inbox's department (sales→sales, privacy→privacy, help→help).
  const result = await resend.emails.send({
    from: fromForInbox(toAddress),
    to:   toAddress,
    replyTo: opts.email,
    subject: opts.subject,
    html: supportHtml(opts),
  });

  // Resend returns { data, error } instead of throwing on 4xx — turn it
  // into a throw so the API route can surface the real reason (unverified
  // sender domain, wrong key, etc.).
  if (result.error) {
    const detail = typeof result.error === "object" && "message" in result.error
      ? String((result.error as { message: unknown }).message)
      : String(result.error);
    throw new Error(`Resend rejected support email to ${toAddress}: ${detail}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNT + BILLING LIFECYCLE EMAILS
//
// All fire-and-forget (errors logged, never thrown) so they can't break
// whatever webhook / API route triggered them.  The user flow always
// completes even if the email dispatch fails.
// ═══════════════════════════════════════════════════════════════════════════

function pwResetConfirmHtml(name: string) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Password Updated</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;line-height:1.3;">Your password was reset.</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#404040;">${greeting} your sansxel password was just changed. If that was you, you're all set.</p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#737373;"><strong style="color:#b91c1c;">If that wasn&apos;t you</strong>, reply to this email or contact <a href="mailto:help@sansxel.ai" style="color:#525252;">help@sansxel.ai</a> immediately — we can lock the account while we investigate.</p>
  `);
}

function accountDeletedHtml(name: string) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Account Deleted</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;line-height:1.3;">Your account has been removed.</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#404040;">${greeting} your sansxel account and associated data have been deleted. You won&apos;t receive further account or billing emails.</p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#737373;">Active subscriptions are cancelled on deletion — no further charges will be made. Changed your mind? You&apos;re welcome back any time at <a href="https://sansxel.ai" style="color:#525252;">sansxel.ai</a>.</p>
  `);
}

function subscriptionActivatedHtml(name: string, planName: string, cycle: string, amountLabel: string) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Subscription Active</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;line-height:1.3;">Welcome to sansxel ${planName}.</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#404040;">${greeting} your ${cycle} subscription is live — <strong style="color:#0a0a0a;">${amountLabel}</strong>. You have the full plan available starting now.</p>
    <a href="https://sansxel.ai/account/billing" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:500;padding:12px 24px;border-radius:14px;text-decoration:none;">Manage billing</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#737373;">Need help? Reply to this email or contact <a href="mailto:help@sansxel.ai" style="color:#525252;">help@sansxel.ai</a>.</p>
  `);
}

function subscriptionCancellationScheduledHtml(name: string, planName: string, endsOn: string) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Cancellation Scheduled</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;line-height:1.3;">Your ${planName} plan ends on ${endsOn}.</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#404040;">${greeting} we&apos;ve scheduled your cancellation. You keep full access until <strong style="color:#0a0a0a;">${endsOn}</strong>. After that you&apos;ll drop to the Free plan — no data loss.</p>
    <a href="https://sansxel.ai/account/billing" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:500;padding:12px 24px;border-radius:14px;text-decoration:none;">Change your mind? Resume</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#737373;">If this wasn&apos;t you, head to billing and tap Resume subscription immediately — it&apos;s one click.</p>
  `);
}

function subscriptionEndedHtml(name: string, planName: string) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Plan Reset</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;line-height:1.3;">Your ${planName} plan has ended.</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#404040;">${greeting} your paid period is over and your account is now on the Free plan. Your data and history are still there — just the paid features are no longer active.</p>
    <a href="https://sansxel.ai/pricing" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:500;padding:12px 24px;border-radius:14px;text-decoration:none;">Pick a plan again</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#737373;">No charge goes out until you pick a plan again. Reply here if something seems off.</p>
  `);
}

function paymentFailedHtml(name: string, planName: string) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#b91c1c;">Payment Failed</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;line-height:1.3;">We couldn&apos;t charge your card.</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#404040;">${greeting} your latest charge for the <strong style="color:#0a0a0a;">${planName}</strong> plan didn&apos;t go through. We&apos;ll retry automatically, but if the card on file is expired or blocked, update it to avoid losing access.</p>
    <a href="https://sansxel.ai/account/billing" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:500;padding:12px 24px;border-radius:14px;text-decoration:none;">Update payment method</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#737373;">If retries fail, your plan drops to Free — no data loss, just the paid features pause until billing is back on.</p>
  `);
}

function paymentMethodUpdatedHtml(name: string, brand: string, last4: string) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Payment Method Updated</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;line-height:1.3;">New card on file.</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#404040;">${greeting} your next invoice will charge <strong style="color:#0a0a0a;">${brand.toUpperCase()} ending in ${last4}</strong>. No other plan changes were made.</p>
    <a href="https://sansxel.ai/account/billing" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:500;padding:12px 24px;border-radius:14px;text-decoration:none;">Review billing</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#737373;"><strong style="color:#b91c1c;">If you didn&apos;t make this change</strong>, reply immediately or contact <a href="mailto:help@sansxel.ai" style="color:#525252;">help@sansxel.ai</a>.</p>
  `);
}

// ── Send helpers ───────────────────────────────────────────────────────────

export async function sendPasswordResetConfirmEmail(email: string, name: string) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: fromAccount, replyTo: REPLY_TO, to: email,
      subject: "Your sansxel password was reset",
      html: pwResetConfirmHtml(name),
    });
  } catch (err) { console.error("sendPasswordResetConfirmEmail failed:", err); }
}

export async function sendAccountDeletedEmail(email: string, name: string) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: fromAccount, replyTo: REPLY_TO, to: email,
      subject: "Your sansxel account has been deleted",
      html: accountDeletedHtml(name),
    });
  } catch (err) { console.error("sendAccountDeletedEmail failed:", err); }
}

export async function sendSubscriptionActivatedEmail(opts: {
  email: string; name: string; planName: string; cycle: "monthly" | "yearly"; amountLabel: string;
}) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: fromBilling, replyTo: REPLY_TO, to: opts.email,
      subject: `Welcome to sansxel ${opts.planName}`,
      html: subscriptionActivatedHtml(opts.name, opts.planName, opts.cycle, opts.amountLabel),
    });
  } catch (err) { console.error("sendSubscriptionActivatedEmail failed:", err); }
}

export async function sendSubscriptionCancellationScheduledEmail(opts: {
  email: string; name: string; planName: string; endsOn: string;
}) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: fromBilling, replyTo: REPLY_TO, to: opts.email,
      subject: `Your ${opts.planName} plan ends on ${opts.endsOn}`,
      html: subscriptionCancellationScheduledHtml(opts.name, opts.planName, opts.endsOn),
    });
  } catch (err) { console.error("sendSubscriptionCancellationScheduledEmail failed:", err); }
}

export async function sendSubscriptionEndedEmail(opts: {
  email: string; name: string; planName: string;
}) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: fromBilling, replyTo: REPLY_TO, to: opts.email,
      subject: `Your ${opts.planName} plan has ended`,
      html: subscriptionEndedHtml(opts.name, opts.planName),
    });
  } catch (err) { console.error("sendSubscriptionEndedEmail failed:", err); }
}

export async function sendPaymentFailedEmail(opts: {
  email: string; name: string; planName: string;
}) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: fromBilling, replyTo: REPLY_TO, to: opts.email,
      subject: `Payment failed for your sansxel ${opts.planName} plan`,
      html: paymentFailedHtml(opts.name, opts.planName),
    });
  } catch (err) { console.error("sendPaymentFailedEmail failed:", err); }
}

export async function sendPaymentMethodUpdatedEmail(opts: {
  email: string; name: string; brand: string; last4: string;
}) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: fromBilling, replyTo: REPLY_TO, to: opts.email,
      subject: "Your payment method was updated",
      html: paymentMethodUpdatedHtml(opts.name, opts.brand, opts.last4),
    });
  } catch (err) { console.error("sendPaymentMethodUpdatedEmail failed:", err); }
}
