// DB helpers for the Learn content publication system.
//
// Three tables (learn_pieces, learn_chapters, learn_sources). See
// docs/v0.1.16-learn-content.sql. All helpers fail open (return
// null/empty) when the migration hasn't been run yet OR Supabase is
// transiently down. Same convention as lib/chat-history.ts.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export type LearnPieceType = "article" | "info" | "research";
export type LearnPieceStatus = "draft" | "review" | "published" | "archived";

export type LearnPiece = {
  id: string;
  type: LearnPieceType;
  slug: string;
  title: string;
  excerpt: string | null;
  topic: string;
  subtopic: string | null;
  level: string;
  cover_emoji: string | null;
  status: LearnPieceStatus;
  read_minutes: number | null;
  author_email: string | null;
  // Hardlocked byline snapshot for non-admin contributors. Null for
  // admin-authored pieces (the renderer falls back to "VRAELIS
  // (OWNER)") and legacy pieces seeded before v0.2.0-contributors.
  author_display_name: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type LearnChapter = {
  id: string;
  piece_id: string;
  ord: number;
  slug: string;
  title: string;
  body_md: string;
  created_at: string;
  updated_at: string;
};

export type LearnSource = {
  id: string;
  piece_id: string;
  ord: number;
  url: string;
  title: string | null;
  author: string | null;
  source_type: string | null;
  excerpt: string | null;
  created_at: string;
};

export type LearnPieceWithChapters = LearnPiece & {
  chapters: LearnChapter[];
  sources: LearnSource[];
};

const PIECES = "learn_pieces";
const CHAPTERS = "learn_chapters";
const SOURCES = "learn_sources";

// --- Reads ---------------------------------------------------------

/** Lists published pieces, newest first. Filterable by type/topic.
 * Returns [] on any failure so a missing table doesn't 500 /learn. */
export async function listPublishedPieces(opts?: {
  type?: LearnPieceType;
  topic?: string;
  limit?: number;
}): Promise<LearnPiece[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    let q = supabase
      .from(PIECES as never)
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(opts?.limit ?? 100);
    if (opts?.type) q = q.eq("type", opts.type);
    if (opts?.topic) q = q.eq("topic", opts.topic);
    const { data, error } = await q;
    if (error) {
      console.warn("listPublishedPieces failed:", error.message);
      return [];
    }
    return (data ?? []) as unknown as LearnPiece[];
  } catch (err) {
    console.warn("listPublishedPieces threw:", err);
    return [];
  }
}

/** Lists pieces by status. Used by the admin review UI. Most-recent
 * first by updated_at so freshly-edited drafts surface immediately. */
export async function listPiecesByStatus(
  status: LearnPieceStatus,
  limit = 200,
): Promise<LearnPiece[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(PIECES as never)
      .select("*")
      .eq("status", status)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("listPiecesByStatus failed:", error.message);
      return [];
    }
    return (data ?? []) as unknown as LearnPiece[];
  } catch (err) {
    console.warn("listPiecesByStatus threw:", err);
    return [];
  }
}

/** Fetches one piece + its chapters + sources, or null if missing.
 * Used by /learn/* detail routes and the admin edit page. */
export async function getPieceWithChapters(
  idOrSlug: string,
): Promise<LearnPieceWithChapters | null> {
  if (!isDatabaseConfigured() || !idOrSlug) return null;
  try {
    const supabase = getSupabaseAdminClient();
    // Try id first (uuid-shaped), then slug. Cheap because slug is
    // unique-indexed.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const { data: pieceRow, error: pieceErr } = await supabase
      .from(PIECES as never)
      .select("*")
      .eq(isUuid ? "id" : "slug", idOrSlug)
      .maybeSingle();
    if (pieceErr || !pieceRow) {
      if (pieceErr) console.warn("getPieceWithChapters piece failed:", pieceErr.message);
      return null;
    }
    const piece = pieceRow as unknown as LearnPiece;
    const [{ data: chapters }, { data: sources }] = await Promise.all([
      supabase
        .from(CHAPTERS as never)
        .select("*")
        .eq("piece_id", piece.id)
        .order("ord", { ascending: true }),
      supabase
        .from(SOURCES as never)
        .select("*")
        .eq("piece_id", piece.id)
        .order("ord", { ascending: true }),
    ]);
    return {
      ...piece,
      chapters: ((chapters ?? []) as unknown as LearnChapter[]),
      sources: ((sources ?? []) as unknown as LearnSource[]),
    };
  } catch (err) {
    console.warn("getPieceWithChapters threw:", err);
    return null;
  }
}

/** Returns true iff a slug is already taken. Used by the ingester
 * and the admin form to avoid unique-index conflicts. */
export async function slugExists(slug: string): Promise<boolean> {
  if (!isDatabaseConfigured() || !slug) return false;
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from(PIECES as never)
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

// --- Writes --------------------------------------------------------

export type DraftChapterInput = {
  ord: number;
  slug: string;
  title: string;
  body_md: string;
};

export type DraftSourceInput = {
  ord?: number;
  url: string;
  title?: string;
  author?: string;
  source_type?: string;
  excerpt?: string;
};

/** Creates a draft piece + chapters + sources in one transactional
 * sequence. Throws on hard failure (caller should surface the error
 * rather than silently lose work, since drafts are valuable). */
export async function createDraftPiece(input: {
  type: LearnPieceType;
  slug: string;
  title: string;
  excerpt?: string;
  topic: string;
  subtopic?: string;
  level?: string;
  cover_emoji?: string;
  read_minutes?: number;
  author_email?: string;
  author_display_name?: string;
  chapters: DraftChapterInput[];
  sources?: DraftSourceInput[];
}): Promise<LearnPiece> {
  const supabase = getSupabaseAdminClient();
  const { data: piece, error: pieceErr } = await supabase
    .from(PIECES as never)
    .insert({
      type: input.type,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt ?? null,
      topic: input.topic,
      subtopic: input.subtopic ?? null,
      level: input.level ?? "all",
      cover_emoji: input.cover_emoji ?? null,
      read_minutes: input.read_minutes ?? null,
      author_email: input.author_email ?? null,
      author_display_name: input.author_display_name ?? null,
      status: "draft",
    } as never)
    .select("*")
    .single();
  if (pieceErr || !piece) {
    throw new Error(`createDraftPiece insert failed: ${pieceErr?.message ?? "no row"}`);
  }
  const pieceId = (piece as unknown as LearnPiece).id;

  if (input.chapters.length > 0) {
    const { error: chErr } = await supabase
      .from(CHAPTERS as never)
      .insert(
        input.chapters.map((c) => ({ ...c, piece_id: pieceId })) as never,
      );
    if (chErr) {
      // Roll back the piece row so we don't leave an empty husk.
      await supabase.from(PIECES as never).delete().eq("id", pieceId);
      throw new Error(`createDraftPiece chapters failed: ${chErr.message}`);
    }
  }

  if (input.sources && input.sources.length > 0) {
    const sourceRows = input.sources.map((s, i) => ({
      piece_id: pieceId,
      ord: s.ord ?? i,
      url: s.url,
      title: s.title ?? null,
      author: s.author ?? null,
      source_type: s.source_type ?? null,
      excerpt: s.excerpt ?? null,
    }));
    const { error: srcErr } = await supabase
      .from(SOURCES as never)
      .insert(sourceRows as never);
    if (srcErr) {
      // Sources are non-essential. Log and keep the piece.
      console.warn("createDraftPiece sources failed:", srcErr.message);
    }
  }

  return piece as unknown as LearnPiece;
}

/** Marks a draft as published. Sets published_at to now() unless
 * already set. Returns the updated row, or null on failure. */
export async function publishPiece(id: string): Promise<LearnPiece | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(PIECES as never)
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      console.warn("publishPiece failed:", error?.message);
      return null;
    }
    return data as unknown as LearnPiece;
  } catch (err) {
    console.warn("publishPiece threw:", err);
    return null;
  }
}

/** Reverts a piece to draft. Useful if a published piece needs
 * pulling. Doesn't clear published_at, so we preserve "first published"
 * history for analytics. */
export async function unpublishPiece(id: string): Promise<LearnPiece | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(PIECES as never)
      .update({
        status: "draft",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      console.warn("unpublishPiece failed:", error?.message);
      return null;
    }
    return data as unknown as LearnPiece;
  } catch (err) {
    console.warn("unpublishPiece threw:", err);
    return null;
  }
}

/** Updates piece metadata (title, excerpt, topic, etc.). Body
 * edits go through updateChapter so we don't accidentally clobber
 * the body when we meant to edit the title. */
export async function updatePieceMeta(
  id: string,
  patch: Partial<Pick<LearnPiece, "title" | "excerpt" | "topic" | "subtopic" | "level" | "cover_emoji" | "read_minutes">>,
): Promise<LearnPiece | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(PIECES as never)
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      console.warn("updatePieceMeta failed:", error?.message);
      return null;
    }
    return data as unknown as LearnPiece;
  } catch (err) {
    console.warn("updatePieceMeta threw:", err);
    return null;
  }
}

/** Replaces a chapter's body. Updates the chapter's updated_at +
 * cascades to the piece's updated_at so the admin list resorts. */
export async function updateChapterBody(
  chapterId: string,
  bodyMd: string,
): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const supabase = getSupabaseAdminClient();
    const { data: ch, error: chErr } = await supabase
      .from(CHAPTERS as never)
      .update({ body_md: bodyMd, updated_at: new Date().toISOString() } as never)
      .eq("id", chapterId)
      .select("piece_id")
      .single();
    if (chErr || !ch) {
      console.warn("updateChapterBody failed:", chErr?.message);
      return false;
    }
    const pieceId = (ch as unknown as { piece_id: string }).piece_id;
    await supabase
      .from(PIECES as never)
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", pieceId);
    return true;
  } catch (err) {
    console.warn("updateChapterBody threw:", err);
    return false;
  }
}

/** Appends a new chapter to a piece. Computes the next ord by
 * MAX(ord)+1 so the new chapter lands at the end. Slug is uniqued
 * within the piece (collision → slug-2, slug-3, ...). */
export async function addChapter(input: {
  pieceId: string;
  title: string;
  slug: string;
  bodyMd?: string;
}): Promise<LearnChapter | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data: existing } = await supabase
      .from(CHAPTERS as never)
      .select("ord, slug")
      .eq("piece_id", input.pieceId);
    const rows = (existing ?? []) as unknown as Array<{ ord: number; slug: string }>;
    const nextOrd = rows.length === 0
      ? 0
      : Math.max(...rows.map((r) => r.ord)) + 1;
    const taken = new Set(rows.map((r) => r.slug));
    let slug = input.slug;
    let n = 2;
    while (taken.has(slug)) {
      slug = `${input.slug}-${n}`;
      n += 1;
    }
    const { data, error } = await supabase
      .from(CHAPTERS as never)
      .insert({
        piece_id: input.pieceId,
        ord: nextOrd,
        slug,
        title: input.title,
        body_md: input.bodyMd ?? "",
      } as never)
      .select("*")
      .single();
    if (error || !data) {
      console.warn("addChapter failed:", error?.message);
      return null;
    }
    await supabase
      .from(PIECES as never)
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", input.pieceId);
    return data as unknown as LearnChapter;
  } catch (err) {
    console.warn("addChapter threw:", err);
    return null;
  }
}

/** Removes a chapter. The piece keeps its other chapters; ord values
 * are NOT renumbered (gaps are tolerated by the reader, prev/next
 * just orders by ord asc). */
export async function deleteChapter(chapterId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const supabase = getSupabaseAdminClient();
    const { data: ch } = await supabase
      .from(CHAPTERS as never)
      .select("piece_id")
      .eq("id", chapterId)
      .single();
    const pieceId = (ch as unknown as { piece_id?: string } | null)?.piece_id;
    const { error } = await supabase
      .from(CHAPTERS as never)
      .delete()
      .eq("id", chapterId);
    if (error) {
      console.warn("deleteChapter failed:", error.message);
      return false;
    }
    if (pieceId) {
      await supabase
        .from(PIECES as never)
        .update({ updated_at: new Date().toISOString() } as never)
        .eq("id", pieceId);
    }
    return true;
  } catch (err) {
    console.warn("deleteChapter threw:", err);
    return false;
  }
}

/** Hard-deletes a piece + cascade-deletes chapters/sources via FK.
 * Use with care: for accidentally-created drafts, not for retiring
 * published pieces (use unpublishPiece for those). */
export async function deletePiece(id: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from(PIECES as never)
      .delete()
      .eq("id", id);
    if (error) {
      console.warn("deletePiece failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("deletePiece threw:", err);
    return false;
  }
}
