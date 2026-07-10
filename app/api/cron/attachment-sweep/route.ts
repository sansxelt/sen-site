// Scheduled orphan sweep for abandoned draft attachments (Pass 2A Phase 7). Deletes draft uploads that
// were never bound to a check and are past their 24h expiry: private-storage bytes FIRST, then the
// metadata rows, so a byte-purge failure retries next run instead of orphaning an object. Bound
// attachments (attached to a real check) are never touched. Bounded per run; idempotent. Logs only
// redacted counts + id prefixes -- never filenames or content.
// Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>`.

import { NextResponse } from "next/server";
import { findExpiredDrafts, deleteAttachmentRowsById } from "@/lib/v-attachments-db";
import { deleteCheckAttachments } from "@/lib/v-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let deleted = 0, purgeFailures = 0, batches = 0;
  for (let i = 0; i < 25; i++) { // bounded: <= 25 batches x 200 = 5000 attachments/run
    const rows = await findExpiredDrafts(200);
    if (!rows.length) break;
    batches++;
    // Bytes first (best-effort; a failure leaves the row so it retries next run).
    try { await deleteCheckAttachments(rows.map((r) => r.storage_path)); } catch { purgeFailures++; continue; }
    deleted += await deleteAttachmentRowsById(rows.map((r) => r.id));
  }
  console.log(`attachment-sweep: batches=${batches} deleted=${deleted} purge_failures=${purgeFailures}`);
  return NextResponse.json({ ok: true, deleted, purge_failures: purgeFailures, batches });
}
