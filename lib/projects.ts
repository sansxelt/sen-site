// Projects + pinned-context layer (v0.2.0 memory wedge).
//
// Schema: docs/v0.2.0-projects.sql. Every helper fails open
// (returns null / empty) when the migration hasn't been applied or
// Supabase is transiently down, same convention as lib/chat-history
// and lib/contributors. The chat route reads these to assemble the
// system message; the UI reads them to render the project sidebar
// and side panel.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export type Project = {
  id: string;
  owner_email: string;
  name: string;
  description: string | null;
  goals: string | null;
  created_at: string;
  updated_at: string;
};

// v0.2.0 phase G+ — pinned items split by kind:
//  - "context": auto-injected into the chat's system prompt (the
//    original memory-wedge behavior).
//  - "prompt":  a one-click saved prompt the user fires from the
//    project panel; runs as a Duel turn on click. NOT injected into
//    the system prompt.
// Migration in docs/v0.2.0-duel-projects.sql defaults existing rows
// to 'context' so older data behaves the same.
export type PinKind = "context" | "prompt";

export type ProjectPinnedItem = {
  id: string;
  project_id: string;
  label: string | null;
  content: string;
  ord: number;
  kind: PinKind;
  created_at: string;
  updated_at: string;
};

export type ProjectWithPins = Project & {
  pinned: ProjectPinnedItem[];
};

const PROJECTS = "projects";
const PINS = "project_pinned_items";

// --- Reads -----------------------------------------------------

export async function listProjectsForOwner(email: string): Promise<Project[]> {
  if (!email || !isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(PROJECTS as never)
      .select("*")
      .eq("owner_email", email.toLowerCase())
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error || !data) return [];
    return data as unknown as Project[];
  } catch {
    return [];
  }
}

export async function getProjectWithPins(
  email: string,
  projectId: string,
): Promise<ProjectWithPins | null> {
  if (!email || !projectId || !isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data: project, error: pErr } = await supabase
      .from(PROJECTS as never)
      .select("*")
      .eq("id", projectId)
      .eq("owner_email", email.toLowerCase())
      .maybeSingle();
    if (pErr || !project) return null;
    const { data: pins } = await supabase
      .from(PINS as never)
      .select("*")
      .eq("project_id", projectId)
      .order("ord", { ascending: true });
    return {
      ...(project as unknown as Project),
      pinned: ((pins ?? []) as unknown as ProjectPinnedItem[]),
    };
  } catch {
    return null;
  }
}

/** Returns just the pin rows for a project. Used by the chat route
 * when injecting context, where we already trust the thread's
 * project_id and don't need to re-check ownership. */
export async function listPinsForProject(
  projectId: string,
): Promise<ProjectPinnedItem[]> {
  if (!projectId || !isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(PINS as never)
      .select("*")
      .eq("project_id", projectId)
      .order("ord", { ascending: true });
    if (error || !data) return [];
    return data as unknown as ProjectPinnedItem[];
  } catch {
    return [];
  }
}

// --- Writes ----------------------------------------------------

export async function createProject(input: {
  email: string;
  name: string;
  description?: string;
  goals?: string;
}): Promise<Project | null> {
  if (!isDatabaseConfigured() || !input.email || !input.name.trim()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(PROJECTS as never)
      .insert({
        owner_email: input.email.toLowerCase(),
        name: input.name.trim().slice(0, 80),
        description: input.description?.trim() || null,
        goals: input.goals?.trim() || null,
      } as never)
      .select("*")
      .single();
    if (error || !data) return null;
    return data as unknown as Project;
  } catch {
    return null;
  }
}

export async function updateProject(input: {
  email: string;
  projectId: string;
  patch: { name?: string; description?: string | null; goals?: string | null };
}): Promise<Project | null> {
  if (!isDatabaseConfigured() || !input.email || !input.projectId) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof input.patch.name === "string") {
      const trimmed = input.patch.name.trim();
      if (!trimmed) return null;
      update.name = trimmed.slice(0, 80);
    }
    if (input.patch.description !== undefined) {
      update.description = input.patch.description?.toString().trim() || null;
    }
    if (input.patch.goals !== undefined) {
      update.goals = input.patch.goals?.toString().trim() || null;
    }
    const { data, error } = await supabase
      .from(PROJECTS as never)
      .update(update as never)
      .eq("id", input.projectId)
      .eq("owner_email", input.email.toLowerCase())
      .select("*")
      .single();
    if (error || !data) return null;
    return data as unknown as Project;
  } catch {
    return null;
  }
}

export async function deleteProject(input: {
  email: string;
  projectId: string;
}): Promise<boolean> {
  if (!isDatabaseConfigured() || !input.email || !input.projectId) return false;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from(PROJECTS as never)
      .delete()
      .eq("id", input.projectId)
      .eq("owner_email", input.email.toLowerCase());
    return !error;
  } catch {
    return false;
  }
}

export async function addPin(input: {
  email: string;
  projectId: string;
  label?: string;
  content: string;
  kind?: PinKind;
}): Promise<ProjectPinnedItem | null> {
  if (!isDatabaseConfigured() || !input.email || !input.projectId) return null;
  if (!input.content?.trim()) return null;
  const kind: PinKind = input.kind === "prompt" ? "prompt" : "context";
  try {
    const supabase = getSupabaseAdminClient();
    // Verify ownership before insert. Without this, a user could
    // post pins to a project they don't own by guessing the id.
    const { data: project } = await supabase
      .from(PROJECTS as never)
      .select("id")
      .eq("id", input.projectId)
      .eq("owner_email", input.email.toLowerCase())
      .maybeSingle();
    if (!project) return null;

    // Pick the next ord (max + 1) within this kind so prompt and
    // context pins keep separate orderings.
    const { data: existing } = await supabase
      .from(PINS as never)
      .select("ord")
      .eq("project_id", input.projectId)
      .eq("kind", kind);
    const rows = (existing ?? []) as unknown as Array<{ ord: number }>;
    const nextOrd = rows.length === 0
      ? 0
      : Math.max(...rows.map((r) => r.ord)) + 1;

    const { data, error } = await supabase
      .from(PINS as never)
      .insert({
        project_id: input.projectId,
        label: input.label?.trim() || null,
        content: input.content.trim(),
        ord: nextOrd,
        kind,
      } as never)
      .select("*")
      .single();
    if (error || !data) return null;
    // Bump project updated_at so it sorts to the top.
    await supabase
      .from(PROJECTS as never)
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", input.projectId);
    return data as unknown as ProjectPinnedItem;
  } catch {
    return null;
  }
}

export async function updatePin(input: {
  email: string;
  pinId: string;
  patch: { label?: string | null; content?: string };
}): Promise<ProjectPinnedItem | null> {
  if (!isDatabaseConfigured() || !input.email || !input.pinId) return null;
  try {
    const supabase = getSupabaseAdminClient();
    // Ownership check via the pin's project.
    const { data: pin } = await supabase
      .from(PINS as never)
      .select("id, project_id, projects:project_id (owner_email)")
      .eq("id", input.pinId)
      .maybeSingle();
    const ownerEmail = (
      pin as unknown as { projects?: { owner_email?: string } } | null
    )?.projects?.owner_email;
    if (!ownerEmail || ownerEmail.toLowerCase() !== input.email.toLowerCase()) {
      return null;
    }
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.patch.label !== undefined) {
      update.label = input.patch.label?.toString().trim() || null;
    }
    if (typeof input.patch.content === "string") {
      const trimmed = input.patch.content.trim();
      if (!trimmed) return null;
      update.content = trimmed;
    }
    const { data, error } = await supabase
      .from(PINS as never)
      .update(update as never)
      .eq("id", input.pinId)
      .select("*")
      .single();
    if (error || !data) return null;
    return data as unknown as ProjectPinnedItem;
  } catch {
    return null;
  }
}

export async function deletePin(input: {
  email: string;
  pinId: string;
}): Promise<boolean> {
  if (!isDatabaseConfigured() || !input.email || !input.pinId) return false;
  try {
    const supabase = getSupabaseAdminClient();
    const { data: pin } = await supabase
      .from(PINS as never)
      .select("id, projects:project_id (owner_email)")
      .eq("id", input.pinId)
      .maybeSingle();
    const ownerEmail = (
      pin as unknown as { projects?: { owner_email?: string } } | null
    )?.projects?.owner_email;
    if (!ownerEmail || ownerEmail.toLowerCase() !== input.email.toLowerCase()) {
      return false;
    }
    const { error } = await supabase
      .from(PINS as never)
      .delete()
      .eq("id", input.pinId);
    return !error;
  } catch {
    return false;
  }
}

// --- System-message assembly ----------------------------------

/** Builds the project-context block injected into the chat system
 * message. Order: project name + description, goals, pinned items
 * (each labeled). Returns empty string when there's nothing to add
 * so callers can concatenate without conditional whitespace. */
export function buildProjectContextBlock(input: {
  project: Project | null;
  pins: ProjectPinnedItem[];
}): string {
  const { project, pins } = input;
  if (!project) return "";
  const parts: string[] = [];
  parts.push(`# Project: ${project.name}`);
  if (project.description?.trim()) {
    parts.push(`Description: ${project.description.trim()}`);
  }
  if (project.goals?.trim()) {
    parts.push(`Goals: ${project.goals.trim()}`);
  }
  // Only "context" pins get auto-injected. "prompt" pins are
  // user-clickable shortcuts (fired from the project panel) and
  // would just bloat the system prompt if injected as memory.
  const contextPins = pins.filter((p) => (p.kind ?? "context") === "context");
  if (contextPins.length > 0) {
    parts.push("Pinned context:");
    for (const pin of contextPins) {
      const label = pin.label?.trim();
      const head = label ? `- [${label}]` : "-";
      parts.push(`${head} ${pin.content.trim()}`);
    }
  }
  return parts.join("\n\n");
}

/** Rough token estimate. 1 token ≈ 4 chars for English text, good
 * enough for a UI counter; actual billing uses the real tokenizer
 * server-side. Keep this in sync with the badge in the chat input. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
