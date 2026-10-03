"use client";

/* WHAT IT CHECKS, AS AN ORBIT (2026-10-01; rebuilt 2026-10-02 evening from the founder's direction).

   The founder: the orbit "is supposed to be actual images that can be hovered on (real images) that takes them
   somewhere", with "a lot of kinds of subject": drones, planes, defense and strike systems, Electron apps, scripts,
   apps. So: twenty-three real photographs (public/home/orbit, every one credited in CREDITS.md) circle the
   headline "Know your ___ works.", every tile is a link, and pointing at one names it and says where it goes.

   THE WORDS ARE HELD TO WHAT IS LIVE (_content/coverage.ts). Nineteen tiles are checked today: web apps, an
   agent's work, and the web panel or console that runs a device. A device word names the panel or the console,
   never the machine. Their word can become the headline. Four tiles are Next, not built yet (Electron apps, SDKs
   and scripts, the device itself, native mobile apps): they carry a "Next" mark, link to the coverage list, and
   never become the headline. Where each word leads is the registry's ORBIT_ROUTE (_content/sectors.ts).

   THE LAYOUT. On a screen with a mouse, from 1024px wide, the tiles ride one closed track around the words: a
   rounded rectangle that keeps a margin from the section's edges, so no tile is ever cut off. As on a tilted ring
   seen from in front, the front (the bottom) is largest and brightest and the back (the top) smaller. The tiles
   stand in slots along the track, each slot long enough that neighbours keep at least 7% of their size apart
   even where the track turns a corner, and the whole ring moves in slots, so every tile drifts smoothly (SLOTS,
   below). The track and the tile size are solved from the section's size and the measured lines of the words, so
   the words never sit under a tile at any width or in any language (solveTrack).

   THE FAR SIDE (reviewed 2026-10-02 night). Twenty-three photographs all in sight at once around the words fit
   only at about 100 to 180px at 1440x900 (measured: no single ring of 23 averages more than about 140px there),
   and the top row then reads as a strip of thumbnails. So, as on a real ring, the middle of the top arc is the
   far side: a tile there recedes (it shrinks and fades) and comes back into sight on the other side. About
   fourteen are in sight at a time and every one passes the front each turn; the photographs in sight are about
   125 to 185px at 1440x900 and 160 to 245px at 1920x1080. The far side is only as wide as the screen needs: on a
   short screen, where the height limits the size anyway, it hides fewer tiles.

   Pointing at a tile (or focusing it from the keyboard) holds it: it comes forward a little with a thin light
   edge, a label appears on it or beside it, the other tiles dim, the drift stops, and a Live tile's word becomes
   the headline. A tile focused from the keyboard while on the far side is first turned into sight. Moving away
   lets it go and the drift resumes; the headline keeps the last word, as scale.com's does. A click or Enter opens
   the page. The ring turns once in REV_MS, only while it is on screen; its own button pauses it (WCAG 2.2.2).
   With reduced motion it never turns, nothing zooms and nothing slides, and it has no far side: all twenty-three
   stand still in sight, smaller.

   Without a mouse (phones, tablets, touch screens) and below 1024px there is nothing to point with, so the same
   links are cards with their label always under the photo, and one tap opens the page: two rows that swipe
   sideways on a phone (software above, the panels that run machines below), a grid above 700px.

   Every string is whole for the page translator (components/language-controller.tsx): one sentence per word for
   the headline, one label and one destination name per tile. A link's accessible name is its label and where it
   leads, read from those same visible strings (aria-labelledby), so it is translated with them. */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent } from "react";
import { EditorialLink } from "./ui";
import { V6_BASE } from "@/lib/v6-routes";
import { orbitRoute, type OrbitWord } from "../_content/sectors";
import "./orbit.css";

type Photo = { src: string; alt: string; ar: number };
// narrow: the sentence wraps in a narrower measure without balancing (orbit.css), so "AI-built" is never broken at
// its hyphen. The sentence stays one plain string for the translator.
type LiveTile = Photo & { word: OrbitWord; label: string; sentence: string; narrow?: true; next?: undefined };
type NextTile = Photo & { next: true; label: string; word?: undefined; sentence?: undefined; narrow?: undefined };
type Tile = LiveTile | NextTile;

// In ring order. Software sits at the even places and the panels that run machines at the odd ones, so the ring
// alternates and a phone's two rows split cleanly; the four Next tiles are spread around (2, 8, 15, 20), and
// checkout rests at the front, under its own headline. ar = width / height, the shape each photo was cut to.
const P = "/home/orbit/photo-";
export const ORBIT: readonly Tile[] = [
  { word: "checkout", label: "Checkout", sentence: "Know your checkout works.", src: `${P}checkout.jpg`, alt: "A card held to a card reader", ar: 1 },
  { word: "drone panel", label: "Drone panel", sentence: "Know your drone panel works.", src: `${P}drone.jpg`, alt: "A drone against an evening sky", ar: 0.8 },
  { next: true, label: "Electron apps", src: `${P}electron.jpg`, alt: "A desktop editing app open on a laptop", ar: 1.2 },
  { word: "robot console", label: "Robot console", sentence: "Know your robot console works.", src: `${P}robot.jpg`, alt: "A robot arm building a lattice", ar: 1 },
  { word: "sign-up", label: "Sign-up", sentence: "Know your sign-up works.", src: `${P}signup.jpg`, alt: "Hands on a laptop keyboard in the dark", ar: 1.2 },
  { word: "mission console", label: "Mission console", sentence: "Know your mission console works.", src: `${P}mission.jpg`, alt: "An operations room at night", ar: 1.2 },
  { word: "banking app", label: "Banking app", sentence: "Know your banking app works.", src: `${P}banking.jpg`, alt: "A hand holding a phone calculator over banknotes", ar: 0.8 },
  { word: "fleet console", label: "Fleet console", sentence: "Know your fleet console works.", src: `${P}fleet.jpg`, alt: "A person flying a drone at dusk", ar: 0.8 },
  { next: true, label: "SDKs and scripts", src: `${P}script.jpg`, alt: "Python code that collects statuses on a dark screen", ar: 1 },
  { word: "flight console", label: "Flight console", sentence: "Know your flight console works.", src: `${P}flight.jpg`, alt: "An airliner cockpit lit at night over a city", ar: 1 },
  { word: "release", label: "Release", sentence: "Know your release works.", src: `${P}release.jpg`, alt: "A server rack lit green", ar: 0.8 },
  { word: "ground control console", label: "Ground control console", sentence: "Know your ground control console works.", src: `${P}groundstation.jpg`, alt: "A hand on a control stick beside a map display", ar: 1.2 },
  { word: "dashboard", label: "Dashboard", sentence: "Know your dashboard works.", src: `${P}dashboard.jpg`, alt: "A person reading a dashboard", ar: 1 },
  { word: "robot fleet panel", label: "Robot fleet panel", sentence: "Know your robot fleet panel works.", src: `${P}robotfleet.jpg`, alt: "A row of delivery robots waiting on a pavement", ar: 0.8 },
  { word: "AI-built app", label: "AI-built app", sentence: "Know your AI-built app works.", narrow: true, src: `${P}aiapp.jpg`, alt: "An app open on a tablet in low light", ar: 1.2 },
  { next: true, label: "The device itself", src: `${P}firmware.jpg`, alt: "A small development board on a dark table", ar: 1 },
  { word: "agent's change", label: "Agent's change", sentence: "Know your agent's change works.", src: `${P}agent.jpg`, alt: "Code on a laptop screen", ar: 1.2 },
  { word: "vehicle portal", label: "Vehicle portal", sentence: "Know your vehicle portal works.", src: `${P}vehicle.jpg`, alt: "A truck on a road at dusk", ar: 1.2 },
  { word: "client's site", label: "Client's site", sentence: "Know your client's site works.", src: `${P}client.jpg`, alt: "A person working at two monitors", ar: 1.2 },
  { word: "targeting console", label: "Targeting console", sentence: "Know your targeting console works.", src: `${P}targeting.jpg`, alt: "A radar scope and a track readout on a console", ar: 0.8 },
  { next: true, label: "Native mobile apps", src: `${P}mobile.jpg`, alt: "A phone held at night against city lights", ar: 0.8 },
  { word: "device panel", label: "Device panel", sentence: "Know your device panel works.", src: `${P}device.jpg`, alt: "A circuit board inside a device", ar: 1 },
  { word: "benefits portal", label: "Benefits portal", sentence: "Know your benefits portal works.", src: `${P}public.jpg`, alt: "An arched hall inside a state capitol", ar: 0.8 },
];

const N = ORBIT.length;
// Where each tile leads and the name it prints for that page. A Next tile leads to the coverage list, where its row
// says what happens today instead; its line says it is not built yet.
const COVERAGE_HREF = `${V6_BASE}/platform#coverage`;
const ROUTE = ORBIT.map((t) => (t.next ? { href: COVERAGE_HREF, to: "Not built yet" } : orbitRoute(t.word) ?? { href: COVERAGE_HREF, to: "What it can check today" }));
// The headline's sentences, one per Live tile, and each tile's place among them (-1 for a Next tile).
const LIVE = ORBIT.flatMap((t) => (t.next ? [] : [t]));
const SENTENCE_OF = ORBIT.map((t) => (t.next ? -1 : LIVE.indexOf(t)));

// The photo's rendered width: a front tile in the ring is about 13vw wide (14vw leaves room for the lift); a card
// is 148px on a phone and up to about 200px in the grid.
const SIZES = "(max-width: 700px) 148px, (max-width: 1023px) 200px, 14vw";

const RING = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";
const REDUCE = "(prefers-reduced-motion: reduce)";
const HOVER = "(hover: hover)";
const REV_MS = 84000;     // one turn of the ring
const BACK = 0.66;        // a tile at the back of the ring, as a share of one at the front
const GMIN = 0.07;        // the least gap between two neighbours, as a share of their size (taken as squares: see SLOTS)
const SQUARE = 4;         // the track's shape: 2 is an ellipse, higher is squarer (it uses the section's corners)
const LIFT = 1.06;        // a held tile comes forward this much
const PAD = 24;           // the least room kept between any tile in sight and the words
const EDGE = 24;          // the least room kept between any tile and the section's edge
const SIG_MAX = 340;      // the largest front tile, on very large screens
const S = 720;            // samples along the track
// The far side: on the top arc, a tile nearer the centre line than FAR0 of the ring's half-width is out of sight,
// one beyond FAR1 is fully in sight, and in between it recedes, shrinking toward FAR_K of its size as it fades.
const FAR0 = 0.2, FAR1 = 0.5, FAR_K = 0.32;
const REVEAL_MS = 700;    // turning a focused tile out of the far side

type Box = { x0: number; y0: number; x1: number; y1: number };
type Pt = { x: number; y: number; d: number; k: number; v: number };
type Track = {
  sig: number;            // a front tile's long side, px
  m: number;              // the room the track keeps to the section's edges
  far: number;            // how much of the far side is out of sight: 0 none (reduced motion), 1 all of it
  // samples, evenly spaced by length from the front centre and running clockwise (left along the front first)
  xs: Float64Array; ys: Float64Array;  // position
  ds: Float64Array;       // depth, 1 at the front
  ks: Float64Array;       // size, as a share of a front tile (depth, and receding on the far side)
  vs: Float64Array;       // how much in sight, 0 to 1
  sg: Float64Array;       // the slot coordinate at each sample (S + 1 values; sg[S] is T); see SLOTS
  T: number;              // slots round the loop: the ring fits when T is at least N
  far0: number; far1: number;  // the slots between which a tile is not fully in sight (equal when nothing is)
  clear: number;          // the largest front tile that keeps clear of the words and the edges anywhere on it
};

const sizeAt = (d: number) => BACK + (1 - BACK) * d;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const newPt = (): Pt => ({ x: 0, y: 0, d: 0, k: 1, v: 1 });

// One track for a given front tile size: a superellipse whose top and bottom keep a back tile and a front tile
// inside the section. It is traced densely and resampled evenly by length, so a steady turn is a steady speed on
// screen (sampled evenly by its angle, the samples near the top and bottom centres are tens of pixels apart, and a
// ring stepped through them surges there). Only tiles in sight are kept off the words.
//
// SLOTS (reviewed 2026-10-02 night). The first rebuild placed the tiles each frame as a chain (each at the first
// place clear of the one before) and closed it by searching the gap; that search jumps between neighbouring answers,
// so the tiles stuttered by 8 to 27px between frames (measured in the page, qa/orbit/rv-smooth.mjs). Now the track
// carries a slot coordinate instead: at each sample, ws is how far ahead the next tile must stand to clear this one
// by GMIN, both taken as squares of their size there (a square is the largest box any photo here fills), and the
// slot coordinate grows by 1 / ws per sample. Where that need shrinks within a tile's own reach (coming out of a
// corner) the density is lowered over the reach, so any two tiles a slot apart are at least the first one's need
// apart. The tiles stand an even number of slots apart and the whole ring moves in slots: every tile moves
// smoothly, neighbours never overlap, and a frame costs a lookup per tile.
function trackFor(W: number, H: number, copy: Box, sig: number, m: number, far: number, slots = true): Track {
  const cx = W / 2, cy = (copy.y0 + copy.y1) / 2;
  const rx = Math.max(8, W / 2 - m - (sig * sizeAt(0.5)) / 2);
  const ryT = Math.max(8, cy - m - (sig * sizeAt(0)) / 2);
  const ryB = Math.max(8, H - cy - m - (sig * sizeAt(1)) / 2);
  const D = S * 8, px = new Float64Array(D + 1), py = new Float64Array(D + 1), pn = new Float64Array(D + 1), len = new Float64Array(D + 1);
  for (let q = 0; q <= D; q++) {
    const t = (q / D) * Math.PI * 2 + Math.PI / 2, c = Math.cos(t), s = Math.sin(t);
    px[q] = cx + rx * Math.sign(c) * Math.abs(c) ** (2 / SQUARE);
    py[q] = cy + (s > 0 ? ryB : ryT) * Math.sign(s) * Math.abs(s) ** (2 / SQUARE);
    pn[q] = s;
    if (q) len[q] = len[q - 1] + Math.hypot(px[q] - px[q - 1], py[q] - py[q - 1]);
  }
  const xs = new Float64Array(S), ys = new Float64Array(S), ds = new Float64Array(S), ks = new Float64Array(S), vs = new Float64Array(S);
  let clear = Infinity, q = 0;
  for (let j = 0; j < S; j++) {
    const want = (j / S) * len[D];
    while (q < D - 1 && len[q + 1] < want) q++;
    const f = (want - len[q]) / Math.max(1e-9, len[q + 1] - len[q]);
    const x = px[q] + (px[q + 1] - px[q]) * f, y = py[q] + (py[q + 1] - py[q]) * f, s = pn[q] + (pn[q + 1] - pn[q]) * f;
    const d = (1 + s) / 2;
    const v = far > 0 && s < 0 ? smooth(FAR0 * far, FAR1 * far, Math.abs(x - cx) / rx) : 1;
    const k = sizeAt(d) * (FAR_K + (1 - FAR_K) * v);
    xs[j] = x; ys[j] = y; ds[j] = d; ks[j] = k; vs[j] = v;
    if (v > 0.02) {
      const ex = Math.max(copy.x0 - PAD - x, x - copy.x1 - PAD), ey = Math.max(copy.y0 - PAD - y, y - copy.y1 - PAD);
      clear = Math.min(clear, (2 * Math.max(ex, ey)) / k);
    }
    const edge = Math.min(x - EDGE, W - EDGE - x, y - EDGE, H - EDGE - y);
    clear = Math.min(clear, (2 * edge) / k);
  }
  const sg = new Float64Array(S + 1);
  let far0 = 0, far1 = 0;
  if (slots) {
    // ws: how many samples ahead the next tile must stand (both squares of their size, GMIN between them)
    const ws = new Float64Array(S);
    for (let j = 0; j < S; j++) {
      const a = ks[j] * sig;
      let need = S / 2, before = -Infinity;
      for (let e = 1; e < S / 2; e++) {
        const u = (j + e) % S, b = ks[u] * sig;
        const sep = Math.max(Math.abs(xs[u] - xs[j]), Math.abs(ys[u] - ys[j])) - ((a + b) / 2) * (1 + GMIN);
        if (sep >= 0) { need = e - 1 + (Number.isFinite(before) ? -before / (sep - before) : 0); break; }
        before = sep;
      }
      ws[j] = Math.max(0.25, need);
    }
    // the density 1 / ws, lowered wherever a tile's reach would hold more than one slot
    const rho = new Float64Array(S), cum = new Float64Array(2 * S + 1), over = new Float64Array(S).fill(1);
    for (let j = 0; j < S; j++) rho[j] = 1 / ws[j];
    for (let j = 0; j < 2 * S; j++) cum[j + 1] = cum[j] + rho[j % S];
    for (let j = 0; j < S; j++) {
      const e = j + ws[j], i0 = Math.floor(e);
      const reach = cum[i0] + (cum[i0 + 1] - cum[i0]) * (e - i0) - cum[j];
      if (reach <= 1) continue;
      for (let u = 0; u <= Math.ceil(ws[j]); u++) { const w = (j + u) % S; if (reach > over[w]) over[w] = reach; }
    }
    for (let j = 0; j < S; j++) sg[j + 1] = sg[j] + rho[j] / over[j];
    // the stretch of slots where a tile is not fully in sight: around the top centre, never across sample 0
    let j0 = -1, j1 = -1;
    for (let j = 0; j < S; j++) if (vs[j] < 0.999) { if (j0 < 0) j0 = j; j1 = j; }
    if (j0 >= 0) { far0 = sg[Math.max(0, j0 - 1)]; far1 = sg[Math.min(S, j1 + 1)]; }
  }
  return { sig, m, far, xs, ys, ds, ks, vs, sg, T: sg[S], far0, far1, clear };
}

// The point at sample position v (it wraps), between samples, written into o.
function at(tr: Track, v: number, o: Pt): Pt {
  const vv = ((v % S) + S) % S, j = Math.floor(vv), k = j + 1 === S ? 0 : j + 1, f = vv - j;
  o.x = tr.xs[j] + (tr.xs[k] - tr.xs[j]) * f;
  o.y = tr.ys[j] + (tr.ys[k] - tr.ys[j]) * f;
  o.d = tr.ds[j] + (tr.ds[k] - tr.ds[j]) * f;
  o.k = tr.ks[j] + (tr.ks[k] - tr.ks[j]) * f;
  o.v = tr.vs[j] + (tr.vs[k] - tr.vs[j]) * f;
  return o;
}

// The sample position at slot u (it wraps).
function sampleAt(tr: Track, u: number) {
  const T = tr.T, uu = ((u % T) + T) % T, sg = tr.sg;
  let lo = 0, hi = S;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (sg[mid] <= uu) lo = mid; else hi = mid; }
  return lo + (uu - sg[lo]) / Math.max(1e-9, sg[lo + 1] - sg[lo]);
}
// Tile i's slot at a phase of the turn: tile 0 rests at the front centre, the others an even step apart clockwise.
const slotOf = (tr: Track, i: number, phase: number) => ((((i / N + phase) * tr.T) % tr.T) + tr.T) % tr.T;

// A front tile of sig fits when it keeps clear of the words and the edges and the loop holds a slot for every tile.
function fitsAt(W: number, H: number, copy: Box, sig: number, m: number, far: number): Track | null {
  const tr = trackFor(W, H, copy, sig, m, far);
  return sig <= tr.clear + 0.5 && tr.T >= N ? tr : null;
}
function solveAt(W: number, H: number, copy: Box, m: number, far: number): Track {
  let lo = 40, hi = Math.max(48, Math.min(SIG_MAX, H * 0.45));
  let best = trackFor(W, H, copy, lo, m, far);
  for (let r = 0; r < 11; r++) {
    const mid = (lo + hi) / 2, tr = fitsAt(W, H, copy, mid, m, far);
    if (tr) { lo = mid; best = tr; } else hi = mid;
  }
  return best;
}

// THE RING for a section of W x H with the words in `copy`: the largest front tile that fits. Still (reduced
// motion), nothing is on the far side. Turning, the far side is as wide as it needs to be and no wider: the
// narrowest far side at which the ring still reaches (nearly) the size the whole far side allows. On a short
// screen the height limits the size, so few tiles go out of sight; on a tall one, about seven. A few tens of
// milliseconds; it runs when the section comes near the screen and after a resize.
function solveTrack(W: number, H: number, copy: Box, still: boolean): Track {
  const m = EDGE + 6;
  if (still) return solveAt(W, H, copy, m, 0);
  const full = solveAt(W, H, copy, m, 1);
  for (const far of [0, 0.25, 0.5, 0.75]) {
    const tr = fitsAt(W, H, copy, full.sig * 0.97, m, far);
    if (tr) return tr;
  }
  return full;
}

// Before the script runs (and without it) the ring still stands, all twenty-three in sight: each tile's place at
// rest for a 1440x833 section, spaced evenly by length in tiles along whichever axis moves more (a quick estimate,
// not the slots), written as shares of the section (orbit.css reads them in container units). The script then places
// every tile for the real size, by transform only, so nothing shifts the layout.
const FALLBACK: CSSProperties[] = (() => {
  const W = 1440, H = 833, copy = { x0: 407, y0: 279, x1: 1033, y1: 545 };
  const fit = (sig: number) => {
    const tr = trackFor(W, H, copy, sig, EDGE + 6, 0, false);
    const us = new Float64Array(S + 1);
    for (let j = 1; j <= S; j++) {
      const a = j - 1, b = j % S;
      us[j] = us[j - 1] + Math.max(Math.abs(tr.xs[b] - tr.xs[a]), Math.abs(tr.ys[b] - tr.ys[a])) / (((tr.ks[a] + tr.ks[b]) / 2) * sig);
    }
    return { tr, us };
  };
  let sig = 150, f = fit(sig);
  for (let it = 0; it < 4; it++) { sig = Math.max(40, Math.min((sig * f.us[S]) / (N * (1 + GMIN) * 1.2), f.tr.clear)); f = fit(sig); }
  const { tr, us } = f, p = newPt();
  return ORBIT.map((t, i) => {
    const u = (i / N) * us[S];
    let j = 0;
    while (j < S - 1 && us[j + 1] <= u) j++;
    at(tr, j, p);
    const w = sig * Math.min(1, t.ar), h = sig * Math.min(1, 1 / t.ar);
    return {
      "--x": ((100 * p.x) / W).toFixed(2), "--y": ((100 * p.y) / H).toFixed(2), "--k": p.k.toFixed(3),
      "--fw": ((100 * w) / W).toFixed(2), "--fh": ((100 * h) / W).toFixed(2),
    } as CSSProperties;
  });
})();

type Geo = { W: number; H: number; m: number; copy: Box; boxes: { x: number; y: number; w: number; h: number }[] };

export function Orbit() {
  const field = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const call = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const [held, setHeld] = useState<number | null>(null);
  const [callIdx, setCallIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const [paused, setPaused] = useState(false);
  const heldRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const reduceRef = useRef(false);
  // Where nothing can hover (orbit.css then shows only the shown sentence), the headline keeps its word, so the
  // keyboard on a touch screen never changes its height.
  const hoverRef = useRef(true);
  const releaseTimer = useRef(0);
  // Filled in by the ring's effect: place the tiles now, start or stop the turn, read the ring's geometry, place the
  // held tile's label, and turn a tile out of the far side.
  const ring = useRef<{ place: () => void; sync: () => void; geo: () => Geo | null; label: () => void; reveal: (i: number) => void }>({
    place: () => {}, sync: () => {}, geo: () => null, label: () => {}, reveal: () => {},
  });

  // THE RING. Positions are written straight to the tiles each frame; React only hears about holds and words.
  useEffect(() => {
    const el = field.current, cp = copy.current;
    if (!el || !cp) return;
    const lis = items.current;
    const ringMq = window.matchMedia(RING), redMq = window.matchMedia(REDUCE), hovMq = window.matchMedia(HOVER);
    let on = ringMq.matches;
    reduceRef.current = redMq.matches;
    hoverRef.current = hovMq.matches;
    let tr: Track | null = null;
    let W = 0, H = 0, box: Box = { x0: 0, y0: 0, x1: 0, y1: 0 };
    let phase = 0, raf = 0, last = 0, inView = false, near = false, dirty = true, timer = 0;
    // A focused tile on the far side is turned into sight: the phase eases from `from` to `to`.
    let tween: { from: number; to: number; t0: number } | null = null;
    const vs = new Float64Array(N);
    const pt = newPt();
    const dims = ORBIT.map(() => ({ w: 0, h: 0 }));
    const boxes = ORBIT.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));

    const clearStyles = () => {
      for (const li of lis) {
        if (!li) continue;
        for (const p of ["width", "height", "transform", "z-index", "pointer-events", "--d", "--vis", "--mk", "--ik"]) li.style.removeProperty(p);
      }
    };
    // The words as they are drawn: every line of every sentence the headline can show, the line under it and the
    // link, in the section's coordinates. Tiles in sight keep clear of this (PAD), so a word never sits under a tile.
    const inkBox = (): Box => {
      const fr = el.getBoundingClientRect();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const add = (r: DOMRect) => {
        if (!r.width || !r.height) return;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      };
      const range = document.createRange();
      for (const n of cp.querySelectorAll(".v6-or__s, .v6-or__d")) { range.selectNodeContents(n); for (const r of range.getClientRects()) add(r); }
      for (const a of cp.querySelectorAll("a")) add(a.getBoundingClientRect());
      if (!Number.isFinite(x0)) add(cp.getBoundingClientRect());
      return { x0: x0 - fr.left, y0: y0 - fr.top, x1: x1 - fr.left, y1: y1 - fr.top };
    };
    // A held tile comes forward, but stays inside the section and off the words.
    const keepClear = (x: number, y: number, hw: number, hh: number) => {
      x = Math.min(Math.max(x, EDGE + hw), W - EDGE - hw);
      y = Math.min(Math.max(y, EDGE + hh), H - EDGE - hh);
      const dx = Math.min(x + hw - (box.x0 - PAD / 2), box.x1 + PAD / 2 - (x - hw)), dy = Math.min(y + hh - (box.y0 - PAD / 2), box.y1 + PAD / 2 - (y - hh));
      if (dx > 0 && dy > 0) {
        if (dx < dy) x += x < (box.x0 + box.x1) / 2 ? -dx : dx;
        else y += y < (box.y0 + box.y1) / 2 ? -dy : dy;
      }
      return { x, y };
    };
    // Where every tile stands at this phase: its slot, as a place on the track.
    const layout = () => {
      if (!tr) return;
      for (let i = 0; i < N; i++) vs[i] = sampleAt(tr, slotOf(tr, i, phase));
    };
    const place = () => {
      if (!tr) return;
      const h = heldRef.current;
      for (let i = 0; i < N; i++) {
        const li = lis[i];
        if (!li) continue;
        at(tr, vs[i], pt);
        let k = pt.k, x = pt.x, y = pt.y;
        const { w, h: ht } = dims[i];
        if (i === h) {
          k *= reduceRef.current ? 1 : LIFT;
          ({ x, y } = keepClear(x, y, (w * k) / 2, (ht * k) / 2));
          li.style.setProperty("--ik", (1 / k).toFixed(4));
        }
        boxes[i] = { x: x - (w * k) / 2, y: y - (ht * k) / 2, w: w * k, h: ht * k };
        li.style.transform = `translate(${(x - w / 2).toFixed(1)}px, ${(y - ht / 2).toFixed(1)}px) scale(${k.toFixed(4)})`;
        li.style.zIndex = String(10 + Math.round(pt.d * 18));
        li.style.setProperty("--d", pt.d.toFixed(3));
        li.style.setProperty("--vis", pt.v.toFixed(3));
        // a tile mostly out of sight cannot be pointed at (the keyboard still reaches it: see reveal)
        li.style.pointerEvents = pt.v < 0.5 && i !== h ? "none" : "";
        if (ORBIT[i].next) li.style.setProperty("--mk", (1 / k).toFixed(4));
      }
    };
    // Solved only when the section is near the screen (the search takes a few tens of milliseconds); until then each
    // tile stands where FALLBACK put it.
    const measure = () => {
      timer = 0;
      on = ringMq.matches;
      if (!on) { tr = null; tween = null; dirty = true; clearStyles(); return; }
      if (!near) { dirty = true; return; }
      dirty = false;
      W = el.clientWidth; H = el.clientHeight;
      box = inkBox();
      tr = solveTrack(W, H, box, reduceRef.current);
      tween = null;
      for (let i = 0; i < N; i++) {
        const li = lis[i];
        if (!li) continue;
        const ar = ORBIT[i].ar;
        dims[i] = { w: tr.sig * Math.min(1, ar), h: tr.sig * Math.min(1, 1 / ar) };
        li.style.width = `${dims[i].w.toFixed(1)}px`;
        li.style.height = `${dims[i].h.toFixed(1)}px`;
      }
      layout();
      place();
      ring.current.label();
    };
    // A resize or a change in the words is measured once things settle, not on every frame of a drag.
    const remeasure = () => { window.clearTimeout(timer); timer = window.setTimeout(measure, 120); };

    // A frame is asked for only while the ring is on screen and either free to turn and not held, or turning a
    // focused tile into sight. Otherwise the loop stops instead of redrawing the same places on the main thread.
    const turning = () => on && !!tr && inView && !reduceRef.current && (tween !== null || (!pausedRef.current && heldRef.current === null));
    const frame = (now: number) => {
      if (tween) {
        const t = Math.min(1, (now - tween.t0) / REVEAL_MS), e = 1 - (1 - t) ** 3;
        phase = tween.from + (tween.to - tween.from) * e;
        if (t >= 1) { tween = null; phase = ((phase % 1) + 1) % 1; }
      } else {
        phase = (phase + Math.max(0, Math.min(64, now - last)) / REV_MS) % 1;
      }
      last = now;
      layout();
      place();
      if (heldRef.current !== null) ring.current.label();
      raf = turning() ? requestAnimationFrame(frame) : 0;
    };
    const sync = () => {
      if (!turning()) { if (raf) cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    // A tile focused from the keyboard while on the far side turns into sight, the shortest way round: the ring eases
    // until the tile's slot is a fifth of a slot past the edge of the far side.
    const reveal = (i: number) => {
      if (!tr || !on || reduceRef.current || tr.far1 <= tr.far0) return;
      const u = slotOf(tr, i, phase);
      if (u <= tr.far0 || u >= tr.far1) return;
      const ahead = tr.far1 - u + 0.2, back = u - tr.far0 + 0.2;
      tween = { from: phase, to: phase + (ahead <= back ? ahead : -back) / tr.T, t0: performance.now() };
      sync();
    };
    ring.current.place = place;
    ring.current.sync = sync;
    ring.current.reveal = reveal;
    ring.current.geo = () => (on && tr ? { W, H, m: tr.m, copy: box, boxes } : null);

    const io = new IntersectionObserver((es) => { inView = es[es.length - 1].isIntersecting; sync(); }, { threshold: 0 });
    io.observe(el);
    const nearIo = new IntersectionObserver((es) => {
      near = es[es.length - 1].isIntersecting;
      if (near && dirty) { measure(); sync(); }
    }, { rootMargin: "100% 0px" });
    nearIo.observe(el);
    const ro = new ResizeObserver(remeasure);
    ro.observe(el);
    ro.observe(cp);
    // The page translator rewrites the words in place: measure them again.
    const mo = new MutationObserver(remeasure);
    mo.observe(cp, { characterData: true, childList: true, subtree: true });
    const onMode = () => { measure(); sync(); };
    // Reduced motion changes the ring itself (no far side), so it is solved again.
    const onReduce = () => { reduceRef.current = redMq.matches; dirty = true; if (near) measure(); sync(); };
    const onHover = () => { hoverRef.current = hovMq.matches; };
    ringMq.addEventListener("change", onMode);
    redMq.addEventListener("change", onReduce);
    hovMq.addEventListener("change", onHover);
    // The words take their final size once the brand face has loaded.
    void document.fonts?.ready.then(remeasure);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      io.disconnect();
      nearIo.disconnect();
      ro.disconnect();
      mo.disconnect();
      ringMq.removeEventListener("change", onMode);
      redMq.removeEventListener("change", onReduce);
      hovMq.removeEventListener("change", onHover);
      ring.current.place = () => {};
      ring.current.sync = () => {};
      ring.current.reveal = () => {};
      ring.current.geo = () => null;
    };
  }, []);

  // The label of a held tile in the ring. On a large photo it sits on the photo's foot, when it takes no more than
  // half of it. Otherwise it is a small plate under the tile, above it, or beside it on the side toward the words,
  // whichever first stays inside the section and off the words (it may cover a dimmed neighbour); on the photo as a
  // last resort.
  useLayoutEffect(() => {
    const placeLabel = () => {
      const c = call.current, g = ring.current.geo(), i = heldRef.current;
      if (!c || !g || i === null) return;
      const b = g.boxes[i];
      const put = (at: string, l: number, t: number) => {
        c.dataset.at = at;
        c.style.transform = `translate(${l.toFixed(1)}px, ${t.toFixed(1)}px)`;
      };
      const onPhoto = () => {
        c.dataset.at = "on";
        c.style.width = `${b.w.toFixed(1)}px`;
        return c.offsetHeight;
      };
      if (Math.max(b.w, b.h) >= 160) {
        const ch = onPhoto();
        if (ch <= b.h * 0.5) return put("on", b.x, b.y + b.h - ch);
      }
      c.dataset.at = "under";
      c.style.width = "";
      const cw = c.offsetWidth, ch = c.offsetHeight, p = 10;
      const x = Math.min(Math.max(b.x + b.w / 2 - cw / 2, EDGE), g.W - EDGE - cw), y = b.y + b.h / 2 - ch / 2;
      const spots: [string, number, number][] = [
        ["under", x, b.y + b.h + 10],
        ["above", x, b.y - 10 - ch],
        ["beside", b.x + b.w / 2 < g.W / 2 ? b.x + b.w + 10 : b.x - 10 - cw, y],
      ];
      for (const [at, l, t] of spots) {
        const inside = l >= 6 && t >= 6 && l + cw <= g.W - 6 && t + ch <= g.H - 6;
        const offWords = l + cw < g.copy.x0 - p || l > g.copy.x1 + p || t + ch < g.copy.y0 - p || t > g.copy.y1 + p;
        if (inside && offWords) return put(at, l, t);
      }
      const h = onPhoto();
      put("on", b.x, b.y + b.h - h);
    };
    ring.current.label = placeLabel;
    placeLabel();
  }, [held, callIdx]);

  // Holding a tile: the pointer is on it, or the keyboard has focused it. Letting go waits a moment, so a pointer
  // crossing the gap between two tiles does not flash the ring.
  const ease = (i: number | null) => {
    const li = i === null ? null : items.current[i];
    if (!li || reduceRef.current) return;
    li.dataset.settle = "";
    window.setTimeout(() => { delete li.dataset.settle; }, 340);
  };
  const hold = (i: number) => {
    window.clearTimeout(releaseTimer.current);
    if (heldRef.current === i) return;
    const prev = heldRef.current;
    if (prev !== null) items.current[prev]?.style.removeProperty("--ik");
    heldRef.current = i;
    ease(prev);
    ease(i);
    ring.current.place();
    ring.current.sync();
    setHeld(i);
    setCallIdx(i);
    if (SENTENCE_OF[i] >= 0 && hoverRef.current) setShown(SENTENCE_OF[i]);
  };
  const release = () => {
    window.clearTimeout(releaseTimer.current);
    releaseTimer.current = window.setTimeout(() => {
      const prev = heldRef.current;
      if (prev === null) return;
      heldRef.current = null;
      items.current[prev]?.style.removeProperty("--ik");
      ease(prev);
      ring.current.place();
      ring.current.sync();
      setHeld(null);
    }, 140);
  };
  useEffect(() => () => window.clearTimeout(releaseTimer.current), []);
  const onEnter = (i: number) => (e: PointerEvent) => { if (e.pointerType !== "touch") hold(i); };
  const onLeave = (e: PointerEvent) => { if (e.pointerType !== "touch") release(); };
  const onFocus = (i: number) => (e: FocusEvent<HTMLAnchorElement>) => {
    if (!e.currentTarget.matches(":focus-visible")) return;
    hold(i);
    ring.current.reveal(i);
  };

  const toggle = () => {
    pausedRef.current = !paused;
    setPaused(!paused);
    ring.current.sync();
  };

  const callTile = ORBIT[callIdx];
  return (
    <section className="v6-or v6-dark" aria-labelledby="v6-or-h" data-nav-dark data-nav-theme="dark">
      <div ref={field} className="v6-or__field" data-hold={held === null ? "0" : "1"}>
        <div ref={copy} className="v6-or__copy">
          {/* One stable sentence for screen readers and search; the sentence that changes is a picture of it. */}
          <h2 id="v6-or-h" className="v6-or__h">
            <span className="v6-or__sr">Know your checkout, sign-up, release and device panels work.</span>
            <span className="v6-or__vis" aria-hidden="true">
              {LIVE.map((t, j) => (
                <span key={t.word} className="v6-or__s" data-on={j === shown} data-narrow={t.narrow ? "" : undefined}>{t.sentence}</span>
              ))}
            </span>
          </h2>
          <p className="v6-or__d">Web apps at a public address, your agent&apos;s work, and the panels that run devices.</p>
          <EditorialLink href={COVERAGE_HREF}>What it can check today</EditorialLink>
          {/* Read after a Next tile's label and line, so its name says where it leads. */}
          <span id="v6-or-cov" hidden>What it can check today</span>
        </div>

        <ul className="v6-or__tiles">
          {ORBIT.map((t, i) => (
            <li
              key={t.label} ref={(li) => { items.current[i] = li; }} className="v6-or__item"
              data-on={held === i} style={FALLBACK[i]}
            >
              <Link
                href={ROUTE[i].href} className="v6-or__tile"
                aria-labelledby={t.next ? `v6-or-w-${i} v6-or-t-${i} v6-or-cov` : `v6-or-w-${i} v6-or-t-${i}`}
                onPointerEnter={onEnter(i)} onPointerLeave={onLeave} onFocus={onFocus(i)} onBlur={release}
              >
                <span className="v6-or__ph">
                  <Image src={t.src} alt={t.alt} fill sizes={SIZES} />
                </span>
                {t.next ? <span className="v6-or__mark" aria-hidden="true">Next</span> : null}
                <span className="v6-or__cap">
                  <span id={`v6-or-w-${i}`} className="v6-or__cw">{t.label}</span>
                  <span id={`v6-or-t-${i}`} className="v6-or__cl">{ROUTE[i].to}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* The held tile's label in the ring (orbit.css shows it only there). The tile's link already carries the
            same words as its name, so this copy is hidden from assistive technology. */}
        <div ref={call} className="v6-or__call" aria-hidden="true" data-show={held !== null} data-at="under">
          <span className="v6-or__call-w">
            {callTile.label}
            {callTile.next ? <span className="v6-or__call-n">Next</span> : null}
          </span>
          <span className="v6-or__call-t">
            <span>{ROUTE[callIdx].to}</span>
            {callTile.next ? null : <span className="v6-or__arw">→</span>}
          </span>
        </div>

        <button type="button" className="v6-or__pause" onClick={toggle} aria-label={paused ? "Play the orbit" : "Pause the orbit"}>
          {paused
            ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5 3.2v9.6L12.5 8z" fill="currentColor" /></svg>
            : <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
        </button>
      </div>
    </section>
  );
}
