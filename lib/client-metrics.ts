// Client-side metric emitter. Posts to /api/metrics, which auths
// against the session and forwards to the server-side recordMetric
// (structured Vercel log). Falls back to navigator.sendBeacon when
// the page is unloading so events fire reliably even on nav-away.
//
// Always fire-and-forget. A network error here MUST NOT bubble up
// to the user — wrap every call in try/catch.

import type { MetricKind } from "./metrics";

type ClientPrimitive = string | number | boolean | null | undefined;
export type ClientMetricProps = Record<string, ClientPrimitive>;

const ENDPOINT = "/api/metrics";

export function trackClientEvent(
  kind: MetricKind,
  props?: ClientMetricProps,
): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ kind, props, surface: "web" });
  try {
    // Beacon is fire-and-forget at the browser level, ideal for
    // events that may fire during page unload (upgrade_clicked
    // right before nav-away to /account/plan).
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(ENDPOINT, blob);
      if (sent) return;
    }
  } catch {
    // Fall through to fetch.
  }
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never throw
  }
}
