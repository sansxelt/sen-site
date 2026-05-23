// InstrumentBar.jsx — persistent top status band.
// Uses the user's actual timezone, local time, day name, and city
// (extracted from their Intl timezone string). No fake mil-spec
// labels, no fictional unit codes.

function InstrumentBar() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // User's IANA timezone — e.g. "America/New_York"
  const tz = (typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC") || "UTC";

  // Pull the last path segment as a friendly city name
  // "America/New_York" → "New York"
  const city = tz.split("/").pop().replace(/_/g, " ");

  // Day + date — "Wed 22 May"
  const day = now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

  // Local 24h time — "14:32:18"
  const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px var(--gutter)",
      borderBottom: "1px solid var(--line-1)",
      background: "var(--bg-2)",
      gap: 24,
      flexWrap: "wrap",
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      letterSpacing: "0.04em",
      color: "var(--fg-3)",
    }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span className="dot dot--acc" />
        <span style={{ color: "var(--fg-1)" }}>live</span>
        <span style={{ color: "var(--fg-5)" }}>·</span>
        <span>vraelis is in development</span>
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

Object.assign(window, { InstrumentBar });
