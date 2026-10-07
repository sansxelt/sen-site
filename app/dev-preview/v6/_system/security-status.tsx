import { SECURITY_STATUS } from "../_content/security-direction";
import { SectionHead } from "./ui";
import "./security-status.css";

export function SecurityStatus() {
  return <div className="security-status">
    <SectionHead eyebrow="Development status" title="The work behind the direction." lead="The product is in private development. App access and live security enforcement are not available." />
    <dl className="security-status__list">
      {SECURITY_STATUS.map(row => <div key={row.title}>
        <dt><span>{row.status}</span><strong>{row.title}</strong></dt>
        <dd>{row.body}</dd>
      </div>)}
    </dl>
  </div>;
}
