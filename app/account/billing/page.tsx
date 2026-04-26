import { redirect } from "next/navigation";

// v0.1.12, billing now lives inline on /account so users see plan +
// addons + payment + invoices in one place. This route stays as a
// redirect so deep links (and the copilot's `[go:/account/billing]`
// navigation marker) still land in the right spot.
export default function AccountBillingRedirect() {
  redirect("/account#billing");
}
