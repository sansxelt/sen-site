"use client";

// THE CONTACT FORM (plan C /contact, revision 2, 2026-10-02). It posts JSON to the existing /api/contact
// (app/api/contact/route.ts: email, name, subject, message, to, channel, and the website honeypot; five messages
// per network per ten minutes), and routes by topic: Privacy to privacy@, Support to help@, every other topic to
// sales@. All three deliver to a person (Cloudflare Email Routing, confirmed 2026-10-02).
//
// WHAT IT SENDS IS ALWAYS ENGLISH. The page may be translated by the DOM translator, so the topic a reader sees can
// be German or Japanese; the payload never reads the rendered label. channel is the topic's English label from
// TOPICS below, and subject is "Website: <English label>", plus ": <Company>" when a company is given.
//
// WHAT IT SAYS IS FIXED. The server's error text is never shown (it can carry a provider's detail): 400, 429 and 502
// map to three fixed sentences, client validation comes first, and success replaces the form with one sentence
// that promises nothing about a confirmation email, because that email is best effort (once per mailbox per hour).
//
// Topics use stable English keys for routing. Dynamic status/error sentences are seeded for translation.
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { V6_BASE } from "@/lib/v6-routes";
import { sectorBySlug } from "../_content/sectors";

type TopicKey = "support" | "sales" | "defense" | "fleets" | "public-sector" | "enterprise" | "partnerships" | "privacy";
type Inbox = "help@vraelis.com" | "sales@vraelis.com" | "privacy@vraelis.com";
type Topic = { key: TopicKey; label: string; to: Inbox };

// The three sector topics take their names from the sector registry (_content/sectors.ts), so the form and the
// Solutions menu can never name a sector two ways. Defense is wider here than its menu label on purpose.
const sectorLabel = (slug: "fleets" | "public-sector" | "enterprise") => sectorBySlug(slug)!.label;

/** The topics in display order, keyed by the ?topic= value each one answers to. */
const TOPICS: readonly Topic[] = [
  { key: "support", label: "General inquiry", to: "help@vraelis.com" },
  { key: "sales", label: "AI security", to: "sales@vraelis.com" },
  { key: "defense", label: "Defense and national security", to: "sales@vraelis.com" },
  { key: "fleets", label: sectorLabel("fleets"), to: "sales@vraelis.com" },
  { key: "public-sector", label: sectorLabel("public-sector"), to: "sales@vraelis.com" },
  { key: "enterprise", label: sectorLabel("enterprise"), to: "sales@vraelis.com" },
  { key: "partnerships", label: "Technical collaboration", to: "sales@vraelis.com" },
  { key: "privacy", label: "Privacy", to: "privacy@vraelis.com" },
];

/** Every sentence the form can show after the page has loaded. Whole strings only: nothing is built from pieces. */
const MSG = {
  topic: "Choose a topic.",
  email: "Enter a valid email address.",
  message: "Write a message of at least 10 characters.",
  send: "Send inquiry",
  sending: "Sending",
  sent: "Sent. A person at Vraelis reads every message.",
  bad: "Check the fields above and try again.",
  limited: "Too many messages from this network. Try again in ten minutes or write to help@vraelis.com.",
  failed: "The message did not send. Try again, or write to help@vraelis.com.",
  goesTo: "Goes to",
} as const;

// A plain shape check before sending. The server's own check (lib/email-address.ts) is the authority; a 400 from
// it is answered with the fixed sentence.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Field = "topic" | "email" | "message";
type Errors = Partial<Record<Field, string>>;

export function ContactForm({ topicParam }: { topicParam?: string }) {
  const id = useId();
  const [topic, setTopic] = useState<TopicKey | null>(() => TOPICS.find((t) => t.key === ({ infrastructure: "public-sector", robotics: "fleets", government: "enterprise", beta: "sales" } as Record<string, string>)[topicParam ?? ""] || t.key === topicParam)?.key ?? null);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const firstTopic = useRef<HTMLSelectElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const message = useRef<HTMLTextAreaElement>(null);
  const done = useRef<HTMLDivElement>(null);

  // Success replaces the form; focus moves to the sentence so a screen reader hears it.
  useEffect(() => { if (sent) done.current?.focus(); }, [sent]);

  const chosen = TOPICS.find((t) => t.key === topic) ?? null;
  const clear = (f: Field) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e));

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (sending) return;
    const data = new FormData(ev.currentTarget);
    const read = (k: string) => String(data.get(k) ?? "").trim();
    const fields = { name: read("name"), email: read("email"), company: read("company"), message: read("message") };

    const next: Errors = {};
    if (!chosen) next.topic = MSG.topic;
    if (!EMAIL.test(fields.email)) next.email = MSG.email;
    if (fields.message.length < 10) next.message = MSG.message;
    setErrors(next);
    setFailure(null);
    if (next.topic) { firstTopic.current?.focus(); return; }
    if (next.email) { email.current?.focus(); return; }
    if (next.message) { message.current?.focus(); return; }
    if (!chosen) return;

    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fields.email,
          name: fields.name,
          subject: fields.company ? `Website: ${chosen.label}: ${fields.company}` : `Website: ${chosen.label}`,
          message: fields.message,
          to: chosen.to,
          channel: chosen.label,
          // The honeypot, sent exactly as found: a person never sees the field, so it is empty unless a bot filled it,
          // and then the route answers ok and sends nothing.
          website: String(data.get("website") ?? ""),
        }),
      });
      if (res.ok) { setSent(true); return; }
      setFailure(res.status === 400 ? MSG.bad : res.status === 429 ? MSG.limited : MSG.failed);
    } catch {
      setFailure(MSG.failed);
    } finally {
      setSending(false);
    }
  }

  const seed = (
    // The sentences above that only appear after an action, rendered once for the translation crawl (plan 0.6).
    <div hidden data-i18n-seed="">
      {[MSG.topic, MSG.email, MSG.message, MSG.sending, MSG.sent, MSG.bad, MSG.limited, MSG.failed, MSG.goesTo].map((s) => <span key={s}>{s}</span>)}
    </div>
  );

  if (sent) {
    // The live region holds the one sentence and nothing else; the seed stays outside it.
    return (
      <>
        <div className="ct-sent" ref={done} tabIndex={-1} role="status">
          <p className="ct-sent__t">{MSG.sent}</p>
        </div>
        {seed}
      </>
    );
  }

  const err = (f: Field) => (errors[f] ? `${id}-${f}-err` : undefined);

  return (
    <form className="ct-form" noValidate onSubmit={onSubmit} aria-busy={sending || undefined}>
      <div className="ct-field">
        <label className="ct-label" htmlFor={`${id}-topic`}>What would you like to discuss?</label>
        <select ref={firstTopic} className="ct-input ct-select" id={`${id}-topic`} name="topic" value={topic ?? ""} required
          aria-invalid={errors.topic ? true : undefined} aria-describedby={err("topic")}
          onChange={e => { setTopic(e.target.value as TopicKey); clear("topic"); }}>
          <option value="" disabled>Select a topic</option>
          {TOPICS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        {errors.topic ? <p className="ct-err" id={err("topic")}>{errors.topic}</p> : null}
      </div>

      <div className="ct-pair">
        <div className="ct-field">
          <label className="ct-label" htmlFor={`${id}-name`}>Name <span className="ct-opt">Optional</span></label>
          <input className="ct-input" id={`${id}-name`} name="name" type="text" autoComplete="name" />
        </div>
        <div className="ct-field">
          <label className="ct-label" htmlFor={`${id}-email`}>Work email</label>
          <input
            ref={email}
            className="ct-input"
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={err("email")}
            onInput={() => clear("email")}
          />
          {errors.email ? <p className="ct-err" id={err("email")}>{errors.email}</p> : null}
        </div>
      </div>

      <div className="ct-field">
        <label className="ct-label" htmlFor={`${id}-company`}>Organization <span className="ct-opt">Optional</span></label>
        <input className="ct-input" id={`${id}-company`} name="company" type="text" autoComplete="organization" />
      </div>

      <div className="ct-field">
        <label className="ct-label" htmlFor={`${id}-message`}>Your security problem</label>
        <textarea
          ref={message}
          className="ct-input ct-input--area"
          id={`${id}-message`}
          name="message"
          rows={5}
          required
          minLength={10}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={err("message")}
          onInput={() => clear("message")}
        />
        {errors.message ? <p className="ct-err" id={err("message")}>{errors.message}</p> : null}
      </div>

      {/* The honeypot (the route drops any message that fills it). Hidden from sight and from assistive technology,
          out of the tab order, and never autofilled. */}
      <div className="ct-hp" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {/* aria-disabled, not disabled, while sending: a disabled button loses focus to the page, and when a send
          fails a keyboard or screen-reader user would be dropped out of the form. onSubmit ignores a second press
          while one is in flight. */}
      <p className="ct-consent">By submitting, you agree to the <a href={`${V6_BASE}/privacy`}>privacy policy</a>. Please leave out sensitive operational data and credentials.</p>
      <div className="ct-actions">
        <button type="submit" className="v6-btn v6-btn--brand v6-btn--lg ct-submit" aria-disabled={sending || undefined}>
          {sending ? MSG.sending : MSG.send}
        </button>
      </div>
      {failure ? <p className="ct-err ct-err--form" role="alert">{failure}</p> : null}
      {seed}
    </form>
  );
}
