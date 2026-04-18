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
        // Only honor the deep-link if we kicked off this request
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

  return (
    <div className="stage">
      <MainShell auth={auth} onSignIn={handleSignIn} onSignOut={handleSignOut} />
    </div>
  );
}

function MainShell({
  auth,
  onSignIn,
  onSignOut,
}: {
  auth: AuthStatus;
  onSignIn: () => void;
  onSignOut: () => void;
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
        <AuthControl auth={auth} onSignIn={onSignIn} onSignOut={onSignOut} />
      </header>

      <div className="main-body">
        <div className="main-empty">
          <h1>{authBodyTitle(auth)}</h1>
          <p>{authBodyDetail(auth)}</p>
        </div>
      </div>
    </div>
  );
}

function AuthControl({
  auth,
  onSignIn,
  onSignOut,
}: {
  auth: AuthStatus;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  if (auth.kind === "loading") {
    return <span className="main-auth-pill main-auth-pill--muted">Checking session…</span>;
  }

  if (auth.kind === "signed-in") {
    const label =
      auth.session.displayName ?? auth.session.email.split("@")[0];
    return (
      <div className="main-auth-row">
        <span className="main-auth-pill main-auth-pill--ok">
          <span className="main-auth-dot main-auth-dot--ok" />
          {label}
        </span>
        <button
          type="button"
          onClick={onSignOut}
          className="main-auth-link"
          title={`Signed in as ${auth.session.email}`}
        >
          Sign out
        </button>
      </div>
    );
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

function authBodyTitle(auth: AuthStatus): string {
  if (auth.kind === "signed-in") {
    const first = auth.session.displayName?.split(" ")[0];
    return first ? `Welcome back, ${first}.` : "Welcome back.";
  }
  if (auth.kind === "loading") return "Checking your session…";
  return "Workspace coming online.";
}

function authBodyDetail(auth: AuthStatus): string {
  if (auth.kind === "signed-in") {
    return "Notes, sansxel-1, and the rest of the workspace land in the next iterations. The sign-in foundation is real.";
  }
  if (auth.kind === "loading") {
    return "Looking for a saved sign-in on this machine.";
  }
  if (auth.kind === "signed-out" && auth.signingIn) {
    return "Approve sansxel desktop in the browser tab that just opened.";
  }
  return "Sign in to connect this desktop to your sansxel.ai account.";
}

export default App;
