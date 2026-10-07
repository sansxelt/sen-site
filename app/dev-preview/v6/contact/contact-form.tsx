"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { V6_BASE } from "@/lib/v6-routes";
import { CONTACT_AUDIENCES, INTAKE_ERRORS, contactAudience, validateContactIntake, type ContactAudience, type IntakeField } from "@/lib/contact-intake";

const TOPICS = [
  { key: "support", label: "General inquiry", to: "help@vraelis.com" },
  { key: "sales", label: "AI security", to: "sales@vraelis.com" },
  { key: "defense", label: "Defense and national security", to: "sales@vraelis.com" },
  { key: "fleets", label: "Robotics", to: "sales@vraelis.com" },
  { key: "public-sector", label: "Infrastructure", to: "sales@vraelis.com" },
  { key: "enterprise", label: "Enterprise", to: "sales@vraelis.com" },
  { key: "partnerships", label: "Technical collaboration", to: "sales@vraelis.com" },
  { key: "privacy", label: "Privacy", to: "privacy@vraelis.com" },
] as const;
type TopicKey = typeof TOPICS[number]["key"];
const MSG = {
  topic: "Choose a topic.", email: "Enter a valid email address.", message: "Write a message of at least 10 characters.",
  send: "Send inquiry", sending: "Sending", sent: "Sent. A person at Vraelis reads every message.",
  bad: "Check the fields above and try again.",
  limited: "Too many messages from this network. Try again in ten minutes or write to help@vraelis.com.",
  failed: "The message did not send. Try again, or write to help@vraelis.com.",
} as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type Field = IntakeField | "topic" | "email" | "message";
type Errors = Partial<Record<Field, string>>;

export function ContactForm({ topicParam }: { topicParam?: string }) {
  const id = useId();
  const [audience, setAudience] = useState<ContactAudience | "">(topicParam === "privacy" ? "privacy" : topicParam === "government" ? "government" : "");
  const [topic, setTopic] = useState<TopicKey | "">(() => {
    const key = ({ infrastructure: "public-sector", robotics: "fleets", government: "support", beta: "sales" } as Record<string,string>)[topicParam ?? ""] ?? topicParam;
    return TOPICS.find(t => t.key === key)?.key ?? "";
  });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const done = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sent) done.current?.focus(); }, [sent]);
  const sender = contactAudience(audience);
  const privacy = audience === "privacy";
  const chosen = TOPICS.find(t => t.key === (privacy ? "privacy" : topic));
  const clear = (f: Field) => setErrors(e => e[f] ? { ...e, [f]: undefined } : e);
  const err = (f: Field) => errors[f] ? `${id}-${f}-err` : undefined;
  const errorText = (f: Field) => errors[f] ? <p className="ct-err" id={err(f)}>{errors[f]}</p> : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget, data = new FormData(form);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    const intake = validateContactIntake({ version: 1, audience, organization: read("organization"), country: read("country"), role: read("role"), acknowledgement: data.get("acknowledgement") === "on" });
    const fields = { email: read("email"), name: read("name"), message: read("message") };
    const next: Errors = intake.ok ? {} : { ...intake.errors };
    if (!chosen) next.topic = MSG.topic;
    if (!EMAIL.test(fields.email)) next.email = MSG.email;
    if (fields.message.length < 10) next.message = MSG.message;
    setErrors(next); setFailure(null);
    for (const field of ["audience", "topic", "email", "organization", "country", "role", "message", "acknowledgement"] as const) {
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
  const seed = <div hidden data-i18n-seed="">{[...Object.values(MSG), ...Object.values(INTAKE_ERRORS), ...CONTACT_AUDIENCES.flatMap(a => [a.messageLabel, a.acknowledgement])].filter(Boolean).map((s, i) => <span key={i}>{s}</span>)}</div>;
  if (sent) return <><div className="ct-sent" ref={done} tabIndex={-1} role="status"><p className="ct-sent__t">{MSG.sent}</p></div>{seed}</>;

  return <form className="ct-form" noValidate onSubmit={onSubmit} aria-busy={sending || undefined}>
    <div className="ct-field">
      <label className="ct-label" htmlFor={`${id}-audience`}>I am reaching out as</label>
      <select className="ct-input ct-select" id={`${id}-audience`} name="audience" value={audience} required aria-invalid={!!errors.audience || undefined} aria-describedby={err("audience")}
        onChange={e => { const key = e.target.value as ContactAudience; setAudience(key); setErrors({}); setFailure(null); setTopic(key === "privacy" ? "privacy" : topic === "privacy" ? "" : topic); }}>
        <option value="" disabled>Select what describes you</option>
        {CONTACT_AUDIENCES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
      </select>{errorText("audience")}
    </div>
    {!privacy ? <div className="ct-field">
      <label className="ct-label" htmlFor={`${id}-topic`}>What would you like to discuss?</label>
      <select className="ct-input ct-select" id={`${id}-topic`} name="topic" value={topic} required aria-invalid={!!errors.topic || undefined} aria-describedby={err("topic")} onChange={e => { setTopic(e.target.value as TopicKey); clear("topic"); }}>
        <option value="" disabled>Select a topic</option>{TOPICS.filter(t => t.key !== "privacy").map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>{errorText("topic")}
    </div> : <p className="ct-help">Your request goes to the privacy team. Organization details and commercial acknowledgements are not required.</p>}
    <div className="ct-pair">
      <div className="ct-field"><label className="ct-label" htmlFor={`${id}-name`}>Name <span className="ct-opt">Optional</span></label><input className="ct-input" id={`${id}-name`} name="name" autoComplete="name" maxLength={160} /></div>
      <div className="ct-field"><label className="ct-label" htmlFor={`${id}-email`}>{privacy || audience === "individual" ? "Email" : "Work email"}</label><input className="ct-input" id={`${id}-email`} name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email || undefined} aria-describedby={err("email")} onInput={() => clear("email")} />{errorText("email")}</div>
    </div>
    {sender?.organizationLabel ? <fieldset className="ct-context-fields" key={audience}>
      <legend className="ct-label">{audience === "government" ? "Who you represent" : "Organization details"}</legend>
      <div className="ct-field"><label className="ct-label" htmlFor={`${id}-organization`}>{sender.organizationLabel}{!sender.requiresOrganization ? <span className="ct-opt">Optional</span> : null}</label><input className="ct-input" id={`${id}-organization`} name="organization" autoComplete="organization" required={sender.requiresOrganization} maxLength={160} aria-invalid={!!errors.organization || undefined} aria-describedby={err("organization")} onInput={() => clear("organization")} />{errorText("organization")}</div>
      <div className="ct-pair">
        <div className="ct-field"><label className="ct-label" htmlFor={`${id}-country`}>Organization country{!sender.requiresCountry ? <span className="ct-opt">Optional</span> : null}</label><input className="ct-input" id={`${id}-country`} name="country" placeholder="Country where the organization is based" required={sender.requiresCountry} maxLength={100} aria-invalid={!!errors.country || undefined} aria-describedby={err("country")} onInput={() => clear("country")} />{errorText("country")}</div>
        <div className="ct-field"><label className="ct-label" htmlFor={`${id}-role`}>Role or office{!sender.requiresRole ? <span className="ct-opt">Optional</span> : null}</label><input className="ct-input" id={`${id}-role`} name="role" autoComplete="organization-title" required={sender.requiresRole} maxLength={100} aria-invalid={!!errors.role || undefined} aria-describedby={err("role")} onInput={() => clear("role")} />{errorText("role")}</div>
      </div>
      <p className="ct-help">These details help us review the inquiry and any applicable requirements. Submitting does not establish eligibility or grant product access.</p>
    </fieldset> : null}
    <div className="ct-field"><label className="ct-label" htmlFor={`${id}-message`}>{sender?.messageLabel ?? "Your inquiry"}</label><textarea key={audience} className="ct-input ct-input--area" id={`${id}-message`} name="message" rows={5} required minLength={10} aria-invalid={!!errors.message || undefined} aria-describedby={err("message")} onInput={() => clear("message")} />{errorText("message")}</div>
    {sender?.acknowledgement ? <div className="ct-field" key={`${audience}-acknowledgement`}>
      <label className="ct-ack"><input name="acknowledgement" type="checkbox" required aria-invalid={!!errors.acknowledgement || undefined} aria-describedby={err("acknowledgement")} onChange={() => clear("acknowledgement")} /><span>{sender.acknowledgement}</span></label>{errorText("acknowledgement")}
    </div> : null}
    <div className="ct-hp" aria-hidden="true"><label htmlFor={`${id}-website`}>Website</label><input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></div>
    <p className="ct-consent">The <a href={`${V6_BASE}/privacy`}>privacy policy</a> explains how we handle your inquiry. Please leave out credentials and sensitive operational data.</p>
    <div className="ct-actions"><button type="submit" className="v6-btn v6-btn--brand v6-btn--lg ct-submit" aria-disabled={sending || undefined}>{sending ? MSG.sending : MSG.send}</button></div>
    {failure ? <p className="ct-err ct-err--form" role="alert">{failure}</p> : null}{seed}
  </form>;
}
