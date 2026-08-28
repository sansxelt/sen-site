"use client";

// ONE GEOMETRY SYSTEM for the whole homepage.
//
// THE DEFECT THIS EXISTS TO FIX. Every pinned wrapper is sized in svh -- .v6-au 300svh, .v6-gap 280svh,
// .v6-st 430svh, .v6-rg 480svh, .v6-dr 520svh -- so the document is roughly 20x the viewport height and its
// LENGTH IS A FUNCTION OF THE VIEWPORT. The browser preserves scrollY in pixels across a viewport change. It
// does not preserve position in a document whose length just changed underneath the reader, and nothing here
// did either. Measured on the running page, one live change with no reload:
//
//   Chromebook windowed -> fullscreen   doc 15048 -> 16952   reader moved -6.3% of the whole page
//   Chromebook fullscreen -> windowed   doc 16952 -> 15048   +7.1%, active chapter lost, STAGE BLANK
//   desktop windowed -> fullscreen      doc 18004 -> 20503   -6.9%, --p 0.7034 -> 0.1525
//   portrait -> landscape               doc 24137 -> 10126   +43%, scrollY clamped, STAGE BLANK
//
// scrollY was byte-identical before and after in every case except the one the browser clamped. So the fix
// is not to smooth anything or to gate anything; it is to RE-DERIVE WHERE THE READER SHOULD BE.
//
// AND IT IS SEMANTIC, NOT PROPORTIONAL. scrollY * newHeight / oldHeight looks equivalent and is not: the
// document is a sequence of chapters whose heights do not scale together (the hero and the closing section
// are not 100svh multiples, and crossing the unpin gate changes five wrappers from svh to content height at
// once). A global ratio lands the reader in the right PERCENTAGE and the wrong SENTENCE. What is preserved
// here is the chapter the reader is in and how far through that chapter's own travel they are.
//
// WHAT COUNTS AS A GEOMETRY CHANGE, AND WHY IT IS MEASURED RATHER THAN LISTENED FOR. The quantity every
// wrapper is sized in is svh. So that is the quantity watched: a hidden probe element of `height: 100svh`
// under a ResizeObserver. This is the whole reason the system needs no fullscreen API, no orientation
// listener, no zoom detection and no user-agent test -- fullscreen, orientation, zoom, split-screen,
// display-scaling and an external display all move svh, and one observer sees all of them.
//
// It also solves the feedback problem for free, in the direction that matters. iOS collapses its URL bar
// constantly during ordinary scrolling and window.innerHeight follows it by 60-90px. svh DOES NOT MOVE for
// that -- it is defined as the viewport with the toolbars shown -- so the probe never fires, and a reader
// scrolling on a phone never triggers a remap. Listening to window resize or visualViewport would have
// remapped the page on every swipe.

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number) => clamp(v, 0, 1);

/** A scroll-scrubbed composition, registered so a remap can suspend it and re-sync it in one frame. */
export type ProgressEngine = {
  el: HTMLElement;
  /** Re-read geometry and ADOPT the target with no smoothing, writing the property before this frame ends. */
  resync: () => void;
  /** Ignore scroll and resize until resumed. */
  suspend: () => void;
  resume: () => void;
};

const engines = new Set<ProgressEngine>();

// WHERE THE READER IS, IN THE DOCUMENT'S OWN TERMS.
//
// "chapter" is a pinned or stacked narrative section and a phase through its travel. "element" is anything
// else -- hero, the terminal chapter, the closing section -- anchored to a real box and the fraction of it
// already scrolled past, which survives that box changing height. "edge" is the top or bottom of the
// document, kept as its own case so a reader who was AT the top is not nudged one pixel off it.
type Anchor =
  | { kind: "chapter"; cls: string; phase: number; lead: number }
  | { kind: "element"; el: HTMLElement; frac: number }
  | { kind: "edge"; at: "top" | "bottom" };

type Chapter = { el: HTMLElement; cls: string; top: number; height: number; travel: number; pinned: boolean };

// WHAT THE PAGE LOOKED LIKE BEFORE THE GEOMETRY MOVED.
//
// The anchor has to describe where the reader was in the OLD layout, but a ResizeObserver only speaks after
// the new one exists. Holding a snapshot solves that and pays for itself twice: measuring the chapters costs
// a getBoundingClientRect per wrapper plus a getComputedStyle per pin, and doing that on every scroll frame
// is a layout read storm in the middle of the one thing on this page that must never stutter. Measured on
// the continuity probe, per-frame measurement pushed .v6-st's peak-to-median ratio from 13.4 to 134.3 at
// 1093x525 and from 8.3 to 33 at 1280x720. Chapter geometry cannot change while the page is merely
// scrolling, so none of that work was buying anything.
type Snapshot = { list: Chapter[]; vh: number; max: number; geom: { w: number; h: number } };

/**
 * Every narrative chapter, measured in DOCUMENT coordinates, right now.
 *
 * A chapter is defined structurally -- a wrapper that directly contains a `*__pin` child -- so this needs no
 * list of class names and cannot drift from the stylesheet. Verified against the running page: it finds
 * exactly the five wrappers at 1366x768 and at 390x844, and the same five at 844x390 where the pins have
 * gone `position: static` and travel is 0, which is precisely how the stacked composition is recognised.
 */
function readChapters(): Chapter[] {
  const out: Chapter[] = [];
  const y = window.scrollY;
  for (const el of document.querySelectorAll<HTMLElement>("#v6-main section, #v6-main > div")) {
    const pin = el.querySelector<HTMLElement>(':scope > [class*="__pin"]');
    if (!pin) continue;
    const r = el.getBoundingClientRect();
    const pinned = getComputedStyle(pin).position === "sticky";
    const travel = pinned ? Math.max(0, r.height - pin.getBoundingClientRect().height) : 0;
    const cls = (el.className || "").split(/\s+/).find((c) => /^v6-[a-z]+$/.test(c));
    if (!cls) continue;
    out.push({ el, cls, top: r.top + y, height: r.height, travel, pinned });
  }
  return out.sort((a, b) => a.top - b.top);
}

const docMax = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

/**
 * Capture where the reader is. Called continuously while scrolling, NOT at the moment of the resize --
 * a ResizeObserver fires after layout has already changed, so by then the pre-change position is gone.
 * The last position recorded while the page was stable is the one that gets restored.
 */
function capture(snap: Snapshot, y: number): Anchor {
  const { list: chapters, vh, max } = snap;
  if (y <= 2) return { kind: "edge", at: "top" };
  if (y >= max - 2) return { kind: "edge", at: "bottom" };

  for (const c of chapters) {
    // A pinned chapter owns scroll positions from its top until its travel is spent; a stacked one owns its
    // whole box. Outside that the reader is between chapters and wants the element branch.
    const span = c.pinned ? c.travel : Math.max(0, c.height - vh);
    // ONE PIXEL OF TOLERANCE, BECAUSE SCROLL IS AN INTEGER AND LAYOUT IS NOT.
    // A chapter's end is a fractional number of pixels (300svh of a 657px viewport is 1970.99, not 1971)
    // while window.scrollY only takes whole numbers. A reader on the last pixel of a chapter therefore sits
    // a hundredth of a pixel PAST its computed end and fell through to the element branch, which anchors
    // them sensibly but by the wrong rule. Measured: v6-au and v6-st failed this way at phase 1.0 while
    // v6-gap, v6-rg and v6-dr passed, purely on which way their fraction rounded.
    if (y >= c.top - vh * 0.5 && y <= c.top + Math.max(span, c.height - vh) + 1) {
      if (y < c.top - 1) {
        // Approaching, not yet in it. Preserve the gap in viewports so it scales with the new geometry
        // instead of being restored as a stale pixel count.
        //
        // THE PIXEL MATTERS. A chapter's top is fractional and scrollY is not, so a reader standing exactly
        // at the start of a chapter reads as a hair ABOVE it and took this branch. The lead was then applied
        // against the new geometry and pushed them out of the chapter altogether -- measured on
        // .v6-au at entry, 1366x657 -> 1366x768: landed at 766 against a chapter starting at 768, i.e. two
        // pixels short of the thing they were supposed to be looking at. Anything within a pixel of the top
        // IS the top, and belongs in the phase branch below at phase 0.
        return { kind: "chapter", cls: c.cls, phase: 0, lead: (c.top - y) / vh };
      }
      return { kind: "chapter", cls: c.cls, phase: span > 0 ? clamp01((y - c.top) / span) : 0, lead: 0 };
    }
  }

  // NON-NARRATIVE SECTIONS. Anchor to the box the reader is looking at and how far through it they are, so a
  // section that changes height keeps them at the same point in its content rather than the same pixel.
  let best: HTMLElement | null = null;
  let bestTop = -Infinity;
  const originY = window.scrollY;
  for (const el of document.querySelectorAll<HTMLElement>("#v6-main section, #v6-main > div")) {
    const t = el.getBoundingClientRect().top + originY;
    if (t <= y && t > bestTop) { bestTop = t; best = el; }
  }
  if (best) {
    const h = best.getBoundingClientRect().height || 1;
    return { kind: "element", el: best, frac: clamp01((y - bestTop) / h) };
  }
  return { kind: "edge", at: "top" };
}

/**
 * Where that anchor lands in the geometry that exists NOW.
 *
 * PINNED <-> STACKED IS HANDLED HERE AND NOWHERE ELSE. The phase is a fraction through the chapter's own
 * travel, and both compositions have a travel: pinned, it is the wrapper height minus the pin; stacked, it
 * is the wrapper height minus the viewport. So a chapter that unpins keeps the reader at the same fraction
 * through the same chapter, which is the closest meaningful beat when the phase model itself has gone away.
 * A chapter shorter than the viewport when stacked has no travel at all and resolves to its own top, which
 * is still inside its composed range -- the one thing that must never fail.
 */
function resolve(a: Anchor): number {
  const max = docMax();
  const vh = window.innerHeight;
  if (a.kind === "edge") return a.at === "top" ? 0 : max;

  if (a.kind === "chapter") {
    const c = readChapters().find((x) => x.cls === a.cls);
    if (!c) return clamp(window.scrollY, 0, max);
    if (a.lead > 0) return clamp(c.top - a.lead * vh, 0, max);
    const span = c.pinned ? c.travel : Math.max(0, c.height - vh);
    return clamp(c.top + a.phase * span, 0, max);
  }

  if (!a.el.isConnected) return clamp(window.scrollY, 0, max);
  const r = a.el.getBoundingClientRect();
  return clamp(r.top + window.scrollY + a.frac * (r.height || 1), 0, max);
}

// ---------------------------------------------------------------------------------------------------------

let started = false;
let anchor: Anchor | null = null;
let remapping = false;
let probe: HTMLElement | null = null;
let lastW = 0;
let lastH = 0;
let lastY = 0;
// The page as it was when the snapshot was taken. anchorGeom lives inside it, so a scroll can be tested
// against the geometry the snapshot belongs to without a second source of truth.
let snap: Snapshot = { list: [], vh: 0, max: 0, geom: { w: 0, h: 0 } };

const liveGeom = () => {
  if (!probe) return { w: 0, h: 0 };
  const r = probe.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
};
const sameGeom = (a: { w: number; h: number }, b: { w: number; h: number }) => a.w === b.w && a.h === b.h;

const takeSnapshot = () => {
  snap = { list: readChapters(), vh: window.innerHeight, max: docMax(), geom: liveGeom() };
};

/**
 * The whole per-scroll cost of this system: one rect read to confirm the geometry has not moved, and an
 * integer store. Everything the anchor needs is derived later, from the snapshot, at the one moment it is
 * actually wanted.
 *
 * Shrinking the document makes the browser CLAMP scrollY and dispatch a scroll event like any other.
 * Recording it would overwrite the reader's real position with wherever the browser had just dumped them --
 * measured at portrait 390x844, .v6-rg phase 0.87 became scrollY 9736 of a 9736 maximum and stayed there.
 * A scroll that arrives in a geometry the snapshot does not describe is a CONSEQUENCE of the change, never
 * the reader moving, so it is ignored and the pending remap keeps the position it was given.
 */
const onScroll = () => {
  if (remapping) return;
  if (!sameGeom(liveGeom(), snap.geom)) return;
  lastY = window.scrollY;
};

/**
 * Re-derive the reader's position and repaint every scrubbed scene, in one frame, with nothing animated.
 *
 * ORDER MATTERS AND IS NOT NEGOTIABLE. The anchor is computed from the OLD snapshot and the last scroll
 * position recorded in it, because by the time a ResizeObserver speaks the new layout already exists.
 * Engines are suspended first so the scroll this performs cannot be mistaken for the reader's and fed back
 * in. scroll-behavior is forced to auto because the site sets smooth scrolling for in-page links, and a
 * smoothly ANIMATED restoration is the jump this exists to prevent. resync() runs synchronously after the
 * scroll rather than on the next frame: window.scrollTo has already updated layout by the time it returns,
 * so reading geometry here sees the final numbers and the custom property is written before the browser
 * paints. A frame of delay is exactly the blank or stale stage.
 */
function remap() {
  remapping = true;
  for (const e of engines) e.suspend();

  anchor = snap.list.length ? capture(snap, lastY) : null;

  const html = document.documentElement;
  const prev = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";

  if (anchor) {
    const y = resolve(anchor);
    if (Math.abs(y - window.scrollY) > 0.5) window.scrollTo(0, y);
  }
  for (const e of engines) e.resync();

  html.style.scrollBehavior = prev;
  remapping = false;
  takeSnapshot();
  lastY = window.scrollY;
  for (const e of engines) e.resume();
}

/**
 * COALESCE, THEN WAIT FOR THE LAYOUT TO STOP MOVING.
 *
 * A fullscreen transition is not one resize. Chrome reports several as it animates its own chrome away, and
 * an orientation change reports the intermediate square. Remapping on each costs a visible stutter and,
 * worse, re-anchors against a half-finished layout. So a change starts a settle window: keep looking until
 * the probe has held the same size for a few consecutive frames, then remap once. The ceiling stops a
 * pathological case -- a continuously dragged window edge -- from deferring the remap forever.
 */
const STABLE_FRAMES = 3;
const MAX_SETTLE_MS = 600;
let settleRaf = 0;
let settleStart = 0;
let stableFor = 0;

function settle(now: number) {
  settleRaf = 0;
  if (!probe) return;
  const g = liveGeom();
  if (g.w === lastW && g.h === lastH) stableFor += 1;
  else { stableFor = 0; lastW = g.w; lastH = g.h; }

  if (stableFor >= STABLE_FRAMES || now - settleStart > MAX_SETTLE_MS) {
    remap();
    return;
  }
  settleRaf = requestAnimationFrame(settle);
}

function onGeometry() {
  if (!probe) return;
  const g = liveGeom();
  // Sub-pixel noise is not a layout change. Anything that genuinely moves svh moves it by whole pixels.
  if (Math.abs(g.w - lastW) < 1 && Math.abs(g.h - lastH) < 1) return;
  if (!settleRaf) {
    settleStart = performance.now();
    stableFor = 0;
    settleRaf = requestAnimationFrame(settle);
  }
}

/** Starts on the first registration and lives for the page. Idempotent. */
function startController() {
  if (started || typeof window === "undefined") return;
  started = true;

  probe = document.createElement("div");
  // Sized in exactly what the wrappers are sized in. Fixed and hidden so it can neither be seen nor affect
  // layout; width 100% of the initial containing block, which excludes a classic scrollbar and therefore
  // cannot itself cause overflow.
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100svh;visibility:hidden;pointer-events:none;z-index:-1";
  document.body.appendChild(probe);
  const g0 = liveGeom();
  lastW = g0.w;
  lastH = g0.h;

  takeSnapshot();
  lastY = window.scrollY;

  new ResizeObserver(onGeometry).observe(probe);
  // The document can also change height for reasons that are not a geometry change -- a webfont swapping,
  // late content resolving above a chapter. Those move every chapter top underneath a snapshot that still
  // claims to describe them. Refreshing only while the geometry still matches keeps this observer from
  // stealing the pre-change snapshot out from under a remap that is already pending.
  const main = document.getElementById("v6-main");
  if (main) {
    new ResizeObserver(() => {
      if (!remapping && sameGeom(liveGeom(), snap.geom)) takeSnapshot();
    }).observe(main);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
}

export function registerEngine(e: ProgressEngine): () => void {
  startController();
  engines.add(e);
  return () => { engines.delete(e); };
}

/** True while a remap is in flight, so an engine can ignore the scroll it causes. */
export const isRemapping = () => remapping;

/** Test seam: the probe drives everything, so a probe that never changes size proves the suite is vacuous. */
export const __geometryProbeSize = () => (probe ? probe.getBoundingClientRect() : null);
