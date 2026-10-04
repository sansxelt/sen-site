"use client";

// Licensed real footage in the original, centered homepage film frame.
import { useEffect, useRef, useState } from "react";
import { HEADLINE } from "./positioning";
import { V6_APP } from "@/lib/v6-routes";
import { CTA, EditorialLink } from "./ui";
import "./hero.css";

const COMPOSE = V6_APP;
// The two cuts and the screens each is for (hero.css switches the layout at the same width).
const FILM = "/home/systems-film-defense.mp4";
const FILM_PHONE = "/home/systems-film-defense-vertical.mp4";
const POSTER = "/home/systems-poster-defense.jpg";
const POSTER_PHONE = "/home/systems-poster-defense-vertical.jpg";
/** A clear pixel: the video's own poster, so the picture under it (each cut's first frame) shows through. */
const CLEAR = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PHONE = "(max-width: 560px)";
const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const wanted = useRef(true);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = true;
    wanted.current = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onPlay = () => setPlaying(true), onPause = () => setPlaying(false);
    v.addEventListener("play", onPlay); v.addEventListener("pause", onPause);
    let visible = true;
    const sync = () => {
      if (wanted.current && visible && !document.hidden) v.play().then(onPlay).catch(onPause);
      else v.pause();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(v);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => { wanted.current = !motion.matches; sync(); };
    motion.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { observer.disconnect(); motion.removeEventListener("change", onMotion); document.removeEventListener("visibilitychange", sync); v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause); };
  }, []);


  // The first scroll continues inside the same film, then hands over to the recorded check.
  // CSS variables keep wheel/touch scrolling off React's render path.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const film = el.querySelector<HTMLElement>(".v6-h__frame");
      if (!film) return;
      const top = parseFloat(getComputedStyle(film).top) || 0;
      const distance = el.offsetHeight - film.offsetHeight;
      const progress = motion.matches ? 0 : Math.max(0, Math.min(1, (top - el.getBoundingClientRect().top) / Math.max(1, distance)));
      el.style.setProperty("--hero-out", `${-Math.min(progress * 1.7, 1) * 80}svh`);
      el.style.setProperty("--hero-in", `${Math.max(1 - progress * 1.55, 0) * 100}svh`);
      el.dataset.continued = String(progress >= 0.38);
      const context = el.querySelector<HTMLElement>(".v6-h__continuation");
      if (context) context.inert = !motion.matches && progress < 0.38;
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resize = new ResizeObserver(request);
    resize.observe(el);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    motion.addEventListener("change", request);
    update();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect();
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      motion.removeEventListener("change", request);
    };
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (!v.paused) { wanted.current = false; v.pause(); return; }
    // With reduced motion no source matched, so nothing is loaded yet: play fetches the cut this screen would
    // have had. If the browser refuses, or a pause interrupts it, the button shows what the film is really doing.
    if (!v.currentSrc) v.src = window.matchMedia(PHONE).matches ? FILM_PHONE : FILM;
    wanted.current = true;
    v.play().catch(() => setPlaying(!v.paused));
  };

  return (
    <section ref={root} className="v6-h" data-nav-dark data-nav-theme="dark" aria-labelledby="v6-h-h1">

      <div className="v6-h__frame">

        <picture className="v6-h__poster">
          <source media={PHONE} srcSet={POSTER_PHONE} />
          <img src={POSTER} alt="" fetchPriority="high" />
        </picture>
        <video ref={video} className="v6-h__video" autoPlay muted loop playsInline preload="metadata" poster={CLEAR} aria-hidden>
          <source src={FILM_PHONE} type="video/mp4" media={`${PHONE} and ${MOTION_OK}`} />
          <source src={FILM} type="video/mp4" media={MOTION_OK} />
        </video>
        <div className="v6-h__shade" aria-hidden />
        <h1 id="v6-h-h1" className="v6-h__h1">
          <span className="v6-mask"><span className="v6-mask__in">{HEADLINE}</span></span>
        </h1>
        <div className="v6-h__continuation">
          <h2>Before software<br />becomes an action.</h2>
          <p>Vraelis checks live web apps and control panels in a real browser. See it catch a mistake in our simulated drone mission.</p>
          <div className="v6-h__actions">
            <EditorialLink href="#how-a-check-works">Watch the check</EditorialLink>
            <CTA href={`${COMPOSE}?new=1`}>Start a check</CTA>
          </div>
          <a className="v6-h__sources" href="/home/systems-film-sources.txt">Field footage · Vraelis software simulation</a>
        </div>
        <a className="v6-h__scroll" href="#hero-context">See what we check <span aria-hidden>↓</span></a>
        <span className="v6-h__signature">Vraelis · Software verification</span>
        <button type="button" className="v6-h__pause" onClick={toggle} aria-label={playing ? "Pause the film" : "Play the film"}>
          {playing
            ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            : <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M5 3.2v9.6L12.5 8z" fill="currentColor" /></svg>}
        </button>
      </div>
      <span id="hero-context" className="v6-h__anchor" aria-hidden />
    </section>
  );
}
