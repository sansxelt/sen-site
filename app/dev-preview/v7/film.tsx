"use client";

import { useEffect, useRef, useState } from "react";

/** Field footage illustrates an operating environment, never product performance. */
export function FieldFilm() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const manualPause = useRef(false);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !reduced.matches && !connection?.saveData && !manualPause.current) void el.play().catch(() => {});
      else el.pause();
    }, { threshold: .3 });
    const stop = () => { if (reduced.matches) el.pause(); };
    observer.observe(el); reduced.addEventListener("change", stop);
    return () => { observer.disconnect(); reduced.removeEventListener("change", stop); el.pause(); };
  }, []);
  const toggle = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) { manualPause.current = false; void el.play().catch(() => {}); }
    else { manualPause.current = true; el.pause(); }
  };
  return <figure className="v7-film">
    <video ref={video} src="/design/v7/robotics-loop.mp4" poster="/design/v7/robotics-poster.jpg" muted loop playsInline preload="none" aria-label="Industrial robotics field footage" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)} />
    <figcaption>Industrial robotics · Context footage</figcaption>
    {!failed && <button className="v7-film__toggle" aria-label={playing ? "Pause robotics footage" : "Play robotics footage"} onClick={toggle}>{playing ? <svg aria-hidden="true" viewBox="0 0 18 18" width="16" height="16"><path d="M6 4v10M12 4v10" stroke="currentColor" strokeWidth="2" /></svg> : <svg aria-hidden="true" viewBox="0 0 18 18" width="16" height="16"><path d="m5 3 10 6-10 6Z" fill="currentColor" /></svg>}</button>}
  </figure>;
}
