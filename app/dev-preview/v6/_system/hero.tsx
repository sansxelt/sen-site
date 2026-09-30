"use client";

// CHAPTER 1: the opening, rebuilt 2026-09-30.
//
// The founder's read of the last one: too much text, and nothing that looked like the product. So the first
// screen is now three things, centred: one headline, one line, one field that takes the reader's own
// address. Under them sit the two partnership records (kept as records, not a moving logo strip, which the
// founder ruled out as looking generated), and the product itself: a console window replaying real runs
// (_system/run-window.tsx) that rises out of the tinted band.
//
// THE FIELD IS REAL. It sends the address to the console's connect page (/systems/new?url=), which carries
// it through sign-in and prefills it. Nothing runs from here: the connect page still asks for the sentence,
// and a person still approves the plan. A bare "example.com" is given https:// on the way; anything else is
// left to the connect form to judge.
import { useState, type FormEvent } from "react";
import { HEADLINE, SUPPORT } from "./positioning";
import { RunWindow } from "./run-window";
import { V6_APP, V6_BASE } from "@/lib/v6-routes";
import "./hero.css";

const CONNECT = `${V6_APP}/systems/new`;

function normalise(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

export function Hero() {
  const [url, setUrl] = useState("");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = normalise(url);
    window.location.assign(v ? `${CONNECT}?url=${encodeURIComponent(v)}` : CONNECT);
  };

  return (
    <section className="v6-h" data-nav-theme="light" aria-labelledby="v6-h-h1">
      <div className="v6-h__band">
        <div className="v6-h__grid" aria-hidden />
        <div className="v6-h__inner">
          <a className="v6-h__pill" href="#devices">
            <span className="v6-h__pilltag">Live</span>
            <span className="v6-h__pilltxt">Drones, robots and fleets, checked through their control panel</span>
            <span className="v6-h__pillarw" aria-hidden>→</span>
          </a>
          <h1 id="v6-h-h1" className="v6-h__h1">
            <span className="v6-mask"><span className="v6-mask__in">{HEADLINE[0]}</span></span>
            <span className="v6-mask"><span className="v6-mask__in" style={{ animationDelay: "150ms" }}>{HEADLINE[1]}</span></span>
          </h1>
          <p className="v6-h__say">{SUPPORT}</p>

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
              <strong>Vraelis × Reddit</strong>
              <span className="v6-h__pmeta">Partnered in 2026 <span aria-hidden>↗</span></span>
            </a>
            <a className="v6-h__partner" href={`${V6_BASE}/partnerships/bytedance`} aria-label="Read the Vraelis and ByteDance partnership record.">
              <span className="v6-h__plabel">Partnership record</span>
              <strong>Vraelis × ByteDance</strong>
              <span className="v6-h__pmeta">The company behind TikTok · 2026 <span aria-hidden>↗</span></span>
            </a>
          </div>
        </div>
      </div>

      <div className="v6-h__stage">
        <RunWindow />
        <p className="v6-h__stagecap">Real runs on Vraelis demo apps, replayed at their recorded pace. Pick one on the left.</p>
      </div>
    </section>
  );
}
