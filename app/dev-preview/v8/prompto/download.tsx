"use client";

import { useSyncExternalStore } from "react";
import { PROMPTO, promptoDownloadUrl } from "../_kit/site";

// Cursor-style download (founder, 2026-10-24: "not git, regular downloading"). The button names the visitor's system
// once the page has hydrated; before that (and without JavaScript) it reads "Download" and goes to the full list.
type Os = "windows" | "mac" | "linux" | null;
const noSubscribe = () => () => {};
function detect(): Os {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua)) return "mac";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return null;
}

export function DownloadButton() {
  const os = useSyncExternalStore(noSubscribe, detect, () => null);
  // Most Macs sold since 2020 are Apple silicon; Intel is listed below.
  const pick = os ? PROMPTO.downloads.find((d) => d.os === os) : undefined;
  const cls = "v8-btn v8-btn--solid v8-btn--lg";
  if (!pick) return <a className={cls} href="#download">Download<span className="v8-arrow" aria-hidden="true" /></a>;
  return (
    <a className={cls} href={promptoDownloadUrl(pick.file)}>
      Download for {pick.label}<span className="v8-arrow" aria-hidden="true" />
    </a>
  );
}
