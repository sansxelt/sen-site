"use client";

import { useEffect } from "react";
import Script from "next/script";

declare global {
  interface Window {
    Tally?: { loadEmbeds: () => void };
  }
}

// Embeds the Tally intake form in-page. Zero backend: Tally hosts the form and
// handles submissions; we only render its iframe. The iframe uses data-tally-src,
// and Tally's widget script swaps in the real src and drives dynamicHeight (no
// inner scrollbar). transparentBackground lets the form inherit our theme.
export function TallyEmbed() {
  useEffect(() => {
    // If the widget script is already loaded (e.g. client-side nav), (re)init embeds.
    if (window.Tally) window.Tally.loadEmbeds();
  }, []);

  return (
    <>
      <iframe
        data-tally-src="https://tally.so/embed/pbMQk1?alignLeft=1&transparentBackground=1&dynamicHeight=1"
        loading="lazy"
        width="100%"
        height={500}
        title="Get a free QA report"
        style={{ border: 0, background: "transparent" }}
      />
      <Script
        src="https://tally.so/widgets/embed.js"
        strategy="afterInteractive"
        onLoad={() => window.Tally?.loadEmbeds()}
        onError={() => {
          // If the widget script is blocked, load the form directly so it still
          // works (without dynamic height). Better a scrollable form than a blank box.
          document.querySelectorAll<HTMLIFrameElement>("iframe[data-tally-src]").forEach((f) => {
            if (!f.getAttribute("src")) f.setAttribute("src", f.getAttribute("data-tally-src") || "");
          });
        }}
      />
    </>
  );
}
