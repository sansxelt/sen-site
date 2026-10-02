"use client";

// CHAPTER 1: the opening, as a film (2026-10-01).
//
// The founder: open on a video, as Anduril, Palantir and axiom do, and make it real (notes, 2026-10-01). The
// film climbs from a dev board on a bench to our drone in a studio, then holds the drone in the air while the
// camera circles it and four real places sweep in behind it (app/film/orbit, rendered frame by frame over
// Poly Haven panoramas), and lands in a real hand, then on the controller. Real footage is Pexels-licensed
// (credits in app/film/CREDITS.md). Nothing in it claims a result. One centred sentence sits on it; the
// orbit holds the drone below that sentence. Few words, on purpose.
//
// Phones get the 720p cut. Reduced motion shows the poster and does not play. The film can always be
// paused, because anything that moves for more than five seconds must be (WCAG 2.2.2).
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
    if (v.paused) { void v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
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
        <video ref={video} className="v6-h__video" autoPlay muted loop playsInline preload="auto" poster="/home/film-poster.jpg" aria-hidden>
          <source src="/home/film-720.mp4" type="video/mp4" media="(max-width: 900px)" />
          <source src="/home/film.mp4" type="video/mp4" />
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
