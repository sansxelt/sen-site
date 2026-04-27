"use server";

import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { isAdminEmail } from "../../../lib/admin";
import {
  listPiecesByStatus,
  publishPiece,
} from "../../../lib/learn-db";

// List-page actions for /account/content. Per-row Publish + a
// bulk Publish-all-drafts so admins can ship without drilling
// into each piece. Both re-check the admin gate inside the action
// since form posts can be replayed by any signed-in user.

async function assertAdmin() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email || !isAdminEmail(email)) {
    throw new Error("Forbidden");
  }
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
