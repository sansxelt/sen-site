"use client";

// CHAPTER 1: the opening, rebuilt again 2026-10-01.
//
// The founder: the page had too many visuals, and the one he imagined was a drone. So the opening is now text
// on the left (the headline, one line, the address field, the two partnership records) and a single 3D
// drone on the right (_system/drone-scene.tsx) that hovers, comes home to its pad, lands and lifts off again.
// The replay of real runs moved off the homepage; it lives in the Platform hero.
//
// THE FIELD IS REAL. It sends the address to the console's connect page (/systems/new?url=), which carries
// it through sign-in and prefills it. Nothing runs from here: the connect page still asks for the sentence,
// and a person still approves the plan. A bare "example.com" is given https:// on the way.
//
// The scene loads after the page (next/dynamic, no SSR), so the headline and the field paint first; until it
// arrives the right half holds a soft placeholder of the same size, so nothing moves when it does.
import dynamic from "next/dynamic";
import { useState, type FormEvent } from "react";
import { HEADLINE, SUPPORT } from "./positioning";
import { V6_APP, V6_BASE } from "@/lib/v6-routes";
import { hrefWithLocale } from "@/lib/i18n/locales";
import { currentLocale } from "@/lib/i18n/client";
import "./hero.css";

const DroneScene = dynamic(() => import("./drone-scene"), {
  ssr: false,
  loading: () => <div className="dr-host dr-host--wait" aria-hidden />,
});

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
    // The language rides along, like on every other link (components/language-controller.tsx).
    window.location.assign(hrefWithLocale(v ? `${CONNECT}?url=${encodeURIComponent(v)}` : CONNECT, currentLocale(), window.location.href));
  };

  return (
    <section className="v6-h" data-nav-theme="light" aria-labelledby="v6-h-h1">
      <div className="v6-h__band">
        <div className="v6-h__in">
          <div className="v6-h__text">
            <a className="v6-h__pill" href="#what-you-can-check">
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

          <div className="v6-h__visual">
            <DroneScene />
          </div>
        </div>
      </div>
    </section>
  );
}
