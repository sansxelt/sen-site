"use client";

// The stealth curtain. Shares the 404's calm paper field and restraint (app/not-found.tsx) but not its
// oversized numeral: here the headline IS the composition. An earlier version put a redacted line above it
// and the mark competed with the one sentence that carries the page, so it went.
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
    <main
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        isolation: "isolate",
        textAlign: "center",
        padding: "clamp(40px, 8vw, 96px) var(--gutter)",
        background: "radial-gradient(135% 100% at 50% 4%, var(--bg-1) 0%, var(--bg-0) 62%, var(--bg-2) 100%)",
      }}
    >
      <style>{ST_CSS}</style>

      <div className="gridbg" aria-hidden style={{ opacity: 0.4 }} />
      <div className="vst-bloom" aria-hidden />

      <div className="wrap vst-stack">
        <h1 className="vst-head vst-in vst-d1">
          Vraelis is in <span className="em">stealth</span>.
        </h1>

        <p className="vst-body vst-in vst-d2">
          Not public yet. If you were meant to be here, you already know the way in.
        </p>
      </div>
    </main>
  );
}

const ST_CSS = `
/* Type only, sat a little above true centre. Dead centre reads as content that fell there; a touch high
   reads as composed. */
.vst-stack{
  position:relative; z-index:1;
  display:flex; flex-direction:column; align-items:center;
  max-width:680px; margin:0 auto;
  transform:translateY(-6%);
}

.vst-head{
  font-family:var(--font-display);
  font-size:clamp(1.5rem, 3.4vw, 2.35rem);
  font-weight:600; letter-spacing:-.02em; line-height:1.12;
  color:var(--fg-1);
  margin:0; /* nothing above it now, so no top margin to clear */
}
.vst-body{
  font-size:clamp(1rem, 1.25vw, 1.12rem); line-height:1.55;
  color:var(--fg-2); max-width:440px; margin:13px auto 0; text-wrap:pretty;
}

.vst-bloom{
  position:absolute; z-index:0; pointer-events:none;
  top:44%; left:50%; width:min(880px, 122vw); height:min(880px, 122vw);
  transform:translate(-50%,-50%);
  background:radial-gradient(circle, var(--acc-glow) 0%, var(--acc-soft) 36%, transparent 68%);
  animation:vst-breathe 10s var(--ease-out) infinite;
}

.vst-in{ animation:vst-rise .6s var(--ease-out) both; }
.vst-d1{ animation-delay:120ms; }
.vst-d2{ animation-delay:200ms; }

@keyframes vst-rise{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:none; } }
@keyframes vst-breathe{ 0%,100%{ opacity:.45; transform:translate(-50%,-50%) scale(1); } 50%{ opacity:.8; transform:translate(-50%,-50%) scale(1.07); } }

@media (prefers-reduced-motion: reduce){
  .vst-in, .vst-bloom{ animation:none !important; }
  .vst-in{ opacity:1; transform:none; }
}
`;
