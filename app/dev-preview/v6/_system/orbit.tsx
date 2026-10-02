"use client";

/* WHAT IT CHECKS, AS AN ORBIT (2026-10-01).

   Adapted from the closing section of scale.com, as the founder asked: pictures of what the product is for
   circle a two-line headline, and pointing at one stops the orbit and swaps the headline's word for it.
   Ours reads "Know your ___ works."

   THE WORDS ARE HELD TO WHAT IS LIVE. Web apps and agents are checked directly; a device, a vehicle or an
   aircraft is only checked through the web panel that runs it (_content/coverage.ts), so every device word
   names the panel ("drone panel", "fleet console"), never the machine. The pictures are real photographs
   under a free commercial licence (public/home/orbit/CREDITS.md); the founder found the first set, cut from
   our own screenshots and renders, poor next to scale.com's.

   Motion: one slow revolution a minute, paused on hover or focus, and not at all with reduced motion. The
   tiles are buttons, so the orbit can be stepped through with the keyboard. The headline holds its word until
   a tile is pointed at, tapped or focused, as scale.com's does (it used to change word every 2.6 s on its
   own). A tap holds a tile and a second tap, or a tap anywhere else, lets it go. The ring also has its own
   pause button, like the film's, because anything that moves for more than five seconds must be pausable
   without having to point at it (WCAG 2.2.2); with reduced motion it starts paused and only that button
   starts it.

   (The airliner's flight deck left the ring 2026-10-01: next to "flight dashboard" it said we check an
   aircraft's instruments, and only web panels are live.) */
import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type PointerEvent } from "react";
import { EditorialLink } from "./ui";
import { useLocale } from "@/lib/i18n/client";
import { V6_BASE } from "@/lib/v6-routes";
import "./orbit.css";

type Tile = { word: string; src: string; alt: string; ar: number };

// Real photographs, each cut to the shape it was taken in (ar = width / height), as scale.com's are. Sources
// and licences: public/home/orbit/CREDITS.md.
export const ORBIT: Tile[] = [
  { word: "checkout", src: "/home/orbit/photo-checkout.jpg", alt: "A card held to a card reader", ar: 1 },
  { word: "drone panel", src: "/home/orbit/photo-drone.jpg", alt: "A drone against an evening sky", ar: 0.8 },
  { word: "sign-up", src: "/home/orbit/photo-signup.jpg", alt: "Hands on a laptop keyboard in the dark", ar: 1.2 },
  { word: "device panel", src: "/home/orbit/photo-device.jpg", alt: "A circuit board inside a device", ar: 1 },
  { word: "agent's change", src: "/home/orbit/photo-agent.jpg", alt: "Code on a laptop screen", ar: 1.2 },
  { word: "fleet console", src: "/home/orbit/photo-fleet.jpg", alt: "A person flying a drone at dusk", ar: 0.8 },
  { word: "client's site", src: "/home/orbit/photo-client.jpg", alt: "A person working at two monitors", ar: 1.2 },
  { word: "vehicle portal", src: "/home/orbit/photo-vehicle.jpg", alt: "A truck on a road at dusk", ar: 1.2 },
  { word: "release", src: "/home/orbit/photo-release.jpg", alt: "A server rack lit green", ar: 0.8 },
  { word: "dashboard", src: "/home/orbit/photo-dashboard.jpg", alt: "A person reading a dashboard", ar: 1 },
  { word: "robot console", src: "/home/orbit/photo-robot.jpg", alt: "A robot arm building a lattice", ar: 1 },
  { word: "mission console", src: "/home/orbit/photo-mission.jpg", alt: "An operations room at night", ar: 1.2 },
];

const REV_MS = 64000;

// Read as a store, so the server renders a turning ring and the browser corrects it without a mismatch.
const REDUCE = "(prefers-reduced-motion: reduce)";
const onReduceChange = (cb: () => void) => {
  const m = window.matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export function Orbit() {
  const field = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const measure = useRef<HTMLSpanElement>(null);
  const [held, setHeld] = useState<number | null>(null);
  const [wordW, setWordW] = useState<number | null>(null);
  const shown = held ?? 0;
  // Paused by the ring's button, or by reduced motion until the button is pressed. The frame loop reads the
  // ref; sync starts or stops the loop after anything it reads changes (the orbit effect fills it in).
  const reduced = useSyncExternalStore(onReduceChange, () => window.matchMedia(REDUCE).matches, () => false);
  const [choice, setChoice] = useState<boolean | null>(null);
  const paused = choice ?? reduced;
  const pausedRef = useRef(false);
  const sync = useRef(() => {});
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
    let raf = 0, last = 0, phase = 0, inView = false;
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
    // A frame is only asked for while the ring is on screen and free to turn. Off screen, paused or held, the
    // loop stops instead of redrawing the same positions on the main thread, and a resize re-places the
    // tiles once.
    const turning = () => inView && !pausedRef.current && el.dataset.hold !== "1";
    const frame = (now: number) => {
      phase += (Math.max(0, Math.min(64, now - last)) / REV_MS) * Math.PI * 2; last = now;
      place();
      raf = turning() ? requestAnimationFrame(frame) : 0;
    };
    sync.current = () => {
      if (!turning()) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    const io = new IntersectionObserver((es) => { inView = es[es.length - 1].isIntersecting; sync.current(); }, { threshold: 0 });
    io.observe(el);
    place();
    const onResize = () => { if (!raf) place(); };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf); sync.current = () => {};
      io.disconnect(); window.removeEventListener("resize", onResize);
    };
  }, []);
  useEffect(() => { pausedRef.current = paused; sync.current(); }, [paused]);

  const hold = (i: number | null) => {
    setHeld(i);
    if (field.current) field.current.dataset.hold = i === null ? "0" : "1";
    sync.current();
  };
  // The button also lets go of a held tile, as any tap outside the tile does, so Play always turns the ring.
  // The ref is set here too, so letting go does not start the loop for a frame before a pause lands.
  const toggle = () => {
    pausedRef.current = !paused;
    setChoice(!paused);
    if (held !== null) hold(null);
  };
  // A pointer hovering holds a tile; a touch does not hover, so there a tap holds it and a second tap lets go.
  const onEnter = (i: number) => (e: PointerEvent) => { if (e.pointerType === "mouse") hold(i); };
  const onLeave = (e: PointerEvent) => { if (e.pointerType === "mouse") hold(null); };
  const onClick = (i: number) => (e: MouseEvent) => {
    if ((e.nativeEvent as globalThis.PointerEvent).pointerType === "mouse") return; // the hover already holds it
    hold(held === i ? null : i);
  };
  // A tap anywhere outside the ring lets a held tile go.
  useEffect(() => {
    if (held === null) return;
    const away = (e: globalThis.PointerEvent) => { if (!field.current?.contains(e.target as Node)) hold(null); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [held]);

  return (
    <section className="v6-or" aria-labelledby="v6-or-h" data-nav-dark data-nav-theme="dark">
      <div ref={field} className="v6-or__field" data-hold="0">
        {ORBIT.map((t, i) => (
          <button
            key={t.word} type="button" className="v6-or__tile" data-on={i === shown} style={{ ["--ar" as string]: t.ar }}
            ref={(b) => { tiles.current[i] = b; }}
            onPointerEnter={onEnter(i)} onPointerLeave={onLeave}
            onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) hold(i); }} onBlur={() => hold(null)}
            onClick={onClick(i)}
            aria-label={`Know your ${t.word} works.`} aria-pressed={i === shown}
          >
            <Image src={t.src} alt={t.alt} fill sizes="200px" />
          </button>
        ))}

        <div className="v6-or__copy">
          {/* One stable sentence for screen readers and search; the moving words below are a picture of it. */}
          <h2 id="v6-or-h" className="v6-or__h">
            <span className="v6-or__sr">Know your checkout, sign-up, release and device panels work.</span>
            <span className="v6-or__vis" aria-hidden>
            {en ? (
              <>
                <span className="v6-or__l1">Know your</span>
                <span className="v6-or__l2">
                  <span className="v6-or__slot" style={wordW ? { width: wordW } : undefined}>
                    {ORBIT.map((t, i) => (
                      <span key={t.word} className="v6-or__w" data-on={i === shown}>{t.word}</span>
                    ))}
                  </span>
                  <span className="v6-or__end">works.</span>
                </span>
                <span ref={measure} className="v6-or__measure" aria-hidden>{ORBIT[shown].word}</span>
              </>
            ) : (
              <span className="v6-or__whole">
                {ORBIT.map((t, i) => (
                  <span key={t.word} className="v6-or__s" data-on={i === shown}>{`Know your ${t.word} works.`}</span>
                ))}
              </span>
            )}
            </span>
          </h2>
          <p className="v6-or__d">Web apps at a public address, your agent&apos;s work, and the panels that run devices.</p>
          <EditorialLink href={`${V6_BASE}/platform#coverage`}>What it can check today</EditorialLink>
        </div>

        <button type="button" className="v6-or__pause" onClick={toggle} aria-label={paused ? "Play the orbit" : "Pause the orbit"}>
          {paused
            ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M5 3.2v9.6L12.5 8z" fill="currentColor" /></svg>
            : <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
        </button>
      </div>
    </section>
  );
}
