"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type MouseEvent } from "react";
import { INTRO_CSS, INTRO_STYLE_ID } from "./scripts";
import { SPECTRUM_HEX, spectrumAt } from "./spectrum";

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
//
// The word is an OUTLINE, not live text (founder, 2026-10-10: "it should load as 1"). As text it painted in a
// fallback font and swapped to Manrope a moment later, so the lockup arrived in two steps; as a path it paints in
// the same frame as the mark. "Vraelis" in Manrope 600 at -0.012em tracking, kerned by HarfBuzz, outlined with
// fontTools; units of a 2000-unit em, baseline at y = 0, ink from y = -1470 to 30.
export const WORDMARK_D = "M478 0 10 -1440H227L626 -211L1030 -1440H1247L779 0ZM1373 0V-1080H1559V-818L1533 -852Q1553 -904 1585 -947Q1617 -991 1659 -1019Q1700 -1049 1751 -1066Q1801 -1082 1854 -1085Q1907 -1089 1956 -1080V-884Q1903 -898 1839 -892Q1774 -886 1720 -851Q1669 -818 1640 -771Q1610 -724 1597 -666Q1584 -609 1584 -545V0ZM2397 30Q2277 30 2196 -14Q2115 -59 2073 -132Q2032 -206 2032 -294Q2032 -376 2061 -438Q2090 -500 2147 -544Q2204 -587 2287 -614Q2359 -635 2450 -651Q2541 -667 2641 -681Q2742 -695 2841 -709L2765 -667Q2767 -794 2711 -855Q2656 -917 2521 -917Q2436 -917 2365 -877Q2294 -838 2266 -747L2071 -807Q2111 -946 2223 -1028Q2336 -1110 2523 -1110Q2668 -1110 2775 -1060Q2883 -1011 2933 -904Q2959 -851 2965 -792Q2971 -733 2971 -665V0H2786V-247L2822 -215Q2755 -91 2651 -31Q2548 30 2397 30ZM2434 -141Q2523 -141 2587 -172Q2651 -204 2690 -253Q2729 -302 2741 -355Q2758 -403 2760 -463Q2763 -523 2763 -559L2831 -534Q2732 -519 2651 -507Q2570 -495 2505 -483Q2439 -472 2388 -456Q2345 -441 2311 -420Q2278 -399 2258 -369Q2239 -339 2239 -296Q2239 -254 2260 -219Q2281 -183 2324 -162Q2367 -141 2434 -141ZM3686 30Q3525 30 3404 -41Q3282 -111 3215 -238Q3147 -364 3147 -531Q3147 -708 3214 -838Q3280 -968 3399 -1039Q3518 -1110 3676 -1110Q3841 -1110 3957 -1033Q4073 -957 4130 -816Q4188 -675 4176 -481H3967V-557Q3965 -745 3895 -835Q3826 -925 3684 -925Q3527 -925 3448 -826Q3369 -727 3369 -540Q3369 -362 3448 -265Q3527 -167 3676 -167Q3774 -167 3845 -212Q3917 -256 3957 -339L4162 -274Q4099 -129 3971 -50Q3843 30 3686 30ZM3301 -481V-644H4072V-481ZM4396 0V-1470H4605V0ZM4901 -1257V-1460H5110V-1257ZM4901 0V-1080H5110V0ZM5799 29Q5602 29 5478 -58Q5354 -145 5326 -303L5540 -336Q5560 -252 5633 -203Q5705 -155 5813 -155Q5911 -155 5966 -195Q6022 -235 6022 -305Q6022 -346 6003 -371Q5983 -397 5921 -420Q5859 -443 5732 -477Q5593 -513 5511 -554Q5430 -596 5396 -651Q5361 -707 5361 -786Q5361 -884 5413 -957Q5465 -1030 5560 -1070Q5654 -1110 5781 -1110Q5905 -1110 6002 -1071Q6099 -1032 6159 -960Q6219 -889 6231 -793L6017 -754Q6006 -832 5944 -877Q5882 -922 5783 -926Q5688 -930 5629 -894Q5570 -859 5570 -797Q5570 -761 5593 -736Q5615 -711 5680 -688Q5745 -665 5872 -633Q6008 -598 6088 -555Q6168 -513 6203 -455Q6237 -396 6237 -313Q6237 -153 6121 -62Q6004 29 5799 29Z";
const WM_BOX = { x: 10, y: -1470, w: 6227, h: 1500 };

/** The outlined "Vraelis", sized by its height in px (a 21px font is 15.75px of ink). */
export function Wordmark({ height }: { height: number }) {
  const w = +(height * WM_BOX.w / WM_BOX.h).toFixed(2);
  return (
    <svg viewBox={`${WM_BOX.x} ${WM_BOX.y} ${WM_BOX.w} ${WM_BOX.h}`} width={w} height={height} fill="currentColor" aria-hidden="true" focusable="false">
      <path d={WORDMARK_D} />
    </svg>
  );
}


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
              {SPECTRUM_HEX.map((c, i) => <stop key={c} offset={i / (SPECTRUM_HEX.length - 1)} stopColor={c} />)}
            </linearGradient>
          </defs>
          <path className="v8-brand__tint" d={OUTLINE} fill={`url(#${gradientId})`} style={{ opacity: 0 }} />
        </>
      ) : null}
    </svg>
  );
}

// The shared spectrum (spectrum.ts): the same colours as the hero keyword and the Latest chip.
const spec = spectrumAt;
const easeInOut = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Smoothly back to the top, even mid-scroll: wheel and touch scrolling are held off until the glide lands, because a
 *  momentum scroll still in flight would otherwise cancel it. */
export function glideToTop() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { window.scrollTo({ top: 0 }); return; }
  const hold = (e: Event) => e.preventDefault();
  const opts = { passive: false } as const;
  window.addEventListener("wheel", hold, opts); window.addEventListener("touchmove", hold, opts);
  const t0 = performance.now();
  const release = () => { window.removeEventListener("wheel", hold); window.removeEventListener("touchmove", hold); };
  const watch = () => { if (window.scrollY <= 1 || performance.now() - t0 > 1400) release(); else requestAnimationFrame(watch); };
  window.scrollTo({ top: 0, behavior: "smooth" });
  requestAnimationFrame(watch);
}

/** Dispatched on window to end a playing intro at once, on the mark (the phone menu opening). */
export const INTRO_SKIP = "v8:intro-skip";

export function Brand({ home, navId }: { home: string; navId: string }) {
  const brand = useRef<HTMLAnchorElement>(null);
  const word = useRef<HTMLSpanElement>(null);
  const replay = useRef<(() => void) | null>(null);

  useEffect(() => {
    const b = brand.current, w = word.current, nav = document.getElementById(navId);
    if (!b || !w || !nav) return;
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
      const ink = getComputedStyle(w).color; // the theme's ink, so the held word is dark on the light ground
      const k = wr.height / WM_BOX.h;
      o.scale(dpr, dpr); o.translate(1 - WM_BOX.x * k, (H - wr.height) / 2 - WM_BOX.y * k); o.scale(k, k);
      o.fillStyle = "#fff"; o.fill(new Path2D(WORDMARK_D));
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
          if (rel <= 0) { c.globalAlpha = p.a; c.fillStyle = ink; c.fillRect(p.x + ox + pad, p.y + pad, 1, 1); continue; }
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
    if (document.getElementById(INTRO_STYLE_ID)) start();
    // Coming back to the page from another site with Back restores it from the browser's page cache without a load,
    // so replay the intro then too (founder 2026-10-10: "when they go off page and come back, then it does replay").
    // A replay on a live page eases into the held state instead of snapping to it (founder, 2026-10-11: going home
    // "does it but it's not smooth, just pops in"): the name fades in while the menu glides over on its own .7s
    // transition, and the sweep starts once both have settled. A full load needs none of this: the held state is
    // already painted before the first frame.
    let settle = 0;
    replay.current = () => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      finish(); clearTimeout(settle);
      w.style.transition = "opacity .45s var(--ease)";
      const s = document.createElement("style"); s.id = INTRO_STYLE_ID; s.textContent = INTRO_CSS; document.head.appendChild(s);
      settle = window.setTimeout(() => { w.style.transition = ""; cancelled = false; start(); }, 650);
    };
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) replay.current?.(); };
    const onSkip = () => { cancelled = true; clearTimeout(settle); w.style.transition = ""; finish(); };
    window.addEventListener("pageshow", onShow);
    window.addEventListener(INTRO_SKIP, onSkip);
    return () => { cancelled = true; clearTimeout(settle); finish(); replay.current = null; window.removeEventListener("pageshow", onShow); window.removeEventListener(INTRO_SKIP, onSkip); };
  }, [navId]);

  // x.ai's logo: from another page it goes home; on the homepage it glides back to the top, and at the top it reloads.
  const pathname = usePathname();
  // Arriving home from another page of the site replays the intro too (founder, 2026-10-11: "whenever they go back
  // home it should always repeat"); before, only a full load, a Back from another site or the reload at the top did.
  const last = useRef(pathname);
  useEffect(() => {
    const isHome = (p: string) => p === home || p === `${home}/`;
    const from = last.current; last.current = pathname;
    if (isHome(pathname) && !isHome(from)) replay.current?.();
  }, [pathname, home]);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (pathname !== home && pathname !== `${home}/`) return;
    e.preventDefault();
    if (window.scrollY > 4) glideToTop();
    else window.location.reload();
  };

  return (
    <Link ref={brand} href={home} className="v8-brand" aria-label="Vraelis home" onClick={onClick}>
      <span className="v8-brand__mark"><Mark gradientId="v8-mark-spec" /></span>
      <span ref={word} className="v8-brand__word" aria-hidden="true"><Wordmark height={15.75} /></span>
    </Link>
  );
}
