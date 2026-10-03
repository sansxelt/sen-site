"use client";

// THE FIELDLINE FIXTURE, FRAMED (plan S2, /solutions/fleets#fixture; revision 2, 2026-10-02). Owner: b5a.
//
//   <FixtureFrame narrow={<the capture and two links, rendered by the page>} />
//
// From 900px up: the real fixture, /api/fixtures/drone, in an iframe 600px tall inside a MediaPanel-style shell,
// with a two-option switch above it, "Broken" first. Same-origin framing is allowed (the route sends
// X-Frame-Options: SAMEORIGIN). The fixture's own colours are allowed: it is the app being checked. Its state lives
// in the visitor's own browser storage under fieldline-fleet-<mode>, which /cookies lists; nothing is sent anywhere.
// Below 900px there is no iframe at all: the page's `narrow` content shows instead (a capture of the broken console
// with its credit, and plain links that open each mode).
//
// The iframe is created only after hydration and only when the screen is at least 900px wide, so a phone never
// loads it. Its box is a fixed height from the first paint, so neither mounting it nor switching the mode moves
// anything below it. Not the DronePanel replica in surfaces.tsx, which plays only the fixed mode: this is the
// fixture itself.
import { useEffect, useId, useState, type ReactNode } from "react";

type Mode = "broken" | "fixed";
const MODES: { mode: Mode; label: string }[] = [
  { mode: "broken", label: "Broken" },
  { mode: "fixed", label: "Fixed" },
];
/** The fixture's own route. It lives at the site root in both the promoted and the preview server. */
const src = (mode: Mode) => `/api/fixtures/drone?mode=${mode}`;
const WIDE = "(min-width: 900px)";

export function FixtureFrame({ narrow }: { narrow: ReactNode }) {
  const [mode, setMode] = useState<Mode>("broken");
  const [wide, setWide] = useState(false);
  const name = useId();

  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div className="v6-ff">
      <div className="v6-ff__wide">
        <fieldset className="v6-ff__modes">
          <legend className="v6-ff__legend">Which mode of the fixture to show</legend>
          {MODES.map((m) => (
            <label key={m.mode} className="v6-ff__mode" data-on={mode === m.mode ? "" : undefined}>
              <input
                type="radio" name={name} value={m.mode} checked={mode === m.mode}
                onChange={() => setMode(m.mode)} className="v6-ff__radio"
              />
              <span>{m.label}</span>
            </label>
          ))}
        </fieldset>
        <figure className="v6-ff__shell">
          <div className="v6-ff__bar">
            <span className="v6-ff__addr" data-no-translate>{`vraelis.com/api/fixtures/drone?mode=${mode}`}</span>
            <span className="v6-ff__tag">Vraelis demo fixture</span>
          </div>
          <div className="v6-ff__view">
            {wide ? (
              <iframe
                key={mode}
                className="v6-ff__frame"
                src={src(mode)}
                title="Fieldline fleet console, a Vraelis demo fixture"
                loading="lazy"
              />
            ) : null}
          </div>
        </figure>
      </div>
      <div className="v6-ff__narrow">{narrow}</div>
    </div>
  );
}
