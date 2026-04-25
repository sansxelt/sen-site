import { getSupabaseAdminClient } from "./supabase-admin";

export type Note = {
  id: string;
  email: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const NOTE_COLUMNS = "id, email, title, body, created_at, updated_at, deleted_at";

export async function listNotesForEmail(email: string): Promise<Note[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notes" as never)
    .select(NOTE_COLUMNS)
    .eq("email", email)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Note[];
}

export async function createNote(
  email: string,
  title: string,
  body: string,
): Promise<Note> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notes" as never)
    .insert([
      {
        email,
        title: title || "Untitled",
        body: body ?? "",
      },
    ] as never)
    .select(NOTE_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as Note;
}

export async function updateNote(
  email: string,
  id: string,
  patch: { title?: string; body?: string },
): Promise<Note | null> {
  const supabase = getSupabaseAdminClient();

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof patch.title === "string") update.title = patch.title;
  if (typeof patch.body === "string") update.body = patch.body;

  const { data, error } = await supabase
    .from("notes" as never)
    .update(update as never)
    .eq("id", id)
    .eq("email", email)
    .is("deleted_at", null)
    .select(NOTE_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Note) ?? null;
}

export async function softDeleteNote(
  email: string,
  id: string,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notes" as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("email", email)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function getNoteById(
  email: string,
  id: string,
): Promise<Note | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notes" as never)
    .select(NOTE_COLUMNS)
    .eq("id", id)
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Note) ?? null;
}
