// Nav.jsx
// Sits below the InstrumentBar.
// Just text wordmark (no decorative icon). Contextual section links
// that hide when you're already in that section. Sign-in surfaced as
// a quiet link. Join waitlist is the only solid button.

function Nav({ onJoin }) {
  const inProduct = useInViewSection("product"); // true when hero is on screen

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "18px var(--gutter)",
      background: "rgba(10, 15, 24, 0.85)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--line-1)",
    }}>
      {/* Wordmark — just text, with a phosphor dot for accent */}
      <a href="#top" style={{
        display: "inline-flex", alignItems: "center",
        textDecoration: "none", color: "var(--fg-1)",
        fontSize: 19, fontWeight: 600, letterSpacing: "-0.025em",
      }}>
        vraelis<span style={{ color: "var(--acc)" }}>.</span>
      </a>

      <div className="vra-nav-links" style={{ display: "flex", gap: 26, alignItems: "center" }}>
        {/* Product link only appears when user has scrolled past the hero */}
        {!inProduct && <NavLink href="#top">Product</NavLink>}
        <NavLink href="#spec">Specifications</NavLink>
        <span style={{ width: 1, height: 14, background: "var(--line-2)" }} />
        <NavLink href="https://vraelis.com/chat" external>Chat</NavLink>
        <NavLink href="https://vraelis.com/platform" external>Platform</NavLink>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <a href="https://vraelis.com/chat" style={{
          fontSize: 14,
          color: "var(--fg-2)",
          textDecoration: "none",
          letterSpacing: "-0.005em",
        }}>
          Sign in
        </a>
        <button className="btn" onClick={onJoin}>
          Join waitlist
        </button>
      </div>
    </nav>
  );
}

function NavLink({ href, children, external }) {
  return (
    <a href={href} style={{
      fontSize: 14,
      color: "var(--fg-2)",
      textDecoration: "none",
      letterSpacing: "-0.005em",
    }}>
      {children}{external && <span style={{ marginLeft: 4, opacity: 0.55, fontSize: 11 }}>↗</span>}
    </a>
  );
}

// Lightweight intersection observer hook for nav contextual links
function useInViewSection(id) {
  const [inView, setInView] = React.useState(true);
  React.useEffect(() => {
    const el = document.getElementById(id);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting && entry.intersectionRatio > 0.25);
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    obs.observe(el);
    return () => obs.disconnect();
  }, [id]);
  return inView;
}

Object.assign(window, { Nav, NavLink, useInViewSection });
