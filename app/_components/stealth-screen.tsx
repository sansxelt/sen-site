"use client";

// The stealth curtain, in the v6 monochrome system: full graphite field, white and neutral grey only.
// No colour, no glow, no grid, no floating card. A top row (wordmark left, "Private access" right) and
// one quiet block of copy. There is deliberately nothing interactive on this page: the real entrances are
// the reviewer link (/yc?k=) and the hidden gesture below, and the page must never advertise either.
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
    <div className="vst-page">
      <style>{ST_CSS}</style>

      <header className="vst-top">
        <span className="vst-mark">Vraelis</span>
        <span className="vst-priv">Private access</span>
      </header>

      <main className="vst-main">
        <div className="vst-stack">
          <p className="vst-eyebrow vst-in vst-d1">Vraelis is in stealth</p>
          <h1 className="vst-head vst-in vst-d2">This environment is not public yet.</h1>
          <p className="vst-body vst-in vst-d3">
            Use the private access link you were given, or sign in with an authorized account.
          </p>
          <p className="vst-quiet vst-in vst-d4">Reviewer and invited access only.</p>
        </div>
      </main>
    </div>
  );
}

const ST_CSS = `
/* Black and white only. Ground #0A0A0B, type #FFFFFF at varying opacity for hierarchy; no third hue,
   no grey tints, no colour anywhere.
   Self-contained: the stealth branch of the root layout loads no site stylesheets. */
.vst-page{
  min-height:100svh;
  display:flex; flex-direction:column;
  background:#0A0A0B; color:#FFFFFF;
  font-family:var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing:antialiased;
}

.vst-top{
  display:flex; align-items:baseline; justify-content:space-between; gap:16px;
  padding:clamp(20px, 3.5vw, 32px) clamp(20px, 5vw, 48px);
}
.vst-mark{
  font-weight:700; font-size:clamp(22px, 2.2vw, 28px); letter-spacing:-0.038em; line-height:1;
  color:#FFFFFF; white-space:nowrap;
}
.vst-priv{
  font-size:12px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase;
  color:#FFFFFF; opacity:0.55; white-space:nowrap;
}

/* One quiet block, sat a little above true centre. Left edge lines up with the wordmark. */
.vst-main{
  flex:1; display:flex; align-items:center;
  padding:clamp(32px, 6vw, 72px) clamp(20px, 5vw, 48px) clamp(64px, 12vh, 140px);
}
.vst-stack{ max-width:620px; }

.vst-eyebrow{
  font-size:11px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase;
  color:#FFFFFF; opacity:0.55; margin:0 0 18px;
}
.vst-head{
  font-weight:600; letter-spacing:-0.026em; line-height:1.08;
  font-size:clamp(1.85rem, 4.4vw, 3.1rem);
  color:#FFFFFF; margin:0; text-wrap:balance;
}
.vst-body{
  font-size:clamp(1rem, 1.25vw, 1.13rem); line-height:1.6;
  color:#FFFFFF; opacity:0.72; max-width:46ch; margin:18px 0 0; text-wrap:pretty;
}
.vst-quiet{
  font-size:13.5px; line-height:1.5; color:#FFFFFF; opacity:0.5;
  margin:28px 0 0; padding-top:20px;
  border-top:1px solid rgba(255,255,255,0.18);
  max-width:46ch;
}

.vst-in{ animation:vst-rise .55s cubic-bezier(.22,.61,.36,1) both; }
.vst-d1{ animation-delay:60ms; }
.vst-d2{ animation-delay:120ms; }
.vst-d3{ animation-delay:190ms; }
.vst-d4{ animation-delay:260ms; }

@keyframes vst-rise{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:none; } }

@media (prefers-reduced-motion: reduce){
  .vst-in{ animation:none !important; opacity:1; transform:none; }
}
`;
