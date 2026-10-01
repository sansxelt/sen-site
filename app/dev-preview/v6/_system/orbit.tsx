"use client";

/* WHAT IT CHECKS, AS AN ORBIT (2026-10-01).

   Adapted from the closing section of scale.com, as the founder asked: pictures of what the product is for
   circle a two-line headline, and pointing at one stops the orbit and swaps the headline's word for it.
   Ours reads "Know your ___ works."

   THE WORDS ARE HELD TO WHAT IS LIVE. Web apps and agents are checked directly; a device, a vehicle or an
   aircraft is only checked through the web panel that runs it (_content/coverage.ts), so every device word
   names the panel ("drone panel", "fleet console"), never the machine. The pictures are our own demo apps,
   our own drone render, our own product, and stock footage stills under a free commercial licence
   (public/home/orbit/CREDITS.md).

   Motion: one slow revolution a minute, paused on hover or focus, and not at all with reduced motion. The
   tiles are buttons, so the orbit can be stepped through with the keyboard. */
import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditorialLink } from "./ui";
import { useLocale } from "@/lib/i18n/client";
import { V6_BASE } from "@/lib/v6-routes";
import "./orbit.css";

type Tile = { word: string; src: string; alt: string };

export const ORBIT: Tile[] = [
  { word: "checkout", src: "/home/orbit/checkout.jpg", alt: "The pricing page of Lumen Notes, a Vraelis demo app" },
  { word: "drone panel", src: "/home/orbit/drone.jpg", alt: "A quadcopter holding in the air" },
  { word: "sign-up", src: "/home/orbit/signup.jpg", alt: "The sign-in page of Notewell, a Vraelis demo app built with Lovable" },
  { word: "device panel", src: "/home/orbit/board.jpg", alt: "A small microcontroller board" },
  { word: "agent's change", src: "/home/orbit/agent.jpg", alt: "A coding agent calling the Vraelis verify tool" },
  { word: "fleet console", src: "/home/orbit/fleet.jpg", alt: "The Fieldline fleet console, a Vraelis demo fixture" },
  { word: "client's site", src: "/home/orbit/client.jpg", alt: "The landing page of Notewell, a Vraelis demo app" },
  { word: "vehicle portal", src: "/home/orbit/truck.jpg", alt: "A pickup truck on a road at dusk" },
  { word: "release", src: "/home/orbit/release.jpg", alt: "A deploy pipeline running the Vraelis command" },
  { word: "dashboard", src: "/home/orbit/dashboard.jpg", alt: "The project dashboard of a Vraelis demo fixture" },
  { word: "flight dashboard", src: "/home/orbit/plane.jpg", alt: "An aircraft on a runway at dusk" },
];

const REV_MS = 64000;

export function Orbit() {
  const field = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const measure = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState<number | null>(null);
  const [wordW, setWordW] = useState<number | null>(null);
  const shown = held ?? active;
  // In English only the noun swaps, as on scale.com. Other languages do not put the noun in the same place
  // (German: "Wissen, dass Ihr Checkout funktioniert"), so there each tile swaps a whole sentence, which the
  // page translator translates as one string.
  const en = useLocale() === "en";

  // The word slot animates to the width of the word it is about to show.
  useLayoutEffect(() => {
    if (measure.current) setWordW(measure.current.getBoundingClientRect().width);
  }, [shown]);

  // The orbit. Positions are written straight to the tiles each frame; React only hears about the word.
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = performance.now(), phase = 0, visible = true, auto = 0;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(el);
    const place = () => {
      const w = el.clientWidth, h = el.clientHeight;
      const rx = w * (w < 700 ? 0.42 : 0.4), ry = h * (w < 700 ? 0.44 : 0.36);
      ORBIT.forEach((_, i) => {
        const t = tiles.current[i];
        if (!t) return;
        const a = phase + (i / ORBIT.length) * Math.PI * 2;
        const depth = (Math.sin(a) + 1) / 2;               // 0 at the back of the ring, 1 at the front
        const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
        const s = 0.62 + depth * 0.5;
        t.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
        t.style.zIndex = String(10 + Math.round(depth * 20));
        t.style.setProperty("--d", depth.toFixed(3));
      });
    };
    const frame = (now: number) => {
      const dt = Math.min(64, now - last); last = now;
      const hovering = el.dataset.hold === "1";
      if (!still && visible && !hovering) {
        phase += (dt / REV_MS) * Math.PI * 2;
        // With nothing held, the word follows the tile nearest the front every few seconds.
        auto += dt;
        if (auto > 2600) { auto = 0; setActive((a) => (a + 1) % ORBIT.length); }
      }
      place();
      raf = requestAnimationFrame(frame);
    };
    place();
    raf = requestAnimationFrame(frame);
    const onResize = () => place();
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("resize", onResize); };
  }, []);

  const hold = (i: number | null) => {
    setHeld(i);
    if (field.current) field.current.dataset.hold = i === null ? "0" : "1";
  };

  return (
    <section className="v6-or" aria-labelledby="v6-or-h" data-nav-dark data-nav-theme="dark">
      <div ref={field} className="v6-or__field" data-hold="0">
        {ORBIT.map((t, i) => (
          <button
            key={t.word} type="button" className="v6-or__tile" data-on={i === shown}
            ref={(b) => { tiles.current[i] = b; }}
            onMouseEnter={() => hold(i)} onMouseLeave={() => hold(null)}
            onFocus={() => hold(i)} onBlur={() => hold(null)}
            onClick={() => hold(held === i ? null : i)}
            aria-label={`Know your ${t.word} works.`} aria-pressed={i === shown}
          >
            <Image src={t.src} alt={t.alt} fill sizes="200px" />
          </button>
        ))}

        <div className="v6-or__copy">
          <h2 id="v6-or-h" className="v6-or__h">
            {en ? (
              <>
                <span className="v6-or__l1">Know your</span>
                <span className="v6-or__l2">
                  <span className="v6-or__slot" style={wordW ? { width: wordW } : undefined} aria-live="polite">
                    {ORBIT.map((t, i) => (
                      <span key={t.word} className="v6-or__w" data-on={i === shown} aria-hidden={i !== shown}>{t.word}</span>
                    ))}
                  </span>
                  <span className="v6-or__end">works.</span>
                </span>
                <span ref={measure} className="v6-or__measure" aria-hidden>{ORBIT[shown].word}</span>
              </>
            ) : (
              <span className="v6-or__whole" aria-live="polite">
                {ORBIT.map((t, i) => (
                  <span key={t.word} className="v6-or__s" data-on={i === shown} aria-hidden={i !== shown}>{`Know your ${t.word} works.`}</span>
                ))}
              </span>
            )}
          </h2>
          <p className="v6-or__d">Anything a browser can reach: web apps, your agent&apos;s work, and the panels that run devices.</p>
          <EditorialLink href={`${V6_BASE}/platform#coverage`}>What it can check today</EditorialLink>
        </div>
      </div>
    </section>
  );
}
