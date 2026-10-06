import Link from "next/link";
import { getSignInPath } from "@/lib/auth-ui";
import { RecordedExample } from "./recorded-example";
import { V6_BASE } from "@/lib/v6-routes";
import "./recorded-entry.css";

/** A real local workflow, distinct from the browser demo and future live-device adapters. */
export function RecordedEntry({ homepage = false }: { homepage?: boolean }) {
  return (
    <section id="recorded-evidence" className={`v6-sec v6-dark recorded-entry${homepage ? " recorded-entry--home" : ""}`} data-nav-dark data-nav-theme="dark" aria-labelledby="recorded-entry-title">
      <div className="v6-wrap recorded-entry__inner">
        <div>
          <p className="recorded-entry__label">{homepage ? "Inside Vraelis" : "Start with recorded evidence"}</p>
          <h2 id="recorded-entry-title">{homepage ? <>The panel says done.<br />The reports tell another story.</> : <>Follow one task across the reports.</>}</h2>
          <p>{homepage ? "Follow one task across control-panel, service and device reports. Vraelis finds conflicting states, missing evidence and changes to the wrong asset." : "Import supported JSON or MCAP task reports. Compare control-panel, service and device states for the same task, and inspect the source events behind each finding."}</p>
          <Link href={getSignInPath("/verifications/recorded")} prefetch={false}>{homepage ? "Try a recording" : "Open recorded evidence"} <span aria-hidden>→</span></Link>
          <Link className="recorded-entry__docs" href={`${V6_BASE}/docs/recorded-reports`}>Recording formats and setup docs <span aria-hidden>→</span></Link>
        </div>
        <RecordedExample />
      </div>
      <div className="v6-wrap"><p className="recorded-entry__boundary">{homepage ? "Local recording beta. Supported JSON and MCAP reports stay in your browser. Reports describe recorded state, not physical ground truth. Live device connections are not available." : "Files stay in your browser. A device report does not prove what physically happened. Live device connections are not available."}</p></div>
    </section>
  );
}
