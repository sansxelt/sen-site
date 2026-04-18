import { useEffect, useState } from "react";
import "./App.css";

type Phase = "splash" | "fading" | "main";

const SPLASH_HOLD_MS = 1600;
const SPLASH_FADE_MS = 380;

function App() {
  const [phase, setPhase] = useState<Phase>("splash");

  useEffect(() => {
    const fadeTimer = setTimeout(() => setPhase("fading"), SPLASH_HOLD_MS);
    const swapTimer = setTimeout(
      () => setPhase("main"),
      SPLASH_HOLD_MS + SPLASH_FADE_MS,
    );
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(swapTimer);
    };
  }, []);

  return (
    <div className="stage">
      {phase !== "main" && (
        <div className={`splash${phase === "fading" ? " fading-out" : ""}`}>
          <div className="splash-icon">
            <img src="/icon.png" alt="sansxel" />
          </div>
          <h1 className="splash-wordmark">sansxel</h1>
          <p className="splash-tagline">Build something real.</p>
        </div>
      )}

      {phase === "main" && <MainShell />}
    </div>
  );
}

function MainShell() {
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
        <div className="main-status">not signed in</div>
      </header>

      <div className="main-body">
        <div className="main-empty">
          <h1>Workspace coming online.</h1>
          <p>
            Sign-in, notes, and the sansxel-1 brain land in the next iterations.
            For now: this is the shell.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
