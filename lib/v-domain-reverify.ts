// Periodic domain re-verification / health (v1). A verified org domain can later lose its DNS TXT
// record; if Vraelis kept trusting it forever, SSO + auto-provisioning would rely on stale domain
// ownership. This re-resolves _vraelis-challenge.<domain> on a schedule (and on a manual "Re-check
// DNS" button), tracks health, and after repeated failures flags the domain requires_reverification
// = true — which PAUSES new SSO logins + new joins for that domain (existing members/sessions are
// untouched) until it is re-checked successfully.
//
// Reuses the EXACT same TXT matching as the original verification (txtRecordsMatchHash) — no
// duplicated/unsafe DNS parsing. Never exposes or logs the token, hash, or raw TXT values.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";
import { txtRecordsMatchHash } from "./v-organization";

const DNS_PREFIX = "_vraelis-challenge.";
// Conservative policy: a single failure (often a transient DNS hiccup) does NOT pause a domain.
// requires_reverification flips true only after this many CONSECUTIVE failed checks. A successful
// check resets the counter and clears the flag. Tune here if needed.
export const FAILURE_THRESHOLD = 3;

export type CheckStatus = "ok" | "missing_txt" | "mismatch" | "dns_error" | "timeout";
export type ReverifyResult = { status: CheckStatus; requiresReverification: boolean; failedCount: number };

// Pure DNS check: resolve the challenge TXT and compare to the stored hash. Graceful on failure.
async function checkDomainDns(domain: string, storedHash: string | null): Promise<CheckStatus> {
  if (!storedHash) return "mismatch";
  let records: string[][] = [];
  try {
    const { resolveTxt } = await import("node:dns/promises");
    records = await Promise.race([
      resolveTxt(`${DNS_PREFIX}${domain}`),
      new Promise<string[][]>((_, rej) => setTimeout(() => rej(new Error("__timeout__")), 5000)),
    ]);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err?.message === "__timeout__") return "timeout";
    if (err?.code === "ENOTFOUND" || err?.code === "ENODATA") return "missing_txt";
    return "dns_error";
  }
  if (!records || records.length === 0) return "missing_txt";
  return txtRecordsMatchHash(records, storedHash) ? "ok" : "mismatch";
}

type DomainRow = { id: string; organization_id: string; domain: string; status: string; verification_token_hash: string | null; failed_check_count: number | null; requires_reverification: boolean | null };

// Re-check ONE verified domain row and apply the health/failure policy. System-level (no per-user
// permission check here — callers gate access). Returns the new health. Logs safe events only.
export async function reverifyDomainRow(row: DomainRow): Promise<ReverifyResult> {
  const s = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const status = await checkDomainDns(row.domain, row.verification_token_hash);
  const wasRequired = row.requires_reverification === true;

  if (status === "ok") {
    await s.from("v_organization_domains" as never).update({ last_checked_at: nowIso, last_verified_at: nowIso, last_check_status: "ok", failed_check_count: 0, requires_reverification: false, reverification_started_at: null, updated_at: nowIso } as never).eq("id", row.id);
    await logEvent({ userId: "system", eventType: "organization_domain_reverification_checked", actorType: "system", source: "cron", metadata: { organization_id: row.organization_id, domain: row.domain, status: "ok" } });
    if (wasRequired) await logEvent({ userId: "system", eventType: "organization_domain_reverification_restored", actorType: "system", source: "cron", metadata: { organization_id: row.organization_id, domain: row.domain, status: "ok" } });
    return { status, requiresReverification: false, failedCount: 0 };
  }

  const failedCount = (row.failed_check_count ?? 0) + 1;
  const nowRequired = failedCount >= FAILURE_THRESHOLD;
  const update: Record<string, unknown> = { last_checked_at: nowIso, last_check_status: status, failed_check_count: failedCount, updated_at: nowIso };
  if (nowRequired) { update.requires_reverification = true; if (!wasRequired) update.reverification_started_at = nowIso; }
  await s.from("v_organization_domains" as never).update(update as never).eq("id", row.id);
  await logEvent({ userId: "system", eventType: "organization_domain_reverification_failed", actorType: "system", source: "cron", metadata: { organization_id: row.organization_id, domain: row.domain, status, failure_count: failedCount } });
  if (nowRequired && !wasRequired) await logEvent({ userId: "system", eventType: "organization_domain_reverification_required", actorType: "system", source: "cron", metadata: { organization_id: row.organization_id, domain: row.domain, status, failure_count: failedCount } });
  return { status, requiresReverification: nowRequired || wasRequired, failedCount };
}

const ROW_COLS = "id,organization_id,domain,status,verification_token_hash,failed_check_count,requires_reverification";

// Re-check a single verified domain by id (used by the manual "Re-check DNS" button after the route
// has verified owner/admin permission + org scope).
export async function reverifyDomainById(domainId: string): Promise<ReverifyResult | { error: string }> {
  if (!isDatabaseConfigured()) return { error: "unavailable" };
  try {
    const { data } = await getSupabaseAdminClient().from("v_organization_domains" as never).select(ROW_COLS).eq("id", domainId).maybeSingle();
    const row = data as unknown as DomainRow | null;
    if (!row) return { error: "not_found" };
    if (row.status !== "verified") return { error: "not_verified" };
    return await reverifyDomainRow(row);
  } catch { return { error: "check_failed" }; }
}

export type CronSummary = { checked: number; okCount: number; failed: number; required: number };

// Bounded sweep: re-check the stalest verified domains (never checked, or checked > staleHours ago).
export async function reverifyStaleDomains(batchSize = 50, staleHours = 24): Promise<CronSummary> {
  const summary: CronSummary = { checked: 0, okCount: 0, failed: 0, required: 0 };
  if (!isDatabaseConfigured()) return summary;
  try {
    const s = getSupabaseAdminClient();
    const cutoff = new Date(Date.now() - staleHours * 3600 * 1000).toISOString();
    const { data } = await s.from("v_organization_domains" as never).select(ROW_COLS + ",last_checked_at").eq("status", "verified").or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`).order("last_checked_at", { ascending: true, nullsFirst: true }).limit(batchSize);
    const rows = (data as unknown as (DomainRow & { last_checked_at: string | null })[]) ?? [];
    for (const row of rows) {
      const r = await reverifyDomainRow(row);
      summary.checked++;
      if (r.status === "ok") summary.okCount++; else summary.failed++;
      if (r.requiresReverification) summary.required++;
    }
    await logEvent({ userId: "system", eventType: "organization_domain_reverification_cron_completed", actorType: "system", source: "cron", metadata: { status: "ok", batch_count: summary.checked } });
    return summary;
  } catch { return summary; }
}
