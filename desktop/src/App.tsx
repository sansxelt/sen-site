import "./App.css";

function App() {
  return (
    <div className="stage">
      <MainShell />
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
        <button type="button" className="main-signin-btn">
          <span className="main-signin-dot" />
          Sign in
        </button>
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
