"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { V6_BASE, V6_PRIVACY } from "@/lib/v6-routes";
import {
  ESSENTIAL_ONLY, OPTIONAL_CATEGORIES, PRIVACY_CHANGE_EVENT, PRIVACY_OPEN_EVENT,
  browserSendsGpc, clearDeclinedStorage, effectivePrivacyChoice, isLegalPath, readPrivacyChoice,
  savePrivacyChoice, serializePrivacyChoice,
  type OptionalCategory, type PrivacyChoice,
} from "@/lib/privacy-choice";
import "./privacy-choices.css";

/* THE PRIVACY CHOICES, ON EVERY SURFACE.
 *
 * Mounted once, in the root layout's real branch (never on the stealth curtain, which renders nothing of the
 * product), so the marketing site, the docs, sign-in and /auth, and the console on app.vraelis.com all ask
 * the same question through the same code.
 *
 * TWO SHAPES, DECIDED BY WHERE THE PERSON IS.
 *   Anywhere except the legal pages, with no saved choice: a modal dialog that has to be answered. Escape
 *   and a click on the backdrop do nothing, and there is no close button until a choice exists.
 *   On the legal pages (lib/privacy-choice.ts LEGAL_PATHS): a bar at the foot of the page with the same
 *   switches and the same two buttons. Reading a policy never requires agreeing to anything first. The
 *   moment they move to any other page without having chosen, the dialog appears.
 *
 * THE TWO BUTTONS ARE THE SAME BUTTON. "Essential only" and "Save my choices" share one class: same size,
 * same ink, same position in the row. Refusing has to be exactly as easy as accepting, and every optional
 * switch starts off, so "Save my choices" without touching anything is also essential only.
 *
 * WHAT THE COPY SAYS IS WHAT THE CODE DOES. Each category description names the actual mechanism: Speed
 * Insights and the visit count are gated in app/_components/consented-measurement.tsx and the site shell,
 * the Meta sign-up report in lib/analytics.ts. If one of those changes, this copy and the cookie policy
 * (app/_content/legal.tsx) change with it. */

const COOKIES_PAGE = `${V6_BASE}/cookies`;

const CATEGORY: Record<OptionalCategory, { title: string; short: string; body: string }> = {
  preferences: {
    title: "Preferences",
    short: "Preferences",
    body: "Remembers display choices on this browser, such as the language you pick and whether the console notes panel is open. Off means they reset when you reload.",
  },
  analytics: {
    title: "Analytics",
    short: "Analytics",
    body: "Vercel Speed Insights measures how fast pages load and respond, and Vraelis counts one anonymous visit per browser tab with the page you landed on. Neither sets a cookie or records who you are.",
  },
  advertising: {
    title: "Advertising measurement",
    short: "Advertising",
    body: "If you create an account, Vraelis tells Meta that a sign-up happened and includes a hashed copy of your email address, so Meta can match it to an ad you saw. No advertising cookies or pixels are placed on this site.",
  },
};

const ESSENTIAL_BODY =
  "Keeps you signed in, protects sign-in and payments against forgery and fraud, and remembers this choice.";

export function PrivacyChoices() {
  const pathname = usePathname() || "";
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<PrivacyChoice | null>(null);
  const [draft, setDraft] = useState<PrivacyChoice>(ESSENTIAL_ONLY);
  const [gpc, setGpc] = useState(false);
  const [legal, setLegal] = useState(false);
  const [status, setStatus] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const bar = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  // True while the open dialog is the one the page forced (no choice, not a legal page), as opposed to one
  // the person opened themselves.
  const forced = useRef(false);
  const uid = useId();
  const ids = { title: `${uid}t`, lead: `${uid}l`, barTitle: `${uid}b` };

  // Must the person answer before they can use this page? Read live, never from state, because the dialog's
  // own close handler runs between renders.
  const mustAnswer = useCallback(() => readPrivacyChoice() === null && !isLegalPath(window.location.pathname), []);

  const sync = useCallback(() => {
    const s = readPrivacyChoice();
    const g = browserSendsGpc();
    setSaved(s);
    setGpc(g);
    // A choice made in another tab, or on the other host (the cookie spans vraelis.com and app.vraelis.com),
    // applies here as well, including removing what a category that is now off had stored.
    clearDeclinedStorage(effectivePrivacyChoice(s, g));
  }, []);

  const openDialog = useCallback((isForced: boolean) => {
    const d = dialog.current;
    if (!d) return;
    if (d.open) { if (!isForced) forced.current = false; return; }
    forced.current = isForced;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Reopening shows what is saved. With no choice yet the switches keep whatever was set in the bar.
    const s = readPrivacyChoice();
    if (s) setDraft(effectivePrivacyChoice(s, browserSendsGpc()));
    try { d.showModal(); } catch { return; }
    requestAnimationFrame(() => d.querySelector<HTMLElement>(".vr-pc__title")?.focus());
  }, []);

  // Client only: the choice lives in the browser (and GPC is only visible there), so nothing renders on the
  // server and there is nothing to mismatch on hydration.
  useEffect(() => {
    setReady(true);
    sync();
    const onOpen = () => openDialog(false);
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener(PRIVACY_OPEN_EVENT, onOpen);
    window.addEventListener(PRIVACY_CHANGE_EVENT, sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(PRIVACY_OPEN_EVENT, onOpen);
      window.removeEventListener(PRIVACY_CHANGE_EVENT, sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sync, openDialog]);

  // Every navigation: a legal page gets the bar, anything else gets the dialog until a choice exists.
  useEffect(() => {
    if (!ready) return;
    const onLegal = isLegalPath(window.location.pathname);
    setLegal(onLegal);
    const d = dialog.current;
    if (!d || saved !== null) return;
    if (!onLegal) openDialog(true);
    else if (d.open && forced.current) { forced.current = false; d.close(); }
  }, [ready, saved, pathname, openDialog]);

  const showBar = ready && saved === null && legal;

  // The bar sits over the foot of the page, so the page gets that much room at its end: the footer and the
  // last paragraph of the policy stay readable above it.
  useEffect(() => {
    const el = bar.current;
    const root = document.documentElement;
    if (!showBar || !el) { root.style.removeProperty("--vr-pc-bar-h"); return; }
    const put = () => root.style.setProperty("--vr-pc-bar-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    put();
    const ro = new ResizeObserver(put);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty("--vr-pc-bar-h"); };
  }, [showBar]);

  function save(choice: PrivacyChoice) {
    // Under GPC the switches are off and disabled, so what was on screen is essential only.
    const persisted = savePrivacyChoice(gpc ? ESSENTIAL_ONLY : choice);
    forced.current = false;
    sync();
    const kept = readPrivacyChoice();
    if (kept) setDraft(effectivePrivacyChoice(kept, browserSendsGpc()));
    setStatus(persisted
      ? "Your privacy choices are saved."
      : "Your browser did not keep this choice, so optional storage stays off and you may be asked again.");
    if (dialog.current?.open) dialog.current.close();
  }

  const toggle = (c: OptionalCategory, on: boolean) => setDraft((d) => ({ ...d, [c]: on }));

  if (!ready) return null;
  const answered = saved !== null;
  const closable = answered || legal;

  return (
    <div className="vr-pc" data-choice={saved ? serializePrivacyChoice(saved) : "none"}>
      {showBar && (
        <section ref={bar} className="vr-pc__bar" aria-labelledby={ids.barTitle}>
          <div className="vr-pc__bar-in">
            <div className="vr-pc__bar-text">
              <h2 id={ids.barTitle} className="vr-pc__bar-title">Choose what Vraelis may store</h2>
              <p className="vr-pc__bar-p">
                Read this page freely. Before you go anywhere else on Vraelis, choose which optional categories to
                allow. Essential storage is always on.{" "}
                <button type="button" className="vr-pc__more" onClick={() => openDialog(false)} aria-haspopup="dialog">What each one does</button>
              </p>
              {gpc && <p className="vr-pc__gpc vr-pc__gpc--bar">Your browser sends Global Privacy Control, so optional categories stay off.</p>}
            </div>
            <div className="vr-pc__chips" role="group" aria-label="Optional categories">
              {OPTIONAL_CATEGORIES.map((c) => (
                <label key={c} className="vr-pc__chip">
                  <input type="checkbox" role="switch" className="vr-pc__switch" checked={!gpc && draft[c]} disabled={gpc}
                    onChange={(e) => toggle(c, e.target.checked)} />
                  <span>{CATEGORY[c].short}</span>
                </label>
              ))}
            </div>
            <div className="vr-pc__actions vr-pc__actions--bar">
              <button type="button" className="vr-pc__btn" onClick={() => save(ESSENTIAL_ONLY)}>Essential only</button>
              <button type="button" className="vr-pc__btn" onClick={() => save(draft)}>Save my choices</button>
            </div>
          </div>
        </section>
      )}

      <dialog
        ref={dialog}
        className="vr-pc__dialog"
        aria-labelledby={ids.title}
        aria-describedby={ids.lead}
        // Escape: refused while an answer is required.
        onCancel={(e) => { if (mustAnswer()) e.preventDefault(); }}
        // Chrome lets a second Escape close a dialog even when the first cancel was refused (its close
        // watcher protects against dialogs that trap people). Required means required, so if it closed
        // without a choice on a page that needs one, it opens again on the next frame.
        onClose={() => {
          if (mustAnswer()) { requestAnimationFrame(() => openDialog(true)); return; }
          forced.current = false;
          if (opener.current && document.contains(opener.current)) opener.current.focus();
        }}
        // The backdrop is the dialog element itself outside its box. Clicking it closes only an optional dialog.
        onClick={(e) => {
          if (e.target !== e.currentTarget || mustAnswer()) return;
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.currentTarget.close();
        }}
      >
        <div className="vr-pc__top">
          <span className="vr-pc__brand">Vraelis</span>
          {closable && (
            <button type="button" className="vr-pc__x" aria-label="Close privacy choices" onClick={() => dialog.current?.close()}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
            </button>
          )}
        </div>
        <div className="vr-pc__scroll">
          <h2 id={ids.title} className="vr-pc__title" tabIndex={-1}>{answered ? "Privacy choices" : "Choose what Vraelis may store"}</h2>
          <p id={ids.lead} className="vr-pc__lead">
            {answered
              ? "Change what this browser may store or share. Your choice applies across vraelis.com and app.vraelis.com and lasts six months."
              : "Essential storage keeps Vraelis working and is always on. Everything else is off unless you turn it on. You can change this at any time from Privacy choices."}
          </p>
          {gpc && (
            <p className="vr-pc__gpc">
              Your browser sends Global Privacy Control. Vraelis treats it as an opt out, so every optional category
              stays off while the signal is on.
            </p>
          )}
          <div className="vr-pc__cats">
            <section className="vr-pc__cat">
              <div className="vr-pc__row"><h3 className="vr-pc__h">Essential</h3><span className="vr-pc__always">Always on</span></div>
              <p className="vr-pc__p">{ESSENTIAL_BODY}</p>
            </section>
            {OPTIONAL_CATEGORIES.map((c) => (
              <section key={c} className="vr-pc__cat">
                <div className="vr-pc__row">
                  <label className="vr-pc__h" htmlFor={`${uid}${c}`}>{CATEGORY[c].title}</label>
                  <input id={`${uid}${c}`} type="checkbox" role="switch" className="vr-pc__switch"
                    checked={!gpc && draft[c]} disabled={gpc} aria-describedby={`${uid}${c}d`}
                    onChange={(e) => toggle(c, e.target.checked)} />
                </div>
                <p id={`${uid}${c}d`} className="vr-pc__p">{CATEGORY[c].body}</p>
              </section>
            ))}
          </div>
          {/* Plain anchors, not <Link>: on app.vraelis.com these paths redirect to the site, and a client-side
              navigation across that redirect is a cross-origin fetch that fails. */}
          <p className="vr-pc__links">
            <a href={V6_PRIVACY}>Read the privacy policy</a>
            <a href={COOKIES_PAGE}>Read the cookie policy</a>
          </p>
        </div>
        <div className="vr-pc__actions">
          <button type="button" className="vr-pc__btn" onClick={() => save(ESSENTIAL_ONLY)}>Essential only</button>
          <button type="button" className="vr-pc__btn" onClick={() => save(draft)}>Save my choices</button>
        </div>
      </dialog>
      <p className="vr-pc__sr" role="status" aria-live="polite">{status}</p>
    </div>
  );
}
