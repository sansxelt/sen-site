import { useEffect, useState } from "react";
import "./App.css";

type Phase = "boot" | "boot-fading" | "main";

const bootSteps = [
  { label: "Initializing sansxel core", ms: 720 },
  { label: "Loading workspace memory", ms: 880 },
  { label: "Syncing context", ms: 740 },
  { label: "Connecting sansxel-1", ms: 1020 },
  { label: "Preparing your space", ms: 820 },
];

const HOLD_AFTER_BOOT_MS = 420;
const FADE_OUT_MS = 460;

function App() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    let elapsed = 0;

    bootSteps.forEach((step, i) => {
      timers.push(window.setTimeout(() => setStepIdx(i), elapsed));
      elapsed += step.ms;
    });

    timers.push(
      window.setTimeout(() => setPhase("boot-fading"), elapsed + HOLD_AFTER_BOOT_MS),
    );
    timers.push(
      window.setTimeout(
        () => setPhase("main"),
        elapsed + HOLD_AFTER_BOOT_MS + FADE_OUT_MS,
      ),
    );

    return () => timers.forEach((id) => clearTimeout(id));
  }, []);

  const totalSteps = bootSteps.length;
  const currentStep = bootSteps[stepIdx];

  return (
    <div className="stage">
      {phase !== "main" && (
        <div className={`boot${phase === "boot-fading" ? " fading-out" : ""}`}>
          <div className="boot-icon">
            <img src="/icon.png" alt="sansxel" />
          </div>

          <h1 className="boot-wordmark">sansxel</h1>

          <div className="boot-status">
            <span className="boot-status-dot" />
            <span key={stepIdx} className="boot-status-label">
              {currentStep.label}
            </span>
          </div>

          <div className="boot-progress">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={`boot-progress-pip${i <= stepIdx ? " on" : ""}`}
              />
            ))}
          </div>

          <div className="boot-version">v0.1.0 · build sansxel-1 · windows</div>
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
