// Chrome.jsx — instrument bar, nav, and the Reveal motion wrapper.

// ── Reveal: fades + rises children when scrolled into view ──────────
function Reveal({ children, d, as = "div", className = "", style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { return; }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { el.classList.add("in"); obs.unobserve(el); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const Tag = as;
  return (
    <Tag ref={ref} className={`reveal ${className}`} data-d={d} style={style}>
      {children}
    </Tag>
  );
}

// ── Persistent instrument status band ───────────────────────────────
function InstrumentBar() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const tz = (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC") || "UTC";
  const city = tz.split("/").pop().replace(/_/g, " ");
  const day = now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "9px var(--gutter)", borderBottom: "1px solid var(--line-1)",
      background: "var(--bg-2)", gap: 24, flexWrap: "wrap",
      fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em", color: "var(--fg-3)",
    }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span className="dot dot--acc" />
        <span style={{ color: "var(--fg-1)" }}>live</span>
        <span style={{ color: "var(--fg-5)" }}>·</span>
        <span>247 leads answered in the last hour</span>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
        <span>{day}</span>
        <span style={{ width: 1, height: 10, background: "var(--line-2)" }} />
        <span style={{ color: "var(--fg-1)" }}>{time}</span>
        <span style={{ width: 1, height: 10, background: "var(--line-2)" }} />
        <span>{city}</span>
      </div>
    </div>
  );
}

// ── Nav ─────────────────────────────────────────────────────────────
function Nav({ onCta, active }) {
  const links = [
    { href: "how.html", label: "How it works", key: "how" },
    { href: "automates.html", label: "What it automates", key: "automates" },
    { href: "dashboard.html", label: "Dashboard", key: "dashboard" },
    { href: "pricing.html", label: "Pricing", key: "pricing" },
  ];
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px var(--gutter)",
      background: "rgba(250, 248, 244, 0.86)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--line-1)",
    }}>
      <a href="index.html" style={{
        display: "inline-flex", alignItems: "center", textDecoration: "none",
        color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.04em",
      }}>
        vraelis
      </a>
      <div className="vra-nav-links" style={{ display: "flex", gap: 28, alignItems: "center" }}>
        {links.map((l) => <NavLink key={l.key} href={l.href} active={active === l.key}>{l.label}</NavLink>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <a href="#" style={{ fontSize: 14, color: "var(--fg-2)", textDecoration: "none", letterSpacing: "-0.005em", whiteSpace: "nowrap" }}>Sign in</a>
        <button className="btn" onClick={onCta}>Start free</button>
      </div>
    </nav>
  );
}
function NavLink({ href, children, active }) {
  return (
    <a href={href} style={{ fontSize: 14, color: active ? "var(--fg-1)" : "var(--fg-2)", fontWeight: active ? 600 : 400, textDecoration: "none", letterSpacing: "-0.005em", whiteSpace: "nowrap" }}>
      {children}
    </a>
  );
}

Object.assign(window, { Reveal, InstrumentBar, Nav, NavLink });
