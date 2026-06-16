"use server";

// Server actions for the vraelis account: business profile (used by the
// AI to reply to leads), lead status changes, and sign out. All scoped
// to the signed-in user.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import {
  addMessage,
  createLead,
  createPayment,
  getLeadWithMessages,
  getOrCreateWorkspace,
  getWorkspaceOffer,
  getWorkspaceServices,
  isWorkspaceOnboarded,
  listPayments,
  setLeadOutcome,
  setLeadStatus,
  setWorkspaceContact,
  setWorkspaceDeposit,
  setWorkspaceOffer,
  setWorkspaceServices,
  updateLead,
  updateWorkspaceBusiness,
  type LeadStatus,
} from "@/lib/vraelis-db";
import { generateOutreach, generateLeadReply } from "@/lib/vraelis-ai";
import { sendLeadReply } from "@/lib/vraelis-email";
import { createPaymentCheckout, expireCheckout } from "@/lib/vraelis-connect";
import { cutRateFor } from "@/lib/vraelis-plans";
import { maybeProvisionAgentNumber } from "@/lib/vraelis-sms";
import { isDatabaseConfigured } from "@/lib/supabase-admin";

const ORIGIN = "https://vraelis.com";

// The dashboard is browsed at the CLEAN url (/account, /account/leads/:id) but
// proxy.ts rewrites it to the internal /v/account route group. router.refresh()
// refetches the CURRENT browser url (/account), so revalidating only /v/account
// left the browser-path cache entry stale — the intermittent "saved but UI
// didn't update" bug. Revalidate BOTH the clean and internal paths so whichever
// cache key the refresh hits is fresh. "layout" scope covers nested segments.
function revalidateAccount() {
  // /v/account is the REAL rendered route — "layout" scope so nested segments
  // (lead pages) go stale too. /account is the browser URL the rewrite maps
  // from; revalidate it (page scope) so router.refresh() of the current URL
  // aligns. (/account is the unrelated sansxel route on other hosts, so keep
  // it page-scoped — no need to bust that whole subtree.)
  revalidatePath("/v/account", "layout");
  revalidatePath("/account");
}
function revalidateLead(leadId: string) {
  revalidatePath(`/v/account/leads/${leadId}`, "layout");
  revalidatePath(`/account/leads/${leadId}`);
  revalidateAccount();
}

export type ActionResult = { ok: boolean; message: string };

// Full LeadStatus set — must match every option the lead-detail <select>
// exposes, or those statuses silently no-op on save.
const VALID_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualifying",
  "qualified",
  "booking_ready",
  "needs_owner",
  "booked",
  "won",
  "lost",
];

export async function updateVraelisBusiness(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, message: "Signed out — sign in again to save." };
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "Storage isn't configured in this environment." };
  }

  const businessName = String(formData.get("businessName") ?? "").trim().slice(0, 120);
  const businessDescription = String(formData.get("businessDescription") ?? "").trim().slice(0, 400);
  const businessServices = String(formData.get("businessServices") ?? "").trim().slice(0, 2000);

  try {
    await getOrCreateWorkspace(email); // ensure the row exists
    await updateWorkspaceBusiness(email, {
      businessName: businessName || null,
      businessDescription: businessDescription || null,
    });
    // Fail-soft: no-ops until the column is migrated.
    await setWorkspaceServices(email, businessServices || null);
    revalidateAccount();
    return { ok: true, message: "Saved." };
  } catch (error) {
    console.error("updateVraelisBusiness failed:", error);
    return { ok: false, message: "Couldn't save — try again." };
  }
}

// Save the owner's alert phone. The agent's twilio_number is NOT accepted here
// — it's assigned only by provisionAgentNumber (a Vraelis-owned Twilio
// purchase), so the form can never overwrite it with a user-supplied value.
export async function setSmsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, message: "Signed out — sign in again." };
  const ownerPhone = String(formData.get("ownerPhone") ?? "").trim().slice(0, 32);
  try {
    await setWorkspaceContact(email, { ownerPhone: ownerPhone || null });
    revalidateAccount();
    return { ok: true, message: "Saved." };
  } catch (error) {
    console.error("setSmsAction failed:", error);
    return { ok: false, message: "Couldn't save — try again." };
  }
}

// Offer-first onboarding save. One submit persists the whole "what you
// sell / how much / how they pay / how to qualify / where leads come from"
// sequence. Reuses the existing per-field helpers — no new Stripe, AI, or
// pricing logic; the payment step just toggles the existing deposit flag.
export async function saveOfferAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, message: "Signed out — sign in again to save." };
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "Storage isn't configured in this environment." };
  }

  // 1) Your business — the brand (business_name). Customer-facing surfaces
  //    and the greeting use this, never the offer.
  const businessName = String(formData.get("businessName") ?? "").trim().slice(0, 120);
  const businessDescription = String(formData.get("businessDescription") ?? "").trim().slice(0, 400);
  // 1b) What the agent sells — the offer (offer_name). Distinct from the
  //     brand; used for the Stripe product label / checkout description.
  const offerName = String(formData.get("offerName") ?? "").trim().slice(0, 120) || null;
  const offerDescription = String(formData.get("offerDescription") ?? "").trim().slice(0, 400) || null;
  // 2) How much (services + prices, freeform)
  const businessServices = String(formData.get("businessServices") ?? "").trim().slice(0, 2000);
  // 3) How customers pay — "full" | "deposit" (plan is a disabled placeholder).
  //    Maps onto the EXISTING deposit flag; no Stripe logic change.
  const payType = String(formData.get("payType") ?? "full");
  const depositEnabled = payType === "deposit";
  const depositDollars = Number(String(formData.get("depositAmount") ?? "").trim());
  const depositCents =
    depositEnabled && Number.isFinite(depositDollars) && depositDollars >= 0.5
      ? Math.round(depositDollars * 100)
      : null;
  // 4) Qualifying questions  5) Where leads come from
  const qualifyingQuestions = String(formData.get("qualifyingQuestions") ?? "").trim().slice(0, 1500);
  const leadSources = String(formData.get("leadSources") ?? "").trim().slice(0, 500);
  // 0) Business type — personalizes the form examples; whitelist only.
  const PERSONA_KEYS = ["coach", "course", "agency", "consultant", "community", "other"];
  const personaRaw = String(formData.get("persona") ?? "").trim();
  const persona = PERSONA_KEYS.includes(personaRaw) ? personaRaw : null;
  // Agent identity — name (free text) + tone (whitelisted preset). Both
  // feed the AI prompt across chat/email/SMS.
  const TONE_KEYS = ["friendly", "professional", "direct", "casual"];
  const agentName = String(formData.get("agentName") ?? "").trim().slice(0, 40) || null;
  const agentToneRaw = String(formData.get("agentTone") ?? "").trim();
  const agentTone = TONE_KEYS.includes(agentToneRaw) ? agentToneRaw : null;
  // "onboarding" mode = the gated first-run screen; it requires the
  // core-onboarding minimums before the workspace unlocks.
  const isOnboarding = String(formData.get("mode") ?? "") === "onboarding";

  try {
    // Read onboarded state BEFORE writing: an account that is already
    // complete (flag or derived from existing fields) must stay complete
    // even if this save clears a minimum field — otherwise a flagless
    // grandfathered account could silently re-lock itself into onboarding
    // by editing the Setup tab.
    const wasOnboarded = await isWorkspaceOnboarded(email);
    await updateWorkspaceBusiness(email, {
      businessName: businessName || null,
      businessDescription: businessDescription || null,
    });
    // The remaining writes are all fail-soft (no-op until their column is
    // migrated), so a missing column never blocks the core profile save.
    await setWorkspaceServices(email, businessServices || null);
    await setWorkspaceDeposit(email, { enabled: depositEnabled, amountCents: depositCents });
    // Core onboarding is complete when the minimums exist: persona, offer
    // name + description, price/services. payType always has a value, and
    // Stripe/Calendar/SMS stay post-onboarding. The flag is sticky — once
    // complete, editing setup later never re-locks the workspace.
    const missing: string[] = [];
    if (!persona) missing.push("pick what describes you");
    if (!businessName) missing.push("your business name");
    if (!businessDescription) missing.push("one line on your business");
    if (!offerName) missing.push("what your agent sells");
    if (!businessServices) missing.push("at least one price");
    const minimumsMet = missing.length === 0;

    await setWorkspaceOffer(email, {
      qualifyingQuestions: qualifyingQuestions || null,
      leadSources: leadSources || null,
      persona,
      agentName,
      agentTone,
      offerName,
      offerDescription,
      ...(minimumsMet || wasOnboarded ? { onboardingComplete: true } : {}),
    });
    revalidateAccount();
    if (isOnboarding && !minimumsMet) {
      return { ok: false, message: `Saved your progress — still needed: ${missing.join(", ")}.` };
    }
    // Non-onboarding setup edit: refresh-in-place handles the UI update.
    if (!isOnboarding) return { ok: true, message: "Saved." };
    // Onboarding just completed: kick off agent-number assignment for paid
    // plans, but DON'T block the redirect on a Twilio round-trip. It's gated +
    // idempotent + self-catching, and the plan-activation webhook also triggers
    // it, so the dashboard never waits on provisioning. Fire-and-forget with a
    // catch so a rejection can't crash the action.
    void maybeProvisionAgentNumber(email).catch(() => {});
    // Fall through to the redirect below.
  } catch (error) {
    console.error("saveOfferAction failed:", error);
    return { ok: false, message: "Couldn't save — try again." };
  }
  // Onboarding completed: leave onboarding deterministically. A server redirect
  // forces a fresh navigation to the dashboard, so it never depends on a client
  // cache-invalidation race (the cause of the intermittent "saved but stayed on
  // onboarding" bug). redirect() throws NEXT_REDIRECT, so it MUST run outside
  // the try/catch above or the catch would swallow the signal. Landing on the
  // dashboard IS the success signal, so no query param to clean up.
  redirect("/account");
}

// OUTBOUND: owner adds a lead (missed call, referral, list) and Vraelis
// reaches out first — generates a first-touch message and emails it.
export async function addLeadAndReachOut(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, message: "Signed out — sign in again." };

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const contactEmail = String(formData.get("email") ?? "").trim().slice(0, 200);
  const contactPhone = String(formData.get("phone") ?? "").trim().slice(0, 40);
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!name && !contactEmail && !contactPhone) {
    return { ok: false, message: "Add at least a name and email or phone." };
  }

  try {
    const ws = await getOrCreateWorkspace(email);
    const lead = await createLead({
      ownerEmail: email,
      name,
      contactEmail,
      contactPhone,
      source: "outbound",
      snippet: note || "Added by you for outreach",
    });

    if (contactEmail) {
      const outreach = await generateOutreach({
        businessName: ws?.business_name ?? "",
        businessDescription: ws?.business_description ?? "",
        leadName: name,
        note,
      });
      const r = await sendLeadReply({
        to: contactEmail,
        businessName: ws?.business_name ?? "Vraelis",
        replyText: outreach,
        replyTo: email,
      });
      await addMessage({ leadId: lead.id, role: "agent", body: outreach, channel: r.sent ? "email" : "note", delivered: r.sent });
      await setLeadStatus(email, lead.id, "contacted");
      revalidateLead(lead.id);
      return {
        ok: true,
        message: r.sent ? `Reached out to ${name || contactEmail}.` : "Lead added — but the outreach email didn't send.",
      };
    }

    revalidateLead(lead.id);
    return { ok: true, message: "Lead added. Add an email and Vraelis will reach out by email." };
  } catch (error) {
    console.error("addLeadAndReachOut failed:", error);
    return { ok: false, message: "Couldn't add the lead — try again." };
  }
}

// Owner sends a manual reply to a lead → emails the lead + logs it in
// the thread (reply-to set so the lead's response comes back to the owner).
export async function sendManualReply(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, message: "Signed out — sign in again." };

  const leadId = String(formData.get("leadId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!leadId || !body) return { ok: false, message: "Write a message first." };

  try {
    const data = await getLeadWithMessages(email, leadId);
    if (!data) return { ok: false, message: "Lead not found." };

    const ws = await getOrCreateWorkspace(email);
    let delivered = false;
    if (data.lead.contact_email) {
      const r = await sendLeadReply({
        to: data.lead.contact_email,
        businessName: ws?.business_name ?? "Vraelis",
        replyText: body,
        replyTo: email,
      });
      delivered = r.sent;
    }
    await addMessage({ leadId, role: "agent", body, channel: delivered ? "email" : "note", delivered });
    if (data.lead.status === "new") await setLeadStatus(email, leadId, "contacted");
    revalidateLead(leadId);
    return {
      ok: true,
      message: delivered
        ? "Sent."
        : data.lead.contact_email
          ? "Saved to thread (email didn't send)."
          : "Saved to thread (lead has no email).",
    };
  } catch (error) {
    console.error("sendManualReply failed:", error);
    return { ok: false, message: "Couldn't send — try again." };
  }
}

// Update a lead's status and/or deal value (marking won + $ feeds the
// future revenue-cut tally).
export async function updateLeadDealAction(formData: FormData): Promise<void> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return;

  const leadId = String(formData.get("leadId") ?? "");
  const status = String(formData.get("status") ?? "") as LeadStatus;
  const valueRaw = String(formData.get("value") ?? "").trim();
  const value = valueRaw === "" ? null : Math.max(0, Math.round(Number(valueRaw)));
  if (!leadId || !VALID_STATUSES.includes(status)) return;
  if (value !== null && !Number.isFinite(value)) return;

  try {
    await updateLead(email, leadId, { status, value });
    revalidateLead(leadId);
  } catch (error) {
    console.error("updateLeadDealAction failed:", error);
  }
}

// Set the conversation outcome (VIE training data): open/booked/paid/lost/spam.
const OUTCOMES = ["open", "booked", "paid", "lost", "spam"];
export async function updateLeadOutcomeAction(formData: FormData): Promise<void> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return;
  const leadId = String(formData.get("leadId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const lostReason = String(formData.get("lostReason") ?? "").trim().slice(0, 60) || null;
  if (!leadId || !OUTCOMES.includes(outcome)) return;
  try {
    await setLeadOutcome(email, leadId, outcome, outcome === "lost" ? lostReason : null);
    revalidateLead(leadId);
  } catch (error) {
    console.error("updateLeadOutcomeAction failed:", error);
  }
}

export async function updateLeadStatusAction(formData: FormData): Promise<void> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return;

  const leadId = String(formData.get("leadId") ?? "");
  const status = String(formData.get("status") ?? "") as LeadStatus;
  if (!leadId || !VALID_STATUSES.includes(status)) return;

  try {
    await setLeadStatus(email, leadId, status);
    revalidateLead(leadId);
  } catch (error) {
    console.error("updateLeadStatusAction failed:", error);
  }
}

// Deposit settings: whether a booking requires a deposit through Vraelis,
// and how much. Used by the booking page to gate slot confirmation.
export async function setDepositAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, message: "Signed out — sign in again." };

  const enabled = String(formData.get("enabled") ?? "") === "on";
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amountCents = amountRaw === "" ? null : Math.max(0, Math.round(Number(amountRaw) * 100));
  if (enabled && (!amountCents || amountCents < 50)) {
    return { ok: false, message: "Set a deposit of at least $0.50." };
  }

  try {
    await setWorkspaceDeposit(email, { enabled, amountCents });
    revalidateAccount();
    return { ok: true, message: enabled ? `Deposit of $${(amountCents! / 100).toLocaleString()} required to book.` : "Deposit turned off." };
  } catch (error) {
    console.error("setDepositAction failed:", error);
    return { ok: false, message: "Couldn't save — try again." };
  }
}

// Owner requests payment from a lead: creates an on-platform Checkout
// (destination charge + application fee), emails the link, and logs it to
// the thread. The Vraelis cut is taken automatically when the lead pays.
export async function requestPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, message: "Signed out — sign in again." };

  const leadId = String(formData.get("leadId") ?? "");
  const amountCents = Math.round(Number(formData.get("amount")) * 100);
  const description = String(formData.get("description") ?? "").trim().slice(0, 300);
  if (!leadId) return { ok: false, message: "Missing lead." };
  if (!Number.isFinite(amountCents) || amountCents < 50) {
    return { ok: false, message: "Enter an amount of at least $0.50." };
  }

  try {
    const ws = await getOrCreateWorkspace(email);
    if (!ws?.connect_account_id || ws.connect_status !== "active") {
      return { ok: false, message: "Set up payouts first (Payouts panel on your account)." };
    }
    const data = await getLeadWithMessages(email, leadId);
    if (!data) return { ok: false, message: "Lead not found." };
    const existingPayments = await listPayments(email, { leadId, limit: 10 });
    if (existingPayments.some((payment) => payment.status === "paid")) {
      return { ok: false, message: "This lead already paid through Vraelis." };
    }
    if (existingPayments.some((payment) => payment.status === "pending")) {
      return { ok: false, message: "A payment request is already waiting on this lead. The checkout link is saved in the conversation." };
    }

    const feeCents = Math.round(amountCents * cutRateFor(ws.plan, ws.plan_cycle));
    const customerEmail = data.lead.contact_email;
    // Buyer sees the OFFER as the Stripe product; brand is the fallback.
    const offer = await getWorkspaceOffer(email);
    const productName = offer.offerName || ws.business_name || "Vraelis";

    const { url, sessionId } = await createPaymentCheckout({
      accountId: ws.connect_account_id,
      amountCents,
      feeCents,
      productName,
      description: description || "Payment",
      customerEmail,
      successUrl: `${ORIGIN}/pay/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${ORIGIN}/pay/thanks?canceled=1`,
      metadata: { kind: "vraelis_payment", owner_email: email, lead_id: leadId, pay_kind: "full" },
    });

    const paymentId = await createPayment({
      ownerEmail: email,
      leadId,
      kind: "full",
      description: description || null,
      amountCents,
      feeCents,
      sessionId,
    });
    if (!paymentId) {
      await expireCheckout(sessionId);
      return { ok: false, message: "Couldn't record the payment — try again." };
    }

    let delivered = false;
    if (url && customerEmail) {
      const r = await sendLeadReply({
        // Email subject is a BRAND surface ("Re: your enquiry to X"), so it
        // uses the business name — NOT productName (the offer, for Stripe).
        to: customerEmail,
        businessName: ws.business_name || "Vraelis",
        replyText: `${description ? description + "\n\n" : ""}You can pay securely here:\n${url}`,
        replyTo: email,
      });
      delivered = r.sent;
    }
    if (url) {
      await addMessage({
        leadId,
        role: "agent",
        body: `Sent a payment request for $${(amountCents / 100).toLocaleString()}${description ? ` — ${description}` : ""}: ${url}`,
        channel: "system",
        delivered,
      });
    }
    revalidateLead(leadId);
    return {
      ok: true,
      message: delivered
        ? `Payment link emailed to ${customerEmail}.`
        : customerEmail
          ? "Link created and saved to the thread (email didn't send)."
          : "Link created and saved to the thread (lead has no email — copy it from the conversation).",
    };
  } catch (error) {
    console.error("requestPaymentAction failed:", error);
    return { ok: false, message: "Couldn't create the payment — try again." };
  }
}

// Activation: create a realistic sample lead and let Vraelis answer it, so a
// brand-new user immediately sees the "oh, it actually replied" moment in
// their inbox. Clearly labelled as a test.
export async function sendTestLead(): Promise<void> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return;

  const question = "Hi! Do you have availability this week, and roughly what would it cost?";
  try {
    const ws = await getOrCreateWorkspace(email);
    const lead = await createLead({
      ownerEmail: email,
      name: "Sample Lead (test)",
      source: "test",
      snippet: question,
    });
    await addMessage({ leadId: lead.id, role: "lead", body: question, channel: "chat", delivered: true });

    // The sample question asks "what would it cost?", so feed the agent the
    // real offer/pricing context — otherwise the demo reply deflects on the
    // exact thing it's posing and undersells what the agent can do.
    const [services, offer] = await Promise.all([
      getWorkspaceServices(email),
      getWorkspaceOffer(email),
    ]);
    const reply = await generateLeadReply({
      businessName: ws?.business_name ?? "",
      businessDescription: ws?.business_description ?? "",
      leadName: "Sample Lead",
      leadMessage: question,
      businessServices: services ?? undefined,
      qualifyingQuestions: offer.qualifyingQuestions,
      agentName: offer.agentName,
      agentTone: offer.agentTone,
    });
    await addMessage({ leadId: lead.id, role: "agent", body: reply, channel: "chat", delivered: true });
    await setLeadStatus(email, lead.id, "contacted");
    revalidateLead(lead.id);
  } catch (error) {
    console.error("sendTestLead failed:", error);
  }
}

export async function vraelisSignOut() {
  await signOut({ redirectTo: "/v" });
}
