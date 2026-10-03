"use client";

/* WHAT IT CHECKS, AS AN ORBIT OF SUBJECTS (2026-10-01; rebuilt 2026-10-02 evening; grouped by subject 2026-10-03).

   The founder, 2026-10-03: "categorize them, not by each, but by each subject, so commercial, government, military,
   contracted defense, just a lot of other subjects that make sense", and "when they hover over it, slowly the orbital
   stops, and what they're hovering over kind of enlarges, and they can click on it, obviously the text changes as
   soon as they hover over it, like, smoothly, but they should be able to click on it and go actually somewhere."

   So the ring carries fourteen SUBJECTS, not twenty-three things: each tile is one subject (Military, Government,
   Commercial and retail, ...), shows its first photograph at rest (public/home/orbit, every one credited in
   CREDITS.md) with the subject's name on it, and opens that subject's page. The names are on the tiles at rest so
   the ring reads as subjects before anything is pointed at (review, 2026-10-03: without them the subjects showed
   only under the pointer, and an unlabelled ring of photographs read as products again). There is no "defense
   contractors" tile on purpose: the defense page
   says Vraelis cannot yet be used for US Department of War contract work, so such a tile would invite exactly that.
   Military covers defense.

   THE WORDS ARE HELD TO WHAT IS LIVE (_content/coverage.ts). Eleven subjects are checked today; each has one whole
   sentence that becomes the headline while its tile is held ("Know your mission software works."). A device word
   names the panel, console or portal, never the machine. Three subjects are Next, not built yet (desktop and mobile
   apps, SDKs and scripts, devices and firmware): they carry a "Next" mark, say "Not built yet", link to the coverage
   list, and never become the headline. Where each subject leads is the registry's ORBIT_ROUTE (_content/sectors.ts).

   THE LAYOUT. On a screen with a mouse, from 1024px wide, the tiles ride one closed track around the words: a
   rounded rectangle that keeps a margin from the section's edges, so no tile is ever cut off. As on a tilted ring
   seen from in front, the front (the bottom) is largest and brightest and the back (the top) smaller; the middle of
   the top arc is the far side, where a tile recedes for a moment and comes back, so about thirteen of the fourteen
   are in sight at a time. Every photograph sits in the same 4:3 frame, so the ring packs by the frame's true shape
   (wider than tall); the tiles stand in slots along the track, each slot long enough that neighbours keep 6% of a
   tile's width apart, and the whole ring moves in slots, so every tile drifts smoothly (SLOTS, below). The track and
   the tile size are solved from the section's size and the measured lines of the words, so the words never sit
   under a tile at any width or in any language (solveTrack). Measured: about 170 to 245px at 1440x900.

   HOLDING A TILE (the pointer on it, or the keyboard's focus). The ring does not stop dead: it slows to a stop over
   SLOW_MS, easing out. The held tile grows to GROW (1.25x) and comes to the front, sliding just enough to stay clear
   of the words and inside the section, and the other tiles dim. At once the headline crossfades to that subject's
   sentence (the space for the tallest sentence is always reserved, so nothing moves). A subject with several
   photographs crossfades through them, PHOTO_MS each. Its label shows the subject and the page it opens (a Next
   tile's: not built yet, and the coverage list); a click or Enter opens it, and where the label stands outside the
   tile it is a link to the same page that keeps the tile held. Letting go, the tile settles back, its first
   photograph returns, and the ring eases back to speed
   over RESUME_MS; the headline keeps the last subject's sentence, as scale.com's does. A tile focused from the
   keyboard while on the far side is first turned into sight. The ring turns only while it is on screen; its own
   button pauses it (WCAG 2.2.2), slowing it the same way.

   With reduced motion it never turns, nothing grows, nothing crossfades and nothing slides, and it has no far side:
   all fourteen stand still in sight, and holding one still labels it and dims the rest.

   Without a mouse (phones, tablets, touch screens) and below 1024px there is nothing to point with, so the same
   links are cards with their label always under the photo, and one tap opens the page: two rows that swipe
   sideways on a phone, a grid above 700px. Cards show each subject's first photograph only.

   Every string is whole for the page translator (components/language-controller.tsx): one sentence per subject for
   the headline, one label and one destination name per tile. A link's accessible name is its label and where it
   leads, read from those same visible strings (aria-labelledby), so it is translated with them. */
import Image from "next/image";
import Link from "next/link";
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent } from "react";
import { EditorialLink } from "./ui";
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

// In ring order. The three Next tiles are spread round the ring (4, 7, 10: the sides and the back at rest, never the
// front), and Commercial and retail rests at the front, under its own headline. Military is one subject among
// several and rests at the side, not the front. As cards on a phone the even places make the top row and the odd
// ones the bottom, so the first screen shows Commercial and retail, Drones and aviation, Developers and Government.
export const ORBIT: readonly Tile[] = [
  { word: "commercial", label: "Commercial and retail", sentence: "Know your checkout works.",
    photos: [pic("checkout", "A card held to a card reader", "50% 65%")] },
  { word: "drones", label: "Drones and aviation", sentence: "Know your drone panel works.",
    photos: [pic("drone", "A drone against an evening sky"), pic("flight", "An airliner cockpit lit at night over a city"), pic("fleet", "A person flying a drone at dusk", "50% 22%")] },
  { word: "developers", label: "Developers", sentence: "Know your release works.",
    photos: [pic("agent", "Code on a laptop screen"), pic("release", "A server rack lit green")] },
  { word: "government", label: "Government", sentence: "Know your public service works.",
    photos: [pic("public", "An arched hall inside a state capitol")] },
  { next: true, label: "Desktop and mobile apps",
    photos: [pic("electron", "A desktop editing app open on a laptop"), pic("mobile", "A phone held at night against city lights", "50% 62%")] },
  { word: "fintech", label: "Fintech and banking", sentence: "Know your banking app works.",
    photos: [pic("banking", "A hand holding a phone calculator over banknotes", "50% 58%")] },
  { word: "robotics", label: "Robotics and manufacturing", sentence: "Know your robot console works.",
    photos: [pic("robot", "A robot arm building a lattice", "50% 60%"), pic("device", "A circuit board inside a device")] },
  { next: true, label: "SDKs and scripts", photos: [pic("script", "Python code that collects statuses on a dark screen")] },
  { word: "ai-built-apps", label: "AI-built apps", sentence: "Know your AI-built app works.", narrow: true,
    photos: [pic("aiapp", "An app open on a tablet in low light")] },
  { word: "logistics", label: "Logistics and vehicles", sentence: "Know your fleet portal works.",
    photos: [pic("vehicle", "A truck on a road at dusk"), pic("robotfleet", "A row of delivery robots waiting on a pavement", "50% 55%")] },
  { next: true, label: "Devices and firmware", photos: [pic("firmware", "A small development board on a dark table")] },
  { word: "military", label: "Military", sentence: "Know your mission software works.",
    photos: [pic("targeting", "A radar scope and a track readout on a console", "50% 45%"), pic("mission", "An operations room at night"), pic("groundstation", "A hand on a control stick beside a map display")] },
  { word: "saas", label: "SaaS and startups", sentence: "Know your product works.",
    photos: [pic("dashboard", "A person reading a dashboard"), pic("signup", "Hands on a laptop keyboard in the dark")] },
  { word: "agencies", label: "Agencies", sentence: "Know your client's site works.",
    photos: [pic("client", "A person working at two monitors")] },
];

const N = ORBIT.length;
// Where each tile leads and the name it prints for that page. A Next tile leads to the coverage list, where its row
// says what happens today instead; its line says it is not built yet.
const COVERAGE_HREF = `${V6_BASE}/platform#coverage`;
const ROUTE = ORBIT.map((t) => (t.next ? { href: COVERAGE_HREF, to: "Not built yet" } : orbitRoute(t.word) ?? { href: COVERAGE_HREF, to: "What it can check today" }));
// The headline's sentences, one per Live tile, and each tile's place among them (-1 for a Next tile).
const LIVE = ORBIT.flatMap((t) => (t.next ? [] : [t]));
const SENTENCE_OF = ORBIT.map((t) => (t.next ? -1 : LIVE.indexOf(t)));

// The photo's rendered width: a held front tile in the ring is about 21vw wide; a card is 148px on a phone and up
// to about 200px in the grid.
const SIZES = "(max-width: 700px) 148px, (max-width: 1023px) 200px, 22vw";

const RING = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";
const REDUCE = "(prefers-reduced-motion: reduce)";
const HOVER = "(hover: hover)";
const HR = 0.75;          // every frame is 4:3: its height as a share of its width
// How fast the ring drifts, on average, in px per second along the track: the front tiles, whose slots are longest,
// move about 55 px/s at 1440x900, as the twenty-three-photo ring did (and never more than about a pixel a frame).
const DRIFT = 32;
const BACK = 0.7;         // a tile at the back of the ring, as a share of one at the front
const GMIN = 0.06;        // the least gap between two neighbours, as a share of their width (see SLOTS)
const SQUARE = 5;         // the track's shape: 2 is an ellipse, higher is squarer (it uses the section's corners)
const PAD = 24;           // the least room kept between any tile in sight and the words
const EDGE = 24;          // the least room kept between any tile and the section's edge
const GROW = 1.25;        // a held tile grows to this
const PAD_H = 14;         // the least room a held tile keeps to the words
const EDGE_H = 12;        // the least room a held tile keeps to the section's edge
const SIG_MAX = 340;      // the largest front tile, on very large screens
const S = 720;            // samples along the track
// The far side: on the top arc, a tile nearer the centre line than FAR0 * FAR of the ring's half-width is out of
// sight, one beyond FAR1 * FAR is fully in sight, and in between it recedes, shrinking toward FAR_K of its size as
// it fades. FAR is kept narrow, so about one tile at a time is out of sight.
const FAR0 = 0.2, FAR1 = 0.5, FAR_K = 0.32, FAR = 0.35;
const SLOW_MS = 750;      // holding a tile: the ring slows to a stop (ease out)
const RESUME_MS = 1000;   // letting go: the ring comes back to speed (ease in and out)
const LIFT_MS = 440;      // a held tile grows, or settles back
const PHOTO_MS = 1800;    // a held subject's photographs, each
// Turning a focused tile out of the far side: the turn starts at the speed the ring has and ends at rest (a cubic
// Hermite, see frame). As an ease out over 700ms it began at its fastest, so the whole ring lurched about 20px in
// one frame the moment the keyboard reached a tile on the far side (review, 2026-10-03).
const REVEAL_MS = 1000;
const RELEASE_MS = 140;   // crossing the gap between two tiles does not let go
const FOOT_FADE = 30;     // the fade above a label on a photo, px

type Box = { x0: number; y0: number; x1: number; y1: number };
type Rect = { x: number; y: number; w: number; h: number };
type Pt = { x: number; y: number; d: number; k: number; v: number };
type Track = {
  sig: number;            // a front tile's width, px (its height is sig * HR)
  m: number;              // the room the track keeps to the section's edges
  far: number;            // how much of the far side is out of sight: 0 none (reduced motion), FAR while turning
  // samples, evenly spaced by length from the front centre and running clockwise (left along the front first)
  xs: Float64Array; ys: Float64Array;  // position
  ds: Float64Array;       // depth, 1 at the front
  ks: Float64Array;       // size, as a share of a front tile (depth, and receding on the far side)
  vs: Float64Array;       // how much in sight, 0 to 1
  sg: Float64Array;       // the slot coordinate at each sample (S + 1 values; sg[S] is T); see SLOTS
  T: number;              // slots round the loop: the ring fits when T is at least N
  far0: number; far1: number;  // the slots between which a tile is not fully in sight (equal when nothing is)
  clear: number;          // the largest front tile that keeps clear of the words and the edges anywhere on it
  rev: number;            // one turn, ms (the track's length at DRIFT)
};

const sizeAt = (d: number) => BACK + (1 - BACK) * d;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const easeOut = (u: number) => 1 - (1 - u) ** 3;
const newPt = (): Pt => ({ x: 0, y: 0, d: 0, k: 1, v: 1 });

// Where a held tile of half-size hw x hh, whose place in the ring is (x, y), can stand: inside the section by EDGE_H
// and clear of every box in `avoid` (the words grown by PAD_H, and in the page the pause button), as near its place
// as it can. Null when there is no such place at this size.
function holdAt(W: number, H: number, avoid: readonly Box[], x: number, y: number, hw: number, hh: number): { x: number; y: number } | null {
  const lx = EDGE_H + hw, hx = W - EDGE_H - hw, ly = EDGE_H + hh, hy = H - EDGE_H - hh;
  if (lx > hx || ly > hy) return null;
  x = Math.min(Math.max(x, lx), hx);
  y = Math.min(Math.max(y, ly), hy);
  const hits = (px: number, py: number, b: Box) => px > b.x0 - hw && px < b.x1 + hw && py > b.y0 - hh && py < b.y1 + hh;
  for (let pass = 0; pass < 3; pass++) {
    const b = avoid.find((o) => hits(x, y, o));
    if (!b) return { x, y };
    // on it: slide out the shortest way that stays inside the section and clear of the rest
    const a = { x0: b.x0 - hw, y0: b.y0 - hh, x1: b.x1 + hw, y1: b.y1 + hh };
    const ways = [
      { x: a.x0, y, cost: x - a.x0 }, { x: a.x1, y, cost: a.x1 - x },
      { x, y: a.y0, cost: y - a.y0 }, { x, y: a.y1, cost: a.y1 - y },
    ].filter((p) => p.x >= lx - 0.01 && p.x <= hx + 0.01 && p.y >= ly - 0.01 && p.y <= hy + 0.01);
    if (!ways.length) return null;
    ways.sort((p, q) => Number(avoid.some((o) => o !== b && hits(p.x, p.y, o))) - Number(avoid.some((o) => o !== b && hits(q.x, q.y, o))) || p.cost - q.cost);
    x = ways[0].x; y = ways[0].y;
  }
  return avoid.some((o) => hits(x, y, o)) ? null : { x, y };
}
const padded = (b: Box, p: number): Box => ({ x0: b.x0 - p, y0: b.y0 - p, x1: b.x1 + p, y1: b.y1 + p });

// One track for a given front tile size: a superellipse whose top and bottom keep a back tile and a front tile
// inside the section. It is traced densely and resampled evenly by length, so a steady turn is a steady speed on
// screen. Only tiles in sight are kept off the words, and every place where a tile is in sight must also leave a
// held tile room to grow to GROW (holdAt).
//
// SLOTS (reviewed 2026-10-02 night). The track carries a slot coordinate: at each sample, ws is how far ahead the
// next tile must stand to clear this one by GMIN, both taken at their true 4:3 size there (two frames clear when
// they are apart along either axis), and the slot coordinate grows by 1 / ws per sample. Where that need shrinks
// within a tile's own reach (coming out of a corner) the density is lowered over the reach, so any two tiles a slot
// apart are at least the first one's need apart. The tiles stand an even number of slots apart and the whole ring
// moves in slots: every tile moves smoothly, neighbours never overlap, and a frame costs a lookup per tile.
function trackFor(W: number, H: number, copy: Box, sig: number, m: number, far: number, slots = true): Track {
  const cx = W / 2, cy = (copy.y0 + copy.y1) / 2;
  const rx = Math.max(8, W / 2 - m - (sig * sizeAt(0.5)) / 2);
  const ryT = Math.max(8, cy - m - (sig * HR * sizeAt(0)) / 2);
  const ryB = Math.max(8, H - cy - m - (sig * HR * sizeAt(1)) / 2);
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
  const words = [padded(copy, PAD_H)];
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
      // clear of the words along either axis (a 4:3 frame: half its width across, half its height up and down)
      const ex = Math.max(copy.x0 - PAD - x, x - copy.x1 - PAD), ey = Math.max(copy.y0 - PAD - y, y - copy.y1 - PAD);
      clear = Math.min(clear, Math.max((2 * ex) / k, (2 * ey) / (k * HR)));
    }
    clear = Math.min(clear, (2 * Math.min(x - EDGE, W - EDGE - x)) / k, (2 * Math.min(y - EDGE, H - EDGE - y)) / (k * HR));
    // a held tile here must have somewhere to grow (reduced motion grows nothing, and has no far side)
    if (far > 0 && v > 0.5 && !holdAt(W, H, words, x, y, (sig * k * GROW) / 2, (sig * k * HR * GROW) / 2)) clear = Math.min(clear, sig - 1);
  }
  const sg = new Float64Array(S + 1);
  let far0 = 0, far1 = 0;
  if (slots) {
    // ws: how many samples ahead the next tile must stand (both at their size there, GMIN of their width between)
    const ws = new Float64Array(S);
    for (let j = 0; j < S; j++) {
      const a = ks[j] * sig;
      let need = S / 2, before = -Infinity;
      for (let e = 1; e < S / 2; e++) {
        const u = (j + e) % S, b = ks[u] * sig, gap = ((a + b) / 2) * GMIN;
        const sep = Math.max(Math.abs(xs[u] - xs[j]) - (a + b) / 2 - gap, Math.abs(ys[u] - ys[j]) - ((a + b) / 2) * HR - gap);
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
  return { sig, m, far, xs, ys, ds, ks, vs, sg, T: sg[S], far0, far1, clear, rev: (len[D] / DRIFT) * 1000 };
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

// THE RING for a section of W x H with the words in `copy`: the largest front tile that fits. Still (reduced
// motion), nothing is on the far side; turning, a narrow far side (FAR). A few tens of milliseconds; it runs when
// the section comes near the screen and after a resize.
function solveTrack(W: number, H: number, copy: Box, still: boolean): Track {
  const m = EDGE + 6, far = still ? 0 : FAR;
  let lo = 40, hi = Math.max(48, Math.min(SIG_MAX, W * 0.3, H * 0.6));
  let best = trackFor(W, H, copy, lo, m, far);
  for (let r = 0; r < 11; r++) {
    const mid = (lo + hi) / 2, tr = fitsAt(W, H, copy, mid, m, far);
    if (tr) { lo = mid; best = tr; } else hi = mid;
  }
  return best;
}

// Before the script runs (and without it) the ring still stands, all fourteen in sight: each tile's place at rest
// for a 1440x833 section, spaced evenly along the track by the frames' size (a quick estimate, not the slots),
// written as shares of the section (orbit.css reads them in container units). The script then places every tile for
// the real size, by transform only, so nothing shifts the layout.
const FALLBACK: CSSProperties[] = (() => {
  const W = 1440, H = 833, copy = { x0: 407, y0: 273, x1: 1033, y1: 527 };
  const fit = (sig: number) => {
    const tr = trackFor(W, H, copy, sig, EDGE + 6, 0, false);
    const us = new Float64Array(S + 1);
    for (let j = 1; j <= S; j++) {
      const a = j - 1, b = j % S, kk = ((tr.ks[a] + tr.ks[b]) / 2) * sig;
      us[j] = us[j - 1] + Math.max(Math.abs(tr.xs[b] - tr.xs[a]) / kk, Math.abs(tr.ys[b] - tr.ys[a]) / (kk * HR));
    }
    return { tr, us };
  };
  let sig = 200, f = fit(sig);
  for (let it = 0; it < 4; it++) { sig = Math.max(40, Math.min((sig * f.us[S]) / (N * (1 + GMIN) * 1.3), f.tr.clear)); f = fit(sig); }
  const { tr, us } = f, p = newPt();
  return ORBIT.map((_, i) => {
    const u = (i / N) * us[S];
    let j = 0;
    while (j < S - 1 && us[j + 1] <= u) j++;
    at(tr, j, p);
    return {
      "--x": ((100 * p.x) / W).toFixed(2), "--y": ((100 * p.y) / H).toFixed(2), "--k": p.k.toFixed(3),
      "--fw": ((100 * sig) / W).toFixed(2), "--fh": ((100 * sig * HR) / W).toFixed(2), "--mk": (1 / p.k).toFixed(2),
    } as CSSProperties;
  });
})();

type Geo = { W: number; H: number; copy: Box; boxes: Rect[]; goal: Rect | null };
type Ring = {
  hold: (i: number) => void; release: (i: number) => void; steer: () => void;
  geo: () => Geo | null; label: () => void; reveal: (i: number) => void;
};
type TileHands = {
  enter: (i: number, e: PointerEvent) => void; leave: (e: PointerEvent) => void;
  // the pointer on the held tile's label where it stands outside the tile: the tile stays held
  keep: (e: PointerEvent) => void;
  focus: (i: number, e: FocusEvent<HTMLAnchorElement>) => void; blur: () => void;
  setRef: (i: number, li: HTMLLIElement | null) => void;
};

// One subject's tile: a link with the subject's photographs (only the first one as a card: `all` is the ring), its
// "Next" mark when it is not built yet, and its label and destination, which are also the link's name. Memoised:
// it re-renders only when it is held or let go, or when its photograph in front changes.
const OrbitTile = memo(function OrbitTile({ i, on, front, all, hands }: { i: number; on: boolean; front: number; all: boolean; hands: TileHands }) {
  const t = ORBIT[i];
  return (
    <li ref={(li) => hands.setRef(i, li)} className="v6-or__item" data-on={on} style={FALLBACK[i]}>
      <Link
        href={ROUTE[i].href} className="v6-or__tile"
        aria-labelledby={t.next ? `v6-or-w-${i} v6-or-t-${i} v6-or-cov` : `v6-or-w-${i} v6-or-t-${i}`}
        onPointerEnter={(e) => hands.enter(i, e)} onPointerLeave={hands.leave} onFocus={(e) => hands.focus(i, e)} onBlur={hands.blur}
      >
        <span className="v6-or__ph">
          {(all ? t.photos : t.photos.slice(0, 1)).map((p, j) => (
            <span key={p.src} className="v6-or__img" data-on={j === front}>
              <Image src={p.src} alt={p.alt} fill sizes={SIZES} style={p.pos ? { objectPosition: p.pos } : undefined} />
            </span>
          ))}
        </span>
        {t.next ? <span className="v6-or__mark" aria-hidden="true">Next</span> : null}
        <span className="v6-or__cap">
          <span id={`v6-or-w-${i}`} className="v6-or__cw">{t.label}</span>
          <span id={`v6-or-t-${i}`} className="v6-or__cl">{ROUTE[i].to}</span>
        </span>
      </Link>
    </li>
  );
});

export function Orbit() {
  const field = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const call = useRef<HTMLAnchorElement>(null);
  const pause = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const [held, setHeld] = useState<number | null>(null);
  const [callIdx, setCallIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const [paused, setPaused] = useState(false);
  // In the ring (a mouse, 1024px and wider) every photograph of a subject is drawn, stacked; as cards only the
  // first is, so a phone never downloads the others.
  const [ringOn, setRingOn] = useState(false);
  // Which of the held subject's photographs is in front (counts up while it is held; 0 at rest).
  const [cycle, setCycle] = useState(0);
  const heldRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const reduceRef = useRef(false);
  // Where nothing can hover (orbit.css then shows only the shown sentence), the headline keeps its word, so the
  // keyboard on a touch screen never changes its height.
  const hoverRef = useRef(true);
  const releaseTimer = useRef(0);
  // Filled in by the ring's effect.
  const ring = useRef<Ring>({ hold: () => {}, release: () => {}, steer: () => {}, geo: () => null, label: () => {}, reveal: () => {} });

  // THE RING. Positions are written straight to the tiles each frame; React only hears about holds and words.
  useEffect(() => {
    const el = field.current, cp = copy.current;
    if (!el || !cp) return;
    const lis = items.current;
    const ringMq = window.matchMedia(RING), redMq = window.matchMedia(REDUCE), hovMq = window.matchMedia(HOVER);
    let on = ringMq.matches;
    reduceRef.current = redMq.matches;
    hoverRef.current = hovMq.matches;
    setRingOn(on);
    let tr: Track | null = null;
    let W = 0, H = 0, box: Box = { x0: 0, y0: 0, x1: 0, y1: 0 }, avoid: Box[] = [];
    let phase = 0, raf = 0, last = 0, inView = false, near = false, dirty = true, timer = 0;
    // The ring's speed, 1 drifting and 0 stopped, eased between by `sp` (holding slows it, letting go speeds it up).
    let speed = 1;
    let sp: { from: number; to: number; t0: number; dur: number } | null = null;
    // A focused tile on the far side is turned into sight: the phase eases from `from` to `to`, starting at the
    // speed the ring had (v0, a phase per ms).
    let tween: { from: number; to: number; t0: number; v0: number } | null = null;
    // Each tile's lift, 0 in the ring and 1 held, eased by `lf`; the size it grows to and where it slides to.
    const lift = new Float64Array(N);
    const lf: ({ from: number; to: number; t0: number } | null)[] = ORBIT.map(() => null);
    const grow = new Float64Array(N).fill(1);
    const off = ORBIT.map(() => ({ x: 0, y: 0 }));
    let goal: Rect | null = null;   // the held tile's box once the ring has stopped
    const vs = new Float64Array(N);
    const mk = new Int32Array(N);   // the --mk each tile was last given, in fiftieths (0: none yet)
    const pt = newPt();
    const boxes: Rect[] = ORBIT.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));

    const clearStyles = () => {
      mk.fill(0);
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
    // Where every tile stands at this phase: its slot, as a place on the track.
    const layout = () => {
      if (!tr) return;
      for (let i = 0; i < N; i++) vs[i] = sampleAt(tr, slotOf(tr, i, phase));
    };
    const place = () => {
      if (!tr) return;
      const h = heldRef.current, w = tr.sig, ht = tr.sig * HR;
      for (let i = 0; i < N; i++) {
        const li = lis[i];
        if (!li) continue;
        at(tr, vs[i], pt);
        const e = lift[i];
        const k = pt.k * (1 + (grow[i] - 1) * e), x = pt.x + off[i].x * e, y = pt.y + off[i].y * e;
        const b = boxes[i];
        b.x = x - (w * k) / 2; b.y = y - (ht * k) / 2; b.w = w * k; b.h = ht * k;
        li.style.transform = `translate(${(x - w / 2).toFixed(2)}px, ${(y - ht / 2).toFixed(2)}px) scale(${k.toFixed(4)})`;
        // the held tile is in front of every other (orbit.css); one settling back stays above its neighbours
        li.style.zIndex = String(e > 0.001 && i !== h ? 59 : 10 + Math.round(pt.d * 18));
        li.style.setProperty("--d", pt.d.toFixed(3));
        li.style.setProperty("--vis", pt.v.toFixed(3));
        if (e > 0.001 || i === h) li.style.setProperty("--ik", (1 / k).toFixed(4));
        else li.style.removeProperty("--ik");
        // a tile receding onto the far side cannot be pointed at, so a held tile is never left half out of sight (the
        // keyboard still reaches it, and turns it into sight first: see reveal)
        li.style.pointerEvents = pt.v < 0.9 && i !== h ? "none" : "";
        // The subject's name and the "Next" mark keep their true size at every depth, and on the far side shrink
        // and fade with their photo, so neither floats where the photo has gone (orbit.css reads --mk: the inverse
        // of the tile's scale, less the far side's shrink, FAR_K). It is written in steps of 2% (a quarter of a
        // pixel on 13px type) and only when it changes, so a tile is repainted now and then as its depth changes,
        // never every frame: about 6 writes a second across the ring at 1440x900, and none while a tile crosses
        // the far side (a fade of their own there repainted that tile every frame). Not for a held Live tile, whose
        // name is hidden while the ring's label shows it (a tile settling back is followed, so its name comes back
        // at its true size).
        if (ORBIT[i].next || i !== h) {
          const q = Math.round((50 * (FAR_K + (1 - FAR_K) * pt.v)) / k);
          if (q !== mk[i]) { mk[i] = q; li.style.setProperty("--mk", (q / 50).toFixed(2)); }
        }
      }
    };
    // The speed now, along its curve: slowing is an ease out (it starts at the speed it had, so nothing jumps, and
    // settles to a stop); speeding up eases in and out.
    const speedAt = (now: number) => {
      if (!sp) return speed;
      const u = Math.min(1, Math.max(0, (now - sp.t0) / sp.dur));
      const e = sp.to < sp.from ? 1 - (1 - u) ** 2 : u * u * (3 - 2 * u);
      speed = sp.from + (sp.to - sp.from) * e;
      if (u >= 1) { speed = sp.to; sp = null; }
      return speed;
    };
    // Aim the speed at what the ring should do now: stopped while a tile is held or the ring is paused, else turning.
    // A new curve always starts from the speed the ring has.
    const steer = (now = performance.now()) => {
      const cur = speedAt(now), want = reduceRef.current || pausedRef.current || heldRef.current !== null ? 0 : 1;
      sp = want === cur ? null : { from: cur, to: want, t0: now, dur: want < cur ? SLOW_MS : RESUME_MS };
      if (!sp) speed = want;
    };
    // Where the ring will come to rest: the end of a turn into sight, or how far the slowing still carries it (what is
    // left of the integral of from * (1 - u)^2 over SLOW_MS: from * SLOW_MS * (1 - u)^3 / 3).
    const stopPhase = () => {
      if (tween) return tween.to;
      if (!tr || !sp || sp.to !== 0) return phase;
      const u = Math.min(1, Math.max(0, (performance.now() - sp.t0) / sp.dur));
      return phase + (sp.from * sp.dur * (1 - u) ** 3) / 3 / tr.rev;
    };
    // How large tile i grows when held, and where it slides to: as near GROW as the room around its resting place
    // allows (the ring is solved so that GROW always fits; a smaller lift is only a safety net).
    const aim = (i: number) => {
      if (!tr) return;
      const p = at(tr, sampleAt(tr, slotOf(tr, i, stopPhase())), newPt());
      const w = tr.sig * p.k, ht = w * HR;
      grow[i] = 1; off[i].x = 0; off[i].y = 0;
      for (let g = GROW; g > 1.001; g -= 0.025) {
        const q = holdAt(W, H, avoid, p.x, p.y, (w * g) / 2, (ht * g) / 2);
        if (q) { grow[i] = g; off[i].x = q.x - p.x; off[i].y = q.y - p.y; break; }
      }
      const g = grow[i];
      goal = { x: p.x + off[i].x - (w * g) / 2, y: p.y + off[i].y - (ht * g) / 2, w: w * g, h: ht * g };
    };
    const liftTo = (i: number, to: number, now: number) => {
      if (Math.abs(lift[i] - to) < 1e-4) { lift[i] = to; lf[i] = null; return; }
      lf[i] = { from: lift[i], to, t0: now };
    };

    // Solved only when the section is near the screen (the search takes a few tens of milliseconds); until then each
    // tile stands where FALLBACK put it.
    const measure = () => {
      timer = 0;
      on = ringMq.matches;
      setRingOn(on);
      if (!on) { tr = null; tween = null; dirty = true; clearStyles(); return; }
      if (!near) { dirty = true; return; }
      dirty = false;
      W = el.clientWidth; H = el.clientHeight;
      box = inkBox();
      // a held tile keeps clear of the words and of the pause button (which sits above every tile)
      avoid = [padded(box, PAD_H)];
      const pb = pause.current?.getBoundingClientRect(), fr = el.getBoundingClientRect();
      if (pb && pb.width) avoid.push(padded({ x0: pb.left - fr.left, y0: pb.top - fr.top, x1: pb.right - fr.left, y1: pb.bottom - fr.top }, 10));
      tr = solveTrack(W, H, box, reduceRef.current);
      tween = null;
      const w = `${tr.sig.toFixed(1)}px`, h = `${(tr.sig * HR).toFixed(1)}px`;
      for (const li of lis) {
        if (!li) continue;
        li.style.width = w;
        li.style.height = h;
      }
      layout();
      const i = heldRef.current;
      if (i !== null && !reduceRef.current) aim(i);
      place();
      ring.current.label();
    };
    // A resize or a change in the words is measured once things settle, not on every frame of a drag.
    const remeasure = () => { window.clearTimeout(timer); timer = window.setTimeout(measure, 120); };

    // A frame is asked for only while the ring is on screen and something moves: the ring turning or slowing, a
    // tile growing or settling, or a focused tile turning into sight. Otherwise the loop stops instead of redrawing
    // the same places on the main thread.
    const lifting = () => lf.some((l) => l !== null);
    const wanted = () => on && !!tr && inView && !reduceRef.current && (speed > 0 || sp !== null || tween !== null || lifting());
    const frame = (now: number) => {
      const dt = Math.max(0, Math.min(64, now - last));
      last = now;
      if (!tr) { raf = 0; return; }
      if (tween) {
        // a cubic Hermite from the ring's own speed (v0, a phase per ms) to rest at the target: no jump at either end
        const u = Math.min(1, (now - tween.t0) / REVEAL_MS);
        phase = tween.from + tween.v0 * REVEAL_MS * u * (1 - u) * (1 - u) + (tween.to - tween.from) * u * u * (3 - 2 * u);
        if (u >= 1) { tween = null; phase = ((phase % 1) + 1) % 1; }
      } else {
        // the mean of the speed at both ends of the frame, so the slowing is integrated, not stepped
        const s0 = speed, s1 = speedAt(now);
        phase = (phase + (((s0 + s1) / 2) * dt) / tr.rev) % 1;
      }
      for (let i = 0; i < N; i++) {
        const l = lf[i];
        if (!l) continue;
        // growing eases out (it answers the pointer at once); settling back eases in and out, so it leaves gently
        const u = Math.min(1, (now - l.t0) / LIFT_MS);
        lift[i] = l.from + (l.to - l.from) * (l.to > l.from ? easeOut(u) : u * u * (3 - 2 * u));
        if (u >= 1) { lift[i] = l.to; lf[i] = null; }
      }
      layout();
      place();
      ring.current.label();
      raf = wanted() ? requestAnimationFrame(frame) : 0;
    };
    const sync = () => {
      if (!wanted()) { if (raf) cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    // Holding tile i: every other tile settles back, the ring slows to a stop, and tile i grows where the ring will
    // stop. With reduced motion nothing moves: the tile is held where it stands.
    const hold = (i: number) => {
      const now = performance.now();
      for (let j = 0; j < N; j++) if (j !== i && (lift[j] > 0 || lf[j])) liftTo(j, 0, now);
      if (!tr || !on) return;
      if (reduceRef.current) {
        lift.fill(0); lf.fill(null); grow.fill(1);
        for (const o of off) { o.x = 0; o.y = 0; }
        lift[i] = 1;
        const b = boxes[i];
        place();
        goal = { ...b };
        ring.current.label();
        return;
      }
      steer(now);
      aim(i);
      liftTo(i, 1, now);
      sync();
    };
    const release = (i: number) => {
      const now = performance.now();
      goal = null;
      if (!tr || !on) return;
      if (reduceRef.current) { lift[i] = 0; place(); return; }
      liftTo(i, 0, now);
      steer(now);
      sync();
    };
    // A tile focused from the keyboard while on the far side turns into sight, the shortest way round: the ring eases
    // until the tile's slot is a fifth of a slot past the edge of the far side, starting from the speed it has.
    const reveal = (i: number) => {
      if (!tr || !on || reduceRef.current || tr.far1 <= tr.far0) return;
      const u = slotOf(tr, i, phase);
      if (u <= tr.far0 || u >= tr.far1) return;
      const ahead = tr.far1 - u + 0.2, back = u - tr.far0 + 0.2, now = performance.now();
      // the ring's speed now, as a phase per ms: drifting or slowing, or partway through another turn into sight
      let v0 = speedAt(now) / tr.rev;
      if (tween) {
        const w = Math.min(1, (now - tween.t0) / REVEAL_MS);
        v0 = tween.v0 * (1 - w) * (1 - 3 * w) + ((tween.to - tween.from) * 6 * w * (1 - w)) / REVEAL_MS;
      }
      tween = { from: phase, to: phase + (ahead <= back ? ahead : -back) / tr.T, t0: now, v0 };
      sp = null; speed = 0;
      if (heldRef.current === i) aim(i);
      sync();
    };
    ring.current.hold = hold;
    ring.current.release = release;
    ring.current.steer = () => { steer(); sync(); };
    ring.current.reveal = reveal;
    ring.current.geo = () => (on && tr ? { W, H, copy: box, boxes, goal } : null);

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
    // Reduced motion changes the ring itself (no far side, no drift), so it is solved again.
    const onReduce = () => {
      reduceRef.current = redMq.matches;
      lift.fill(0); lf.fill(null); grow.fill(1);
      for (const o of off) { o.x = 0; o.y = 0; }
      steer();
      dirty = true;
      if (near) measure();
      sync();
    };
    const onHover = () => { hoverRef.current = hovMq.matches; };
    ringMq.addEventListener("change", onMode);
    redMq.addEventListener("change", onReduce);
    hovMq.addEventListener("change", onHover);
    if (reduceRef.current) speed = 0;
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
      ring.current.hold = () => {};
      ring.current.release = () => {};
      ring.current.steer = () => {};
      ring.current.reveal = () => {};
      ring.current.geo = () => null;
    };
  }, []);

  // The label of a held tile in the ring. On a large photo it sits on the photo's foot, when it takes no more than
  // half of it. Otherwise it is a small plate under the tile, above it, or beside it on the side toward the words,
  // whichever first stays inside the section and off the words (it may cover a dimmed neighbour); on the photo as a
  // last resort. Where it goes, and its size, are decided once per hold from the box the tile grows to (on the photo
  // it is as wide as that box, from the tile's left edge); each frame it only follows the tile, so it is never
  // measured while the ring moves (measuring it every frame of the growth forced a layout each time).
  const lab = useRef<{ key: string; at: string; h: number; cw: number; ch: number }>({ key: "", at: "", h: 0, cw: 0, ch: 0 });
  useLayoutEffect(() => {
    const placeLabel = () => {
      const c = call.current, g = ring.current.geo(), i = heldRef.current;
      if (!c || !g || i === null) return;
      // decided again when the tile, its words or the size it grows to change (a resize while it is held)
      const b = g.boxes[i], goal = g.goal ?? b, L = lab.current, key = `${i}:${c.textContent}:${Math.round(goal.w)}`;
      if (L.key !== key) {
        L.key = key;
        L.at = "";
        const onPhoto = () => {
          c.dataset.at = "on";
          c.style.width = `${goal.w.toFixed(1)}px`;
          L.h = c.offsetHeight;
          return L.h;
        };
        if (Math.max(goal.w, goal.h) >= 160 && onPhoto() <= goal.h * 0.5) L.at = "on";
        else {
          c.dataset.at = "under";
          c.style.width = "";
          L.cw = c.offsetWidth; L.ch = c.offsetHeight;
          const cw = L.cw, ch = L.ch, p = 10;
          const x = Math.min(Math.max(goal.x + goal.w / 2 - cw / 2, EDGE), g.W - EDGE - cw), y = goal.y + goal.h / 2 - ch / 2;
          const spots: [string, number, number][] = [
            ["under", x, goal.y + goal.h + 10],
            ["above", x, goal.y - 10 - ch],
            ["beside", goal.x + goal.w / 2 < g.W / 2 ? goal.x + goal.w + 10 : goal.x - 10 - cw, y],
          ];
          for (const [at, l, t] of spots) {
            const inside = l >= 6 && t >= 6 && l + cw <= g.W - 6 && t + ch <= g.H - 6;
            const offWords = l + cw < g.copy.x0 - p || l > g.copy.x1 + p || t + ch < g.copy.y0 - p || t > g.copy.y1 + p;
            if (inside && offWords) { L.at = at; break; }
          }
          if (!L.at) { onPhoto(); L.at = "on"; }
        }
        c.dataset.at = L.at;
        // Under a label on the photo the photo's foot darkens (orbit.css data-foot): from the label's top edge down it is
        // fully dark, and above that it fades out over FOOT_FADE px. Only the held tile has one.
        for (let j = 0; j < N; j++) if (j !== i) items.current[j]?.removeAttribute("data-foot");
        const li = items.current[i];
        if (li && L.at === "on") {
          const foot = Math.min(goal.h, L.h + FOOT_FADE);
          li.style.setProperty("--foot", `${((100 * foot) / goal.h).toFixed(2)}%`);
          li.style.setProperty("--foot-solid", `${((100 * (foot - L.h)) / foot).toFixed(2)}%`);
          li.dataset.foot = "";
        } else li?.removeAttribute("data-foot");
      }
      let l = 0, t = 0;
      if (L.at === "on") { l = b.x; t = b.y + b.h - L.h; }
      else {
        const cw = L.cw, ch = L.ch;
        const x = Math.min(Math.max(b.x + b.w / 2 - cw / 2, EDGE), g.W - EDGE - cw);
        if (L.at === "under") { l = x; t = b.y + b.h + 10; }
        else if (L.at === "above") { l = x; t = b.y - 10 - ch; }
        else { l = b.x + b.w / 2 < g.W / 2 ? b.x + b.w + 10 : b.x - 10 - cw; t = b.y + b.h / 2 - ch / 2; }
      }
      c.style.transform = `translate(${l.toFixed(1)}px, ${t.toFixed(1)}px)`;
    };
    ring.current.label = placeLabel;
    lab.current.key = "";
    placeLabel();
  }, [held, callIdx]);

  // While a subject with several photographs is held, the next one comes forward every PHOTO_MS (orbit.css
  // crossfades them). Never with reduced motion, and never as cards.
  useEffect(() => {
    if (held === null || !ringOn || reduceRef.current || ORBIT[held].photos.length < 2) return;
    const id = window.setInterval(() => setCycle((c) => c + 1), PHOTO_MS);
    return () => window.clearInterval(id);
  }, [held, ringOn]);

  // Holding a tile: the pointer is on it, or the keyboard has focused it. Letting go waits a moment, so a pointer
  // crossing the gap between two tiles does not set the ring off again. The handlers are made once and read only
  // refs and state setters, so every tile keeps the same functions and a hold re-renders just the two tiles that
  // change (re-rendering all fourteen cost a dropped frame at the moment the ring starts to slow).
  const [hands] = useState(() => {
    const hold = (i: number) => {
      window.clearTimeout(releaseTimer.current);
      if (heldRef.current === i) return;
      heldRef.current = i;
      ring.current.hold(i);
      setHeld(i);
      setCallIdx(i);
      setCycle(0);
      if (SENTENCE_OF[i] >= 0 && hoverRef.current) setShown(SENTENCE_OF[i]);
    };
    const release = () => {
      window.clearTimeout(releaseTimer.current);
      releaseTimer.current = window.setTimeout(() => {
        const prev = heldRef.current;
        if (prev === null) return;
        heldRef.current = null;
        items.current[prev]?.removeAttribute("data-foot");
        ring.current.release(prev);
        setHeld(null);
      }, RELEASE_MS);
    };
    const hands: TileHands = {
      enter: (i, e) => { if (e.pointerType !== "touch") hold(i); },
      leave: (e) => { if (e.pointerType !== "touch") release(); },
      keep: (e) => { const i = heldRef.current; if (e.pointerType !== "touch" && i !== null) hold(i); },
      focus: (i, e) => {
        if (!e.currentTarget.matches(":focus-visible")) return;
        hold(i);
        ring.current.reveal(i);
      },
      blur: release,
      setRef: (i, li) => { items.current[i] = li; },
    };
    return hands;
  });
  useEffect(() => () => window.clearTimeout(releaseTimer.current), []);

  const toggle = () => {
    pausedRef.current = !paused;
    setPaused(!paused);
    ring.current.steer();
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
            <OrbitTile key={t.label} i={i} on={held === i} front={held === i ? cycle % t.photos.length : 0} all={ringOn} hands={hands} />
          ))}
        </ul>

        {/* The held tile's label in the ring (orbit.css shows it only there). The tile's link already carries the
            same words as its name, so this copy is hidden from assistive technology and from the keyboard. Where it
            stands outside the tile (under, above or beside it) it is a link to the same page, and the pointer on it
            keeps the tile held: its arrow invites the click, and as a plate the pointer passed through, reaching
            for it held the dimmed tile underneath instead and a click opened that tile's page (review, 2026-10-03).
            On the photo it lets the pointer through to the tile. A Next tile's label says it is not built yet and
            names the page it opens, the coverage list; the "Next" mark is already on its photo. */}
        <Link ref={call} href={ROUTE[callIdx].href} prefetch={false} tabIndex={-1} className="v6-or__call" aria-hidden="true"
          data-show={held !== null} data-at="under" onPointerEnter={hands.keep} onPointerLeave={hands.leave}>
          <span className="v6-or__call-w">{callTile.label}</span>
          <span className="v6-or__call-t">
            <span>{ROUTE[callIdx].to}</span>
            {callTile.next ? null : <span className="v6-or__arw">→</span>}
          </span>
          {callTile.next ? <span className="v6-or__call-t"><span>What it can check today</span><span className="v6-or__arw">→</span></span> : null}
        </Link>

        <button ref={pause} type="button" className="v6-or__pause" onClick={toggle} aria-label={paused ? "Play the orbit" : "Pause the orbit"}>
          {paused
            ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5 3.2v9.6L12.5 8z" fill="currentColor" /></svg>
            : <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
        </button>
      </div>
    </section>
  );
}
