"use client";

// CHAPTER 1: the opening, as a film (2026-10-01).
//
// The founder: open on a video, as Anduril, Palantir and axiom do, and make it real (notes, 2026-10-01). Since
// v4 (same day) the film is one held subject, because the founder asked that "the drone should kind of stay in
// the same position" while everything around it changes: our drone sits on its pad in a garage, lifts, and
// flies a slow circle while four real places sweep in behind it (app/film/orbit, rendered frame by frame over
// Poly Haven panoramas), then a real hand, filmed from below, rises and takes a real drone held at that same
// spot (Pexels footage, reframed frame by frame), and the same wipe returns to the pad, so the loop has no seam.
// The drone never leaves its place under the sentence. Credits in app/film/CREDITS.md. Nothing in it claims a
// result. Few words, on purpose.
//
// Phones get their own cut, vertical (1080x1920): the rendered shots are rendered in portrait and the real
// footage is reframed to 9:16 around the drone (scratchpad reel/v4). It fills the phone's first screen. (They
// used to get a 720p cut stretched 1.9x into a 4:5 frame.) Each cut has its own poster, its first frame, so the
// picture does not jump when it starts. Reduced motion shows the poster and does not play, and does not download
// the film either: neither source matches it, and the film is only fetched if that visitor presses play. The
// film can always be paused, because anything that moves for more than five seconds must be (WCAG 2.2.2).
//
// THE FIELD IS REAL. It sends the address to the console's two-field composer (/app?new=1&url=), which
// carries it through sign-in and opens with it filled in. It used to land on the six-section connect form
// (console audit P1-2). Nothing runs from here: a person still approves the plan.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { HEADLINE, HERO_LINE } from "./positioning";
import { V6_APP, V6_BASE } from "@/lib/v6-routes";
import { hrefWithLocale } from "@/lib/i18n/locales";
import { currentLocale } from "@/lib/i18n/client";
import "./hero.css";

const COMPOSE = V6_APP;
// The two cuts and the screens each is for (hero.css switches the layout at the same width).
const FILM = "/home/film.mp4";
const FILM_PHONE = "/home/film-vertical.mp4";
const POSTER = "/home/film-poster.jpg";
const POSTER_PHONE = "/home/film-poster-vertical.jpg";
/** A clear pixel: the video's own poster, so the picture under it (each cut's first frame) shows through. */
const CLEAR = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PHONE = "(max-width: 560px)";
const MOTION_OK = "(prefers-reduced-motion: no-preference)";

function normalise(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

export function Hero() {
  const [url, setUrl] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    // React does not always write the muted attribute into the server HTML, and a browser only autoplays a
    // muted video, so it is set here before play is asked for.
    v.muted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { v.pause(); setPlaying(false); return; }
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (!v.paused) { v.pause(); setPlaying(false); return; }
    // With reduced motion no source matched, so nothing is loaded yet: play fetches the cut this screen would
    // have had. If the browser refuses, or a pause interrupts it, the button shows what the film is really doing.
    if (!v.currentSrc) v.src = window.matchMedia(PHONE).matches ? FILM_PHONE : FILM;
    setPlaying(true);
    v.play().catch(() => setPlaying(!v.paused));
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = normalise(url);
    // The language rides along, like on every other link (components/language-controller.tsx).
    window.location.assign(hrefWithLocale(v ? `${COMPOSE}?new=1&url=${encodeURIComponent(v)}` : `${COMPOSE}?new=1`, currentLocale(), window.location.href));
  };

  return (
    <section className="v6-h" data-nav-dark data-nav-theme="dark" aria-labelledby="v6-h-h1">
      {/* THE FILM, IN A FRAME, WITH ONE SENTENCE ON IT (founder, 2026-10-01, against scale.com: the homepage
          opens on one main thing, not a clutter). The address field and the partnership records sit below. */}
      <div className="v6-h__frame">
        {/* The poster is a picture of its own, under the film, so a phone gets the first frame of its own cut: a
            video can name one poster, and the desktop one, cropped to a phone, showed the drone at twice the size
            the phone's film then starts at. The video's poster is a clear pixel, so this shows through until the
            first frame is drawn, and stays when the film does not play (reduced motion). */}
        <picture className="v6-h__poster" aria-hidden>
          <source media={PHONE} srcSet={POSTER_PHONE} />
          <img src={POSTER} alt="" fetchPriority="high" />
        </picture>
        <video ref={video} className="v6-h__video" autoPlay muted loop playsInline preload="auto" poster={CLEAR} aria-hidden>
          <source src={FILM_PHONE} type="video/mp4" media={`${PHONE} and ${MOTION_OK}`} />
          <source src={FILM} type="video/mp4" media={MOTION_OK} />
        </video>
        <div className="v6-h__shade" aria-hidden />
        <h1 id="v6-h-h1" className="v6-h__h1">
          <span className="v6-mask"><span className="v6-mask__in">{HEADLINE[0]}</span></span>
          <span className="v6-mask"><span className="v6-mask__in" style={{ animationDelay: "150ms" }}>{HEADLINE[1]}</span></span>
        </h1>
        <button type="button" className="v6-h__pause" onClick={toggle} aria-label={playing ? "Pause the film" : "Play the film"}>
          {playing
            ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            : <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M5 3.2v9.6L12.5 8z" fill="currentColor" /></svg>}
        </button>
      </div>

      <div className="v6-h__below">
        <p className="v6-h__say">{HERO_LINE}</p>
        <form className="v6-h__form" action={COMPOSE} method="get" onSubmit={submit}>
          <input type="hidden" name="new" value="1" />
          <label htmlFor="v6-h-url" className="v6-h__sr">The address of your live app</label>
          <input
            id="v6-h-url" name="url" type="text" inputMode="url" autoComplete="url" spellCheck={false}
            placeholder="https://your-app.com" value={url} onChange={(e) => setUrl(e.target.value)}
          />
          <button type="submit">Check it <span aria-hidden>→</span></button>
        </form>
        <div className="v6-h__partners" aria-label="Partnership records">
          <a className="v6-h__partner" href={`${V6_BASE}/partnerships/reddit`} aria-label="Read the Vraelis and Reddit partnership record.">
            <span className="v6-h__plabel">Partnership record</span>
            <strong>Vraelis × Reddit <span aria-hidden>↗</span></strong>
          </a>
          <a className="v6-h__partner" href={`${V6_BASE}/partnerships/bytedance`} aria-label="Read the Vraelis and ByteDance partnership record.">
            <span className="v6-h__plabel">Partnership record</span>
            <strong>Vraelis × ByteDance <span aria-hidden>↗</span></strong>
          </a>
        </div>
      </div>
    </section>
  );
}
