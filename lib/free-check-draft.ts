// Shared contract for the "free check" handoff: the public entry page stashes a draft,
// the visitor signs up, and the in-app new-check form consumes it once and auto-fills.
// localStorage keeps it alive across the same-tab signin round-trip (email/password or
// OAuth). Best-effort UX only — if it doesn't survive (e.g. a different device), the user
// simply pastes again. No server trust: the draft is re-validated by /api/v/check anyway.

export const FREE_CHECK_DRAFT_KEY = "vraelis:free-check-draft";
const MAX_AGE_MS = 60 * 60 * 1000; // 1h; a stale draft is ignored
const MAX_TEXT = 8000;             // matches MAX_TEXT_CHARS in lib/v-checks
const MAX_CANDIDATES = 8;          // matches MAX_CANDIDATES in lib/v-checks

export type FreeCheckDraft = { outputType: string; candidates: string[]; title?: string; ts: number };

function cleanCandidates(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    .map((c) => c.slice(0, MAX_TEXT))
    .slice(0, MAX_CANDIDATES);
}

export function stashFreeCheckDraft(d: { outputType: string; candidates: string[]; title?: string }): void {
  try {
    const candidates = cleanCandidates(d.candidates);
    if (!candidates.length) return;
    localStorage.setItem(FREE_CHECK_DRAFT_KEY, JSON.stringify({
      outputType: d.outputType,
      candidates,
      title: d.title ? String(d.title).slice(0, 140) : undefined,
      ts: Date.now(),
    }));
  } catch { /* private mode / no storage — the flow still works, just no prefill */ }
}

// Read AND delete the draft (consume once, so a refresh never re-fills or re-runs).
// Returns null if absent, malformed, or older than MAX_AGE_MS.
export function takeFreeCheckDraft(): FreeCheckDraft | null {
  try {
    const raw = localStorage.getItem(FREE_CHECK_DRAFT_KEY);
    if (!raw) return null;
    localStorage.removeItem(FREE_CHECK_DRAFT_KEY);
    const d = JSON.parse(raw) as Partial<FreeCheckDraft> | null;
    if (!d || typeof d !== "object") return null;
    if (typeof d.ts !== "number" || Date.now() - d.ts > MAX_AGE_MS) return null;
    const candidates = cleanCandidates(d.candidates);
    if (!candidates.length) return null;
    return {
      outputType: typeof d.outputType === "string" ? d.outputType : "other",
      candidates,
      title: typeof d.title === "string" ? d.title.slice(0, 140) : undefined,
      ts: d.ts,
    };
  } catch { return null; }
}
