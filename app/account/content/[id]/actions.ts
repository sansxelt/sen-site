"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "../../../../auth";
import { isAdminEmail } from "../../../../lib/admin";
import {
  publishPiece,
  unpublishPiece,
  updatePieceMeta,
  updateChapterBody,
  deletePiece,
} from "../../../../lib/learn-db";

// Server actions for the content review UI. Every action re-checks
// the admin gate — the form posts can be replayed by any signed-in
// user, so we don't trust the page-level redirect alone.

async function assertAdmin() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email || !isAdminEmail(email)) {
    throw new Error("Forbidden");
  }
  return email;
}

// Revalidates every surface that could be showing this piece. Cheap
// because Next dedupes invalidations within a request.
function bustCaches(slug?: string) {
  revalidatePath("/account/content");
  revalidatePath("/learn");
  if (slug) {
    revalidatePath(`/learn/p/${slug}`);
    revalidatePath(`/learn/p/${slug}/[chapter]`, "page");
  }
}

export async function publishAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const piece = await publishPiece(id);
  bustCaches(piece?.slug);
}

export async function unpublishAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const piece = await unpublishPiece(id);
  bustCaches(piece?.slug);
}

export async function deleteAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deletePiece(id);
  redirect("/account/content");
}

export async function saveMetaAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const topic = String(formData.get("topic") ?? "").trim();
  const subtopic = String(formData.get("subtopic") ?? "").trim();
  const cover_emoji = String(formData.get("cover_emoji") ?? "").trim();
  const readMinsRaw = String(formData.get("read_minutes") ?? "").trim();
  const piece = await updatePieceMeta(id, {
    title: title || undefined,
    excerpt: excerpt || null,
    topic: topic || undefined,
    subtopic: subtopic || null,
    cover_emoji: cover_emoji || null,
    read_minutes: readMinsRaw ? Math.max(1, Number(readMinsRaw)) : null,
  });
  bustCaches(piece?.slug);
}

export async function saveChapterAction(formData: FormData) {
  await assertAdmin();
  const chapterId = String(formData.get("chapter_id") ?? "");
  const body = String(formData.get("body_md") ?? "");
  if (!chapterId) return;
  await updateChapterBody(chapterId, body);
  // Don't know the piece slug from chapter id alone — bust the
  // index pages and let detail-page revalidation happen on next
  // visit. ISR on the detail route handles the rest.
  bustCaches(undefined);
}
