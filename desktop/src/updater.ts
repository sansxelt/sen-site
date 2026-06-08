import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Update state machine — surfaces visible UI events the App can
// listen to. The previous version downloaded + relaunched silently;
// users had no idea anything happened. Now there are real beats:
//
//   idle    → no update
//   found   → "Update v0.2.0 found"
//   downloading (with progress %)
//   ready   → "Update ready. Restart now / Later"
//   error
//
// On "ready" we cache the version + notes so the post-relaunch
// "what's new" card has something to show.

export type UpdateProgress =
  | { kind: "idle" }
  | { kind: "found"; version: string; notes: string }
  | { kind: "downloading"; version: string; notes: string; pct: number }
  | { kind: "ready"; version: string; notes: string }
  | { kind: "error"; message: string };

const NEW_VERSION_KEY = "Vraelis.update.pending";
const LAST_SEEN_VERSION_KEY = "Vraelis.update.lastSeenVersion";

export type PendingUpdate = {
  version: string;
  notes: string;
  appliedAt: string; // ISO
};

let cachedUpdate: Update | null = null;

export async function checkForUpdatesOnLaunch(
  onProgress: (p: UpdateProgress) => void,
): Promise<void> {
  try {
    const update = await check();
    if (!update) {
      onProgress({ kind: "idle" });
      return;
    }
    cachedUpdate = update;

    const version = update.version;
    const notes = update.body ?? "";

    onProgress({ kind: "found", version, notes });

    let total = 0;
    let downloaded = 0;
    await update.download((event) => {
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? 0;
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          onProgress({
            kind: "downloading",
            version,
            notes,
            pct: total > 0 ? Math.min(100, (downloaded / total) * 100) : 0,
          });
          break;
        case "Finished":
          break;
      }
    });

    // Stash so the post-relaunch UI has the notes to show
    if (typeof window !== "undefined") {
      const pending: PendingUpdate = {
        version,
        notes,
        appliedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(NEW_VERSION_KEY, JSON.stringify(pending));
    }

    onProgress({ kind: "ready", version, notes });
  } catch (err) {
    onProgress({
      kind: "error",
      message: err instanceof Error ? err.message : "Update failed.",
    });
  }
}

// User-driven restart from the "Update ready" banner.
export async function applyUpdateAndRestart(): Promise<void> {
  if (!cachedUpdate) return;
  try {
    await cachedUpdate.install();
    await relaunch();
  } catch (err) {
    console.warn("[VRAELIS-updater] install failed:", err);
  }
}

// Reads + clears any "we just updated" record. Returns the pending
// notes if this launch is the first since an update applied.
export function consumePendingUpdate(): PendingUpdate | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(NEW_VERSION_KEY);
  if (!raw) return null;
  let pending: PendingUpdate;
  try {
    pending = JSON.parse(raw) as PendingUpdate;
  } catch {
    window.localStorage.removeItem(NEW_VERSION_KEY);
    return null;
  }
  // Only show "what's new" once per version
  const lastSeen = window.localStorage.getItem(LAST_SEEN_VERSION_KEY);
  if (lastSeen === pending.version) {
    return null;
  }
  window.localStorage.setItem(LAST_SEEN_VERSION_KEY, pending.version);
  window.localStorage.removeItem(NEW_VERSION_KEY);
  return pending;
}
