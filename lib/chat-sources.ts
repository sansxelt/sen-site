import { randomBytes } from "node:crypto";
import { getSupabaseAdminClient } from "./supabase-admin";

// v0.1.4 scaffold — uploaded reference materials the user can attach
// to a chat turn. PDF parsing is deferred to v0.1.5; for now we only
// store the raw filename + body for plain-text uploads.

export type ChatSource = {
  id: string;
  owner_email: string;
  title: string;
  body: string;
  byte_size: number;
  created_at: string;
};

const SOURCE_COLUMNS =
  "id, owner_email, title, body, byte_size, created_at";

export function makeSourceId(): string {
  return `src_${randomBytes(9).toString("base64url")}`;
}

export async function listSourcesForEmail(
  email: string,
): Promise<ChatSource[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_sources" as never)
    .select(SOURCE_COLUMNS)
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ChatSource[];
}

export async function createSource(
  email: string,
  init: { title: string; body: string; byte_size: number },
): Promise<ChatSource> {
  const supabase = getSupabaseAdminClient();
  const id = makeSourceId();
  const { data, error } = await supabase
    .from("chat_sources" as never)
    .insert([
      {
        id,
        owner_email: email,
        title: init.title.slice(0, 200),
        body: init.body,
        byte_size: init.byte_size,
      },
    ] as never)
    .select(SOURCE_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as ChatSource;
}

export async function deleteSource(
  email: string,
  id: string,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_sources" as never)
    .delete()
    .eq("id", id)
    .eq("owner_email", email)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function fetchSourcesByIds(
  email: string,
  ids: string[],
): Promise<ChatSource[]> {
  if (ids.length === 0) return [];
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_sources" as never)
    .select(SOURCE_COLUMNS)
    .eq("owner_email", email)
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as unknown as ChatSource[];
}

// Cap total injected source context so a user can't blow the model's
// context window by attaching a 200-page PDF. 24k chars ≈ 6k tokens.
const MAX_INJECTED_CHARS = 24000;

export function buildReferenceBlock(sources: ChatSource[]): string {
  if (sources.length === 0) return "";
  const parts: string[] = ["Reference materials:"];
  let used = 0;
  for (const source of sources) {
    const header = `=== ${source.title} ===\n`;
    const remaining = MAX_INJECTED_CHARS - used - header.length;
    if (remaining <= 200) break;
    const body = source.body.slice(0, remaining);
    parts.push(`${header}${body}\n`);
    used += header.length + body.length + 1;
  }
  return parts.join("\n");
}
