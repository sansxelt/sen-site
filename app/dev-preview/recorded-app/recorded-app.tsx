"use client";
import { useState } from "react";
import { RecordedAppShell } from "@/app/rank/_components/rank-ui";
import { Page, PageHeader } from "@/app/rank/_components/page-header";
import { STRIKE } from "../v6/_content/strike";
import "./recorded-app.css";
const tabs = ["Plan", "Activity", "Finding", "Repair prompt"] as const;
export function RecordedApp() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Plan");
  const [copied, setCopied] = useState(false);
  const run = STRIKE.run!;
  return <div className="recorded-app">
    <div className="recorded-browser" aria-label="Illustrative browser address"><span>‹</span><span>›</span><span>↻</span><div>app.vraelis.com</div><span className="recorded-label">Recorded demo</span></div>
    <RecordedAppShell><Page>
      <PageHeader eyebrow="Verifications" title="Larkspur" lead="Simulated mission console" />
      <div className="recorded-meta"><span>Recorded {run.recorded}</span><span>{run.seconds} seconds</span><span>Found a problem</span></div>
      <div className="recorded-tabs" role="tablist" aria-label="Verification record">{tabs.map(t => <button key={t} id={`record-${t.toLowerCase().replace(/ /g,"-")}`} role="tab" aria-selected={tab===t} onClick={() => setTab(t)}>{t}</button>)}</div>
      <div className="recorded-content" role="tabpanel" aria-label={tab}>
        {tab === "Plan" && <><section className="recorded-claim"><h2>What should be true</h2><p>{STRIKE.claim}</p><div className="recorded-approval">Approved 2 October 2026. Recorded plan.</div></section><section className="recorded-plan"><h2>Requirements</h2><ol>{STRIKE.plan.requirements.slice(0,5).map(q => <li key={q}>{q}</li>)}</ol></section></>}
        {tab === "Activity" && <div className="recorded-activity"><section><h2>Confirm T-1 and check the other contacts</h2><ol className="recorded-steps">{run.journeys[0].steps.map((s,i) => <li key={s.say}><span>{i+1}</span><p>{s.say}</p></li>)}</ol></section><div className="recorded-live"><div className="recorded-live-title">Browser reenactment <span>Simulation</span></div><iframe id="recorded-fixture" src="/api/fixtures/strike?mode=broken&capture=1" title="Simulated browser journey" /></div></div>}
        {tab === "Finding" && <><section className="recorded-claim"><h2>Two contacts cleared after one confirmation</h2><p>The civilian bus was cleared alongside T-1.</p></section><div className="recorded-finding"><section><h2>Expected</h2><p>T-3, Bus, civilian</p><strong>Do not engage</strong></section><section><h2>Observed</h2><p>T-3, Bus, civilian</p><strong>{run.failure!.shown}</strong></section></div><p className="recorded-note">Step 8 stopped when the expected civilian status was not visible. The original record keeps the screenshot and the preceding browser steps.</p></>}
        {tab === "Repair prompt" && <section className="recorded-prompt"><div><h2>Repair prompt</h2><button id="copy-repair" className="btn btn--ghost" onClick={async()=>{await navigator.clipboard.writeText(run.repairPrompt);setCopied(true)}}>{copied ? "Copied" : "Copy prompt"}</button></div><pre>{run.repairPrompt}</pre></section>}
      </div>
    </Page></RecordedAppShell>
  </div>;
}
