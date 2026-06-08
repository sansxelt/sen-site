// Header.jsx — top nav with wordmark, link group, sign-in CTA.

function Header({ onSignIn }) {
  return (
    <header style={{
      position: "fixed",
      top: 0, left: 0, right: 0,
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "18px clamp(20px, 5vw, 80px)",
      background: "linear-gradient(180deg, rgba(5,5,7,0.85) 0%, rgba(5,5,7,0) 100%)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    }}>
      <a href="#top" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <img src={(window.VRAELIS_BASE || "") + "assets/logo-mark.svg"} alt="Vraelis" style={{ width: 28, height: 28, borderRadius: 7, display: "block" }} />
        <span style={{ fontSize: 16, fontWeight: 500, color: "var(--fg-1)", letterSpacing: "-0.01em" }}>Vraelis</span>
      </a>

      <nav style={{ display: "flex", gap: 28, alignItems: "center" }} className="vra-nav">
        <a href="#capabilities" style={navLink}>Capabilities</a>
        <a href="#architecture" style={navLink}>Architecture</a>
        <a href="#waitlist" style={navLink}>Waitlist</a>
      </nav>

      <button
        onClick={onSignIn}
        style={{
          padding: "8px 16px",
          borderRadius: 100,
          border: "1px solid var(--line-3)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--fg-2)",
          fontSize: 13,
          fontFamily: "var(--font-sans)",
          cursor: "pointer",
          letterSpacing: "-0.005em",
          whiteSpace: "nowrap",
        }}
      >
        Sign in
      </button>
    </header>
  );
}

const navLink = {
  fontSize: 13,
  color: "var(--fg-3)",
  textDecoration: "none",
  letterSpacing: "-0.005em",
  transition: "color 250ms cubic-bezier(0.16, 1, 0.3, 1)",
};

Object.assign(window, { Header });
