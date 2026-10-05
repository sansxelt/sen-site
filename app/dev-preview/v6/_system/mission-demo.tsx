"use client";

import { useEffect, useRef, useState } from "react";

const CLEAR = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const filmSource = () => matchMedia("(max-width: 560px)").matches
  ? "/home/app-check-replay-vertical.mp4?v=workspace-20261004" : "/home/app-check-replay.mp4?v=workspace-20261004";

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
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === screen.current);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.fullscreenElement === screen.current) {
        document.exitFullscreen().catch(() => {});
      }
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("keydown", escape);
    };
  }, []);

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
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (screen.current?.requestFullscreen) screen.current.requestFullscreen().catch(() => {});
    else el?.webkitEnterFullscreen?.();
  };

  return <figure className="v6-mission-demo">
    <div ref={screen} className={`v6-mission-demo__screen${exploring ? " is-exploring" : ""}`}>
    <picture>
      <source media="(max-width: 560px)" srcSet="/home/app-check-replay-poster-vertical.jpg?v=workspace-20261004" />
      <img src="/home/app-check-replay-poster.jpg?v=workspace-20261004" alt="" loading="lazy" />
    </picture>
    <video ref={video} muted loop playsInline preload="none" poster={CLEAR}
      aria-label="Vraelis app demo: review the Larkspur plan, browser activity, finding and repair prompt."
      aria-describedby="mission-demo-description"
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setUnavailable(true)} />
    {exploring && <iframe className="v6-mission-demo__explore" src="/api/fixtures/strike?mode=broken&ui=terrain-20261005" title="Larkspur software simulation" allow="fullscreen" />}
    <div className="v6-mission-demo__controls">
      <button type="button" onClick={exploring ? watch : explore} aria-label={exploring ? "Watch film" : "Explore"} title={exploring ? "Watch film" : "Explore simulation"}>
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>{exploring ? <path d="m10 5-7 7 7 7M3 12h17" fill="none" stroke="currentColor" strokeWidth="1.7" /> : <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9L4 7.5M12 12l8-4.5M12 12v9" fill="none" stroke="currentColor" strokeWidth="1.5" /></>}</svg>
      </button>
      {!exploring && <button type="button" onClick={toggle} disabled={unavailable} aria-label={playing ? "Pause demo" : "Play demo"} title={playing ? "Pause demo" : "Play demo"}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>{playing ? <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2" /> : <path d="m8 5 11 7-11 7Z" fill="currentColor" />}</svg>
      </button>}
      <button type="button" onClick={fullscreen} aria-label={isFullscreen ? "Exit full screen" : "Full screen"} title={isFullscreen ? "Exit full screen" : "Full screen"} aria-pressed={isFullscreen}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg></button>
    </div>
    </div>
    <figcaption id="mission-demo-description" className="v6-mission-demo__description">Replay of the recorded check in Vraelis’s app interface. The mission console is a simulation.</figcaption>
    {unavailable && <p className="v6-mission-demo__error">The recording could not load. <a href="/api/fixtures/strike?mode=broken&ui=terrain-20261005">Open the simulation</a>.</p>}
  </figure>;
}
