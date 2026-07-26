"use client";

// The stealth curtain, in the V6 system.
//
// This is the ONLY page anyone following a link to vraelis.com sees while stealth is on, which makes it the
// entire first impression: investors, a prospective design partner, anyone sent the domain. It was still
// wearing the previous brand's warm paper and emerald bloom, so the front door announced a company that no
// longer exists behind it.
//
// It cannot reuse the V6 stylesheet. Stealth renders from the ROOT layout, which never loads
// app/dev-preview/v6/_system/v6.css, and importing it here would ship the design system to a page that
// exists to ship nothing. So the V6 values are written out literally below and must be kept in step with
// v6.css by hand; there is no import that would keep them honest.
//
// The composition follows V6's opening chapter: near-black graphite ground, one sentence at display weight,
// one quiet line under it, nothing else. No mark, no bloom, no gradient doing work the type should do.
//
// The unlock gesture is below. It cannot be hidden (client code has to interpret keystrokes), so what
// protects it is the server-enforced three-second wait and the attempt limiter. See lib/stealth.ts.
//
// This component is the ONLY thing the server renders while stealth is on, so nothing of the real site is
// in the HTML or the RSC payload until the cookie exists.

import { useEffect } from "react";

export function StealthScreen() {
  useEffect(() => {
    // THE GESTURE: press Control, then Shift, then Alt, in that order. While holding all three, press Enter
    // four times. Then wait three seconds; letting go of the keys is fine. The screen never reacts.
    //
    // The three seconds are enforced by the SERVER, not by the timer here (see lib/stealth.ts). A gesture
    // has to be interpreted by client code, so it can never be secret the way a passphrase can. Making the
    // wait real server-side is what stops someone reading this file and simply replaying the two calls.
    const ENTERS_NEEDED = 4;
    const ORDER = ["Control", "Shift", "Alt"];

    let held: string[] = [];   // modifiers in the order they went down
    let enters = 0;
    let armed = false;         // handshake started; waiting out the three seconds
    let cancelled = false;
    let generation = 0;        // bumped on every reset, so an abandoned attempt can never finish
    let timer: ReturnType<typeof setTimeout> | undefined;

    const orderOk = () => held.length === ORDER.length && held.every((k, i) => k === ORDER[i]);

    function reset() {
      held = [];
      enters = 0;
      armed = false;
      generation += 1; // invalidates any attempt already in flight
      if (timer) clearTimeout(timer);
    }

    async function post(payload: Record<string, unknown>) {
      const res = await fetch("/api/stealth/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return (await res.json().catch(() => null)) as { ok?: boolean; token?: string } | null;
    }

    async function run() {
      armed = true;
      const attempt = ++generation; // a cancelled attempt must not unlock later if its fetch is still open
      // NOTHING changes on screen while this runs. The page must never acknowledge a correct gesture: a
      // "waiting…" state would tell anyone probing that they had the first half right.
      try {
        const begun = await post({ step: "begin" });
        if (cancelled || attempt !== generation || !begun?.ok || !begun.token) { reset(); return; }

        // Wait four seconds. The server independently refuses anything under its own floor, so this timer
        // is not the security boundary; it just avoids asking before the answer could possibly be yes.
        // Same duration on desktop and mobile, so the gesture feels identical once the entry differs.
        await new Promise((r) => { timer = setTimeout(r, 4200); });
        if (cancelled || attempt !== generation) return;

        const done = await post({ step: "complete", token: begun.token });
        if (cancelled || attempt !== generation) return;
        if (done?.ok) {
          // Full reload, not a router refresh: the server must re-render the real layout from scratch now
          // that the signed cookie exists. This is the first and only visible change.
          location.reload();
          return;
        }
        reset();
      } catch {
        // Offline or blocked: stay closed and silent. A failed attempt must never look like a hint.
        reset();
      }
    }

    function onDown(e: KeyboardEvent) {
      const isEnterKey = e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter";

      if (armed) {
        // Anti-spam: once the wait has started, another Enter abandons the whole attempt. Someone who knows
        // the gesture presses it four times and stops; someone hammering the key does not get in, and gets
        // no feedback telling them to stop either.
        if (isEnterKey) { e.preventDefault(); reset(); }
        return;
      }

      if (ORDER.includes(e.key)) {
        // Record each modifier once, in the order it was pressed. Held keys repeat; ignore the repeats.
        if (!held.includes(e.key)) held.push(e.key);
        return;
      }

      if (!isEnterKey || !orderOk() || !(e.ctrlKey && e.shiftKey && e.altKey)) { reset(); return; }
      if (e.repeat) return; // leaning on Enter is not four presses

      e.preventDefault();
      enters += 1;
      if (enters > ENTERS_NEEDED) { reset(); return; } // mashing past four is not the gesture
      if (enters === ENTERS_NEEDED) void run();
    }

    function onUp(e: KeyboardEvent) {
      // Once the wait has started, releasing must not cancel it: the gesture is designed to be finished with
      // the keys let go. Before that, releasing a modifier abandons the attempt.
      if (armed) return;
      if (ORDER.includes(e.key)) reset();
    }

    // MOBILE: there are no modifier keys, so the gesture is eight taps, then the same four-second wait.
    // Eight is high enough that no idle tapping reaches it, and the same anti-spam rule applies: a ninth
    // tap during the wait abandons the attempt. Taps must be reasonably paced; a burst faster than a person
    // taps is treated as spam and resets.
    const TAPS_NEEDED = 8;
    const MIN_TAP_GAP_MS = 60;   // below this is a synthetic burst, not a finger
    const MAX_TAP_GAP_MS = 1200; // a long pause means they stopped, so start over
    let taps = 0;
    let lastTap = 0;

    function onTap(e: PointerEvent) {
      if (e.pointerType === "mouse") return; // desktop uses the keyboard gesture

      if (armed) {
        // Same rule as the keyboard: tapping again during the wait cancels the whole thing.
        taps = 0;
        reset();
        return;
      }

      const now = e.timeStamp;
      const gap = now - lastTap;
      lastTap = now;
      // Too fast is a burst, too slow means they moved on. Either way this tap starts a fresh count.
      if (taps > 0 && (gap < MIN_TAP_GAP_MS || gap > MAX_TAP_GAP_MS)) { taps = 1; return; }

      taps += 1;
      if (taps > TAPS_NEEDED) { taps = 0; reset(); return; }
      if (taps === TAPS_NEEDED) { taps = 0; void run(); }
    }

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("pointerdown", onTap);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("pointerdown", onTap);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <main className="vst-root">
      <style>{ST_CSS}</style>

      <div className="vst-stack">
        <p className="vst-kicker vst-in vst-d1">Vraelis</p>
        <h1 className="vst-head vst-in vst-d2">
          Not open yet.
        </h1>
        <p className="vst-body vst-in vst-d3">
          Vraelis independently proves that software built or changed by AI still delivers the outcome the
          business depends on. If you were meant to be here, you already know the way in.
        </p>
      </div>
    </main>
  );
}

const ST_CSS = `
/* V6 VALUES, WRITTEN OUT. The V6 stylesheet is not loaded on this page and must not be: stealth exists to
   ship nothing. Keep these in step with app/dev-preview/v6/_system/v6.css by hand. */
.vst-root{
  position:relative; min-height:100svh;
  display:flex; align-items:center; justify-content:center;
  overflow:hidden; isolation:isolate;
  padding:clamp(40px,8vw,96px) clamp(20px,5vw,64px);
  background:#0A0A0B;                 /* --graphite */
  color:#FAFAFA;                      /* --g-fg */
}

/* Left-aligned, not centred. V6 opens on a left-set headline in a wide field; centring it here would be a
   different company's composition wearing this one's colours. */
.vst-stack{
  position:relative; z-index:1;
  width:100%; max-width:720px;
  transform:translateY(-4%);
}

.vst-kicker{
  margin:0 0 18px;
  font-size:13px; font-weight:500; letter-spacing:.14em; text-transform:uppercase;
  color:#8E9095;                      /* --g-fg-3 */
}
.vst-head{
  margin:0;
  font-weight:600; letter-spacing:-.032em; line-height:1.0;
  font-size:clamp(2.7rem,5vw,4.4rem); /* v6-d2xl */
  color:#FAFAFA;
  text-wrap:balance;
}
.vst-body{
  margin:20px 0 0; max-width:56ch;
  font-size:clamp(1rem,1.2vw,1.1rem); line-height:1.6;
  color:#C4C5C9;                      /* --g-fg-2 */
  text-wrap:pretty;
}

/* One hairline, the way every V6 section separates itself. The only ornament on the page. */
.vst-stack::after{
  content:""; display:block; margin-top:34px;
  height:1px; width:100%; max-width:220px;
  background:rgba(255,255,255,0.12);  /* --g-line */
}

.vst-in{ animation:vst-rise .62s cubic-bezier(.22,1,.36,1) both; }
.vst-d1{ animation-delay:80ms; }
.vst-d2{ animation-delay:150ms; }
.vst-d3{ animation-delay:220ms; }

@keyframes vst-rise{ from{ opacity:0; transform:translateY(12px); } to{ opacity:1; transform:none; } }

@media (prefers-reduced-motion: reduce){
  .vst-in{ animation:none !important; opacity:1; transform:none; }
}
`;
