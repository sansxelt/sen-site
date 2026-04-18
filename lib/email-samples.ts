import {
  accountDeletedHtml,
  contactConfirmHtml,
  earlyAccessHtml,
  passwordResetHtml,
  paymentFailedHtml,
  paymentMethodUpdatedHtml,
  pwResetConfirmHtml,
  renewalSucceededHtml,
  renewalUpcomingHtml,
  sendAccountDeletedEmail,
  sendContactConfirmEmail,
  sendEarlyAccessEmail,
  sendPasswordResetConfirmEmail,
  sendPasswordResetEmail,
  sendPaymentFailedEmail,
  sendPaymentMethodUpdatedEmail,
  sendRawForDev,
  sendRenewalSucceededEmail,
  sendRenewalUpcomingEmail,
  sendSubscriptionActivatedEmail,
  sendSubscriptionCancellationScheduledEmail,
  sendSubscriptionEndedEmail,
  sendVerifyAccountEmail,
  sendWelcomeEmail,
  subscriptionActivatedHtml,
  subscriptionCancellationScheduledHtml,
  subscriptionEndedHtml,
  supportHtml,
  verifyAccountHtml,
  welcomeHtml,
} from "./email";

/**
 * Dev registry of every transactional template — one entry per template.
 * Each sample carries:
 *   - a canned HTML renderer (for on-page preview, no Resend call)
 *   - a matching `send(to)` helper that fires the *same* template through
 *     the real Resend pipeline, so any preview/send divergence is a bug.
 *
 * The shape is intentionally narrow: pick a sample, render or send. The
 * dev page at /dev/emails iterates this list without knowing anything
 * about individual templates.
 */
export type EmailSample = {
  key:         string;
  label:       string;
  /** Which sender profile the template uses in production. */
  channel:     "account" | "billing" | "support";
  /** One-line context so you don't have to remember what each is. */
  description: string;
  renderHtml:  () => string;
  send:        (to: string) => Promise<unknown>;
};

// A fixed "fake user" the previews use.  Keeping it constant makes
// preview diffs between template changes easy to read.
const SAMPLE_NAME    = "Alex Rivera";
const SAMPLE_PLAN    = "Pro";
const SAMPLE_AMOUNT  = "$20.00";
const SAMPLE_CHARGE  = "November 14, 2026";
const SAMPLE_ENDS    = "December 1, 2026";
const SAMPLE_VERIFY  = "https://sansxel.ai/auth/verify-email?token=sample-preview-token";
const SAMPLE_RESET   = "https://sansxel.ai/auth/reset?token=sample-preview-token";
const SAMPLE_INVOICE = "https://pay.stripe.com/invoice/sample";

export const EMAIL_SAMPLES: EmailSample[] = [
  {
    key:         "welcome",
    label:       "Welcome",
    channel:     "account",
    description: "Sent after a verified signup — intro + first-steps CTA.",
    renderHtml:  () => welcomeHtml(SAMPLE_NAME),
    send:        (to) => sendWelcomeEmail(to, SAMPLE_NAME),
  },
  {
    key:         "verify",
    label:       "Verify account",
    channel:     "account",
    description: "24h token link — shown to pending signups before the account flips to real.",
    renderHtml:  () => verifyAccountHtml(SAMPLE_NAME, SAMPLE_VERIFY, "24 hours"),
    send:        (to) => sendVerifyAccountEmail({ email: to, name: SAMPLE_NAME, verifyUrl: SAMPLE_VERIFY, expiryLabel: "24 hours" }),
  },
  {
    key:         "password-reset",
    label:       "Password reset",
    channel:     "account",
    description: "Reset link, single-use, 1-hour expiry.",
    renderHtml:  () => passwordResetHtml(SAMPLE_RESET),
    send:        (to) => sendPasswordResetEmail(to, SAMPLE_RESET),
  },
  {
    key:         "password-reset-confirm",
    label:       "Password reset confirm",
    channel:     "account",
    description: "Sent after a password change goes through — security breadcrumb.",
    renderHtml:  () => pwResetConfirmHtml(SAMPLE_NAME),
    send:        (to) => sendPasswordResetConfirmEmail(to, SAMPLE_NAME),
  },
  {
    key:         "early-access",
    label:       "Early access requested",
    channel:     "account",
    description: "Confirmation for waitlist / invite-request flow.",
    renderHtml:  () => earlyAccessHtml(SAMPLE_NAME),
    send:        (to) => sendEarlyAccessEmail(to, SAMPLE_NAME),
  },
  {
    key:         "account-deleted",
    label:       "Account deleted",
    channel:     "account",
    description: "Goodbye note listing exactly what was removed.",
    renderHtml:  () => accountDeletedHtml(SAMPLE_NAME),
    send:        (to) => sendAccountDeletedEmail(to, SAMPLE_NAME),
  },

  {
    key:         "subscription-activated",
    label:       "Subscription activated",
    channel:     "billing",
    description: "Fires when a plan goes live after checkout.",
    renderHtml:  () => subscriptionActivatedHtml(SAMPLE_NAME, SAMPLE_PLAN, "monthly", SAMPLE_AMOUNT),
    send:        (to) => sendSubscriptionActivatedEmail({ email: to, name: SAMPLE_NAME, planName: SAMPLE_PLAN, cycle: "monthly", amountLabel: SAMPLE_AMOUNT }),
  },
  {
    key:         "subscription-cancellation-scheduled",
    label:       "Cancellation scheduled",
    channel:     "billing",
    description: "User scheduled cancel — plan still active until end of period.",
    renderHtml:  () => subscriptionCancellationScheduledHtml(SAMPLE_NAME, SAMPLE_PLAN, SAMPLE_ENDS),
    send:        (to) => sendSubscriptionCancellationScheduledEmail({ email: to, name: SAMPLE_NAME, planName: SAMPLE_PLAN, endsOn: SAMPLE_ENDS }),
  },
  {
    key:         "subscription-ended",
    label:       "Subscription ended",
    channel:     "billing",
    description: "Plan fully lapsed — account dropped to Free.",
    renderHtml:  () => subscriptionEndedHtml(SAMPLE_NAME, SAMPLE_PLAN),
    send:        (to) => sendSubscriptionEndedEmail({ email: to, name: SAMPLE_NAME, planName: SAMPLE_PLAN }),
  },
  {
    key:         "payment-failed",
    label:       "Payment failed",
    channel:     "billing",
    description: "Charge failed — retry is automatic, user should update the card.",
    renderHtml:  () => paymentFailedHtml(SAMPLE_NAME, SAMPLE_PLAN),
    send:        (to) => sendPaymentFailedEmail({ email: to, name: SAMPLE_NAME, planName: SAMPLE_PLAN }),
  },
  {
    key:         "payment-method-updated",
    label:       "Payment method updated",
    channel:     "billing",
    description: "Security breadcrumb when the default card changes.",
    renderHtml:  () => paymentMethodUpdatedHtml(SAMPLE_NAME, "VISA", "4242"),
    send:        (to) => sendPaymentMethodUpdatedEmail({ email: to, name: SAMPLE_NAME, brand: "VISA", last4: "4242" }),
  },
  {
    key:         "renewal-succeeded",
    label:       "Renewal succeeded",
    channel:     "billing",
    description: "Receipt after invoice.paid — includes Stripe invoice link.",
    renderHtml:  () => renewalSucceededHtml(SAMPLE_NAME, SAMPLE_PLAN, SAMPLE_AMOUNT, SAMPLE_CHARGE, SAMPLE_INVOICE),
    send:        (to) => sendRenewalSucceededEmail({ email: to, name: SAMPLE_NAME, planName: SAMPLE_PLAN, amountLabel: SAMPLE_AMOUNT, periodEnd: SAMPLE_CHARGE, invoiceUrl: SAMPLE_INVOICE }),
  },
  {
    key:         "renewal-upcoming",
    label:       "Renewal upcoming (7-day)",
    channel:     "billing",
    description: "Fires 7 days before renewal via invoice.upcoming.",
    renderHtml:  () => renewalUpcomingHtml(SAMPLE_NAME, SAMPLE_PLAN, SAMPLE_AMOUNT, SAMPLE_CHARGE),
    send:        (to) => sendRenewalUpcomingEmail({ email: to, name: SAMPLE_NAME, planName: SAMPLE_PLAN, amountLabel: SAMPLE_AMOUNT, chargeDate: SAMPLE_CHARGE }),
  },

  {
    key:         "contact-confirm-help",
    label:       "Contact confirm (help@)",
    channel:     "support",
    description: "User-facing confirmation when they submit the contact form routed to general support.",
    renderHtml:  () => contactConfirmHtml(SAMPLE_NAME, "Can't export a roadmap"),
    send:        (to) => sendContactConfirmEmail(to, SAMPLE_NAME, "Can't export a roadmap", "help@sansxel.ai"),
  },
  {
    key:         "contact-confirm-sales",
    label:       "Contact confirm (sales@)",
    channel:     "support",
    description: "Confirmation variant routed to sales — from-address swaps to sales@.",
    renderHtml:  () => contactConfirmHtml(SAMPLE_NAME, "Team rollout for 25 seats"),
    send:        (to) => sendContactConfirmEmail(to, SAMPLE_NAME, "Team rollout for 25 seats", "sales@sansxel.ai"),
  },
  {
    key:         "contact-confirm-privacy",
    label:       "Contact confirm (privacy@)",
    channel:     "support",
    description: "Confirmation variant routed to privacy — from-address swaps to privacy@.",
    renderHtml:  () => contactConfirmHtml(SAMPLE_NAME, "GDPR data export request"),
    send:        (to) => sendContactConfirmEmail(to, SAMPLE_NAME, "GDPR data export request", "privacy@sansxel.ai"),
  },
  {
    key:         "support-help",
    label:       "Support email (help@)",
    channel:     "support",
    description: "Team-facing — this is what lands in the help@ inbox. Dev send re-routes it to your address so you can see what ops would read.",
    renderHtml:  () => supportHtml({
      name: SAMPLE_NAME,
      email: "alex@example.com",
      subject: "Can't export a roadmap",
      message: "When I hit Export on the roadmap view it opens a blank modal. Chrome 131 on Windows, tried twice.\n\nDevtools console shows a 500 from /api/export. Screenshot attached in follow-up if helpful.",
      channel: "General support",
    }),
    send: (to) => sendRawForDev({
      to,
      from:    "support",
      subject: "Can't export a roadmap",
      html:    supportHtml({
        name: SAMPLE_NAME,
        email: "alex@example.com",
        subject: "Can't export a roadmap",
        message: "When I hit Export on the roadmap view it opens a blank modal. Chrome 131 on Windows, tried twice.",
        channel: "General support",
      }),
    }),
  },
];

export function findSample(key: string): EmailSample | undefined {
  return EMAIL_SAMPLES.find((s) => s.key === key);
}
