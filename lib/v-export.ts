// Vraelis preference-data export. buildExport() is the SINGLE source of truth for
// what leaves the system — only safe, report-level fields. It NEVER includes:
// owner email/user_id, voter ids, ip/device hashes, billing/credit internals,
// API keys, admin fields, or share tokens. Draft/canceled tests don't export.

import { getSupabaseAdminClient } from "./supabase-admin";
import { getTestWithOptions, getReport, OPTION_LETTERS } from "./v-db";

export type ExportData = {
  test_id: string;
  title: string;
  status: string;
  category: string;
  audience: string;
  created_at: string;
  completed_at: string | null;
  votes_target: number;
  votes_valid: number;
  votes_filtered: number;
  inconclusive: boolean;
  winner: { option: string; label: string | null; votes: number; pct: number } | null;
  options: { option: string; position: number; label: string | null; asset_url: string | null; votes: number; pct: number }[];
  comments: { option: string; reason: string }[];
  analysis: { summary: string; why_winner: string; weaknesses: string[]; suggestions: string[]; confidence: string } | null;
  quality: { valid: number; filtered: number; filtered_reasons: Record<string, number> };
  exported_at: string;
};

export async function buildExport(testId: string): Promise<{ ownerId: string; status: string; data: ExportData } | null> {
  const td = await getTestWithOptions(testId);
  if (!td) return null;
  const { test, options } = td;
  const report = await getReport(testId);
  const r = report?.results ?? null;

  // Aggregated rejected-reason counts only — never raw ip/device/voter data.
  const s = getSupabaseAdminClient();
  const { data: rej } = await s.from("v_judgments" as never).select("reject_reason").eq("test_id", testId).eq("status", "rejected");
  const filtered_reasons: Record<string, number> = {};
  let filteredCount = 0;
  for (const row of (rej as unknown as { reject_reason: string | null }[]) ?? []) {
    filteredCount += 1;
    const k = row.reject_reason ?? "other";
    filtered_reasons[k] = (filtered_reasons[k] ?? 0) + 1;
  }

  const optById = Object.fromEntries(options.map((o) => [o.id, o]));
  const ranked = r?.ranked ?? [];
  const winnerRow = r?.winner_option_id ? ranked.find((x) => x.id === r.winner_option_id) : null;
  const letter = (id: string) => OPTION_LETTERS[optById[id]?.position ?? 0] ?? "?";

  const data: ExportData = {
    test_id: test.id,
    title: test.title,
    status: test.status,
    category: test.category,
    audience: test.audience,
    created_at: test.created_at,
    completed_at: test.completed_at,
    votes_target: test.votes_target,
    votes_valid: r?.total ?? test.votes_valid,
    votes_filtered: r?.filtered ?? filteredCount,
    inconclusive: !!r && !r.winner_option_id,
    winner: winnerRow ? { option: OPTION_LETTERS[winnerRow.position], label: winnerRow.label, votes: winnerRow.votes, pct: winnerRow.pct } : null,
    options: ranked.map((row) => ({ option: OPTION_LETTERS[row.position], position: row.position, label: optById[row.id]?.label ?? row.label, asset_url: optById[row.id]?.asset_url ?? null, votes: row.votes, pct: row.pct })),
    comments: (r?.comments ?? []).map((c) => ({ option: letter(c.option_id), reason: c.reason })),
    analysis: r?.analysis ?? null,
    quality: { valid: r?.total ?? test.votes_valid, filtered: r?.filtered ?? filteredCount, filtered_reasons },
    exported_at: new Date().toISOString(),
  };
  return { ownerId: test.user_id, status: test.status, data };
}

export function toCSV(d: ExportData): string {
  const esc = (v: unknown) => { const str = v == null ? "" : String(v); return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str; };
  const header = ["test_id", "title", "status", "category", "option", "label", "votes", "percent", "is_winner", "total_valid", "total_filtered"];
  const rows = d.options.length
    ? d.options.map((o) => [d.test_id, d.title, d.status, d.category, o.option, o.label ?? "", o.votes, o.pct, d.winner?.option === o.option ? "true" : "false", d.votes_valid, d.votes_filtered])
    : [[d.test_id, d.title, d.status, d.category, "", "", "", "", "", d.votes_valid, d.votes_filtered]];
  return [header, ...rows].map((row) => row.map(esc).join(",")).join("\n");
}

// Auth-agnostic: caller verifies who `userId` is (session or API key) first.
export async function exportResponse(testId: string, userId: string, fmt: string): Promise<Response> {
  if (fmt !== "json" && fmt !== "csv") return Response.json({ error: "invalid_format", allowed: ["json", "csv"] }, { status: 400 });
  const res = await buildExport(testId);
  if (!res) return Response.json({ error: "not_found" }, { status: 404 });
  if (res.status === "draft" || res.status === "canceled") return Response.json({ error: "not_exportable" }, { status: 404 });
  if (res.ownerId !== userId.trim().toLowerCase()) return Response.json({ error: "forbidden" }, { status: 403 });
  const slug = (res.data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)) || "vraelis-export";
  if (fmt === "csv") {
    return new Response(toCSV(res.data), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.csv"` } });
  }
  return new Response(JSON.stringify(res.data, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.json"` } });
}
