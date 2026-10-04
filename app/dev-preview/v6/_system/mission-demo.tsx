"use client";

import { useEffect, useRef, useState } from "react";

const CLEAR = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const filmSource = () => matchMedia("(max-width: 560px)").matches
  ? "/home/spatial-check-vertical.mp4" : "/home/spatial-check.mp4";

/** A browser reenactment of the recorded Larkspur check, not a new engine run. */
export function MissionDemo() {
  const screen = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [exploring, setExploring] = useState(false);
  const wanted = useRef(true);
  const exploreMode = useRef(false);
  const visible = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    wanted.current = !motion.matches;
    const sync = () => {
      if (visible.current && !document.hidden && wanted.current && !exploreMode.current) {
        if (!el.getAttribute("src")) el.src = filmSource();
        el.play().catch(() => setPlaying(false));
      } else el.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      sync();
    }, { threshold: .2 });
    const onMotion = () => { wanted.current = !motion.matches; sync(); };
    observer.observe(el);
    motion.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      el.pause();
      motion.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const explore = () => {
    exploreMode.current = true;
    wanted.current = false;
    video.current?.pause();
    setExploring(true);
  };
  const watch = () => {
    exploreMode.current = false;
    setExploring(false);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) { wanted.current = true; video.current?.play().catch(() => setPlaying(false)); }
  };

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    wanted.current = el.paused;
    if (wanted.current) {
      if (!el.getAttribute("src")) el.src = filmSource();
      el.play().catch(() => setPlaying(false));
    } else el.pause();
  };
  const fullscreen = () => {
    const el = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (screen.current?.requestFullscreen) screen.current.requestFullscreen().catch(() => {});
    else el?.webkitEnterFullscreen?.();
  };

  return <figure className="v6-mission-demo">
    <div ref={screen} className="v6-mission-demo__screen">
    <picture>
      <source media="(max-width: 560px)" srcSet="/home/spatial-check-poster-vertical.jpg" />
      <img src="/home/spatial-check-poster.jpg" alt="" loading="lazy" />
    </picture>
    <video ref={video} muted loop playsInline preload="none" poster={CLEAR}
      aria-label="Larkspur mission-console demo: confirming T-1 also clears civilian bus T-3."
      aria-describedby="mission-demo-description"
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setUnavailable(true)} />
    {exploring && <iframe className="v6-mission-demo__explore" src="/api/fixtures/strike?mode=broken" title="Larkspur software simulation" />}
    </div>
    <figcaption className="v6-mission-demo__bar">
      <p>Larkspur simulation</p>
      <span id="mission-demo-description" className="v6-mission-demo__description">Browser reenactment of the recorded software check. No real aircraft are connected.</span>
      <div className="v6-mission-demo__controls">
        {exploring ? <button type="button" onClick={watch}>Watch film</button> : <>
          <button type="button" onClick={explore}>Explore</button>
          <button type="button" onClick={toggle} disabled={unavailable}>{playing ? "Pause demo" : "Play demo"}</button>
        </>}
        {exploring ? <a href="/api/fixtures/strike?mode=broken" target="_blank" rel="noopener noreferrer">Open simulation</a> : <button type="button" onClick={fullscreen}>Full screen</button>}
      </div>
    </figcaption>
    {unavailable && <p className="v6-mission-demo__error">The recording could not load. <a href="/api/fixtures/strike?mode=broken">Open the simulation</a>.</p>}
  </figure>;
}
