"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type MouseEvent } from "react";
import { INTRO_STYLE_ID } from "./scripts";

// THE LOGO INTRO (founder, 2026-10-10: "what SpaceX AI did ... the text and logo part").
//
// x.ai opens on its full wordmark; the letters break up and collapse into the mark while the nav slides into the
// space they leave. Ours: the Vraelis lockup holds, "Vraelis" breaks into short fragments right to left that travel
// into the mark through the spectral light, the mark carries the colour and cools to white, and the nav slides
// left. About 3.6 seconds, once per document load, never on hover, nothing at all under reduced motion.
//
// No layout moves: the brand box is always the mark's width. The wordmark is absolutely placed after it and the nav
// is only TRANSFORMED out of its way, so the intro costs no layout shift. The starting state is set before first
// paint by INTRO_SCRIPT (a style element, because React compares attributes on <html> when it hydrates), and this
// component plays the animation and removes that style when it finishes.
//
// The mark is the faceted diamond in the live header (public/mark.svg); the founder chose it on 2026-10-10.


const FACETS: [string, string][] = [
  ["M6.27 2.15 L17.73 2.15 L15.99 8.79 L8.07 8.79 Z", "#EDEDEF"],
  ["M1.5 8.79 L6.27 2.15 L8.07 8.79 Z", "#BDBCC1"],
  ["M17.73 2.15 L22.5 8.79 L15.99 8.79 Z", "#7E7E80"],
  ["M1.5 8.79 L8.07 8.79 L12 21.85 Z", "#D7D7D9"],
  ["M8.07 8.79 L12 8.79 L12 21.85 Z", "#F8F8FA"],
  ["M12 8.79 L15.99 8.79 L12 21.85 Z", "#98979C"],
  ["M15.99 8.79 L22.5 8.79 L12 21.85 Z", "#6C6C6E"],
];
const OUTLINE = "M6.27 2.15 L17.73 2.15 L22.5 8.79 L12 21.85 L1.5 8.79 Z";

export function Mark({ title, gradientId }: { title?: string; gradientId?: string }) {
  return (
    <svg viewBox="0 0 24 24" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {FACETS.map(([d, fill]) => <path key={d} d={d} fill={fill} />)}
      {gradientId ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5EE6FF" /><stop offset=".5" stopColor="#8B7CFF" /><stop offset="1" stopColor="#FF5FA2" />
            </linearGradient>
          </defs>
          <path className="v8-brand__tint" d={OUTLINE} fill={`url(#${gradientId})`} style={{ opacity: 0 }} />
        </>
      ) : null}
    </svg>
  );
}

const SPEC: [number, number, number][] = [[94, 230, 255], [139, 124, 255], [255, 95, 162]];
function spec(t: number) {
  const c = Math.max(0, Math.min(1, t)), s = c * 2, i = Math.min(1, Math.floor(s)), f = s - i, a = SPEC[i], b = SPEC[i + 1];
  return `rgb(${(a[0] + (b[0] - a[0]) * f) | 0},${(a[1] + (b[1] - a[1]) * f) | 0},${(a[2] + (b[2] - a[2]) * f) | 0})`;
}
const easeInOut = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function Brand({ home, navId }: { home: string; navId: string }) {
  const brand = useRef<HTMLAnchorElement>(null);
  const word = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const pending = document.getElementById(INTRO_STYLE_ID);
    const b = brand.current, w = word.current, nav = document.getElementById(navId);
    if (!pending || !b || !w || !nav) return;
    let raf = 0, cancelled = false;
    const tint = b.querySelector<SVGPathElement>(".v8-brand__tint");
    const finish = () => {
      cancelAnimationFrame(raf);
      b.querySelector("canvas")?.remove();
      w.style.opacity = "";
      nav.style.transform = "";
      tint?.style.setProperty("opacity", "0");
      document.getElementById(INTRO_STYLE_ID)?.remove();
    };
    const start = async () => {
      try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 700))]); } catch { /* fonts API missing */ }
      if (cancelled) return;
      // The link is padded past the diamond for a larger click area; the shift and the collapse target use the
      // diamond itself.
      const br = b.getBoundingClientRect(), wr = w.getBoundingClientRect();
      const mr = b.querySelector(".v8-brand__mark")?.getBoundingClientRect() ?? br;
      const shift = Math.round(wr.right - mr.right + 4);
      nav.style.setProperty("--v8-shift", `${shift}px`);
      // Rasterise the wordmark once, then draw it as fragments.
      const dpr = Math.max(1, Math.min(2, Math.round(window.devicePixelRatio || 1)));
      const W = Math.ceil(wr.width) + 2, H = Math.ceil(wr.height) + 8;
      const off = document.createElement("canvas"); off.width = W * dpr; off.height = H * dpr;
      const o = off.getContext("2d"); if (!o) return finish();
      const cs = getComputedStyle(w);
      o.scale(dpr, dpr); o.fillStyle = "#fff"; o.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; o.textBaseline = "middle"; o.fillText(w.textContent || "Vraelis", 0, H / 2);
      const px = o.getImageData(0, 0, off.width, off.height).data;
      const parts: { x: number; y: number; a: number; r: number; j: number }[] = [];
      for (let y = 0; y < off.height; y += dpr) for (let x = 0; x < off.width; x += dpr) {
        const a = px[(y * off.width + x) * 4 + 3]; if (a > 90) parts.push({ x: x / dpr, y: y / dpr, a: a / 255, r: Math.random(), j: Math.random() - .5 });
      }
      const pad = 26, ox = wr.left - br.left, oy = wr.top - br.top + (wr.height - H) / 2;
      const cv = document.createElement("canvas");
      cv.width = (W + ox + pad * 2) * dpr; cv.height = (H + pad * 2) * dpr;
      Object.assign(cv.style, { width: `${W + ox + pad * 2}px`, height: `${H + pad * 2}px`, left: `${-pad}px`, top: `${oy - pad}px` });
      cv.setAttribute("aria-hidden", "true");
      b.appendChild(cv);
      const c = cv.getContext("2d"); if (!c) return finish();
      c.scale(dpr, dpr);
      w.style.opacity = "0";
      const HOLD = 1500, SWEEP = 900, COLLAPSE = 700, COOL = 900, target = mr.left - br.left + mr.width / 2 - ox, t0 = performance.now();
      let collapsed = false;
      const frame = (now: number) => {
        const t = now - t0, st = (t - HOLD) / SWEEP;
        c.clearRect(0, 0, cv.width, cv.height);
        for (const p of parts) {
          const order = 1 - p.x / W, rel = st - order * .75 - p.r * .12;
          if (rel <= 0) { c.globalAlpha = p.a; c.fillStyle = "#FAFAFA"; c.fillRect(p.x + ox + pad, p.y + pad, 1, 1); continue; }
          const k = Math.min(1, rel / .45), e = easeInOut(k);
          const x = p.x + (target - p.x) * e + p.j * 14 * Math.sin(k * Math.PI), y = p.y + p.j * 6 * k;
          c.fillStyle = spec(1 - (p.x / W) * .9 + k * .3);
          c.globalAlpha = p.a * (1 - k) * (k < .15 ? k / .15 : 1);
          c.fillRect(x + ox + pad, y + pad, 1 + 3 * k * (.5 + p.r), 1);
        }
        c.globalAlpha = 1;
        const arrive = (t - HOLD - SWEEP * .45) / 600, cool = (t - HOLD - SWEEP - COLLAPSE * .3) / COOL;
        tint?.style.setProperty("opacity", String(Math.max(0, Math.min(1, arrive)) * (1 - Math.max(0, Math.min(1, cool)))));
        if (t > HOLD + SWEEP * .55 && !collapsed) { collapsed = true; nav.style.transform = "translateX(0)"; }
        if (t < HOLD + SWEEP + COLLAPSE + COOL) raf = requestAnimationFrame(frame); else finish();
      };
      raf = requestAnimationFrame(frame);
    };
    start();
    return () => { cancelled = true; finish(); };
  }, [navId]);

  // x.ai's logo: from another page it goes home; on the homepage it glides back to the top, and at the top it reloads.
  const pathname = usePathname();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (pathname !== home && pathname !== `${home}/`) return;
    e.preventDefault();
    if (window.scrollY > 4) window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    else window.location.reload();
  };

  return (
    <Link ref={brand} href={home} className="v8-brand" aria-label="Vraelis home" onClick={onClick}>
      <span className="v8-brand__mark"><Mark gradientId="v8-mark-spec" /></span>
      <span ref={word} className="v8-brand__word" aria-hidden="true">Vraelis</span>
    </Link>
  );
}
