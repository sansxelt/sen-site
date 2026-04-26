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
 * Account-flavored sender, welcome, password reset, account-lifecycle
 * confirmations.  Matches the "Sansxel AI" identity the user set up in
 * Gmail's Send-mail-as aliases so replies look visually consistent with
 * what they'd see going the other way.
 */
const fromAccount = "Sansxel AI <hello@sansxel.ai>";

/**
 * Automated system sender, billing events today, newsletters in Phase 2.
 * Kept as plain "Sansxel AI" since noreply@ handles multiple kinds of
 * automated mail and a narrower "Billing" label would be wrong for
 * newsletters / product updates.
 */
const fromBilling = "Sansxel AI <noreply@sansxel.ai>";

/**
 * Sender/reply-to policy:
 *   - hello@ and noreply@ are auto-only senders. Neither routes replies
 *     to a human, hello@ is for account mail, noreply@ is for billing
 *     and (future) product updates. Replies are expected to die there.
 *   - help@, sales@, privacy@ are *real inboxes* for inbound support.
 *     They're used as the `from` only on contact-form threads that
 *     started on the user's side, so the conversation stays on-channel.
 *
 * Automated sends therefore don't set `replyTo` at all, Resend
 * defaults it to the `from` address, which is the correct "no reply
 * expected" behavior for hello@ and noreply@. Setting replyTo to help@
 * on billing mail (the old behavior) bled customer billing questions
 * into the general support inbox and muddied the channel model.
 */


/**
 * Departmental sender.  For contact-form traffic the `from` address should
 * match the inbox the message was routed to, so both sides of the thread
 * (the support email and the confirmation to the user) read as coming
 * from that department, sales@ writes to the user about sales inquiries,
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

/**
 * baseHtml, standard email chrome for every transactional message.
 * Header: small sansxel wordmark + tagline.
 * Body: the template's own content, rendered inside a white card.
 * Footer: dense contact block (all 3 departmental inboxes), legal
 *         links, copyright.  Sits below the signature so it never
 *         crowds the message itself.
 */
function baseHtml(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <!--
    Mobile tuning, the main transactional email clients that respect
    <style> + @media are Apple Mail, Gmail iOS/Android (native apps),
    Outlook iOS. Gmail Web strips the head-level style block on some
    templates, so inline styles stay the baseline; this block just
    sharpens things where support exists.
  -->
  <style>
    @media only screen and (max-width: 480px) {
      .sx-outer       { padding: 16px 8px !important; }
      .sx-card        { padding: 22px 20px 20px !important; border-radius: 16px !important; }
      .sx-h1          { font-size: 20px !important; line-height: 1.3 !important; }
      .sx-btn         { display: block !important; width: 100% !important; box-sizing: border-box !important; margin: 0 0 10px !important; text-align: center !important; }
      .sx-btn-spacer  { display: none !important; }
      .sx-details-label { width: auto !important; display: block !important; padding-bottom: 2px !important; }
      .sx-details-value { display: block !important; padding-top: 0 !important; padding-bottom: 10px !important; }
      .sx-footer-links a { display: inline-block; }
      .sx-message-body { padding: 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="sx-outer" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;">

        <!-- ── Brand header ──────────────────────────────────── -->
        <tr><td style="padding:0 4px 20px;">
          <span style="font-size:18px;font-weight:700;color:#0a0a0a;letter-spacing:-0.02em;">sansxel</span>
          <span style="margin-left:10px;font-size:11px;font-weight:500;color:#737373;letter-spacing:0.06em;text-transform:uppercase;">Build something REAL.</span>
        </td></tr>

        <!-- ── Message card ──────────────────────────────────── -->
        <tr><td class="sx-card" style="background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;padding:36px 36px 32px;">
          ${content}
        </td></tr>

        <!-- ── Contact block ─────────────────────────────────── -->
        <tr><td style="padding:22px 4px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding-bottom:10px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#525252;">
              Reach out
            </td></tr>
            <tr><td style="font-size:13px;color:#525252;line-height:1.7;">
              General support · <a href="mailto:help@sansxel.ai" style="color:#0a0a0a;text-decoration:none;border-bottom:1px solid #d4d4d4;">help@sansxel.ai</a><br>
              Privacy &amp; data · <a href="mailto:privacy@sansxel.ai" style="color:#0a0a0a;text-decoration:none;border-bottom:1px solid #d4d4d4;">privacy@sansxel.ai</a><br>
              Teams &amp; sales · <a href="mailto:sales@sansxel.ai" style="color:#0a0a0a;text-decoration:none;border-bottom:1px solid #d4d4d4;">sales@sansxel.ai</a>
            </td></tr>
          </table>
        </td></tr>

        <!-- ── Legal footer ──────────────────────────────────── -->
        <tr><td style="padding:22px 4px 0;border-top:1px solid #e5e5e5;margin-top:22px;">
          <p class="sx-footer-links" style="margin:16px 0 0;font-size:11px;line-height:1.9;color:#a3a3a3;word-break:break-word;">
            <a href="https://sansxel.ai" style="color:#737373;text-decoration:none;">sansxel.ai</a>
             · <a href="https://sansxel.ai/features" style="color:#737373;text-decoration:none;">Features</a>
             · <a href="https://sansxel.ai/pricing" style="color:#737373;text-decoration:none;">Pricing</a>
             · <a href="https://sansxel.ai/privacy" style="color:#737373;text-decoration:none;">Privacy</a>
             · <a href="https://sansxel.ai/terms" style="color:#737373;text-decoration:none;">Terms</a>
             · <a href="https://sansxel.ai/contact" style="color:#737373;text-decoration:none;">Contact</a>
          </p>
          <p style="margin:10px 0 0;font-size:11px;color:#a3a3a3;line-height:1.7;">
            © ${new Date().getFullYear()} sansxel. All rights reserved.<br>
            You&apos;re receiving this because an account or subscription event happened on sansxel.ai.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Shared template atoms ─────────────────────────────────────────────────

const KICKER_STYLE = "margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#737373;";
const KICKER_RED   = "margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#b91c1c;";
// Headlines shrink to 20px on narrow screens via the .sx-h1 class in baseHtml's <style>.
const H1_STYLE     = "margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;line-height:1.25;letter-spacing:-0.01em;";
const BODY_STYLE   = "margin:0 0 18px;font-size:14px;line-height:1.7;color:#404040;";
const META_STYLE   = "margin:0 0 4px;font-size:13px;line-height:1.7;color:#737373;";
// Buttons stack full-width on narrow screens via the .sx-btn class.
const BTN_STYLE    = "display:inline-block;background:#0a0a0a;color:#ffffff !important;font-size:14px;font-weight:500;padding:12px 22px;border-radius:14px;text-decoration:none;";
const BTN_LIGHT    = "display:inline-block;background:#f4f4f5;color:#0a0a0a !important;font-size:14px;font-weight:500;padding:12px 22px;border-radius:14px;text-decoration:none;border:1px solid #e5e5e5;";
const HR_STYLE     = "height:1px;line-height:1px;background:#e5e5e5;margin:24px 0;";
const NOTE_STYLE   = "margin:20px 0 0;padding:14px 16px;background:#fafafa;border:1px solid #e5e5e5;border-radius:12px;font-size:12px;color:#525252;line-height:1.65;";
const NOTE_WARN    = "margin:20px 0 0;padding:14px 16px;background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;font-size:12px;color:#9f1239;line-height:1.65;";

/**
 * HTML-escape a string for safe interpolation into our inline email
 * templates.  The templates intentionally do not use a rendering
 * library, so anywhere user-supplied text (subjects, names, messages,
 * channel labels) lands in an `${...}` hole, run it through this first.
 *
 * Escapes the five HTML-sensitive characters.  `&` must be first so we
 * don't double-escape entities produced by the later replacements.
 */
function escapeHtml(value: unknown): string {
  const str = typeof value === "string" ? value : String(value ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function detailsTable(rows: Array<[string, string]>): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;border-collapse:separate;">
    ${rows.map(([label, value]) => `
      <tr>
        <td class="sx-details-label" style="padding:8px 0;font-size:13px;color:#737373;width:140px;border-bottom:1px solid #f4f4f5;vertical-align:top;">${escapeHtml(label)}</td>
        <td class="sx-details-value" style="padding:8px 0;font-size:13px;color:#0a0a0a;font-weight:500;border-bottom:1px solid #f4f4f5;vertical-align:top;word-break:break-word;">${escapeHtml(value)}</td>
      </tr>
    `).join("")}
  </table>`;
}

// ── Account templates (from hello@) ────────────────────────────────────────

export function welcomeHtml(name?: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return baseHtml(`
    <p style="${KICKER_STYLE}">Welcome to sansxel</p>
    <h1 class="sx-h1" style="${H1_STYLE}">Your account is live.</h1>
    <p style="${BODY_STYLE}">${greeting} your sansxel account is set up and ready. Sansxel is a layered response engine, start with a simple prompt and let the output grow into something you can actually use: a plan, a deliverable, a product shape.</p>
    <p style="${BODY_STYLE}"><strong style="color:#0a0a0a;">What to try first:</strong></p>
    <ul style="margin:0 0 22px;padding-left:20px;font-size:14px;line-height:1.8;color:#404040;">
      <li>Ask something complex, a question that would normally need research + structure.</li>
      <li>Drop in messy input, a screenshot, rough notes, or a link.</li>
      <li>Push the same thread forward instead of starting over. Keep refining what already works.</li>
    </ul>
    <a href="https://sansxel.ai/account" class="sx-btn" style="${BTN_STYLE}">Open workspace</a>
    <span class="sx-btn-spacer">&nbsp;</span>
    <a href="https://sansxel.ai/features" class="sx-btn" style="${BTN_LIGHT}">Tour the features</a>
    <div style="${NOTE_STYLE}">
      <strong style="color:#0a0a0a;">Didn&apos;t create this account?</strong> You can safely ignore this email, the signup won&apos;t charge you anything and we won&apos;t email you again. If you&apos;re seeing emails you didn&apos;t expect, contact <a href="mailto:help@sansxel.ai" style="color:#0a0a0a;">help@sansxel.ai</a>.
    </div>
  `);
}

export function earlyAccessHtml(name: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return baseHtml(`
    <p style="${KICKER_STYLE}">Early Access Requested</p>
    <h1 class="sx-h1" style="${H1_STYLE}">Your place in the rollout is saved.</h1>
    <p style="${BODY_STYLE}">${greeting} thanks for requesting early access. We review access requests carefully and roll out in waves so we can actually support everyone who comes in. You&apos;ll get a personal email from the team once your seat is ready.</p>
    <p style="${BODY_STYLE}"><strong style="color:#0a0a0a;">While you wait, a few things worth knowing:</strong></p>
    <ul style="margin:0 0 22px;padding-left:20px;font-size:14px;line-height:1.8;color:#404040;">
      <li>Your sansxel account exists now, you can sign in any time to manage preferences.</li>
      <li>Rollout order prioritizes focus-area match, not signup date, so feel free to update your profile.</li>
      <li>If access is urgent (team rollout, deadline, specific integration), reach out, we occasionally expedite.</li>
    </ul>
    <a href="https://sansxel.ai/account" class="sx-btn" style="${BTN_STYLE}">View your account</a>
    <div style="${NOTE_STYLE}">
      <strong style="color:#0a0a0a;">Need a different path?</strong> Teams/sales conversations get fast-tracked, email <a href="mailto:sales@sansxel.ai" style="color:#0a0a0a;">sales@sansxel.ai</a>. General questions go to <a href="mailto:help@sansxel.ai" style="color:#0a0a0a;">help@sansxel.ai</a>.
    </div>
  `);
}

export function verifyAccountHtml(name: string, verifyUrl: string, expiryLabel: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return baseHtml(`
    <p style="${KICKER_STYLE}">Confirm your email</p>
    <h1 class="sx-h1" style="${H1_STYLE}">One click and your account is live.</h1>
    <p style="${BODY_STYLE}">${greeting} to finish creating your sansxel account, confirm your email address by tapping the button below. This makes sure nobody else signed you up by mistake, and it&apos;s the only thing between you and the full product.</p>
    <a href="${verifyUrl}" class="sx-btn" style="${BTN_STYLE}">Confirm email</a>
    <div style="${HR_STYLE}"></div>
    <p style="${META_STYLE}">The link <strong style="color:#0a0a0a;">expires in ${expiryLabel}</strong>. If it does, head back to the signup page and we&apos;ll send a fresh one.</p>
    <p style="${META_STYLE}" style="margin-top:14px;">Link not working? Copy and paste this URL into your browser:</p>
    <p style="margin:4px 0 0;font-size:12px;color:#0a0a0a;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${verifyUrl}</p>
    <div style="${NOTE_STYLE}">
      <strong style="color:#0a0a0a;">Didn&apos;t sign up for sansxel?</strong> Ignore this email, without clicking the link, your account never gets created and we won&apos;t message you again. If you&apos;re seeing signup confirmations you didn&apos;t request, email <a href="mailto:help@sansxel.ai" style="color:#0a0a0a;">help@sansxel.ai</a>.
    </div>
  `);
}

export function passwordResetHtml(resetUrl: string) {
  return baseHtml(`
    <p style="${KICKER_STYLE}">Password Reset</p>
    <h1 class="sx-h1" style="${H1_STYLE}">Choose a new password.</h1>
    <p style="${BODY_STYLE}">Someone, hopefully you, asked to reset the password on your sansxel account. Click the button below to pick a new one. The link is <strong style="color:#0a0a0a;">single-use</strong> and expires in <strong style="color:#0a0a0a;">one hour</strong>.</p>
    <a href="${resetUrl}" class="sx-btn" style="${BTN_STYLE}">Reset password</a>
    <div style="${HR_STYLE}"></div>
    <p style="${META_STYLE}">Link not working? Copy and paste this URL into your browser:</p>
    <p style="margin:4px 0 0;font-size:12px;color:#0a0a0a;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${resetUrl}</p>
    <div style="${NOTE_STYLE}">
      <strong style="color:#0a0a0a;">Didn&apos;t ask for this?</strong> You can safely ignore this email, your password won&apos;t change without someone clicking the link. If you&apos;re seeing repeated reset requests, email <a href="mailto:help@sansxel.ai" style="color:#0a0a0a;">help@sansxel.ai</a> and we&apos;ll lock the account while we investigate.
    </div>
  `);
}

export function contactConfirmHtml(name: string, subject: string) {
  const safeName    = escapeHtml(name);
  const safeSubject = escapeHtml(subject);
  const greeting    = safeName ? `Hi ${safeName},` : "Hi,";
  return baseHtml(`
    <p style="${KICKER_STYLE}">Message Received</p>
    <h1 class="sx-h1" style="${H1_STYLE}">We got your note.</h1>
    <p style="${BODY_STYLE}">${greeting} thanks for reaching out. We received your message about <strong style="color:#0a0a0a;">${safeSubject}</strong> and someone on the team will follow up to your email address directly, usually within one business day.</p>
    <p style="${BODY_STYLE}">If you have more to add, just reply to this email. Your reply lands in the right queue automatically.</p>
    <a href="https://sansxel.ai/contact" class="sx-btn" style="${BTN_LIGHT}">Back to contact</a>
    <div style="${NOTE_STYLE}">
      <strong style="color:#0a0a0a;">Didn&apos;t submit this form?</strong> You can safely ignore this email, we&apos;ll process it as a mistake if we don&apos;t hear back. No further messages will be sent unless you reach out again.
    </div>
  `);
}

export function supportHtml(opts: {
  email:    string;
  name:     string;
  subject:  string;
  message:  string;
  channel?: string | null;
}) {
  // Every field here comes from an unauthenticated contact form, so
  // every field is escaped before interpolation. Without this, HTML in
  // subject/message would render as markup inside ops' mail client.
  const safeSubject = escapeHtml(opts.subject);
  const safeName    = escapeHtml(opts.name || "—");
  const safeEmail   = escapeHtml(opts.email);
  const safeMessage = escapeHtml(opts.message);
  const safeChannel = opts.channel ? escapeHtml(opts.channel) : "";
  const channelRow = safeChannel
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#737373;">Channel</td><td style="padding:4px 0;font-size:13px;color:#0a0a0a;">${safeChannel}</td></tr>`
    : "";
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Support Request</p>
    <h1 class="sx-h1" style="margin:0 0 24px;font-size:20px;font-weight:600;color:#0a0a0a;line-height:1.3;word-break:break-word;">${safeSubject}</h1>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${channelRow}
      <tr><td style="padding:4px 0;font-size:13px;color:#737373;width:80px;">From</td><td style="padding:4px 0;font-size:13px;color:#0a0a0a;">${safeName}</td></tr>
      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Email</td><td style="padding:4px 0;font-size:13px;color:#0a0a0a;">${safeEmail}</td></tr>
    </table>
    <div class="sx-message-body" style="background:#f5f5f5;border:1px solid #e5e5e5;border-radius:14px;padding:16px;">
      <p style="margin:0;font-size:14px;line-height:1.7;color:#404040;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;">${safeMessage}</p>
    </div>
  `);
}

// ---------------------------------------------------------------------------
// Send helpers, all fire-and-forget safe (never throw to callers)
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(email: string, name?: string) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from:    fromAccount,
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
      to:      email,
      subject: "Reset your sansxel password",
      html:    passwordResetHtml(resetUrl),
    });
  } catch (error) {
    console.error("sendPasswordResetEmail failed:", error);
  }
}

export async function sendVerifyAccountEmail(opts: {
  email:        string;
  name?:        string;
  verifyUrl:    string;
  expiryLabel:  string;
}) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from:    fromAccount,
      to:      opts.email,
      subject: "Confirm your sansxel account",
      html:    verifyAccountHtml(opts.name ?? "", opts.verifyUrl, opts.expiryLabel),
    });
  } catch (error) {
    console.error("sendVerifyAccountEmail failed:", error);
  }
}

export async function sendContactConfirmEmail(
  email:   string,
  name:    string,
  subject: string,
  /** Inbox the message was routed to, controls the `from` so the
      confirmation comes from the same department the user contacted. */
  inbox:   SupportInbox = "help@sansxel.ai",
) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: fromForInbox(inbox),
      to: email,
      subject: `We received your message, ${subject}`,
      html: contactConfirmHtml(name, subject),
    });
  } catch (error) {
    console.error("sendContactConfirmEmail failed:", error);
  }
}

/**
 * Allowlist of inboxes the contact form may route to.  Any value coming
 * from the client must match one of these, otherwise we silently fall
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
 * Throws on Resend failure, the caller (the API route) surfaces the
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
  // Subject is the user's raw subject, no "[Support]" prefix (the
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

  // Resend returns { data, error } instead of throwing on 4xx, turn it
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

export function pwResetConfirmHtml(name: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return baseHtml(`
    <p style="${KICKER_STYLE}">Password Updated</p>
    <h1 class="sx-h1" style="${H1_STYLE}">Your password was reset.</h1>
    <p style="${BODY_STYLE}">${greeting} your sansxel password was just changed. If that was you, you&apos;re all set, this email is just confirmation. Your active sessions on other devices will need to sign in again the next time you use them.</p>
    <p style="${BODY_STYLE}"><strong style="color:#0a0a0a;">While you&apos;re thinking about security:</strong></p>
    <ul style="margin:0 0 22px;padding-left:20px;font-size:14px;line-height:1.8;color:#404040;">
      <li>Use a password manager if you don&apos;t already, we strongly recommend it.</li>
      <li>If you reused this password elsewhere, change it there too.</li>
      <li>Turn on two-factor auth on the email tied to your sansxel account; that email is the key to everything.</li>
    </ul>
    <div style="${NOTE_WARN}">
      <strong style="color:#9f1239;">If that wasn&apos;t you</strong>, email <a href="mailto:help@sansxel.ai" style="color:#9f1239;font-weight:600;">help@sansxel.ai</a> immediately. We can lock the account, reverse the change, and walk through how to secure it while we investigate.
    </div>
  `);
}

export function accountDeletedHtml(name: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return baseHtml(`
    <p style="${KICKER_STYLE}">Account Deleted</p>
    <h1 class="sx-h1" style="${H1_STYLE}">Your account has been removed.</h1>
    <p style="${BODY_STYLE}">${greeting} your sansxel account and associated data have been deleted. Confirming exactly what was removed, so there&apos;s no ambiguity:</p>
    <ul style="margin:0 0 22px;padding-left:20px;font-size:14px;line-height:1.8;color:#404040;">
      <li><strong style="color:#0a0a0a;">Profile and credentials</strong>, your email, password hash, and preferences.</li>
      <li><strong style="color:#0a0a0a;">API keys</strong>, all keys revoked. Any integrations using them will immediately stop working.</li>
      <li><strong style="color:#0a0a0a;">Saved outputs and history</strong>, gone from our systems (may persist in backups for up to 30 days, purged per our data policy).</li>
      <li><strong style="color:#0a0a0a;">Active subscriptions</strong>, cancelled. No further charges will hit your card.</li>
    </ul>
    <p style="${BODY_STYLE}">You won&apos;t receive further account or billing emails. Changed your mind? You&apos;re welcome back any time, nothing&apos;s permanent on our side.</p>
    <a href="https://sansxel.ai" class="sx-btn" style="${BTN_LIGHT}">Visit sansxel.ai</a>
    <div style="${NOTE_STYLE}">
      <strong style="color:#0a0a0a;">Questions about data or privacy?</strong> For anything involving your data, what was stored, what&apos;s in backups, export requests, email <a href="mailto:privacy@sansxel.ai" style="color:#0a0a0a;">privacy@sansxel.ai</a>. We respond to privacy requests within 72 hours.
    </div>
  `);
}

export function subscriptionActivatedHtml(name: string, planName: string, cycle: string, amountLabel: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const periodLabel = cycle === "yearly" ? "annual" : "monthly";
  return baseHtml(`
    <p style="${KICKER_STYLE}">Subscription Active</p>
    <h1 class="sx-h1" style="${H1_STYLE}">Welcome to sansxel ${planName}.</h1>
    <p style="${BODY_STYLE}">${greeting} your ${periodLabel} subscription is live. Paid features are available immediately, no waiting, no activation step.</p>

    ${detailsTable([
      ["Plan",          planName],
      ["Billing cycle", cycle === "yearly" ? "Yearly" : "Monthly"],
      ["Amount",        amountLabel],
      ["Next charge",   cycle === "yearly" ? "In 12 months" : "In 1 month"],
    ])}

    <a href="https://sansxel.ai/account" class="sx-btn" style="${BTN_STYLE}">Open workspace</a>
    <span class="sx-btn-spacer">&nbsp;</span>
    <a href="https://sansxel.ai/account/billing" class="sx-btn" style="${BTN_LIGHT}">Manage billing</a>
    <div style="${NOTE_STYLE}">
      A Stripe receipt with the full invoice is on its way separately. For plan changes, cancellations, or downgrades, head to <a href="https://sansxel.ai/account/billing" style="color:#0a0a0a;">/account/billing</a>, all changes are self-serve and take effect immediately. For help, email <a href="mailto:help@sansxel.ai" style="color:#0a0a0a;">help@sansxel.ai</a>.
    </div>
  `);
}

export function subscriptionCancellationScheduledHtml(name: string, planName: string, endsOn: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return baseHtml(`
    <p style="${KICKER_STYLE}">Cancellation Scheduled</p>
    <h1 class="sx-h1" style="${H1_STYLE}">Your ${planName} plan ends on ${endsOn}.</h1>
    <p style="${BODY_STYLE}">${greeting} we&apos;ve scheduled your cancellation. This is just a confirmation, no action needed from you.</p>

    ${detailsTable([
      ["Plan",        planName],
      ["Access until", endsOn],
      ["Next step",   "Drops to Free on that date"],
      ["Charges",     "No further charges will be made"],
    ])}

    <p style="${BODY_STYLE}"><strong style="color:#0a0a0a;">What happens next:</strong></p>
    <ul style="margin:0 0 22px;padding-left:20px;font-size:14px;line-height:1.8;color:#404040;">
      <li>You keep every paid feature until <strong style="color:#0a0a0a;">${endsOn}</strong>.</li>
      <li>On that date, your account drops to the Free plan automatically. Nothing is deleted, just the paid features pause.</li>
      <li>All your saved outputs, history, and API keys stay exactly where they are.</li>
    </ul>

    <a href="https://sansxel.ai/account/billing" class="sx-btn" style="${BTN_STYLE}">Resume subscription</a>
    <div style="${NOTE_STYLE}">
      <strong style="color:#0a0a0a;">Didn&apos;t schedule this cancellation?</strong> Head to <a href="https://sansxel.ai/account/billing" style="color:#0a0a0a;">/account/billing</a> and tap Resume subscription, it&apos;s one click and fully reverses this email. If you suspect your account is compromised, email <a href="mailto:help@sansxel.ai" style="color:#0a0a0a;">help@sansxel.ai</a> immediately.
    </div>
  `);
}

export function subscriptionEndedHtml(name: string, planName: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return baseHtml(`
    <p style="${KICKER_STYLE}">Plan Reset to Free</p>
    <h1 class="sx-h1" style="${H1_STYLE}">Your ${planName} plan has ended.</h1>
    <p style="${BODY_STYLE}">${greeting} your paid period is over and your account is now on the Free plan. This could be because you scheduled a cancellation that just hit, or because payment retries ran out after a failed charge.</p>
    <p style="${BODY_STYLE}"><strong style="color:#0a0a0a;">Here&apos;s what changes:</strong></p>
    <ul style="margin:0 0 22px;padding-left:20px;font-size:14px;line-height:1.8;color:#404040;">
      <li><strong style="color:#0a0a0a;">Kept:</strong> your account, saved outputs, history, and profile settings, all intact.</li>
      <li><strong style="color:#0a0a0a;">Paused:</strong> paid features (higher API limits, deeper memory, priority generation).</li>
      <li><strong style="color:#0a0a0a;">Charges:</strong> nothing further will be charged unless you pick a plan again.</li>
    </ul>
    <a href="https://sansxel.ai/pricing" class="sx-btn" style="${BTN_STYLE}">Pick a plan again</a>
    <span class="sx-btn-spacer">&nbsp;</span>
    <a href="https://sansxel.ai/account" class="sx-btn" style="${BTN_LIGHT}">Keep using Free</a>
    <div style="${NOTE_STYLE}">
      <strong style="color:#0a0a0a;">Was this unexpected?</strong> If your plan ended because a charge failed, it&apos;s usually a card issue (expired, frozen, different bank). Update the card at <a href="https://sansxel.ai/account/billing" style="color:#0a0a0a;">/account/billing</a> and resubscribe. For billing concerns, email <a href="mailto:help@sansxel.ai" style="color:#0a0a0a;">help@sansxel.ai</a>.
    </div>
  `);
}

export function paymentFailedHtml(name: string, planName: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return baseHtml(`
    <p style="${KICKER_RED}">Action Needed · Payment Failed</p>
    <h1 class="sx-h1" style="${H1_STYLE}">We couldn&apos;t charge your card.</h1>
    <p style="${BODY_STYLE}">${greeting} a charge for your <strong style="color:#0a0a0a;">${planName}</strong> subscription just failed. Stripe will retry the card automatically a few more times over the next week, but if the card&apos;s expired, blocked, or doesn&apos;t have funds, the retries won&apos;t succeed either.</p>
    <p style="${BODY_STYLE}"><strong style="color:#0a0a0a;">Fastest fix:</strong> add or switch the payment method now.</p>
    <a href="https://sansxel.ai/account/billing" class="sx-btn" style="${BTN_STYLE}">Update payment method</a>
    <p style="${BODY_STYLE}" style="margin-top:22px;"><strong style="color:#0a0a0a;">What happens if retries keep failing:</strong></p>
    <ul style="margin:0 0 22px;padding-left:20px;font-size:14px;line-height:1.8;color:#404040;">
      <li>After all retries exhaust, your plan drops to Free, paid features pause but nothing is deleted.</li>
      <li>You can re-subscribe at any time; your data and history stay.</li>
      <li>No credit goes unused, Stripe prorates any partial period cleanly.</li>
    </ul>
    <div style="${NOTE_WARN}">
      <strong style="color:#9f1239;">Common causes to check:</strong> expired card, recent fraud block from your bank, international transaction limit, or an insufficient-funds alert from your bank app. If you need help reading the decline reason, email <a href="mailto:help@sansxel.ai" style="color:#9f1239;font-weight:600;">help@sansxel.ai</a>.
    </div>
  `);
}

export function paymentMethodUpdatedHtml(name: string, brand: string, last4: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return baseHtml(`
    <p style="${KICKER_STYLE}">Payment Method Updated</p>
    <h1 class="sx-h1" style="${H1_STYLE}">New card on file.</h1>
    <p style="${BODY_STYLE}">${greeting} you just updated your default payment method. Future renewals will charge the new card automatically.</p>

    ${detailsTable([
      ["Card",        `${brand.toUpperCase()} ending in ${last4}`],
      ["Used for",    "All future subscription charges"],
      ["Takes effect", "Immediately"],
    ])}

    <a href="https://sansxel.ai/account/billing" class="sx-btn" style="${BTN_LIGHT}">Review billing</a>
    <div style="${NOTE_WARN}">
      <strong style="color:#9f1239;">If you didn&apos;t make this change</strong>, email <a href="mailto:help@sansxel.ai" style="color:#9f1239;font-weight:600;">help@sansxel.ai</a> immediately. Someone else may have access to your account, we can lock it and revert the card while we investigate.
    </div>
  `);
}

// ── Renewal templates (NEW, tied to invoice.paid / invoice.upcoming) ──────

export function renewalSucceededHtml(name: string, planName: string, amountLabel: string, periodEnd: string, invoiceUrl: string | null) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return baseHtml(`
    <p style="${KICKER_STYLE}">Renewal Successful</p>
    <h1 class="sx-h1" style="${H1_STYLE}">Your ${planName} subscription just renewed.</h1>
    <p style="${BODY_STYLE}">${greeting} this email is your receipt. The charge went through cleanly and your plan continues without interruption.</p>

    ${detailsTable([
      ["Plan",         planName],
      ["Amount",       amountLabel],
      ["Next renewal", periodEnd],
    ])}

    ${invoiceUrl
      ? `<a href="${invoiceUrl}" class="sx-btn" style="${BTN_STYLE}">View full invoice</a><span class="sx-btn-spacer">&nbsp;</span><a href="https://sansxel.ai/account/billing" class="sx-btn" style="${BTN_LIGHT}">Manage billing</a>`
      : `<a href="https://sansxel.ai/account/billing" class="sx-btn" style="${BTN_STYLE}">Manage billing</a>`
    }
    <div style="${NOTE_STYLE}">
      <strong style="color:#0a0a0a;">Want to cancel or downgrade?</strong> No hassle, head to <a href="https://sansxel.ai/account/billing" style="color:#0a0a0a;">/account/billing</a>. Cancellation stops future charges immediately; downgrades take effect at the next renewal so you keep paid features until then. Questions: <a href="mailto:help@sansxel.ai" style="color:#0a0a0a;">help@sansxel.ai</a>.
    </div>
  `);
}

export function renewalUpcomingHtml(name: string, planName: string, amountLabel: string, chargeDate: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return baseHtml(`
    <p style="${KICKER_STYLE}">Renewal in 7 Days</p>
    <h1 class="sx-h1" style="${H1_STYLE}">Heads up, your ${planName} plan renews next week.</h1>
    <p style="${BODY_STYLE}">${greeting} this is an automated heads-up so there are no surprises. In a week we&apos;ll charge the card on file to renew your subscription.</p>

    ${detailsTable([
      ["Plan",         planName],
      ["Renewal date", chargeDate],
      ["Amount",       amountLabel],
    ])}

    <p style="${BODY_STYLE}"><strong style="color:#0a0a0a;">Want to make a change before the charge?</strong> You have a few options:</p>
    <ul style="margin:0 0 22px;padding-left:20px;font-size:14px;line-height:1.8;color:#404040;">
      <li><strong style="color:#0a0a0a;">Nothing to do</strong> if the plan&apos;s still working for you, just ignore this email.</li>
      <li><strong style="color:#0a0a0a;">Downgrade or switch plans</strong>, takes effect at renewal, no proration surprise.</li>
      <li><strong style="color:#0a0a0a;">Cancel</strong>, you keep full access until the renewal date, then drop to Free.</li>
      <li><strong style="color:#0a0a0a;">Update the card</strong> if the one on file is about to expire.</li>
    </ul>

    <a href="https://sansxel.ai/account/billing" class="sx-btn" style="${BTN_STYLE}">Manage billing</a>
    <div style="${NOTE_STYLE}">
      <strong style="color:#0a0a0a;">Billing questions?</strong> Email <a href="mailto:help@sansxel.ai" style="color:#0a0a0a;">help@sansxel.ai</a>. For plan / team / enterprise questions, <a href="mailto:sales@sansxel.ai" style="color:#0a0a0a;">sales@sansxel.ai</a> handles those directly.
    </div>
  `);
}

// ── Send helpers ───────────────────────────────────────────────────────────

export async function sendPasswordResetConfirmEmail(email: string, name: string) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: fromAccount, to: email,
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
      from: fromAccount, to: email,
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
      from: fromBilling, to: opts.email,
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
      from: fromBilling, to: opts.email,
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
      from: fromBilling, to: opts.email,
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
      from: fromBilling, to: opts.email,
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
      from: fromBilling, to: opts.email,
      subject: "Your payment method was updated",
      html: paymentMethodUpdatedHtml(opts.name, opts.brand, opts.last4),
    });
  } catch (err) { console.error("sendPaymentMethodUpdatedEmail failed:", err); }
}

export async function sendRenewalSucceededEmail(opts: {
  email: string; name: string; planName: string; amountLabel: string;
  periodEnd: string; invoiceUrl?: string | null;
}) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: fromBilling, to: opts.email,
      subject: `Renewal successful, ${opts.planName} (${opts.amountLabel})`,
      html: renewalSucceededHtml(opts.name, opts.planName, opts.amountLabel, opts.periodEnd, opts.invoiceUrl ?? null),
    });
  } catch (err) { console.error("sendRenewalSucceededEmail failed:", err); }
}

export async function sendRenewalUpcomingEmail(opts: {
  email: string; name: string; planName: string; amountLabel: string; chargeDate: string;
}) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: fromBilling, to: opts.email,
      subject: `Heads up, your ${opts.planName} plan renews on ${opts.chargeDate}`,
      html: renewalUpcomingHtml(opts.name, opts.planName, opts.amountLabel, opts.chargeDate),
    });
  } catch (err) { console.error("sendRenewalUpcomingEmail failed:", err); }
}

// ═══════════════════════════════════════════════════════════════════════════
// NEWSLETTER / PRODUCT UPDATES
//
// Newsletter sends share the billing sender (noreply@sansxel.ai), both
// are automated broadcasts from the company, neither expects replies.
// `subject` and `bodyHtml` come pre-rendered from the caller (the
// newsletter composer will live in its own module once it exists).
// ═══════════════════════════════════════════════════════════════════════════

export async function sendNewsletterEmail(opts: {
  to:       string;
  subject:  string;
  /** Full rendered inner content, will be wrapped in the standard
      baseHtml chrome (header, contact block, legal footer) so every
      newsletter matches the transactional look. */
  bodyHtml: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from:    fromBilling,
      to:      opts.to,
      subject: opts.subject,
      html:    baseHtml(opts.bodyHtml),
    });
  } catch (err) {
    console.error("sendNewsletterEmail failed:", err);
  }
}
