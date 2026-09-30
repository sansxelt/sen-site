import { Resend } from "resend";
// One conversion rule and one price, shared with the charging path rather than restated in copy. A number
// in an email that disagrees with the number on the invoice is the kind of thing customers screenshot.
import { creditsToCents } from "./preflight/auto-recharge";
import { passPriceCents, PASS_INCLUDED_FLOWS } from "./preflight/pass-pricing";
// The product sentence, imported rather than restated. positioning.ts declares itself the only place the
// high-level thesis may live, and this file had drifted off it twice: the header carried a category label
// from an older generation, and the welcome email described the company with a sentence that file has since
// retired. The emails that explain what Vraelis does (welcome, activation, win-back, invite) now print
// SUPPORT or FOOTER_STATEMENT, so a positioning change reaches the inbox with no edit here.
//
// scripts/email-embeds-verify.ts asserts on this import and on the rendered welcome email, not on a copy of
// a sentence, so it checks that the emails agree with positioning.ts rather than that a string exists.
import { SUPPORT, FOOTER_STATEMENT } from "@/app/dev-preview/v6/_system/positioning";
// The chrome and the atoms every template is built from. See lib/email/shell.ts for the design rules.
import {
  shell, h1, p, small, strong, link, mailto, button, status, details, list, code, quote,
  escapeHtml, textPreview, SUPPORT_EMAIL, type DetailValue,
} from "./email/shell";

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
 * confirmations.  Matches the "Vraelis AI" identity the user set up in
 * Gmail's Send-mail-as aliases so replies look visually consistent with
 * what they'd see going the other way.
 */
const fromAccount = "Vraelis <hello@vraelis.com>";

/**
 * Automated system sender, billing events today, newsletters in Phase 2.
 * Kept as plain "Vraelis AI" since noreply@ handles multiple kinds of
 * automated mail and a narrower "Billing" label would be wrong for
 * newsletters / product updates.
 */
const fromBilling = "Vraelis <noreply@vraelis.com>";

/**
 * Sender/reply-to policy:
 *   - hello@ and noreply@ are auto-only senders. Neither routes replies
 *     to a human, hello@ is for account mail, noreply@ is for billing
 *     and (future) product updates. Replies are expected to die there.
 *   - help@, sales@, privacy@ are *real inboxes* for inbound support.
 *     They're used as the `from` only on contact-form threads that
 *     started on the user's side, so the conversation stays on-channel.
 *
 * Automated sends set `replyTo: help@vraelis.com`. hello@ and noreply@
 * are DROP addresses (no inbox), and several nurture emails promise
 * "just reply and we'll stop" — an opt-out reply must land somewhere a
 * human reads, or the promise (and CAN-SPAM's working-opt-out rule) is
 * silently broken. All replies to automated mail therefore route to the
 * monitored help@ inbox.
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
    case "sales@vraelis.com":   return "Vraelis sales <sales@vraelis.com>";
    case "privacy@vraelis.com": return "Vraelis privacy <privacy@vraelis.com>";
    case "help@vraelis.com":
    default:                   return "Vraelis <help@vraelis.com>";
  }
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

// THE CHROME LIVES IN lib/email/shell.ts. Every template below is a headline, one or two short paragraphs,
// a details table where there are facts to state, at most one primary button, and fine print. The footer
// says why the recipient got the email; these are the reasons, stated once. (With no reason given, the
// shell says "You are receiving this because you have a Vraelis account.")
const REASON_BILLING = "You are receiving this because of a billing change on your Vraelis account.";
// The nurture emails promise a working opt-out by reply. Replies route to help@, which a person reads (see
// the sender policy above), so the promise is kept.
const REASON_NUDGE = "You are receiving this because you have a Vraelis account. If you would rather not get emails like this, reply and we will stop.";

const BILLING_URL = "https://app.vraelis.com/billing";

// ── Account templates (from hello@) ────────────────────────────────────────

export function welcomeHtml(name?: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return shell(`
    ${h1("Your Vraelis account is ready")}
    ${p(`${greeting} your account is set up, and your first verification is included.`)}
    ${p(escapeHtml(SUPPORT))}
    ${button("https://app.vraelis.com", "Verify an outcome")}
    ${small(`New to Vraelis? ${link("https://vraelis.com/method", "See how it works")}.`)}
    ${small(`If you did not create this account, you can ignore this email. Signing up does not charge you anything, and we will not email you again. If you keep getting emails you did not expect, contact ${mailto(SUPPORT_EMAIL)}.`)}
  `, {
    preheader: "Your account is set up, and your first verification is included.",
    reason: "You are receiving this because this email address was used to create a Vraelis account.",
  });
}

// THERE IS NO WAVED ROLLOUT, SO THERE IS NO EMAIL ABOUT ONE.
//
// earlyAccessHtml and sendEarlyAccessEmail lived here and promised a reviewed request, a rollout ordered
// by focus-area match, and a personal note when a seat opened. None of that exists: there is no allowlist,
// no seat queue and no reviewer, lib/v-preflight-flags.ts records the posture as public-by-default, and
// nothing in the repo ever called either function. A promise a product cannot keep is worse sitting in the
// codebase than missing from it, because the next person to need a signup email finds it and sends it.
export function verifyAccountHtml(name: string, verifyUrl: string, expiryLabel: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return shell(`
    ${h1("Confirm your email address")}
    ${p(`${greeting} confirm your email address to finish creating your Vraelis account. This makes sure nobody signed you up by mistake.`)}
    ${button(verifyUrl, "Confirm email")}
    ${small(`The link expires in ${strong(escapeHtml(expiryLabel))}. If it expires, go back to the sign-up page and we will send a new one.`)}
    ${small("If the button does not work, paste this link into your browser:")}
    ${code(verifyUrl)}
    ${small(`If you did not sign up for Vraelis, ignore this email. The account is not created unless the link is used, and we will not email you again. If you keep getting confirmations you did not request, email ${mailto(SUPPORT_EMAIL)}.`)}
  `, {
    preheader: `Confirm your email address to finish creating your Vraelis account. The link expires in ${expiryLabel}.`,
    reason: "You are receiving this because this email address was used to sign up for Vraelis.",
  });
}

export function passwordResetHtml(resetUrl: string) {
  return shell(`
    ${h1("Reset your password")}
    ${p(`We received a request to reset the password for your Vraelis account. Use the button below to choose a new one. The link works ${strong("once")} and expires in ${strong("one hour")}.`)}
    ${button(resetUrl, "Reset password")}
    ${small("If the button does not work, paste this link into your browser:")}
    ${code(resetUrl)}
    ${small(`If you did not ask for this, you can ignore this email. Your password does not change unless the link is used. If you keep getting reset requests, email ${mailto(SUPPORT_EMAIL)} and we will lock the account while we look into it.`)}
  `, {
    preheader: "Use this link to choose a new password. It works once and expires in one hour.",
    reason: "You are receiving this because a password reset was requested for your Vraelis account.",
  });
}

export function contactConfirmHtml(name: string, subject: string) {
  const safeName    = escapeHtml(name);
  const safeSubject = escapeHtml(subject);
  const greeting    = safeName ? `Hi ${safeName},` : "Hi,";
  return shell(`
    ${h1("We received your message")}
    ${p(`${greeting} thanks for writing to us about ${strong(safeSubject)}. Someone on the team will reply to this email address, usually within one business day.`)}
    ${p("To add anything, reply to this email. Your reply goes to the same team.")}
    ${small(`Our other addresses are listed at ${link("https://vraelis.com/contact", "vraelis.com/contact")}.`)}
    ${small("If you did not send this message, you can ignore this email. We will not contact you again unless you write to us.")}
  `, {
    preheader: `We received your message about ${subject} and will reply by email, usually within one business day.`,
    reason: "You are receiving this because this email address was entered in the contact form on vraelis.com.",
  });
}

export function supportHtml(opts: {
  email:    string;
  name:     string;
  subject:  string;
  message:  string;
  channel?: string | null;
}) {
  // Every field here comes from an unauthenticated contact form, so every field is escaped before it
  // reaches HTML: the subject here, and the rest inside details() and quote(), which escape what they are
  // given. Without this, HTML in subject/message would render as markup inside ops' mail client.
  const safeSubject = escapeHtml(opts.subject);
  const rows: Array<[string, DetailValue]> = [];
  if (opts.channel) rows.push(["Channel", opts.channel]);
  rows.push(["From", opts.name || "(no name)"]);
  rows.push(["Email", { html: link(`mailto:${opts.email}`, escapeHtml(opts.email)) }]);
  return shell(`
    ${h1(safeSubject)}
    ${details(rows)}
    ${quote(opts.message)}
  `, {
    preheader: `${opts.name || opts.email}: ${opts.message}`.slice(0, 140),
    reason: `Sent from the contact form on vraelis.com. Replying goes to ${opts.email}.`,
    support: false,
  });
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
      replyTo: "help@vraelis.com",
      to:      email,
      subject: "Welcome to Vraelis",
      html:    welcomeHtml(name),
    });
  } catch (error) {
    console.error("sendWelcomeEmail failed:", error);
  }
}

// THE THREE LIFECYCLE EMAILS NOW WEAR THE SAME CHROME AS EVERY OTHER ONE.
//
// This one, lowCreditsHtml and winbackHtml each rendered their own document: warm paper #FAF8F4, a Georgia
// serif wordmark and a #0d5c46 emerald button. That is the retired generation's brand, named as such in
// app/global-error.tsx, and it survived here for the same reason it survived there, which is that nobody
// re-reads a file that keeps working. Design 06 has no serif wordmark, no warm ground, and reserves green
// to mean "a verification held", so the primary button in a nudge was wearing the product's success
// colour. They go through the shared shell (lib/email/shell.ts) now, so a customer who gets a receipt and
// a nudge in the same week gets them from the same company, and the next brand change is one edit.
//
// Activation nudge: sent once by the lifecycle cron (lib/v-lifecycle.ts) to accounts that signed up but
// haven't run their first verification. One job: get them to run their first one.
function checkActivationHtml(): string {
  const run = "https://app.vraelis.com";
  // /how-it-works is a 301 to /method whenever the V6 public flip is on, which it is (proxy.ts). A link
  // that redirects is fine; printing the redirecting URL as the visible text is telling the reader a
  // page name that no longer exists.
  const learn = "https://vraelis.com/method";
  return shell(`
    ${h1("Run your first verification")}
    ${p("You signed up for Vraelis but have not run a verification yet.")}
    ${p(escapeHtml(SUPPORT))}
    ${button(run, "Verify an outcome")}
    ${small(`Want to see how it works first? ${link(learn, "vraelis.com/method")}`)}
  `, {
    preheader: "You signed up for Vraelis but have not run a verification yet.",
    reason: REASON_NUDGE,
  });
}

export async function sendCheckActivationEmail(email: string) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from:    fromAccount,
      replyTo: "help@vraelis.com",
      to:      email,
      subject: "Verify your first outcome on Vraelis",
      html:    checkActivationHtml(),
    });
  } catch (error) {
    console.error("sendCheckActivationEmail failed:", error);
  }
}

// THE COPY IS WRITTEN AGAINST WHAT THE ACCOUNT CAN ACTUALLY DO, which is the thing it kept getting wrong.
//
// Two staleness bugs lived here. It called the balance "included", from the era when signup minted 25
// credits; under pass pricing signup mints nothing, so a recipient either bought that balance or never had
// one. And it offered "Still have balance left? Verify an outcome" to anyone above zero, which after the
// threshold retune (lib/v-lifecycle.ts) is precisely a set of people whose next launch is refused: the
// link sent them to a 402. Both are gone.
//
// Money is stated in dollars next to the price of the thing being bought. "149 credits" is a number only
// this system understands; "$14.90, and a verification costs $15.00" is a decision the reader can make.
function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Exported for scripts/lifecycle-nudge-verify.ts. The amounts in this template are derived from the
// charging path, so they are worth asserting on the RENDERED output rather than on the source text: a
// scan of the file cannot tell a live template from a sentence in a comment about it.
export function lowCreditsHtml(remaining: number): string {
  const plans = "https://app.vraelis.com/plans";
  const credits = "https://app.vraelis.com/credits";
  const out = remaining <= 0;
  const left = money(creditsToCents(Math.max(0, remaining)));
  const price = money(passPriceCents(PASS_INCLUDED_FLOWS));
  // The headline used to read "You're $14.90 short of another verification" for a balance of $14.90, which
  // is the amount LEFT, not the shortfall (that is ten cents). The headline now states the consequence and
  // the two real numbers sit in the table underneath.
  const headline = out ? "Your Vraelis balance is empty" : "Your balance does not cover another verification";
  const lead = out
    ? `Your Vraelis balance is empty, and a verification costs ${price}. Add balance or choose a plan to keep going.`
    : `You have ${left} left and a verification costs ${price}, so the next one will not start. Add balance or choose a plan to keep going.`;
  return shell(`
    ${h1(headline)}
    ${p(lead)}
    ${details([
      ["Balance", left],
      ["One verification", price],
    ])}
    ${p("Vraelis is priced by the verification, not the seat. Every verification includes a real browser run, the evidence, and an explainable decision.")}
    ${button(plans, "See plans")}
    ${small(`Prefer to pay per verification? ${link(credits, "Add balance")}.`)}
  `, {
    preheader: out ? `Your balance is empty. A verification costs ${price}.` : `You have ${left} left. A verification costs ${price}.`,
    reason: REASON_NUDGE,
  });
}

export async function sendLowCreditsEmail(email: string, remaining: number) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from:    fromAccount,
      replyTo: "help@vraelis.com",
      to:      email,
      // Not "running low". The nudge now fires when the balance can no longer buy a verification, so the
      // subject states the consequence rather than a trend.
      subject: remaining <= 0 ? "Your Vraelis balance is used up" : "Not enough balance for your next verification",
      html:    lowCreditsHtml(remaining),
    });
  } catch (error) {
    console.error("sendLowCreditsEmail failed:", error);
  }
}

// THE ONLY BUTTON IN THIS EMAIL IS A LAUNCH, so it may only ever be sent to an account that can afford
// one. The template cannot check that itself, and it must not try: it is handed a number and prints it.
// lib/v-lifecycle.ts holds the gate, and it now sends only at or above one standard pass, for the same
// reason recorded above money() for the low-balance email. Between 1 and 149 credits the button below is
// a link to a 402.
export function winbackHtml(remaining: number): string {
  const run = "https://app.vraelis.com";
  const left = money(creditsToCents(Math.max(0, remaining)));
  return shell(`
    ${h1(`You still have ${left} of Vraelis balance`)}
    ${p(`You tried Vraelis a while back. Your ${left} balance is still on your account.`)}
    ${p(`Before your next release goes out, run a verification. ${escapeHtml(SUPPORT)}`)}
    ${button(run, "Verify an outcome")}
  `, {
    preheader: `Your ${left} Vraelis balance is still on your account.`,
    reason: REASON_NUDGE,
  });
}

export async function sendWinbackEmail(email: string, remaining: number) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from:    fromAccount,
      replyTo: "help@vraelis.com",
      to:      email,
      subject: "Your Vraelis balance is still here",
      html:    winbackHtml(remaining),
    });
  } catch (error) {
    console.error("sendWinbackEmail failed:", error);
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from:    fromAccount,
      replyTo: "help@vraelis.com",
      to:      email,
      subject: "Reset your Vraelis password",
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
      replyTo: "help@vraelis.com",
      to:      opts.email,
      subject: "Confirm your Vraelis account",
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
  inbox:   SupportInbox = "help@vraelis.com",
) {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: fromForInbox(inbox),
      to: email,
      subject: `We received your message: ${subject}`,
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
  "help@vraelis.com",
  "sales@vraelis.com",
  "privacy@vraelis.com",
] as const;
export type SupportInbox = (typeof SUPPORT_INBOXES)[number];

export function resolveSupportInbox(candidate: string | null | undefined): SupportInbox {
  const v = (candidate ?? "").trim().toLowerCase();
  return SUPPORT_INBOXES.find((addr) => addr === v) ?? "help@vraelis.com";
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
  return shell(`
    ${h1("Your password was reset")}
    ${p(`${greeting} the password for your Vraelis account was just changed. If you made this change, there is nothing else to do. Other devices will need to sign in again the next time they are used.`)}
    ${p(`${strong("If this was not you")}, email ${mailto(SUPPORT_EMAIL)} now. We can lock the account, reverse the change, and help you secure it while we look into it.`)}
    ${small("A few habits that help: use a password manager, change this password anywhere else you used it, and turn on two-factor authentication for the email address tied to your Vraelis account. That inbox is the key to everything else.")}
  `, {
    preheader: `The password for your Vraelis account was changed. If this was not you, email ${SUPPORT_EMAIL} now.`,
    reason: "You are receiving this because the password on your Vraelis account was changed.",
  });
}

export function accountDeletedHtml(name: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return shell(`
    ${h1("Your Vraelis account has been deleted")}
    ${p(`${greeting} your Vraelis account and its data have been deleted. This is exactly what was removed:`)}
    ${details([
      ["Profile and credentials", "Your email address, password hash, and preferences"],
      ["API keys", "All revoked. Integrations that use them stop working immediately."],
      ["Saved outputs and history", "Removed from our systems. Backups may hold a copy for up to 30 days before it is purged under our data policy."],
      ["Subscriptions", "Cancelled. No further charges will be made to your card."],
    ])}
    ${p("You will not receive further account or billing emails. You are welcome to create a new account at any time.")}
    ${small(`For questions about your data, including what was stored, what is in backups, or an export request, email ${mailto("privacy@vraelis.com")}. We respond to privacy requests within 72 hours.`)}
  `, {
    preheader: "Your account, API keys, and saved history have been removed, and no further charges will be made.",
    reason: "You are receiving this because your Vraelis account was deleted. This is the last account email we will send.",
  });
}

export function subscriptionActivatedHtml(name: string, planName: string, cycle: string, amountLabel: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const plan = escapeHtml(planName);
  const periodLabel = cycle === "yearly" ? "annual" : "monthly";
  const rows: Array<[string, DetailValue]> = [
    ["Plan",          planName],
    ["Billing cycle", cycle === "yearly" ? "Yearly" : "Monthly"],
  ];
  // amountLabelFor() returns "" for a plan key outside both catalogues. A blank row reads as a missing
  // charge; no row reads as nothing to show.
  if (amountLabel) rows.push(["Amount", amountLabel]);
  rows.push(["Next charge", cycle === "yearly" ? "In 12 months" : "In 1 month"]);
  return shell(`
    ${h1(`Welcome to Vraelis ${plan}`)}
    ${status("success", `Your ${periodLabel} ${plan} subscription is active.`)}
    ${p(`${greeting} paid features are available now. There is no activation step.`)}
    ${details(rows)}
    ${button("https://app.vraelis.com", "Open Vraelis")}
    ${small(`Stripe sends a receipt with the full invoice separately. To change, downgrade, or cancel your plan, go to ${link(BILLING_URL, "app.vraelis.com/billing")}. Every change there is self-serve.`)}
  `, {
    preheader: `Your ${planName} subscription is active. Paid features are available now.`,
    reason: REASON_BILLING,
  });
}

export function subscriptionCancellationScheduledHtml(name: string, planName: string, endsOn: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const plan = escapeHtml(planName);
  const ends = escapeHtml(endsOn);
  return shell(`
    ${h1(`Your ${plan} plan ends on ${ends}`)}
    ${p(`${greeting} your cancellation is scheduled. This is a confirmation, and there is nothing else you need to do.`)}
    ${details([
      ["Plan",         planName],
      ["Access until", endsOn],
      ["After that",   "Your account moves to the Free plan"],
      ["Charges",      "No further charges will be made"],
    ])}
    ${p(`You keep every paid feature until ${strong(ends)}. After that your account moves to the Free plan automatically. Nothing is deleted: your systems, past verifications, results, and API keys stay where they are.`)}
    ${button(BILLING_URL, "Resume subscription")}
    ${small(`If you did not schedule this, use Resume subscription above. It reverses the cancellation in one click. If you think someone else has access to your account, email ${mailto(SUPPORT_EMAIL)} now.`)}
  `, {
    preheader: `You keep ${planName} until ${endsOn}. After that your account moves to the Free plan, with no further charges.`,
    reason: REASON_BILLING,
  });
}

// THE EMAIL THE FOUNDER SAW. It had a kicker, a list of bold labels, two buttons of equal weight and a
// tinted note, which is four competing voices for one fact. It now states the fact (headline), the new
// state (status row), what that means (details), and one action. Every fact in it is one the old email
// already stated; nothing new is claimed.
export function subscriptionEndedHtml(name: string, planName: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const plan = escapeHtml(planName);
  return shell(`
    ${h1(`Your ${plan} plan has ended`)}
    ${status("notice", "Your account is now on the Free plan.")}
    ${p(`${greeting} your paid period is over. This happens when a scheduled cancellation takes effect, or when payment retries run out after a failed charge.`)}
    ${details([
      ["Previous plan", planName],
      ["Current plan",  "Free"],
      ["Kept",          "Your account, systems, past verifications and results, and settings"],
      ["Paused",        "Paid plan features: higher monthly verification volume, more connected systems, and team seats"],
      ["Charges",       "None, unless you choose a plan again"],
    ])}
    ${button("https://vraelis.com/pricing", "Choose a plan")}
    ${small(`You can also keep using the Free plan at ${link("https://app.vraelis.com", "app.vraelis.com")}.`)}
    ${small(`If a charge failed, it is usually the card: it expired, was frozen, or was replaced by a new one. Update it at ${link(BILLING_URL, "app.vraelis.com/billing")}, then choose a plan again.`)}
  `, {
    preheader: "Your account is now on the Free plan. Your systems and past verifications are kept.",
    reason: REASON_BILLING,
  });
}

export function paymentFailedHtml(name: string, planName: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const plan = escapeHtml(planName);
  return shell(`
    ${h1("We could not charge your card")}
    ${status("problem", `Payment failed for your ${plan} plan.`)}
    ${p(`${greeting} the latest charge for your ${strong(plan)} subscription did not go through. Update your payment method to keep the plan active.`)}
    ${details([
      ["Plan",            planName],
      ["Retries",         "Stripe retries the card automatically a few more times over the next week"],
      ["If retries fail", "Your plan moves to Free and paid features pause. Nothing is deleted, and you can subscribe again at any time."],
    ])}
    ${button(BILLING_URL, "Update payment method")}
    ${small("Retries will not help if the card has expired, has been blocked by your bank for suspected fraud, has hit an international transaction limit, or does not have the funds.")}
    ${small(`If you need help reading the decline reason, email ${mailto(SUPPORT_EMAIL)}.`)}
  `, {
    preheader: `Update your payment method to keep your ${planName} plan. Stripe will retry the card automatically.`,
    reason: REASON_BILLING,
  });
}

// Stripe reports the brand as a lowercase key. Printed as the card says it, not shouted.
const CARD_BRANDS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover",
  jcb: "JCB", diners: "Diners Club", unionpay: "UnionPay",
};
function cardBrand(brand: string): string {
  return CARD_BRANDS[(brand || "").toLowerCase()] ?? (brand || "Card").toUpperCase();
}

export function paymentMethodUpdatedHtml(name: string, brand: string, last4: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const card = `${cardBrand(brand)} ending in ${last4}`;
  return shell(`
    ${h1("Your payment method was updated")}
    ${p(`${greeting} your default payment method was changed. Future renewals will be charged to this card.`)}
    ${details([
      ["Card",         card],
      ["Used for",     "All future subscription charges"],
      ["Takes effect", "Immediately"],
    ])}
    ${button(BILLING_URL, "Review billing")}
    ${p(`${strong("If you did not make this change")}, email ${mailto(SUPPORT_EMAIL)} now. Someone else may have access to your account, and we can lock it and revert the card while we look into it.`)}
  `, {
    preheader: `${card} is now the default payment method on your Vraelis account.`,
    reason: REASON_BILLING,
  });
}

// ── Renewal templates (NEW, tied to invoice.paid / invoice.upcoming) ──────

export function renewalSucceededHtml(name: string, planName: string, amountLabel: string, periodEnd: string, invoiceUrl: string | null) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const plan = escapeHtml(planName);
  return shell(`
    ${h1(`Your ${plan} plan renewed`)}
    ${status("success", `Payment of ${escapeHtml(amountLabel)} received.`)}
    ${p(`${greeting} this email is your receipt. The charge went through and your plan continues without interruption.`)}
    ${details([
      ["Plan",         planName],
      ["Amount paid",  amountLabel],
      ["Next renewal", periodEnd],
    ])}
    ${invoiceUrl ? button(invoiceUrl, "View invoice") : button(BILLING_URL, "Manage billing")}
    ${small(`To change, downgrade, or cancel, go to ${link(BILLING_URL, "app.vraelis.com/billing")}. Cancelling stops future charges immediately. A downgrade takes effect at the next renewal, so you keep paid features until then.`)}
  `, {
    preheader: `Receipt for your ${planName} renewal: ${amountLabel} paid. Next renewal ${periodEnd}.`,
    reason: REASON_BILLING,
  });
}

export function renewalUpcomingHtml(name: string, planName: string, amountLabel: string, chargeDate: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const plan = escapeHtml(planName);
  const date = escapeHtml(chargeDate);
  return shell(`
    ${h1(`Your ${plan} plan renews on ${date}`)}
    ${p(`${greeting} this is a reminder so the charge is not a surprise. On ${date}, we will charge the card on file to renew your subscription.`)}
    ${details([
      ["Plan",         planName],
      ["Renewal date", chargeDate],
      ["Amount",       amountLabel],
    ])}
    ${p("If the plan still works for you, there is nothing to do. Before the renewal you can:")}
    ${list([
      "Switch or downgrade plans. The change takes effect at renewal.",
      "Cancel. You keep full access until the renewal date, then move to the Free plan.",
      "Update the card, if the one on file is about to expire.",
    ])}
    ${button(BILLING_URL, "Manage billing")}
    ${small(`For plan, team, or enterprise questions, email ${mailto("sales@vraelis.com")}.`)}
  `, {
    preheader: `Your ${planName} plan renews on ${chargeDate} for ${amountLabel}. Nothing to do if you want to keep it.`,
    reason: REASON_BILLING,
  });
}

// ── Send helpers ───────────────────────────────────────────────────────────

export async function sendPasswordResetConfirmEmail(email: string, name: string) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: fromAccount, to: email,
      subject: "Your Vraelis password was reset",
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
      subject: "Your Vraelis account has been deleted",
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
      subject: `Welcome to Vraelis ${opts.planName}`,
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
      subject: `Payment failed for your Vraelis ${opts.planName} plan`,
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
      subject: `Receipt for your Vraelis ${opts.planName} renewal (${opts.amountLabel})`,
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
      subject: `Your Vraelis ${opts.planName} plan renews on ${opts.chargeDate}`,
      html: renewalUpcomingHtml(opts.name, opts.planName, opts.amountLabel, opts.chargeDate),
    });
  } catch (err) { console.error("sendRenewalUpcomingEmail failed:", err); }
}

// ═══════════════════════════════════════════════════════════════════════════
// NEWSLETTER / PRODUCT UPDATES
//
// Newsletter sends share the billing sender (noreply@vraelis.com), both
// are automated broadcasts from the company, neither expects replies.
// `subject` and `bodyHtml` come pre-rendered from the caller (the
// newsletter composer will live in its own module once it exists).
// ═══════════════════════════════════════════════════════════════════════════

export async function sendNewsletterEmail(opts: {
  to:       string;
  subject:  string;
  /** Full rendered inner content, will be wrapped in the standard
      shell (wordmark header, footer) so every newsletter matches the
      transactional look. Bare h1/h2/p/li/a inside it are styled by the
      shell's .vx-body rules. */
  bodyHtml: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from:    fromBilling,
      replyTo: "help@vraelis.com",
      to:      opts.to,
      subject: opts.subject,
      // The caller passes no preview line, so the first paragraph of the body is used, which is what the
      // reader sees first anyway. The opt-out is the same working reply-to-stop the nudges carry.
      html:    shell(opts.bodyHtml, { preheader: textPreview(opts.bodyHtml), reason: REASON_NUDGE }),
    });
  } catch (err) {
    console.error("sendNewsletterEmail failed:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKSPACE / PROJECT COLLABORATION INVITES
//
// Invite emails for team workspaces + project sharing. The invite is stored
// pending regardless; the email is best-effort and reports a delivery status so
// the UI can show "sent / email not configured / failed". The body never includes
// tokens, private descriptions, analytics, or secrets — only the workspace/project
// name + role + a sign-in link (activation happens by email match on sign-in).
// ═══════════════════════════════════════════════════════════════════════════

const INVITE_ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer", client_viewer: "Client viewer" };

export type InviteEmail = {
  type: "workspace" | "project";
  to: string;
  workspaceName?: string;
  projectName?: string;
  role: string;
  acceptUrl: string;
};
export type InviteDelivery = "sent" | "not_configured" | "failed";

export function inviteHtml(opts: Omit<InviteEmail, "to">) {
  const isProject = opts.type === "project";
  const rawContext = (isProject ? opts.projectName : opts.workspaceName) || "a Vraelis workspace";
  const context = escapeHtml(rawContext);
  const rawRole = INVITE_ROLE_LABEL[opts.role] ?? opts.role;
  const roleLabel = escapeHtml(rawRole);
  const clientSafe = opts.role === "client_viewer";
  const verb = isProject ? "review" : "join";
  // The workspace case used to add "You'll join this workspace as Editor." straight after a sentence that
  // had just said so. It says it once now.
  const access = clientSafe
    ? " You will have client-safe access to this team's shared reports: read-only, with no access to private workspace controls."
    : isProject
      // The object a customer connects is a System everywhere a user can see it, and proxy.ts redirects
      // the old route to prove it. This sentence still named it the schema's way, in an email whose link
      // lands on a page titled Systems. The table keeps its own name; this is copy, not schema.
      // scripts/terminology-verify.ts now scans this file so the two cannot drift apart again.
      ? ` You will have ${roleLabel} access to this team's systems and reports.`
      : "";
  return shell(`
    ${h1(`You were invited to ${verb} ${context}`)}
    ${p(`You have been invited to ${verb} ${strong(context)} on Vraelis as ${strong(roleLabel)}.${access}`)}
    ${p(escapeHtml(FOOTER_STATEMENT))}
    ${button(opts.acceptUrl, isProject ? "View project" : "Accept invite")}
    ${small(`Sign in with this email address to open the ${isProject ? "project" : "workspace"}. The invite activates automatically.`)}
    ${small("If you were not expecting this invite, you can ignore this email.")}
  `, {
    preheader: `You have been invited to ${verb} ${rawContext} on Vraelis as ${rawRole}.`,
    reason: "You are receiving this because someone invited this email address to Vraelis.",
  });
}

// Returns a delivery status; never throws (the invite is already saved by the caller).
export async function sendInviteEmail(opts: InviteEmail): Promise<InviteDelivery> {
  const resend = getResend();
  if (!resend) return "not_configured";
  try {
    const subject = opts.type === "project" ? "You're invited to review a Vraelis project" : "You're invited to a Vraelis workspace";
    const result = await resend.emails.send({ from: fromAccount, to: opts.to, subject, html: inviteHtml(opts) });
    if (result.error) { console.error("sendInviteEmail rejected:", result.error); return "failed"; }
    return "sent";
  } catch (err) {
    console.error("sendInviteEmail failed:", err);
    return "failed";
  }
}
