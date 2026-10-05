import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { Page } from "@/app/rank/_components/page-header";
import "./start.css";

export const metadata: Metadata = { title: "Start verification", robots: { index: false, follow: false } };
const font = localFont({ src: "../../../fonts/manrope/Manrope-Variable.ttf", display: "swap", weight: "200 800" });

export default function StartVerification() {
  return <Page measure="wide"><div className={`${font.className} verification-start`}>
    <p className="verification-start__eyebrow">Verification workspace</p>
    <h1>What evidence do you have?</h1>
    <p className="verification-start__lead">Start with a recording or a live control panel.</p>
    <div className="verification-start__choices">
      <article>
        <p className="verification-start__eyebrow">Local beta</p>
        <h2>Recorded task evidence</h2>
        <p>Check whether request, service, device and panel reports agree on the same task.</p>
        <ul><li>JSON or supported MCAP JSON topics</li><li>Reviewed criteria and source-event citations</li><li>Compare recordings and export evidence</li></ul>
        <Link href="/verifications/recorded" className="verification-start__primary">Open recorded evidence <span aria-hidden>→</span></Link>
        <small>No account required. Files stay in your browser.</small>
      </article>
      <article>
        <p className="verification-start__eyebrow">Cloud workflow</p>
        <h2>Live control panel</h2>
        <p>State what a deployed web app should do. Approve a plan before a real browser exercises it.</p>
        <ul><li>A reachable staging or simulation URL</li><li>Steps, screenshots and observed behavior</li><li>Saved run history and repair prompts</li></ul>
        <Link href="/app?new=1" className="verification-start__secondary">Set up browser verification <span aria-hidden>→</span></Link>
        <small>Sign in required. Browser actions run on your approved target.</small>
      </article>
    </div>
    <aside><h2>Connecting directly to hardware?</h2><p>Live device adapters and combined browser, API and telemetry execution are not built yet. Imported reports do not prove physical safety or the authenticity of a recording.</p><Link href="/integrations">View available integrations <span aria-hidden>→</span></Link></aside>
  </div></Page>;
}
