"use client";

import Script from "next/script";

// Client-side analytics base: Meta Pixel + GA4 gtag. Both are ENV-GATED — if the
// public IDs aren't set, nothing renders and no third-party script loads. This
// keeps the site clean (and consent-simple) until you actually add the IDs in
// Vercel. The high-value conversions ALSO fire server-side (lib/analytics.ts) so
// ad-blockers can't drop them; this layer covers pageviews + browser-only events
// (e.g. "copy link").

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

export function AnalyticsScripts() {
  if (!PIXEL_ID && !GA4_ID) return null;
  return (
    <>
      {GA4_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4_ID}');`}
          </Script>
        </>
      )}
      {PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}

// Fire a browser-observable event to whatever is loaded (Pixel + GA4). Safe to
// call even when nothing is configured — it just no-ops.
export function trackClient(event: string, params?: Record<string, unknown>): void {
  try {
    const w = window as unknown as {
      fbq?: (...a: unknown[]) => void;
      gtag?: (...a: unknown[]) => void;
    };
    w.fbq?.("trackCustom", event, params);
    w.gtag?.("event", event, params);
  } catch {
    /* analytics must never throw */
  }
}
