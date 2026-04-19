import { useEffect, useState } from "react";
import {
  applyUpdateAndRestart,
  checkForUpdatesOnLaunch,
  consumePendingUpdate,
  type PendingUpdate,
  type UpdateProgress,
} from "./updater";

// Owns the whole user-visible update flow: kicks the once-per-launch
// check, renders the bottom-right banner, and surfaces the
// "what's new" card on the first run after an update applies.
export function UpdateLayer() {
  const [progress, setProgress] = useState<UpdateProgress>({ kind: "idle" });
  const [whatsNew, setWhatsNew] = useState<PendingUpdate | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Check for updates 4s after launch. Surface state via callback.
  useEffect(() => {
    const t = setTimeout(() => {
      void checkForUpdatesOnLaunch(setProgress);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  // First mount: did we just relaunch into a new version?
  useEffect(() => {
    const pending = consumePendingUpdate();
    if (pending) setWhatsNew(pending);
  }, []);

  return (
    <>
      {!bannerDismissed && progress.kind !== "idle" && (
        <UpdateBanner
          progress={progress}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
      {whatsNew && (
        <WhatsNewCard
          pending={whatsNew}
          onClose={() => setWhatsNew(null)}
        />
      )}
    </>
  );
}

// Bottom-right banner. Stays visible through the download + ready
// states, then can be dismissed.
function UpdateBanner({
  progress,
  onDismiss,
}: {
  progress: UpdateProgress;
  onDismiss: () => void;
}) {
  if (progress.kind === "idle") return null;

  let body: React.ReactNode = null;
  let action: React.ReactNode = null;
  let kind = "found";

  if (progress.kind === "found") {
    kind = "found";
    body = (
      <>
        <strong>Update available</strong>
        <span className="upd-banner-version">v{progress.version}</span>
      </>
    );
  } else if (progress.kind === "downloading") {
    kind = "downloading";
    body = (
      <>
        <strong>Downloading update…</strong>
        <span className="upd-banner-version">
          v{progress.version} · {Math.round(progress.pct)}%
        </span>
      </>
    );
  } else if (progress.kind === "ready") {
    kind = "ready";
    body = (
      <>
        <strong>Update ready</strong>
        <span className="upd-banner-version">v{progress.version}</span>
      </>
    );
    action = (
      <button
        type="button"
        className="upd-banner-btn"
        onClick={() => void applyUpdateAndRestart()}
      >
        Restart now
      </button>
    );
  } else if (progress.kind === "error") {
    kind = "error";
    body = (
      <>
        <strong>Update failed</strong>
        <span className="upd-banner-version">{progress.message}</span>
      </>
    );
  }

  return (
    <div className={`upd-banner upd-banner--${kind}`} role="status">
      <div className="upd-banner-body">{body}</div>
      <div className="upd-banner-actions">
        {action}
        <button
          type="button"
          className="upd-banner-x"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      {progress.kind === "downloading" && (
        <div className="upd-banner-bar">
          <div
            className="upd-banner-bar-fill"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Centered overlay shown once after a successful update.
function WhatsNewCard({
  pending,
  onClose,
}: {
  pending: PendingUpdate;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="whats-new-overlay" onClick={onClose}>
      <div
        className="whats-new"
        role="dialog"
        aria-label="What's new"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="whats-new-tag">Updated</div>
        <h2 className="whats-new-title">sansxel v{pending.version} is here</h2>
        <p className="whats-new-sub">
          The app updated in the background. Here's what changed:
        </p>
        <div className="whats-new-notes">
          {pending.notes ? (
            <pre>{pending.notes}</pre>
          ) : (
            <p>Bug fixes and improvements.</p>
          )}
        </div>
        <div className="whats-new-actions">
          <button
            type="button"
            onClick={onClose}
            className="whats-new-btn"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
