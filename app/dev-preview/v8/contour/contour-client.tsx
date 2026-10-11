"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AutoVideo } from "../_kit/client";

// The two moving parts of /contour: the hero recording with details lifted out of it, and the tabbed viewer of
// the four recorded observations. Both show only real captures of the read-only evidence app.

/* The hero recording (public/v8/contour/contour-observations.mp4 and .webm, 14.24 s, 1440 x 900) steps the
   app's Destination screen through the four recorded observations. Measured 2026-10-10 by reading the status
   pill every 50 ms (the mp4 and the webm agree): 01 Matched to 1.95 s, 02 Reload pending to 4.8 s, 03 Matched
   to 7.62 s, 04 Evidence unavailable to 10.5 s, then 02 again (one digest opened) to the end. The poster is
   observation 02. A lifted detail shows only while the screen behind it is on the observation it was cropped
   from, so a lifted detail never says something the screen does not. Measure again if the recording changes. */
const SEGMENTS: [end: number, obs: string][] = [[1.95, "01"], [4.8, "02"], [7.62, "03"], [10.5, "04"], [Infinity, "02"]];
const obsAt = (t: number) => (SEGMENTS.find(([end]) => t < end) ?? SEGMENTS[SEGMENTS.length - 1])[1];

export type Lift = { src: string; w: number; h: number; slot: "a" | "b" | "c"; during: string[] };

export function HeroStage({ video, still, lifts, caption }: {
  video?: { src: string; webm?: string; poster: string; label: string };
  /** A still capture instead of the recording: the screen never changes, so every detail for it shows at once. */
  still?: { src: string; srcSet?: string; alt: string; w: number; h: number; obs: string };
  lifts: Lift[];
  caption: ReactNode;
}) {
  const screen = useRef<HTMLDivElement>(null);
  const [obs, setObs] = useState(still?.obs ?? "02");
  useEffect(() => {
    const v = screen.current?.querySelector("video");
    if (!v) return;
    let started = false;
    let frame = 0;
    const read = (t: number) => { if (started) setObs(obsAt(t)); };
    const onTime = () => read(v.currentTime);
    // Until the video plays or seeks, the poster (observation 02) is what shows.
    const onFrame = () => { started = true; onTime(); };
    // Frame accurate where the browser supports it, timeupdate (about 4 times a second) everywhere.
    const tick = (_now: number, meta: VideoFrameCallbackMetadata) => { read(meta.mediaTime); frame = v.requestVideoFrameCallback(tick); };
    const hasFrames = typeof v.requestVideoFrameCallback === "function";
    if (hasFrames) frame = v.requestVideoFrameCallback(tick);
    v.addEventListener("playing", onFrame);
    v.addEventListener("seeked", onFrame);
    v.addEventListener("timeupdate", onTime);
    return () => {
      if (hasFrames) v.cancelVideoFrameCallback(frame);
      v.removeEventListener("playing", onFrame);
      v.removeEventListener("seeked", onFrame);
      v.removeEventListener("timeupdate", onTime);
    };
  }, []);
  return (
    <figure className="v8-figure ct-stage">
      <div className="v8-stage">
        <div className="v8-stage__screen" ref={screen}>
          {still
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={still.src} srcSet={still.srcSet} sizes="(max-width: 900px) 100vw, 1280px" alt={still.alt} width={still.w} height={still.h} fetchPriority="high" decoding="async" />
            : video ? <AutoVideo src={video.src} webm={video.webm} poster={video.poster} label={video.label} /> : null}
        </div>
        {lifts.map((l) => (
          <div key={l.src} className={`v8-lifted ct-lift ct-lift--${l.slot}`} data-on={l.during.includes(obs)} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.src} alt="" width={l.w} height={l.h} loading="lazy" decoding="async" />
          </div>
        ))}
      </div>
      <figcaption className="v8-caption">{caption}</figcaption>
    </figure>
  );
}

export type ObservationView = {
  n: string; title: string; state: string; tone: string; line: string; time: string; reason?: string;
  img: { src: string; srcSet: string; alt: string; w: number; h: number };
};

/** Tabs 01 to 04 beside the four full-screen captures (a vertical list on desktop, a grid on phones). Each tab
 *  carries its observation's one-line explanation. Arrow keys, Home and End move between tabs (WAI-ARIA tabs). */
export function ObservationTabs({ items, label }: { items: ObservationView[]; label: string }) {
  const [i, setI] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const cur = items[i];
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, k: number) => {
    const last = items.length - 1;
    const next = e.key === "ArrowRight" || e.key === "ArrowDown";
    const prev = e.key === "ArrowLeft" || e.key === "ArrowUp";
    const n = next ? (k === last ? 0 : k + 1) : prev ? (k === 0 ? last : k - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (n < 0) return;
    e.preventDefault();
    setI(n);
    tabs.current[n]?.focus();
  };
  return (
    <div className="ct-obs">
      <div className="ct-obs__tabs" role="tablist" aria-label={label}>
        {items.map((o, k) => (
          <button key={o.n} ref={(el) => { tabs.current[k] = el; }} type="button" role="tab" id={`ct-obs-tab-${o.n}`}
            aria-selected={k === i} aria-controls="ct-obs-panel" tabIndex={k === i ? 0 : -1}
            aria-labelledby={`ct-obs-title-${o.n}`} aria-describedby={`ct-obs-line-${o.n}`}
            className="ct-obs__tab" onClick={() => setI(k)} onKeyDown={(e) => onKey(e, k)}>
            <span className="ct-obs__n" aria-hidden="true">{o.n}<span className="ct-obs__time">{o.time} UTC</span></span>
            <span className="ct-obs__title" id={`ct-obs-title-${o.n}`}>
              <span className="v8-sr">Observation {o.n}: </span>{o.title}
              <span className={`ct-tone ct-tone--${o.tone}`}><span className="v8-sr">, </span>{o.state}</span>
            </span>
            <span className="ct-obs__line" id={`ct-obs-line-${o.n}`}>{o.line}</span>
          </button>
        ))}
      </div>
      <div className="ct-obs__panel" role="tabpanel" id="ct-obs-panel" aria-labelledby={`ct-obs-tab-${cur.n}`}>
        <div className="v8-stage ct-obs__stage">
          <div className="ct-obs__frames">
            {items.map((o, k) => (
              <div key={o.n} className="ct-obs__frame" data-on={k === i} aria-hidden={k !== i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.img.src} srcSet={o.img.srcSet} sizes="(min-width: 1360px) 900px, (min-width: 961px) 68vw, 92vw" alt={k === i ? o.img.alt : ""}
                  width={o.img.w} height={o.img.h} loading="lazy" decoding="async" />
              </div>
            ))}
          </div>
        </div>
        <p className="ct-obs__meta">{cur.reason ? <span>Reason code <span className="v8-mono">{cur.reason}</span></span> : null}</p>
      </div>
    </div>
  );
}
