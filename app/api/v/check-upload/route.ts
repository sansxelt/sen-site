// AI Check attachments API (session/app). Uploading NEVER charges a credit; files bind to a check
// later, only on the successful-check path.
//   POST   /api/v/check-upload                      multipart: file, role, draftKey, versionKey?
//   GET    /api/v/check-upload?draftKey=...          list a draft's attachments
//   GET    /api/v/check-upload?id=...&signed=1       short-lived signed preview URL (owner only)
//   DELETE /api/v/check-upload?id=...                remove one attachment (owner only)
//   PATCH  /api/v/check-upload                       reorder: { draftKey, orderedIds }
// storage_path is never returned; the client only ever sees ids + signed URLs.

import { NextResponse } from "next/server";
import crypto from "crypto";
import { validateFile, sanitizeFilename, FORMATS, LIMITS, type AttachmentRole } from "@/lib/v-attachments";
import { uploadCheckAttachment, signedCheckUrl, deleteCheckAttachments } from "@/lib/v-storage";
import { insertAttachment, listByDraft, deleteAttachmentRow, getAttachment, countForVersion, countContext, countImagesTotal, reorder, requireOwner, type AttachmentRow } from "@/lib/v-attachments-db";

export const runtime = "nodejs";
export const maxDuration = 60;

// Owner comes ONLY from requireOwner() (the session); routes never read a client-supplied owner. The
// storage namespace hashes that session-derived tenant key.
const ns = (owner: string) => crypto.createHash("sha256").update(owner).digest("hex").slice(0, 16);
const fail = (message: string, status = 400, code = "validation_error") => NextResponse.json({ error: code, message }, { status });

// Public shape: everything the UI needs, and NOT storage_path.
function publicRow(r: AttachmentRow) {
  return { id: r.id, role: r.role, version_key: r.version_key, order_index: r.order_index, filename: r.filename, mime: r.mime, kind: FORMATS[r.mime]?.kind ?? "text", size_bytes: r.size_bytes, page_count: r.page_count, status: r.status, capabilities: r.capabilities };
}

export async function POST(req: Request) {
  const u = await requireOwner();
  if (!u) return fail("Sign in to upload files.", 401, "signin_required");

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Expected a multipart file upload.");
  const file = form.get("file");
  const role: AttachmentRole = form.get("role") === "supporting_context" ? "supporting_context" : "candidate_output";
  const draftKey = String(form.get("draftKey") || "").slice(0, 100);
  const versionKey = role === "candidate_output" ? String(form.get("versionKey") || "").slice(0, 100) : null;
  if (!draftKey) return fail("Missing draft reference.");
  if (!(file instanceof Blob)) return fail("No file provided.");
  if (role === "candidate_output" && !versionKey) return fail("Missing version.");

  // Count limit (and the next order index) BEFORE reading/validating bytes.
  const existing = role === "candidate_output" ? await countForVersion(u, draftKey, versionKey as string) : await countContext(u, draftKey);
  const cap = role === "candidate_output" ? LIMITS.filesPerVersion : LIMITS.contextFiles;
  if (existing >= cap) return fail(role === "candidate_output" ? `You can upload up to ${cap} files in this version.` : `You can upload up to ${cap} supporting files.`, 400, "too_many_files");

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = sanitizeFilename((file as File).name || "file");
  const v = await validateFile(buffer, filename);
  if ("error" in v) return fail(v.message, v.error === "too_large" ? 413 : 400, v.error);

  if (v.kind === "image" && (await countImagesTotal(u, draftKey)) >= LIMITS.maxImagesTotal) {
    return fail(`You can attach up to ${LIMITS.maxImagesTotal} images across the check.`, 400, "too_many_files");
  }

  const path = `users/${ns(u)}/${draftKey}/${crypto.randomUUID()}`;
  if (!(await uploadCheckAttachment(path, buffer, v.mime))) return fail("Upload storage is unavailable right now. Try again.", 503, "storage_unavailable");

  const row = await insertAttachment({
    userId: u, draftKey, role, versionKey, filename, mime: v.mime, sizeBytes: buffer.length,
    storagePath: path, pageCount: v.pageCount, capabilities: { text: v.kind !== "image", vision: v.vision }, orderIndex: existing,
  });
  if (!row) { await deleteCheckAttachments([path]); return fail("Could not save the upload. Try again.", 500, "internal_error"); }
  return NextResponse.json({ attachment: publicRow(row) });
}

export async function GET(req: Request) {
  const u = await requireOwner();
  if (!u) return fail("Sign in to view files.", 401, "signin_required");
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id && url.searchParams.get("signed") === "1") {
    const row = await getAttachment(u, id);            // ownership: getAttachment filters on user_id
    if (!row) return fail("Not found.", 404, "not_found");
    const signed = await signedCheckUrl(row.storage_path);
    if (!signed) return fail("Could not create a preview link.", 503, "storage_unavailable");
    return NextResponse.json({ url: signed, mime: row.mime, filename: row.filename });
  }
  const draftKey = url.searchParams.get("draftKey") || "";
  return NextResponse.json({ attachments: (await listByDraft(u, draftKey)).map(publicRow) });
}

export async function DELETE(req: Request) {
  const u = await requireOwner();
  if (!u) return fail("Sign in.", 401, "signin_required");
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return fail("Missing id.");
  const path = await deleteAttachmentRow(u, id); // owner-scoped delete; returns the path to purge bytes
  if (path) await deleteCheckAttachments([path]);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const u = await requireOwner();
  if (!u) return fail("Sign in.", 401, "signin_required");
  const body = (await req.json().catch(() => ({}))) as { draftKey?: string; orderedIds?: unknown };
  const draftKey = String(body.draftKey || "").slice(0, 100);
  const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.filter((x): x is string => typeof x === "string").slice(0, 32) : [];
  if (!draftKey || !orderedIds.length) return fail("Missing draftKey or orderedIds.");
  await reorder(u, draftKey, orderedIds);
  return NextResponse.json({ ok: true });
}
