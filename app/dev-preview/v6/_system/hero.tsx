"use client";

// CHAPTER 1: the opening, as a film (2026-10-01).
//
// The founder: open on a video, as Anduril, Palantir and axiom do. The film is our own drone, rendered frame
// by frame (app/film/drone) and encoded to MP4: a close look at a rotor spinning up on its pad, the lift-off,
// a slow orbit, the return and the landing. It fills the screen; a headline, one short line, the address
// field and the two partnership records sit over its dark left side. Few words, on purpose.
//
// Phones get the 720p cut. Reduced motion shows the poster and does not play. The film can always be
// paused, because anything that moves for more than five seconds must be (WCAG 2.2.2).
//
// THE FIELD IS REAL. It sends the address to the console's connect page (/systems/new?url=), which carries
// it through sign-in and prefills it. Nothing runs from here: a person still approves the plan.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { HEADLINE, HERO_LINE } from "./positioning";
import { V6_APP, V6_BASE } from "@/lib/v6-routes";
import { hrefWithLocale } from "@/lib/i18n/locales";
import { currentLocale } from "@/lib/i18n/client";
import "./hero.css";

const CONNECT = `${V6_APP}/systems/new`;

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
    window.location.assign(hrefWithLocale(v ? `${CONNECT}?url=${encodeURIComponent(v)}` : CONNECT, currentLocale(), window.location.href));
  };

  return (
    <section className="v6-h" data-nav-dark data-nav-theme="dark" aria-labelledby="v6-h-h1">
      <div className="v6-h__media" aria-hidden>
        <video ref={video} className="v6-h__video" autoPlay muted loop playsInline preload="auto" poster="/home/drone-film-poster.jpg">
          <source src="/home/drone-film-720.mp4" type="video/mp4" media="(max-width: 900px)" />
          <source src="/home/drone-film.mp4" type="video/mp4" />
        </video>
        <div className="v6-h__shade" />
      </div>

      <div className="v6-h__in">
        <div className="v6-h__text">
          <h1 id="v6-h-h1" className="v6-h__h1">
            <span className="v6-mask"><span className="v6-mask__in">{HEADLINE[0]}</span></span>
            <span className="v6-mask"><span className="v6-mask__in" style={{ animationDelay: "150ms" }}>{HEADLINE[1]}</span></span>
          </h1>
          <p className="v6-h__say">{HERO_LINE}</p>

          <form className="v6-h__form" action={CONNECT} method="get" onSubmit={submit}>
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
      </div>

      <button type="button" className="v6-h__pause" onClick={toggle} aria-label={playing ? "Pause the film" : "Play the film"}>
        {playing
          ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          : <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M5 3.2v9.6L12.5 8z" fill="currentColor" /></svg>}
      </button>
    </section>
  );
}
