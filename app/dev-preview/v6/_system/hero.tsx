"use client";

// Licensed real footage in the original, centered homepage film frame.
import { useEffect, useRef } from "react";
import { HEADLINE } from "./positioning";
import { MediaReadyFallback, useMediaReady } from "./media-ready";
import { AudienceBar } from "./audience-bar";
import "./hero.css";

// The two cuts and the screens each is for (hero.css switches the layout at the same width).
const FILM = "/home/systems-film-opening.mp4";
const FILM_PHONE = "/home/systems-film-opening-vertical.mp4";
const POSTER = "/home/systems-poster-opening.jpg";
const POSTER_PHONE = "/home/systems-poster-opening-vertical.jpg";
/** A clear pixel: the video's own poster, so the picture under it (each cut's first frame) shows through. */
const CLEAR = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PHONE = "(max-width: 560px)";
const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export function Hero() {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  useMediaReady(frame);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = true;
    let visible = true;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (!motion.matches && visible && !document.hidden) v.play().catch(() => {});
      else v.pause();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(v);
    const onMotion = sync;
    motion.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { observer.disconnect(); motion.removeEventListener("change", onMotion); document.removeEventListener("visibilitychange", sync); };
  }, []);

  return (
    <section className="v6-h" data-nav-dark data-nav-theme="dark" aria-labelledby="v6-h-h1" aria-describedby="v6-h-film-context">

      <link rel="preload" as="image" href={POSTER_PHONE} media={PHONE} fetchPriority="high" />
      <link rel="preload" as="image" href={POSTER} media="(min-width:561px)" fetchPriority="high" />
      <div ref={frame} className="v6-h__frame" data-media-ready="pending">
        <MediaReadyFallback/>

        <picture className="v6-h__poster">
          <source media={PHONE} srcSet={POSTER_PHONE} />
          <img src={POSTER} alt="" fetchPriority="high" />
        </picture>
        <video ref={video} className="v6-h__video" autoPlay muted loop playsInline preload="metadata" poster={CLEAR} aria-hidden>
          <source src={FILM_PHONE} type="video/mp4" media={`${PHONE} and ${MOTION_OK}`} />
          <source src={FILM} type="video/mp4" media={MOTION_OK} />
        </video>
        <div className="v6-h__shade" aria-hidden />
        <h1 id="v6-h-h1" className="v6-h__h1" data-media-copy="">
          <span className="v6-mask"><span className="v6-mask__in">{HEADLINE}</span></span>
        </h1>
        <span id="v6-h-film-context" className="v6-h__context">Industrial robotics and public-domain military training footage illustrate systems whose software matters. Film sources: vraelis.com/home/systems-film-sources.txt.</span>
        <AudienceBar />
      </div>
    </section>
  );
}
