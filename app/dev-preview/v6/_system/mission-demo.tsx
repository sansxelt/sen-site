"use client";

import { useEffect, useRef, useState } from "react";

/** A browser reenactment of the recorded Larkspur check, not a new engine run. */
export function MissionDemo() {
  const video = useRef<HTMLVideoElement>(null);
  const wanted = useRef(true);
  const visible = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    wanted.current = !motion.matches;
    const sync = () => {
      if (visible.current && !document.hidden && wanted.current) {
        if (!el.getAttribute("src")) el.src = "/home/mission-demo.mp4";
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

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    wanted.current = el.paused;
    if (wanted.current) {
      if (!el.getAttribute("src")) el.src = "/home/mission-demo.mp4";
      el.play().catch(() => setPlaying(false));
    } else el.pause();
  };
  const fullscreen = () => {
    const el = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else el?.webkitEnterFullscreen?.();
  };

  return <figure className="v6-mission-demo">
    <video ref={video} muted loop playsInline preload="none" poster="/home/mission-demo-poster.jpg"
      aria-label="Larkspur mission-console demo: confirming T-1 also clears civilian bus T-3."
      aria-describedby="mission-demo-description"
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setUnavailable(true)} />
    <figcaption className="v6-mission-demo__bar">
      <p id="mission-demo-description">Browser reenactment of the October 2 recorded check. Simulated aircraft and contacts.</p>
      <div className="v6-mission-demo__controls">
        <button type="button" onClick={toggle} disabled={unavailable}>{playing ? "Pause demo" : "Play demo"}</button>
        <button type="button" onClick={fullscreen}>Full screen</button>
      </div>
    </figcaption>
    {unavailable && <p className="v6-mission-demo__error">The recording could not load. <a href="/api/fixtures/strike?mode=broken">Open the simulation</a>.</p>}
  </figure>;
}
