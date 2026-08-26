// Bind an OAuth sign-in to the provider's stable subject ID, and refuse the takeover shape.
//
// See sql/vraelis-oauth-identity-binding.sql for the model and its limits. In short: identity in this
// product is an email string, so a second provider account presenting an address that already belongs to
// a different subject is indistinguishable from the original owner. This records the subject and refuses
// that case.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export type BindResult = "bound" | "known" | "email_changed" | "conflict" | "unavailable";

let bindRpcMissingLogged = false;

/**
 * Record this (provider, subject, email) and report what it means.
 *
 * "conflict" is the only refusal — a different subject already holds this address on this provider.
 *
 * FAIL-OPEN, deliberately, and here is the reasoning. This is the SECOND layer; the first is the
 * verified-email requirement, which is enforced at the provider and does not depend on this database. If
 * this table cannot be read, refusing every OAuth sign-in would turn a database hiccup into a total
 * sign-in outage while removing no proven protection — the same tradeoff the surrounding profile sync
 * already makes. The event is logged so a persistent failure is visible rather than silent.
 */
export async function bindOAuthIdentity(
  provider: string,
  subject: string,
  email: string,
): Promise<BindResult> {
  if (!provider || !subject || !email || !isDatabaseConfigured()) return "unavailable";
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("v_bind_oauth_identity" as never, {
      p_provider: provider,
      p_subject: subject,
      p_email: email,
    } as never);
    if (error) {
      // 42883 = undefined_function; PostgREST reports a missing RPC as PGRST202.
      const code = (error as { code?: string }).code ?? "";
      if (code === "42883" || code === "PGRST202" || /could not find the function/i.test(error.message ?? "")) {
        if (!bindRpcMissingLogged) {
          bindRpcMissingLogged = true;
          console.warn("[auth] v_bind_oauth_identity is not deployed; OAuth identities are not being bound");
        }
        return "unavailable";
      }
      console.error("[auth] bindOAuthIdentity failed:", error.message);
      return "unavailable";
    }
    const res = (data ?? {}) as { ok?: boolean; status?: string };
    if (res.ok === false) return res.status === "subject_conflict" ? "conflict" : "unavailable";
    if (res.status === "bound" || res.status === "known" || res.status === "email_changed") return res.status;
    return "unavailable";
  } catch (e) {
    console.error("[auth] bindOAuthIdentity threw:", e);
    return "unavailable";
  }
}
