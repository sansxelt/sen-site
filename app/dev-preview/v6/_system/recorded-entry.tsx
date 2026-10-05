import Link from "next/link";
import { RecordedExample } from "./recorded-example";
import { V6_BASE } from "@/lib/v6-routes";
import "./recorded-entry.css";

/** A real local workflow, distinct from the browser demo and future live-device adapters. */
export function RecordedEntry() {
  return (
    <section id="recorded-evidence" className="v6-sec v6-dark recorded-entry" data-nav-dark data-nav-theme="dark" aria-labelledby="recorded-entry-title">
      <div className="v6-wrap recorded-entry__inner">
        <div>
          <p className="recorded-entry__label">Recorded evidence beta</p>
          <h2 id="recorded-entry-title">The panel says done.<br />Does the task report agree?</h2>
          <p>Compare control-panel, service and device reports for the same task. Find conflicting states, missing evidence and changes to another asset.</p>
          <p>Bring supported JSON or MCAP task reports, review what should happen, and inspect the source events. Files stay in your browser.</p>
          <Link href="/verifications/recorded" prefetch={false}>Open recorded evidence <span aria-hidden>→</span></Link>
          <Link className="recorded-entry__docs" href={`${V6_BASE}/docs/recorded-reports`}>Supported formats and setup <span aria-hidden>→</span></Link>
        </div>
        <RecordedExample />
      </div>
      <div className="v6-wrap"><p className="recorded-entry__boundary">A device report does not prove what physically happened. Live device connections are not available.</p></div>
    </section>
  );
}
