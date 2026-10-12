"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CONTACT_AUDIENCES, COUNTRIES, HEARD_OPTIONS, INTAKE_ERRORS, contactAudience, isRestrictedCountry, validateContactIntake, type ContactAudience, type IntakeField } from "@/lib/contact-intake";

// THE V8 CONTACT FORM. A restyled copy of app/dev-preview/v6/contact/contact-form.tsx with the same behaviour:
// the same fields, client validation, POST body to /api/contact, rate-limit and failure messages, and in-place sent
// state, so the API route works unchanged. What changed: topic labels follow the 2026-10-10 direction (the keys, and
// so the routed inboxes, do not), the ?topic= presets (see PRESETS), and the Vraelis Contour requirements context.
// 2026-10-12 (founder, after scale.com's form): every inquiry but a privacy request asks for the company, the country
// (a fixed list) and how the sender heard about Vraelis; China, Hong Kong and Macao are refused here and on the server.

const TOPICS = [
  { key: "sales", label: "Vraelis Contour and AI security", to: "sales@vraelis.com" },
  { key: "defense", label: "Defense and national security", to: "sales@vraelis.com" },
  { key: "public-sector", label: "Critical infrastructure", to: "sales@vraelis.com" },
  { key: "fleets", label: "Autonomous systems", to: "sales@vraelis.com" },
  { key: "enterprise", label: "Suppliers and system integrators", to: "sales@vraelis.com" },
  { key: "partnerships", label: "Technical collaboration", to: "sales@vraelis.com" },
  { key: "support", label: "General inquiry", to: "help@vraelis.com" },
  { key: "privacy", label: "Privacy", to: "privacy@vraelis.com" },
] as const;
type TopicKey = typeof TOPICS[number]["key"];

/** ?topic= presets. contour (and the live site's older ai-security) opens the Contour requirements context. */
const PRESETS: Record<string, { audience?: ContactAudience; topic?: TopicKey; contour?: boolean }> = {
  contour: { topic: "sales", contour: true },
  "ai-security": { topic: "sales", contour: true },
  beta: { topic: "sales" },
  research: { audience: "research", topic: "partnerships" },
  government: { audience: "government", topic: "support" },
  privacy: { audience: "privacy" },
  infrastructure: { topic: "public-sector" },
  "critical-infrastructure": { topic: "public-sector" },
  robotics: { topic: "fleets" },
  "autonomous-systems": { topic: "fleets" },
  integrators: { topic: "enterprise" },
};

const MSG = {
  topic: "Choose a topic.", email: "Enter a valid email address.", message: "Write a message of at least 10 characters.",
  send: "Send inquiry", sending: "Sending", sent: "Sent. A person at Vraelis reads every message.",
  bad: "Check the fields above and try again.",
  limited: "Too many messages from this network. Try again in ten minutes or write to help@vraelis.com.",
  failed: "The message did not send. Try again, or write to help@vraelis.com.",
} as const;
const CONTOUR_LABEL = "Your release path and requirements";
const CONTOUR_PLACEHOLDER = "Describe the models you release, the systems that run them, how a release is approved today, and which evidence you would need.";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type Field = IntakeField | "topic" | "email" | "message";
type Errors = Partial<Record<Field, string>>;

export function ContactForm({ topicParam, privacyHref }: { topicParam?: string; privacyHref: string }) {
  const id = useId();
  const preset = PRESETS[topicParam ?? ""];
  const [audience, setAudience] = useState<ContactAudience | "">(preset?.audience ?? "");
  const [topic, setTopic] = useState<TopicKey | "">(() => {
    const key = preset?.topic ?? topicParam;
    return TOPICS.find((t) => t.key === key)?.key ?? "";
  });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const done = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sent) done.current?.focus(); }, [sent]);
  const sender = contactAudience(audience);
  const privacy = audience === "privacy";
  const chosen = TOPICS.find((t) => t.key === (privacy ? "privacy" : topic));
  const requirements = !!preset?.contour && topic === "sales" && !privacy;
  const clear = (f: Field) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e));
  const err = (f: Field) => (errors[f] ? `${id}-${f}-err` : undefined);
  const errorText = (f: Field) => (errors[f] ? <p className="cnt-err" id={err(f)}>{errors[f]}</p> : null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget, data = new FormData(form);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    const intake = validateContactIntake({ version: 1, audience, organization: read("organization"), country: read("country"), role: read("role"), source: read("source"), acknowledgement: data.get("acknowledgement") === "on" });
    const fields = { email: read("email"), name: read("name"), message: read("message") };
    const next: Errors = intake.ok ? {} : { ...intake.errors };
    if (!chosen) next.topic = MSG.topic;
    if (!EMAIL.test(fields.email)) next.email = MSG.email;
    if (fields.message.length < 10) next.message = MSG.message;
    setErrors(next); setFailure(null);
    for (const field of ["audience", "topic", "email", "organization", "country", "role", "source", "message", "acknowledgement"] as const) {
      if (next[field]) { form.querySelector<HTMLElement>(`[name="${field}"]`)?.focus(); return; }
    }
    if (!intake.ok || !chosen) { setFailure(MSG.bad); return; }
    setSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, subject: intake.value.organization ? `Website: ${chosen.label}: ${intake.value.organization}` : `Website: ${chosen.label}`, to: chosen.to, channel: chosen.label, intake: intake.value, website: String(data.get("website") ?? "") }),
      });
      if (response.ok) { setSent(true); return; }
      setFailure(response.status === 400 ? MSG.bad : response.status === 429 ? MSG.limited : MSG.failed);
    } catch { setFailure(MSG.failed); }
    finally { setSending(false); }
  }
  // Strings the in-browser translator should know before they first appear (kept from v6).
  const seed = <div hidden data-i18n-seed="">{[...Object.values(MSG), "Send requirements", CONTOUR_LABEL, CONTOUR_PLACEHOLDER, ...Object.values(INTAKE_ERRORS), ...CONTACT_AUDIENCES.flatMap((a) => [a.messageLabel, a.acknowledgement])].filter(Boolean).map((s, i) => <span key={i}>{s}</span>)}</div>;
  if (sent) return <><div className="cnt-sent" ref={done} tabIndex={-1} role="status"><p className="cnt-sent__t">{MSG.sent}</p></div>{seed}</>;

  return (
    <form className="cnt-form" noValidate onSubmit={onSubmit} aria-busy={sending || undefined}>
      <div className="cnt-pair cnt-pair--context">
        <div className="cnt-field">
          <label className="cnt-label" htmlFor={`${id}-audience`}>I am reaching out as</label>
          <select className="cnt-input cnt-select" id={`${id}-audience`} name="audience" value={audience} required aria-invalid={!!errors.audience || undefined} aria-describedby={err("audience")}
            onChange={(e) => { const key = e.target.value as ContactAudience; setAudience(key); setErrors({}); setFailure(null); setTopic(key === "privacy" ? "privacy" : topic === "privacy" ? "" : topic); }}>
            <option value="" disabled>Select what describes you</option>
            {CONTACT_AUDIENCES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>{errorText("audience")}
        </div>
        {!privacy ? (
          <div className="cnt-field">
            <label className="cnt-label" htmlFor={`${id}-topic`}>What would you like to discuss?</label>
            <select className="cnt-input cnt-select" id={`${id}-topic`} name="topic" value={topic} required aria-invalid={!!errors.topic || undefined} aria-describedby={err("topic")} onChange={(e) => { setTopic(e.target.value as TopicKey); clear("topic"); }}>
              <option value="" disabled>Select a topic</option>
              {TOPICS.filter((t) => t.key !== "privacy").map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>{errorText("topic")}
          </div>
        ) : <p className="cnt-help">Goes to the privacy team. No organization details needed.</p>}
      </div>
      <div className="cnt-pair">
        <div className="cnt-field"><label className="cnt-label" htmlFor={`${id}-name`}>Name <span className="cnt-opt">Optional</span></label><input className="cnt-input" id={`${id}-name`} name="name" autoComplete="name" maxLength={160} /></div>
        <div className="cnt-field"><label className="cnt-label" htmlFor={`${id}-email`}>{privacy || audience === "individual" ? "Email" : "Work email"}</label><input className="cnt-input" id={`${id}-email`} name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email || undefined} aria-describedby={err("email")} onInput={() => clear("email")} />{errorText("email")}</div>
      </div>
      {sender?.organizationLabel ? (
        <fieldset className="cnt-context-fields" key={audience}>
          <legend className="cnt-legend">{audience === "government" ? "Who you represent" : audience === "individual" ? "About you" : "Organization details"}</legend>
          <div className="cnt-field"><label className="cnt-label" htmlFor={`${id}-organization`}>{sender.organizationLabel}{!sender.requiresOrganization ? <span className="cnt-opt">Optional</span> : null}</label><input className="cnt-input" id={`${id}-organization`} name="organization" autoComplete="organization" required={sender.requiresOrganization} maxLength={160} aria-invalid={!!errors.organization || undefined} aria-describedby={err("organization")} onInput={() => clear("organization")} />{errorText("organization")}</div>
          <div className="cnt-pair">
            <div className="cnt-field"><label className="cnt-label" htmlFor={`${id}-country`}>Country</label>
              <select className="cnt-input cnt-select" id={`${id}-country`} name="country" defaultValue="" required aria-invalid={!!errors.country || undefined} aria-describedby={err("country")}
                onChange={(e) => setErrors((x) => ({ ...x, country: isRestrictedCountry(e.target.value) ? INTAKE_ERRORS.restricted : undefined }))}>
                <option value="" disabled>Where you or your organization are based</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>{errorText("country")}</div>
            <div className="cnt-field"><label className="cnt-label" htmlFor={`${id}-role`}>Role or office{!sender.requiresRole ? <span className="cnt-opt">Optional</span> : null}</label><input className="cnt-input" id={`${id}-role`} name="role" autoComplete="organization-title" required={sender.requiresRole} maxLength={100} aria-invalid={!!errors.role || undefined} aria-describedby={err("role")} onInput={() => clear("role")} />{errorText("role")}</div>
          </div>
          <p className="cnt-help">Submitting does not establish eligibility or grant access.</p>
        </fieldset>
      ) : null}
      {!privacy && sender ? (
        <div className="cnt-field">
          <label className="cnt-label" htmlFor={`${id}-source`}>How did you hear about Vraelis?</label>
          <select className="cnt-input cnt-select" id={`${id}-source`} name="source" defaultValue="" required aria-invalid={!!errors.source || undefined} aria-describedby={err("source")} onChange={() => clear("source")}>
            <option value="" disabled>Select one</option>
            {HEARD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>{errorText("source")}
        </div>
      ) : null}
      <div className="cnt-field"><label className="cnt-label" htmlFor={`${id}-message`}>{requirements ? CONTOUR_LABEL : sender?.messageLabel ?? "Your inquiry"}</label><textarea key={audience} className="cnt-input cnt-input--area" id={`${id}-message`} name="message" rows={5} required minLength={10} placeholder={requirements ? CONTOUR_PLACEHOLDER : undefined} aria-invalid={!!errors.message || undefined} aria-describedby={err("message")} onInput={() => clear("message")} />{errorText("message")}</div>
      {sender?.acknowledgement ? (
        <div className="cnt-field" key={`${audience}-acknowledgement`}>
          <label className="cnt-ack"><input name="acknowledgement" type="checkbox" required aria-invalid={!!errors.acknowledgement || undefined} aria-describedby={err("acknowledgement")} onChange={() => clear("acknowledgement")} /><span>{sender.acknowledgement}</span></label>{errorText("acknowledgement")}
        </div>
      ) : null}
      <div className="cnt-hp" aria-hidden="true"><label htmlFor={`${id}-website`}>Website</label><input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></div>
      <p className="cnt-consent">Leave out credentials and sensitive operational data. <a href={privacyHref}>Read the privacy policy</a></p>
      <div className="cnt-actions"><button type="submit" className="v8-btn v8-btn--solid v8-btn--lg cnt-submit" aria-disabled={sending || undefined}>{sending ? MSG.sending : requirements ? "Send requirements" : MSG.send}</button></div>
      {failure ? <p className="cnt-err cnt-err--form" role="alert">{failure}</p> : null}{seed}
    </form>
  );
}
