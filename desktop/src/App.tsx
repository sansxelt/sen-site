import { useCallback, useEffect, useRef, useState } from "react";
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
import { NotesWorkspace } from "./notes-workspace";

type AuthStatus =
  | { kind: "loading" }
  | { kind: "signed-out"; signingIn: boolean; error: string | null }
  | { kind: "signed-in"; session: DesktopSession };

function App() {
  const [auth, setAuth] = useState<AuthStatus>({ kind: "loading" });
  const pendingRequestId = useRef<string | null>(null);

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
      <div className="stage stage--workspace">
        <NotesWorkspace session={auth.session} onSignOut={handleSignOut} />
      </div>
    );
  }

  return (
    <div className="stage">
      <SignedOutShell auth={auth} onSignIn={handleSignIn} />
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
