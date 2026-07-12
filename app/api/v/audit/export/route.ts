// GET /api/v/audit/export?scope=workspace|organization&format=csv|json&limit&from&to
// Enterprise Audit Export v1. Session-only (no public / no API-key access). Returns ONLY the
// already-sanitized AuditEntry rows the /activity view shows — never raw metadata, emails,
// tokens, hashes, Stripe ids, OIDC/SAML material, or payloads. Permission enforced in the lib:
// workspace = self-scoped; organization = org owner/admin only. CSV is formula-injection-safe.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exportableAudit, type AuditScope } from "@/lib/v-audit";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

const norm = (e: string) => e.trim().toLowerCase();

// Quote + neutralize spreadsheet formula injection (values starting with = + - @ tab CR).
function csvCell(v: string) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

const statusFor = (e: string) => (e === "forbidden" ? 403 : e === "no_organization" ? 404 : e === "invalid_scope" ? 400 : e === "unavailable" ? 503 : 500);

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") ?? "workspace") as AuditScope;
  if (scope !== "workspace" && scope !== "organization") return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  const limit = parseInt(url.searchParams.get("limit") ?? "500", 10);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const res = await exportableAudit(email, scope, isNaN(limit) ? 500 : limit);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: statusFor(res.error) });

  // Optional date-range filter on the already-sanitized rows.
  let rows = res.entries;
  if (from) { const t = Date.parse(from); if (!isNaN(t)) rows = rows.filter((e) => Date.parse(e.when) >= t); }
  if (to) { const t = Date.parse(to); if (!isNaN(t)) rows = rows.filter((e) => Date.parse(e.when) <= t); }

  await logEvent({ userId: norm(email), eventType: "audit_export_created", actorType: "owner", source: "app", metadata: { scope, format, row_count: rows.length } });

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `vraelis-audit-${scope}-${stamp}.${format}`;

  if (format === "json") {
    return new NextResponse(JSON.stringify({ scope, generated_at: new Date().toISOString(), count: rows.length, entries: rows.map((e) => ({ timestamp: e.when, event: e.label, category: e.category, subject: e.subject ?? null, actor: e.actor, scope, context: e.context })) }, null, 2), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" },
    });
  }
  const header = ["scope", "event", "category", "subject", "timestamp", "actor", "context"];
  const lines = [header.map(csvCell).join(","), ...rows.map((e) => [scope, e.label, e.category, e.subject ?? "", e.when, e.actor, e.context].map(csvCell).join(","))];
  return new NextResponse(lines.join("\r\n"), {
    status: 200,
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" },
  });
}
