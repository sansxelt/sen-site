import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import "./App.css";
import {
  beginSignInFlow,
  clearSession,
  type DesktopSession,
  onSansxelDeepLink,
  redeemRequest,
  restoreSession,
  saveSession,
  validateToken,
} from "./auth";
import { Workspace } from "./workspace";
import { PreferencesProvider } from "./preferences";
import { UpdateLayer } from "./update-ui";

type AuthStatus =
  | { kind: "loading" }
  | { kind: "signed-out"; signingIn: boolean; error: string | null }
  | { kind: "signed-in"; session: DesktopSession };

function App() {
  const [auth, setAuth] = useState<AuthStatus>({ kind: "loading" });
  const pendingRequestId = useRef<string | null>(null);

  // Update lifecycle (banner + what's new) is owned by <UpdateLayer />
  // mounted once below the workspace. It handles the launch-time
  // check, download progress, and the post-relaunch "what's new"
  // card on its own.

  // On mount: try to restore an existing session, then subscribe to
  // deep-link callbacks for fresh sign-ins.
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    (async () => {
      const restored = await restoreSession();
      if (cancelled) return;
      setAuth(
        restored
          ? { kind: "signed-in", session: restored }
          : { kind: "signed-out", signingIn: false, error: null },
      );

      // Tell the splash we're ready so it can hand over without
      // leaving a black gap. Splash polls is_main_ready and waits
      // for this before closing itself.
      void invoke("notify_main_ready").catch(() => {});

      unlisten = await onSansxelDeepLink(async (requestId) => {
        if (
          pendingRequestId.current &&
          pendingRequestId.current !== requestId
        ) {
          return;
        }
        pendingRequestId.current = null;
        try {
          const { token, email } = await redeemRequest(requestId);
          await saveSession(token, email);
          const validated = await validateToken(token);
          setAuth({
            kind: "signed-in",
            session: {
              token,
              email,
              displayName: validated?.display_name ?? null,
            },
          });
        } catch (err) {
          setAuth({
            kind: "signed-out",
            signingIn: false,
            error:
              err instanceof Error ? err.message : String(err) || "Sign-in failed.",
          });
        }
      });
    })();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  const handleSignIn = useCallback(async () => {
    setAuth({ kind: "signed-out", signingIn: true, error: null });
    try {
      const requestId = await beginSignInFlow();
      pendingRequestId.current = requestId;
    } catch (err) {
      setAuth({
        kind: "signed-out",
        signingIn: false,
        error:
          err instanceof Error ? err.message : String(err) || "Could not start sign-in.",
      });
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await clearSession();
    pendingRequestId.current = null;
    setAuth({ kind: "signed-out", signingIn: false, error: null });
  }, []);

  if (auth.kind === "signed-in") {
    return (
      <PreferencesProvider token={auth.session.token}>
        <div className="stage stage--workspace">
          <TitleBar />
          <Workspace session={auth.session} onSignOut={handleSignOut} />
        </div>
        <UpdateLayer />
      </PreferencesProvider>
    );
  }

  return (
    <div className="stage">
      <TitleBar />
      <SignedOutShell auth={auth} onSignIn={handleSignIn} />
      <UpdateLayer />
    </div>
  );
}

// Custom borderless title bar — drag region across the whole strip,
// sansxel mark + window controls on the right. Native chrome is
// disabled in tauri.conf.json (decorations: false).
function TitleBar() {
  const [maxed, setMaxed] = useState(false);

  useEffect(() => {
    const w = getCurrentWindow();
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        setMaxed(await w.isMaximized());
        const u = await w.onResized(async () => {
          setMaxed(await w.isMaximized());
        });
        unlisten = u;
      } catch {
        // No-op: dev preview / non-Tauri host
      }
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const min = useCallback(() => {
    void getCurrentWindow().minimize();
  }, []);
  const toggle = useCallback(() => {
    void getCurrentWindow().toggleMaximize();
  }, []);
  const close = useCallback(() => {
    // v0.1.9: hide the window instead of destroying it. The app stays
    // running in the background; re-launching sansxel from start menu /
    // taskbar bumps single-instance which re-shows the same window.
    // If users actually want to quit they Ctrl+Q (handled below).
    void getCurrentWindow().hide();
  }, []);

  // Ctrl+Q quits the app entirely (vs the X which just hides).
  // v0.1.12 fix: getCurrentWindow().close() only destroys the main
  // webview \u2014 the splash and floating-copilot windows kept the Tauri
  // process alive, so re-launching after Ctrl+Q hit the single-instance
  // guard but found no window to focus, leaving sansxel "open" with no
  // UI until the user killed it via Task Manager. plugin-process.exit()
  // terminates the entire process cleanly so the next launch starts fresh.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "q") {
        event.preventDefault();
        void exit(0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand" data-tauri-drag-region>
        <img src="/icon.png" alt="" className="titlebar-brand-icon" />
        <span className="titlebar-brand-name">sansxel</span>
      </div>
      <div className="titlebar-spacer" data-tauri-drag-region />
      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-btn"
          onClick={min}
          aria-label="Minimize"
          title="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M0 5 H10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          type="button"
          className="titlebar-btn"
          onClick={toggle}
          aria-label={maxed ? "Restore" : "Maximize"}
          title={maxed ? "Restore" : "Maximize"}
        >
          {maxed ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="2.5" width="6" height="6" stroke="currentColor" strokeWidth="1" fill="none" />
              <rect x="2.5" y="0.5" width="6" height="6" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="titlebar-btn titlebar-btn--close"
          onClick={close}
          aria-label="Close"
          title="Hide window — sansxel keeps running. Ctrl+Q to fully quit (and to install pending updates)."
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SignedOutShell({
  auth,
  onSignIn,
}: {
  auth: Exclude<AuthStatus, { kind: "signed-in" }>;
  onSignIn: () => void;
}) {
  return (
    <div className="main">
      <header className="main-header">
        <div className="main-brand">
          <div className="main-brand-icon">
            <img src="/icon.png" alt="" />
          </div>
          <span className="main-brand-name">sansxel</span>
          <span className="main-brand-sub">desktop</span>
        </div>
        <SignInControl auth={auth} onSignIn={onSignIn} />
      </header>

      <div className="main-body">
        <div className="main-empty">
          <h1>{auth.kind === "loading" ? "Checking your session…" : "Workspace coming online."}</h1>
          <p>
            {auth.kind === "loading"
              ? "Looking for a saved sign-in on this machine."
              : auth.kind === "signed-out" && auth.signingIn
                ? "Approve sansxel desktop in the browser tab that just opened."
                : "Sign in to connect this desktop to your sansxel.ai account."}
          </p>
        </div>
      </div>
    </div>
  );
}

function SignInControl({
  auth,
  onSignIn,
}: {
  auth: Exclude<AuthStatus, { kind: "signed-in" }>;
  onSignIn: () => void;
}) {
  if (auth.kind === "loading") {
    return <span className="main-auth-pill main-auth-pill--muted">Checking session…</span>;
  }

  return (
    <div className="main-auth-row">
      {auth.error && <span className="main-auth-error">{auth.error}</span>}
      <button
        type="button"
        onClick={onSignIn}
        disabled={auth.signingIn}
        className="main-signin-btn"
      >
        <span className="main-signin-dot" />
        {auth.signingIn ? "Waiting for browser…" : "Sign in"}
      </button>
    </div>
  );
}

export default App;
