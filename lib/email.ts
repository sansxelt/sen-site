import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const from =
  process.env.RESEND_FROM_EMAIL ?? "sansxel <help@sansxel.ai>";

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
  email: string;
  name: string;
  subject: string;
  message: string;
}) {
  return baseHtml(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Support Request</p>
    <h1 style="margin:0 0 24px;font-size:20px;font-weight:600;color:#0a0a0a;line-height:1.3;">${opts.subject}</h1>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
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
      from,
      to: email,
      subject: "Welcome to sansxel",
      html: welcomeHtml(name),
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
      from,
      to: email,
      subject: "Your sansxel invite request is on file",
      html: earlyAccessHtml(name),
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
      from,
      to: email,
      subject: "Reset your sansxel password",
      html: passwordResetHtml(resetUrl),
    });
  } catch (error) {
    console.error("sendPasswordResetEmail failed:", error);
  }
}

export async function sendContactConfirmEmail(email: string, name: string, subject: string) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from,
      to: email,
      subject: `We received your message — ${subject}`,
      html: contactConfirmHtml(name, subject),
    });
  } catch (error) {
    console.error("sendContactConfirmEmail failed:", error);
  }
}

export async function sendSupportEmail(opts: {
  email: string;
  name: string;
  subject: string;
  message: string;
}) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from,
      to: "contact@sansxel.ai",
      replyTo: opts.email,
      subject: `[Support] ${opts.subject}`,
      html: supportHtml(opts),
    });
  } catch (error) {
    console.error("sendSupportEmail failed:", error);
  }
}
