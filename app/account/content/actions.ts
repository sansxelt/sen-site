"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { isAdminEmail } from "../../../lib/admin";
import { getApprovedDisplayName } from "../../../lib/contributors";
import {
  createDraftPiece,
  listPiecesByStatus,
  publishPiece,
  slugExists,
  type LearnPieceType,
} from "../../../lib/learn-db";

// List-page actions for /account/content. Per-row Publish + a
// bulk Publish-all-drafts so admins can ship without drilling
// into each piece. Both re-check the admin gate inside the action
// since form posts can be replayed by any signed-in user.

async function assertAdmin(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email || !isAdminEmail(email)) {
    throw new Error("Forbidden");
  }
  return email;
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function bustCaches(slug?: string) {
  revalidatePath("/account/content");
  revalidatePath("/learn");
  if (slug) revalidatePath(`/learn/p/${slug}`);
}

export async function publishOneAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const piece = await publishPiece(id);
  bustCaches(piece?.slug);
}

export async function publishAllDraftsAction() {
  await assertAdmin();
  const drafts = await listPiecesByStatus("draft", 500);
  for (const d of drafts) {
    await publishPiece(d.id);
  }
  bustCaches();
}

export async function createDraftFromFormAction(formData: FormData) {
  const email = await assertAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const topic = String(formData.get("topic") ?? "").trim() || "general";
  const subtopic = String(formData.get("subtopic") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "article").trim();
  const type: LearnPieceType =
    typeRaw === "info" || typeRaw === "research" ? typeRaw : "article";
  if (!title) throw new Error("Title required");

  // Make sure the slug is unique. Append -2, -3, ... on collision.
  const baseSlug = slugifyTitle(title) || "untitled";
  let slug = baseSlug;
  let n = 2;
  while (await slugExists(slug)) {
    slug = `${baseSlug}-${n}`;
    n += 1;
  }

  // Snapshot the byline at write time. Admins skip this — the
  // renderer flips them to "Sansxel (OWNER)" via authorLabel —
  // contributors get their hardlocked display_name baked in so a
  // later rename of the contributor doesn't rewrite the byline.
  const displayName = isAdminEmail(email)
    ? null
    : await getApprovedDisplayName(email);

  const piece = await createDraftPiece({
    type,
    slug,
    title,
    topic,
    subtopic: subtopic || undefined,
    author_email: email,
    author_display_name: displayName ?? undefined,
    chapters: [
      {
        ord: 0,
        slug: "intro",
        title: "Introduction",
        body_md: "Write your first chapter here.",
      },
    ],
  });

  bustCaches(piece.slug);
  redirect(`/account/content/${piece.id}`);
}
