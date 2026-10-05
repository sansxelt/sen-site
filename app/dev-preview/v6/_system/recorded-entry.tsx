import Link from "next/link";
import "./recorded-entry.css";

/** A real local workflow, distinct from the browser demo and future live-device adapters. */
export function RecordedEntry() {
  return (
    <section className="v6-sec v6-dark recorded-entry" data-nav-dark data-nav-theme="dark" aria-labelledby="recorded-entry-title">
      <div className="v6-wrap recorded-entry__inner">
        <div>
          <p className="recorded-entry__label">Recorded evidence beta</p>
          <h2 id="recorded-entry-title">The panel says done.<br />Does the task report agree?</h2>
          <p>Compare request, service and device reports for the same task. Find conflicting states, missing evidence and changes to another asset.</p>
          <Link href="/verifications/recorded" prefetch={false}>Open recorded evidence <span aria-hidden>→</span></Link>
        </div>
        <div className="recorded-entry__steps">
          <div><span>01</span><div><h3>Bring a recording</h3><p>Import JSON or supported MCAP task reports. Files stay in your browser.</p></div></div>
          <div><span>02</span><div><h3>Define what must agree</h3><p>Review the task, asset, time window and capture coverage.</p></div></div>
          <div><span>03</span><div><h3>Inspect the result</h3><p>Read source events, compare recordings and export the evidence.</p></div></div>
          <p className="recorded-entry__boundary">Reported states, not physical ground truth. Live device connections are not built.</p>
        </div>
      </div>
    </section>
  );
}
