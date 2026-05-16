import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  applyUpdateAndRestart,
  checkForUpdatesOnLaunch,
  consumePendingUpdate,
  type PendingUpdate,
  type UpdateProgress,
} from "./updater";

// v0.1.6+ update flow (consent-first, policy-safe):
//   1. Quietly check for updates 4s after launch.
//   2. If one is found, show a small bottom-right banner asking the
//      user "Update v0.1.x available — Install now / Later".
//   3. Only AFTER the user clicks Install do we sweep other windows
//      out of the way and run the splash-style download takeover.
//   4. Once the new build is ready, restart automatically (the user
//      already consented, so no second confirmation).
// "Later" dismisses for this session; we'll ask again next launch.
export function UpdateLayer() {
  const [progress, setProgress] = useState<UpdateProgress>({ kind: "idle" });
  const [whatsNew, setWhatsNew] = useState<PendingUpdate | null>(null);
  const [consented, setConsented] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Kick the once-per-launch update check ~4s after launch.
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

  // Show the splash takeover only AFTER the user consents. Before
  // consent we just show a small ask-permission banner.
  const showOverlay =
    consented &&
    (progress.kind === "downloading" || progress.kind === "ready");

  // Sweep other windows out of the way the moment the splash
  // takeover starts (post-consent only).
  useEffect(() => {
    if (showOverlay) {
      void invoke("minimize_other_windows").catch(() => {});
    }
  }, [showOverlay]);

  // Once consented + the build is ready, auto-restart. The user
  // already approved this; no second prompt.
  useEffect(() => {
    if (consented && progress.kind === "ready") {
      const t = setTimeout(() => {
        void applyUpdateAndRestart();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [consented, progress.kind]);

  const consentVisible =
    !consented &&
    !dismissed &&
    (progress.kind === "found" ||
      progress.kind === "downloading" ||
      progress.kind === "ready");

  return (
    <>
      {consentVisible && (
        <UpdateConsentBanner
          progress={progress}
          onAccept={() => setConsented(true)}
          onDismiss={() => setDismissed(true)}
        />
      )}
      {showOverlay && <UpdateSplash progress={progress} />}
      {progress.kind === "error" && <UpdateError progress={progress} />}
      {whatsNew && !showOverlay && (
        <WhatsNewCard pending={whatsNew} onClose={() => setWhatsNew(null)} />
      )}
    </>
  );
}

// Bottom-right consent banner. Shown when an update is available
// before any takeover happens. User clicks Install to accept;
// Later dismisses for this launch.
function UpdateConsentBanner({
  progress,
  onAccept,
  onDismiss,
}: {
  progress: UpdateProgress;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const version =
    progress.kind === "found" ||
    progress.kind === "downloading" ||
    progress.kind === "ready"
      ? progress.version
      : "";
  const notes =
    progress.kind === "found" ||
    progress.kind === "downloading" ||
    progress.kind === "ready"
      ? progress.notes
      : "";

  return (
    <div className="upd-banner upd-banner--found" role="status">
      <div className="upd-banner-body">
        <strong>Update available</strong>
        <span className="upd-banner-version">
          v{version} — install now to take effect
        </span>
        {notes && (
          <span className="upd-banner-notes" title={notes}>
            {notes.length > 80 ? notes.slice(0, 80) + "…" : notes}
          </span>
        )}
        <span className="upd-banner-hint">
          Closing with X just hides the window. To apply this update later,
          press <kbd>Ctrl</kbd> + <kbd>Q</kbd> to fully quit, then relaunch VRAELIS.
        </span>
      </div>
      <div className="upd-banner-actions">
        <button
          type="button"
          className="upd-banner-btn"
          onClick={onAccept}
        >
          Install
        </button>
        <button
          type="button"
          className="upd-banner-x"
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Later — Ctrl+Q + relaunch installs this update on next launch."
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Full-screen splash for the update flow. Same visual language as
// the launcher splash so it feels like a native OS event, not an
// in-app modal. No close button — focus is forced until the install
// finishes and the app relaunches itself.
function UpdateSplash({ progress }: { progress: UpdateProgress }) {
  const version =
    progress.kind === "found" ||
    progress.kind === "downloading" ||
    progress.kind === "ready"
      ? progress.version
      : "";

  let label = "Preparing update";
  let pct = 0;
  if (progress.kind === "found") {
    label = `Update v${version} found`;
    pct = 4;
  } else if (progress.kind === "downloading") {
    label = `Downloading v${version} · ${Math.round(progress.pct)}%`;
    pct = Math.max(4, progress.pct);
  } else if (progress.kind === "ready") {
    label = "Restarting into the new version";
    pct = 100;
  }

  return (
    <div className="upd-splash" role="dialog" aria-modal="true" aria-label="Updating VRAELIS">
      <div className="upd-splash-frame" />

      <div className="upd-splash-brand">
        <h1 className="upd-splash-wordmark">VRAELIS</h1>
        <p className="upd-splash-tagline">Updating in place. Don't close the app.</p>
        <div className="upd-splash-spotlight" />
      </div>

      <div className="upd-splash-footer">
        <div className="upd-splash-status">
          <span className="upd-splash-dot" />
          <span>{label}</span>
        </div>
        <div className="upd-splash-build">
          v{version || "—"} · VRAELIS-1 · auto-update
        </div>
      </div>

      <div className="upd-splash-progress">
        <div
          className="upd-splash-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Compact corner pill — only used when the update process actually
// errored. Lets the user dismiss + try again next launch. The
// happy-path flow never shows this.
function UpdateError({ progress }: { progress: UpdateProgress }) {
  if (progress.kind !== "error") return null;
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="upd-banner upd-banner--error" role="status">
      <div className="upd-banner-body">
        <strong>Update failed</strong>
        <span className="upd-banner-version">{progress.message}</span>
      </div>
      <div className="upd-banner-actions">
        <button
          type="button"
          className="upd-banner-x"
          onClick={() => setHidden(true)}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Centered overlay shown once after a successful update. Same as
// before — only fires on the first launch into the new version.
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
        <h2 className="whats-new-title">VRAELIS v{pending.version} is here</h2>
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
