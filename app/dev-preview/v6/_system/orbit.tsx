"use client";

// All subjects share one evenly spaced, visible track. Only adjacent tiles respond to focus.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EditorialLink } from "./ui";
import { HEADLINE } from "./positioning";
import { V6_BASE } from "@/lib/v6-routes";
import { orbitRoute, type OrbitWord } from "../_content/sectors";
import "./orbit.css";

// pos: where the 4:3 frame crops a photograph cut to another shape (CSS object-position), when the middle is wrong.
type Photo = { readonly src: string; readonly alt: string; readonly pos?: string };
// narrow: the sentence wraps in a narrower measure without balancing (orbit.css), so "AI-built" is never broken at
// its hyphen. The sentence stays one plain string for the translator.
type LiveTile = { word: OrbitWord; label: string; sentence: string; narrow?: true; next?: undefined; photos: readonly Photo[] };
type NextTile = { next: true; label: string; word?: undefined; sentence?: undefined; narrow?: undefined; photos: readonly Photo[] };
type Tile = LiveTile | NextTile;

const pic = (name: string, alt: string, pos?: string): Photo => ({ src: `/home/orbit/photo-${name}.jpg`, alt, pos });

// All subjects share the ring equally. The overview stays broad until a tile is hovered or focused.
export const ORBIT: readonly Tile[] = [
  { word: "commercial", label: "Commercial and retail", sentence: "Know your checkout works",
    photos: [pic("checkout", "A card held to a card reader", "50% 65%")] },
  { word: "drones", label: "Drones and aviation", sentence: "Know your drone panel works",
    photos: [pic("drone", "A drone against an evening sky"), pic("flight", "An airliner cockpit lit at night over a city"), pic("fleet", "A person flying a drone at dusk", "50% 22%")] },
  { word: "developers", label: "Developers", sentence: "Know your release works",
    photos: [pic("agent", "Code on a laptop screen"), pic("release", "A server rack lit green")] },
  { word: "government", label: "Government", sentence: "Know your public service works",
    photos: [pic("public", "An arched hall inside a state capitol")] },
  { next: true, label: "Desktop and mobile apps",
    photos: [pic("electron", "A desktop editing app open on a laptop"), pic("mobile", "A phone held at night against city lights", "50% 62%")] },
  { word: "fintech", label: "Fintech and banking", sentence: "Know your banking app works",
    photos: [pic("banking", "A hand holding a phone calculator over banknotes", "50% 58%")] },
  { word: "robotics", label: "Robotics and manufacturing", sentence: "Know your robot console works",
    photos: [pic("robot", "A robot arm building a lattice", "50% 60%"), pic("device", "A circuit board inside a device")] },
  { next: true, label: "SDKs and scripts", photos: [pic("script", "Python code that collects statuses on a dark screen")] },
  { word: "ai-built-apps", label: "AI-built apps", sentence: "Know your AI-built app works", narrow: true,
    photos: [pic("aiapp", "An app open on a tablet in low light")] },
  { word: "logistics", label: "Logistics and vehicles", sentence: "Know your fleet portal works",
    photos: [pic("vehicle", "A truck on a road at dusk"), pic("robotfleet", "A row of delivery robots waiting on a pavement", "50% 55%")] },
  { next: true, label: "Devices and firmware", photos: [pic("firmware", "A small development board on a dark table")] },
  { word: "military", label: "Military", sentence: "Know your mission software works",
    photos: [pic("targeting", "A radar scope and a track readout on a console", "50% 45%"), pic("mission", "An operations room at night"), pic("groundstation", "A hand on a control stick beside a map display")] },
  { word: "saas", label: "SaaS and startups", sentence: "Know your product works",
    photos: [pic("dashboard", "A person reading a dashboard"), pic("signup", "Hands on a laptop keyboard in the dark")] },
  { word: "agencies", label: "Agencies", sentence: "Know your client's site works",
    photos: [pic("agent", "Code photographed on a laptop screen")] },
];


const ROUTE = ORBIT.map(t => t.next ? { href: `${V6_BASE}/platform#coverage`, to: "Not built yet" } : orbitRoute(t.word) ?? { href: `${V6_BASE}/platform#coverage`, to: "What it can check today" });
const RING = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

export function Orbit() {
  const root = useRef<HTMLElement>(null);
  const tiles = useRef<(HTMLLIElement | null)[]>([]);
  const held = useRef<number | null>(null);
  const stopped = useRef(false);
  const wake = useRef<() => void>(() => {});
  const [selected, setSelected] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const select = (i: number) => { held.current = i; setSelected(i); wake.current(); };
  const release = () => { held.current = null; setSelected(null); wake.current(); };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const media = matchMedia(RING), reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0, height = 0, tile = 140, perimeter = 1, phase = 0, speed = 1, visible = false, raf = 0, last = 0;
    let points: { x: number; y: number; length: number }[] = [];
    const lifts = ORBIT.map(() => 0);
    const offsets = ORBIT.map(() => 0);
    const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
    wake.current = start;
    const measure = () => {
      width = el.clientWidth; height = el.clientHeight;
      tile = Math.min(160, Math.max(90, Math.min(width * .10, height * .21)));
      const rx = width / 2 - tile * .82 - 30, ry = height / 2 - tile * .7 - 24;
      points = [];
      perimeter = 0;
      for (let j = 0; j <= 512; j++) {
        const a = j / 512 * Math.PI * 2 + Math.PI / 2;
        const x = width / 2 + rx * Math.cos(a), y = height / 2 + ry * Math.sin(a);
        if (j) perimeter += Math.hypot(x - points[j - 1].x, y - points[j - 1].y);
        points.push({x, y, length: perimeter});
      }
      start();
    };
    const position = (distance: number) => {
      const target = ((distance % perimeter) + perimeter) % perimeter;
      let lo = 0, hi = points.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (points[mid].length < target) lo = mid; else hi = mid; }
      const a = points[lo], b = points[hi], u = (target - a.length) / Math.max(.001, b.length - a.length);
      return {x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u};
    };
    const frame = (time: number) => {
      raf = 0;
      const dt = Math.min(40, last ? time - last : 0); last = time;
      if (media.matches && points.length) {
        const h = held.current;
        const targetSpeed = stopped.current || h !== null ? 0 : 1;
        speed += (targetSpeed - speed) * (1 - Math.exp(-dt / 120));
        if (Math.abs(speed - targetSpeed) < .001) speed = targetSpeed;
        if (visible && !document.hidden && !reduced.matches) phase += dt * .022 * speed;
        ORBIT.forEach((_, i) => {
          const node = tiles.current[i]; if (!node) return;
          const diff = h === null ? ORBIT.length : Math.min((i - h + ORBIT.length) % ORBIT.length, (h - i + ORBIT.length) % ORBIT.length);
          const target = diff === 0 ? 1 : diff === 1 ? -.7 : diff === 2 ? -.3 : 0;
          lifts[i] = reduced.matches ? 0 : lifts[i] + (target - lifts[i]) * (1 - Math.exp(-dt / 170));
          const lift = lifts[i], scale = lift >= 0 ? 1 + lift * .22 : 1 + lift * .15;
          // Keep displacement continuous when the pointer leaves or selects another tile.
          const direction = h === null ? 0 : ((i - h + ORBIT.length) % ORBIT.length < ORBIT.length / 2 ? 1 : -1);
          const targetOffset = target < 0 ? -target * direction * 32 : 0;
          offsets[i] = reduced.matches ? 0 : offsets[i] + (targetOffset - offsets[i]) * (1 - Math.exp(-dt / 170));
          const p = position(phase + i * perimeter / ORBIT.length + offsets[i]);
          node.style.width = `${tile}px`;
          node.style.transform = `translate(${p.x - tile / 2}px, ${p.y - tile * .375}px) scale(${scale})`;
          node.style.filter = `blur(${lift < 0 ? -lift * 1.1 : 0}px)`;
          node.style.opacity = `${lift < 0 ? 1 + lift * .18 : 1}`;
          node.style.zIndex = diff === 0 ? "3" : "1";
        });
        el.dataset.ready = "true";
      } else {
        delete el.dataset.ready;
        tiles.current.forEach(node => { if (node) { node.style.width = ""; node.style.transform = ""; node.style.filter = ""; node.style.opacity = ""; } });
      }
      const moving = media.matches && visible && !document.hidden && !reduced.matches && (speed > 0 || (!stopped.current && held.current === null) || lifts.some((lift, i) => {
        const h = held.current;
        const d = h === null ? ORBIT.length : Math.min((i - h + ORBIT.length) % ORBIT.length, (h - i + ORBIT.length) % ORBIT.length);
        const target = d === 0 ? 1 : d === 1 ? -.7 : d === 2 ? -.3 : 0;
        const direction = h === null ? 0 : ((i - h + ORBIT.length) % ORBIT.length < ORBIT.length / 2 ? 1 : -1);
        const targetOffset = target < 0 ? -target * direction * 32 : 0;
        return Math.abs(lift - target) > .001 || Math.abs(offsets[i] - targetOffset) > .01;
      }));
      if (moving) raf = requestAnimationFrame(frame);
    };
    const resize = new ResizeObserver(measure); resize.observe(el);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); }, {rootMargin: "60px"}); observer.observe(el);
    media.addEventListener("change", measure); reduced.addEventListener("change", start); document.addEventListener("visibilitychange", start); measure();
    return () => { cancelAnimationFrame(raf); resize.disconnect(); observer.disconnect(); media.removeEventListener("change", measure); reduced.removeEventListener("change", start); document.removeEventListener("visibilitychange", start); wake.current = () => {}; };
  }, []);

  return <section ref={root} className="v6-or__field v6-dark" aria-labelledby="v6-or-h" data-nav-dark data-nav-theme="dark">
    <div className="v6-or__copy">
      <h2 id="v6-or-h" className="v6-or__h"><span className="v6-or__s" data-on={selected === null}>{HEADLINE}</span>{ORBIT.map((t, i) => <span key={t.label} className="v6-or__s" data-on={i === selected}>{t.next ? t.label : t.sentence}</span>)}</h2>
      <p className="v6-or__d">{selected !== null && ORBIT[selected].next ? "Not built yet" : "From everyday apps to the software behind connected machines"}</p>
      <EditorialLink href={selected === null ? `${V6_BASE}/platform#coverage` : ROUTE[selected].href}>{selected === null ? "See every sector" : ORBIT[selected].next ? "See what is planned" : "Explore this subject"}</EditorialLink>
    </div>
    <ul className="v6-or__tiles">
      {ORBIT.map((t, i) => <li key={t.label} ref={node => { tiles.current[i] = node; }} className="v6-or__item" data-on={i === selected}>
        <Link className="v6-or__tile" href={ROUTE[i].href} onPointerEnter={() => select(i)} onPointerLeave={release} onFocus={() => select(i)} onBlur={release}>
          <Image src={t.photos[0].src} alt={t.photos[0].alt} fill sizes="(max-width: 700px) 45vw, (max-width: 1023px) 30vw, 180px" style={{objectFit: "cover", objectPosition: t.photos[0].pos}} />
          <span className="v6-or__name">{t.label}{t.next ? ", not built yet" : ""}</span>
        </Link>
      </li>)}
    </ul>
    <button className="v6-or__pause" type="button" onClick={() => { stopped.current = !paused; setPaused(!paused); wake.current(); }} aria-label={paused ? "Play the orbit" : "Pause the orbit"}>
      {paused ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M5 3v10l8-5z" fill="currentColor" /></svg> : <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="2" /></svg>}
    </button>
  </section>;
}
