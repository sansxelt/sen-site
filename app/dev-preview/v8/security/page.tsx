import { Head, Section, TextLink, Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { COMPANY_LINE, href } from "../_kit/site";
import "./security.css";

export const metadata = v8meta({
  title: "Security",
  description: "Vraelis security information, current development limits and how to report a security issue.",
  path: "/security",
});

// /security, the disclosure page. Current scope is the published Contour reference experiment.
// #status, #data-handling and #report keep
// their ids: other pages link to /security#report, and so does the Policy field of /.well-known/security.txt.
// Addresses are each the only text of their own element (Cloudflare's email obfuscation on vraelis.com splits an
// address out of a shared text node, and React then fails to hydrate it).

type Topic = { label: string; title: string; body: string };

const STATUS_TOPICS: Topic[] = [
  { label: "Product", title: "Controls are being developed privately", body: "The published Vraelis Contour reference is a controlled synthetic ONNX CPU experiment with signed release and approval bindings, runtime policy enforcement and recorded observations, plus a read-only evidence app. Runtime reports are trusted worker self-reports. It does not establish a customer deployment, live Kubernetes integration or hardware attestation." },
  { label: "Assurance", title: "Evaluate the system and its limits", body: "Research topics, design intentions and local tests are not certifications. Any future deployment must be evaluated against its actual interfaces, threat model and operating environment." },
  { label: "Access", title: "Public account access is closed", body: "The site does not offer a self-service product account, production API or operational deployment. A contact submission does not grant access." },
];

const DATA_TOPICS: Topic[] = [
  { label: "Inquiries", title: "Start with a description", body: "Describe the system and security problem at a level you are authorized to share. Do not attach a live secret or operational dataset to explain the issue." },
  { label: "Privacy", title: "Use the privacy channel", body: "Privacy and data-rights requests have a separate contact path. They do not require organization details or a commercial acknowledgement." },
];

const RULES = [
  "Test only systems you own or are authorized to test, and stop as soon as you can show the problem.",
  "Do not open, change or keep anyone else's data. If you reach some by accident, tell us and delete it.",
  "Give us a reasonable chance to fix it before you publish anything.",
];

// The fields of public/.well-known/security.txt (RFC 9116), as published. Change both together.
const SECURITY_TXT = {
  contact: "help@vraelis.com",
  expires: { iso: "2027-09-30T00:00:00.000Z", text: "30 September 2027" },
  languages: "en",
  canonical: "https://vraelis.com/.well-known/security.txt",
  policy: "https://vraelis.com/security#report",
};

function Topics({ items }: { items: Topic[] }) {
  return (
    <ul className="v8-sec__rows" role="list">
      {items.map((t) => (
        <li key={t.label}>
          <span className="v8-sec__label">{t.label}</span>
          <div>
            <h3 className="v8-h3">{t.title}</h3>
            <p>{t.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function V8SecurityPage() {
  return (
    <div className="v8-sec">
      <section className="v8-page-hero">
        <Wrap>
          <div className="v8-head v8-center v8-sec__hero">
            <span className="v8-eyebrow">Security</span>
            <h1 className="v8-h1">Security and responsible disclosure.</h1>
            <p className="v8-lead">{COMPANY_LINE} This page sets out where development stands, what to share with us, and how to report a security issue.</p>
            <p className="v8-body">The public site provides information and a way to contact us. Vraelis Contour and its evidence app are in private development.</p>
            <div className="v8-actions" style={{ marginTop: 10 }}>
              <a className="v8-btn v8-btn--solid v8-btn--lg" href="#report">Report a security issue<span className="v8-arrow" aria-hidden="true" /></a>
              <a className="v8-btn v8-btn--soft v8-btn--lg" href="/.well-known/security.txt">security.txt</a>
            </div>
          </div>
        </Wrap>
      </section>

      <Section id="status" rule>
        <Wrap>
          <div className="v8-sec__split">
            <Head eyebrow="Current status" title="Development is not an operational deployment."
              lead="Earlier browser-checking features and implementation references do not establish a deployed AI-security service. There is no publicly available enforcement gateway or certified physical-system protection." />
            <div>
              <Topics items={STATUS_TOPICS} />
              <p className="v8-body">The experiment records comparisons between approved releases and trusted worker reports. Its evidence app checks imported records for internal consistency, not authenticity. Earlier browser-testing documentation describes a retired product and does not establish current Contour capabilities.</p>
              <div className="v8-sec__links">
                <TextLink to="/contour/status">Development status</TextLink>
                <TextLink to="/contour/status#limits">Read the limitations</TextLink>
              </div>
            </div>
          </div>
        </Wrap>
      </Section>

      <Section id="data-handling" rule>
        <Wrap>
          <div className="v8-sec__split">
            <Head eyebrow="Data handling" title="Share only what belongs in an inquiry."
              lead="Please keep credentials, classified material, restricted technical data and sensitive operational information out of public contact forms." />
            <div>
              <Topics items={DATA_TOPICS} />
              <div className="v8-sec__links">
                <TextLink to="/privacy">Privacy policy</TextLink>
                <TextLink to="/subprocessors">Subprocessors</TextLink>
                <TextLink to="/contact?topic=privacy">Privacy or data-rights request</TextLink>
              </div>
            </div>
          </div>
        </Wrap>
      </Section>

      <Section id="report" rule>
        <Wrap>
          <div className="v8-sec__report">
            <div className="v8-head">
              <span className="v8-eyebrow">Report a security issue</span>
              <h2 className="v8-h2">Tell us, and a person reads it</h2>
              <p className="v8-lead">Email <a className="v8-under" href="mailto:help@vraelis.com?subject=Security%20report">help@vraelis.com</a> with Security report in the subject. Say what you found, the address where it happens, and how to reproduce it.</p>
              <ul className="v8-sec__rules" role="list">
                {RULES.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <div className="v8-actions" style={{ marginTop: 12 }}>
                <a className="v8-btn v8-btn--solid v8-btn--lg" href="mailto:help@vraelis.com?subject=Security%20report"><span>Email <span>help@vraelis.com</span></span></a>
                <a className="v8-btn v8-btn--ghost v8-btn--lg v8-sec__path" href="/.well-known/security.txt" data-no-translate>/.well-known/security.txt</a>
              </div>
            </div>
            <div className="v8-sec__txt" data-no-translate>
              <p className="v8-sec__txthead"><span className="v8-mono">security.txt</span><span>RFC 9116</span></p>
              <dl>
                <div><dt>Contact</dt><dd><a className="v8-under" href={`mailto:${SECURITY_TXT.contact}`}>{SECURITY_TXT.contact}</a></dd></div>
                <div><dt>Policy</dt><dd><a className="v8-under" href={href("/security#report")}>{SECURITY_TXT.policy}</a></dd></div>
                <div><dt>Preferred-Languages</dt><dd>{SECURITY_TXT.languages}</dd></div>
                <div><dt>Expires</dt><dd><time dateTime={SECURITY_TXT.expires.iso}>{SECURITY_TXT.expires.text}</time></dd></div>
                <div><dt>Canonical</dt><dd><a className="v8-under" href="/.well-known/security.txt">{SECURITY_TXT.canonical}</a></dd></div>
              </dl>
            </div>
          </div>
        </Wrap>
      </Section>
    </div>
  );
}
