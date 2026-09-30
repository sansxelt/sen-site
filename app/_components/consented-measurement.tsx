"use client";

import { useEffect, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { analyticsAllowed, onPrivacyChoiceChange } from "@/lib/privacy-choice";

// VERCEL SPEED INSIGHTS, ONLY WITH CONSENT.
//
// Speed Insights reports field LCP, CLS and INP from the hardware people actually hold, which an emulated
// phone cannot. Vercel documents it as cookieless and not tied to a visitor or an IP address, but it is still
// a script that reads measurements from the visitor's browser and sends them to a third party, so it sits in
// the Analytics category of the privacy choices and does not load until that is on.
//
// Two gates, because a script cannot be unloaded. Not rendering the component keeps the script from ever
// being injected before consent. beforeSend is asked at every send, so if Analytics is turned off after the
// script has loaded, nothing further leaves the page even though the script is still in it.
export function ConsentedMeasurement() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const sync = () => setAllowed(analyticsAllowed());
    sync();
    return onPrivacyChoiceChange(sync);
  }, []);
  if (!allowed) return null;
  return <SpeedInsights beforeSend={(event) => (analyticsAllowed() ? event : null)} />;
}
