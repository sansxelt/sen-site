// Revenue-cut billing. Accrues the unbilled "won" deal revenue for a
// workspace, applies the plan's cut rate, and raises a Stripe invoice the
// customer pays (collection_method: send_invoice → Stripe emails a hosted
// pay page). Separate from the plan subscription — the plan only sets the
// rate. Won leads are flagged fee_billed once included so they never bill
// twice.

import Stripe from "stripe";
import {
  getUnbilledWonLeads,
  markLeadsFeeBilled,
  type VraelisWorkspace,
} from "./vraelis-db";
import { cutRateFor } from "./vraelis-plans";

export type BillResult =
  | { billed: false; reason: string }
  | { billed: true; amountCents: number; deals: number; invoiceId: string };

async function findOrCreateCustomer(stripe: Stripe, email: string, name: string | null): Promise<string> {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const created = await stripe.customers.create({ email, name: name ?? undefined });
  return created.id;
}

export async function billWorkspaceFee(workspace: VraelisWorkspace): Promise<BillResult> {
  if (!process.env.STRIPE_SECRET_KEY) return { billed: false, reason: "stripe_not_configured" };

  const leads = await getUnbilledWonLeads(workspace.owner_email);
  if (leads.length === 0) return { billed: false, reason: "no_unbilled_revenue" };

  const revenue = leads.reduce((sum, l) => sum + l.value, 0);
  const rate = cutRateFor(workspace.plan, workspace.plan_cycle);
  const amountCents = Math.round(revenue * rate * 100);
  // Stripe minimum chargeable amount is $0.50 — let small fees accrue.
  if (amountCents < 50) return { billed: false, reason: "below_minimum" };

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    const customer = await findOrCreateCustomer(stripe, workspace.owner_email, workspace.business_name);
    const pct = (rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1);

    // Create the invoice FIRST with pending_invoice_items_behavior:"exclude"
    // so it never sweeps in unrelated pending items (e.g. other Stripe
    // prorations), then attach exactly our one line item to it.
    const invoice = await stripe.invoices.create({
      customer,
      collection_method: "send_invoice",
      days_until_due: 7,
      description: "Vraelis revenue share",
      pending_invoice_items_behavior: "exclude",
      metadata: { owner_email: workspace.owner_email, kind: "vraelis_revenue_share" },
    });
    const invoiceId = invoice.id;
    if (!invoiceId) return { billed: false, reason: "no_invoice_id" };

    await stripe.invoiceItems.create({
      customer,
      invoice: invoiceId,
      amount: amountCents,
      currency: "usd",
      description: `Vraelis revenue share — ${pct}% of $${revenue.toLocaleString()} booked across ${leads.length} deal${leads.length === 1 ? "" : "s"}`,
    });

    await stripe.invoices.finalizeInvoice(invoiceId);
    await stripe.invoices.sendInvoice(invoiceId);

    // Only flag billed after the invoice is safely raised.
    await markLeadsFeeBilled(leads.map((l) => l.id));

    return { billed: true, amountCents, deals: leads.length, invoiceId };
  } catch (error) {
    console.error("billWorkspaceFee failed for", workspace.owner_email, error);
    return { billed: false, reason: "stripe_error" };
  }
}
