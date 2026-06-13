"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { saveOfferAction, type ActionResult } from "./actions";

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "var(--r-xs)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  padding: "9px 12px",
  fontSize: 13.5,
  color: "var(--fg-1)",
  outline: "none",
  fontFamily: "var(--font-sans)",
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--fg-4)",
  marginBottom: 7,
  display: "block",
};

const hintStyle: CSSProperties = {
  fontSize: 11.5,
  color: "var(--fg-4)",
  marginTop: 6,
  lineHeight: 1.5,
};

// One numbered step in the offer-first sequence.
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div
        aria-hidden
        style={{
          flex: "0 0 auto",
          width: 26,
          height: 26,
          borderRadius: 999,
          border: "1px solid var(--acc-line)",
          background: "var(--acc-soft)",
          color: "var(--acc-deep)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: 14, color: "var(--fg-1)", margin: "3px 0 9px", letterSpacing: "-0.01em" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

const PAY_OPTIONS = [
  { key: "full", label: "Full payment", sub: "Collect the whole amount up front." },
  { key: "deposit", label: "Deposit to book", sub: "Take a deposit to lock it in; collect the rest later." },
] as const;

// Business-type personas. The selection personalizes every example and
// hint in the form (and is saved so the AI can use it later).
const PERSONAS = [
  { key: "coach", label: "Coach" },
  { key: "course", label: "Course creator" },
  { key: "agency", label: "Agency" },
  { key: "consultant", label: "Consultant" },
  { key: "community", label: "Community" },
  { key: "other", label: "Other" },
] as const;

type PersonaCopy = { namePh: string; descPh: string; servicesPh: string; qualPh: string; srcPh: string; srcHint: string };
const PERSONA_COPY: Record<string, PersonaCopy> = {
  coach: {
    namePh: "Offer name — e.g. Apex Coaching",
    descPh: "One line — e.g. 12-week 1:1 coaching for founders scaling past $10k/mo.",
    servicesPh: "One per line with a price — e.g.\n12-week program — $4,000\nStrategy call — $750",
    qualPh: "One per line — e.g.\nWhat's your monthly revenue?\nWhat's your goal in 90 days?\nTimeline to start?",
    srcPh: "e.g. Instagram DMs, link in bio, referrals",
    srcHint: "Most coaches drop their Vraelis link in their bio and DMs.",
  },
  course: {
    namePh: "Offer name — e.g. The Creator OS course",
    descPh: "One line — e.g. Self-paced course teaching creators to land brand deals.",
    servicesPh: "One per line with a price — e.g.\nCourse (lifetime access) — $497\nCourse + group coaching — $997",
    qualPh: "One per line — e.g.\nWhat are you hoping to learn?\nWhere are you starting from?\nWhen do you want to start?",
    srcPh: "e.g. YouTube, Instagram bio, email list",
    srcHint: "Most course creators drop their Vraelis link under videos and in their bio.",
  },
  agency: {
    namePh: "Agency name — e.g. Northpeak Media",
    descPh: "One line — e.g. Done-for-you short-form content for local businesses.",
    servicesPh: "One per line with a price — e.g.\nContent engine — $2,500/mo\nOne-off campaign — $1,200",
    qualPh: "One per line — e.g.\nWhat does your business do?\nWhat's your monthly budget?\nWho signs off on this?",
    srcPh: "e.g. cold outreach, referrals, LinkedIn",
    srcHint: "Agencies usually put their Vraelis link in outreach emails and proposals.",
  },
  consultant: {
    namePh: "Practice name — e.g. Hale Consulting",
    descPh: "One line — e.g. Ops consulting for e-commerce brands doing $50k+/mo.",
    servicesPh: "One per line with a price — e.g.\nAudit + roadmap — $1,500\nMonthly advisory — $3,000/mo",
    qualPh: "One per line — e.g.\nWhat problem are you hiring for?\nWhat's your revenue range?\nWhat's your timeline?",
    srcPh: "e.g. LinkedIn, referrals, speaking",
    srcHint: "Consultants usually share their Vraelis link on LinkedIn and in follow-ups.",
  },
  community: {
    namePh: "Community name — e.g. The Operators Club",
    descPh: "One line — e.g. Private community for agency owners sharing playbooks.",
    servicesPh: "One per line with a price — e.g.\nMembership — $49/mo\nAnnual — $490/yr",
    qualPh: "One per line — e.g.\nWhat do you do?\nWhat do you want from the community?\nHave you been in one before?",
    srcPh: "e.g. X/Twitter, podcast, word of mouth",
    srcHint: "Most communities share their Vraelis link in pinned posts and welcome emails.",
  },
  other: {
    namePh: "Offer name — e.g. Apex Coaching",
    descPh: "One line on what it is — e.g. 12-week 1:1 coaching for founders scaling past $10k/mo.",
    servicesPh: "One per line with a price — e.g.\n12-week program — $4,000\nStrategy call — $750",
    qualPh: "One per line — e.g.\nWhat's your monthly revenue?\nWhat's your goal in 90 days?\nTimeline to start?",
    srcPh: "e.g. Instagram DMs, link in bio, webinars, referrals",
    srcHint: "Just so you know where to drop your Vraelis link.",
  },
};

// Tone presets the agent speaks in. Stored key feeds the AI prompt
// (see toneLine in lib/vraelis-ai.ts).
const TONES = [
  { key: "friendly", label: "Friendly" },
  { key: "professional", label: "Professional" },
  { key: "direct", label: "Direct" },
  { key: "casual", label: "Casual" },
] as const;

export function OfferForm({
  initialName,
  initialDescription,
  initialServices,
  initialDepositEnabled,
  initialDepositAmount,
  initialQualifying,
  initialLeadSources,
  initialPersona,
  initialAgentName,
  initialAgentTone,
  initialOfferName,
  initialOfferDescription,
  mode,
}: {
  // initialName/initialDescription are the BUSINESS brand (business_name).
  initialName: string;
  initialDescription: string;
  initialServices: string;
  initialDepositEnabled: boolean;
  initialDepositAmount: number | null; // cents
  initialQualifying: string;
  initialLeadSources: string;
  initialPersona: string;
  initialAgentName: string;
  initialAgentTone: string;
  // The OFFER the agent sells (offer_name/offer_description) — separate
  // from the business brand above.
  initialOfferName: string;
  initialOfferDescription: string;
  mode?: "onboarding";
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveOfferAction, null);
  const [payType, setPayType] = useState<string>(initialDepositEnabled ? "deposit" : "full");
  const [depositAmount, setDepositAmount] = useState<string>(
    initialDepositAmount != null ? String(initialDepositAmount / 100) : "25",
  );
  const [persona, setPersona] = useState<string>(
    PERSONAS.some((p) => p.key === initialPersona) ? initialPersona : "",
  );
  const [personaError, setPersonaError] = useState(false);
  const [tone, setTone] = useState<string>(
    TONES.some((t) => t.key === initialAgentTone) ? initialAgentTone : "friendly",
  );
  const pc = PERSONA_COPY[persona] ?? PERSONA_COPY.other;
  const onboarding = mode === "onboarding";

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Persona is a pill row (no native required); block the gated
        // onboarding submit until one is picked.
        if (onboarding && !persona) {
          e.preventDefault();
          setPersonaError(true);
        }
      }}
      style={{ display: "flex", flexDirection: "column", gap: 15 }}
    >
      {mode && <input type="hidden" name="mode" value={mode} />}
      {/* Save affordance — the Save button lives at the bottom of this form
          (after all steps), which isn't obvious, so flag it up top in the
          Setup-edit case. Onboarding already ends in a clear "Finish setup". */}
      {!onboarding && (
        <p style={{ ...hintStyle, marginTop: 0, marginBottom: 2, color: "var(--fg-3)" }}>
          Edit anything below, then <b style={{ color: "var(--acc-deep)" }}>Save setup</b> at the bottom to apply your changes.
        </p>
      )}
      {/* 0 — Who you are: personalizes every example below */}
      <div>
        <span style={labelStyle}>What best describes you?{onboarding && <span style={{ color: "var(--acc-deep)" }}> *</span>}</span>
        <input type="hidden" name="persona" value={persona} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PERSONAS.map((p) => {
            const active = persona === p.key;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={active}
                onClick={() => { setPersona(p.key); setPersonaError(false); }}
                style={{
                  cursor: "pointer",
                  padding: "5px 12px",
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 500,
                  border: `1px solid ${active ? "var(--acc-deep)" : "var(--line-2)"}`,
                  background: active ? "rgba(14,158,108,0.06)" : "var(--bg-1)",
                  color: active ? "var(--acc-deep)" : "var(--fg-3)",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        {personaError && (
          <p style={{ ...hintStyle, color: "#9F2D2D" }}>Pick the closest one — it tailors everything below (you can change it anytime).</p>
        )}
      </div>

      {/* Agent identity — name + voice. Feeds the AI prompt across every
          channel (chat, email, SMS). */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px", minWidth: 160 }}>
          <label style={labelStyle} htmlFor="agentName">Name your agent</label>
          <input
            id="agentName"
            name="agentName"
            defaultValue={initialAgentName}
            placeholder="e.g. Ava"
            maxLength={40}
            style={inputStyle}
          />
          <p style={hintStyle}>How it introduces itself to leads. Leave blank to speak as your business.</p>
        </div>
        <div style={{ flex: "1 1 200px", minWidth: 160 }}>
          <span style={labelStyle}>Voice</span>
          <input type="hidden" name="agentTone" value={tone} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TONES.map((t) => {
              const active = tone === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTone(t.key)}
                  style={{
                    cursor: "pointer",
                    padding: "5px 12px",
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 500,
                    border: `1px solid ${active ? "var(--acc-deep)" : "var(--line-2)"}`,
                    background: active ? "rgba(14,158,108,0.06)" : "var(--bg-1)",
                    color: active ? "var(--acc-deep)" : "var(--fg-3)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <p style={hintStyle}>How your agent sounds with every lead.</p>
        </div>
      </div>

      {/* 1 — Your business (the brand) */}
      <Step n={1} title="Your business">
        <input
          name="businessName"
          defaultValue={initialName}
          placeholder="Business name — e.g. Apex Trading"
          maxLength={120}
          required={onboarding}
          style={{ ...inputStyle, marginBottom: 8 }}
        />
        <textarea
          name="businessDescription"
          defaultValue={initialDescription}
          placeholder="One line on your business — e.g. Trading education for busy professionals."
          maxLength={400}
          rows={2}
          required={onboarding}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <p style={hintStyle}>Your brand. This is the name leads see in chat, on your booking page, and on payment receipts.</p>
      </Step>

      {/* 2 — What you sell (the offer) */}
      <Step n={2} title="What does your agent sell?">
        <input
          name="offerName"
          defaultValue={initialOfferName}
          placeholder={pc.namePh}
          maxLength={120}
          required={onboarding}
          style={{ ...inputStyle, marginBottom: 8 }}
        />
        <textarea
          name="offerDescription"
          defaultValue={initialOfferDescription}
          placeholder={pc.descPh}
          maxLength={400}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <p style={hintStyle}>The offer your agent sells and that customers pay for.</p>
      </Step>

      {/* 3 — How much */}
      <Step n={3} title="Price">
        <textarea
          name="businessServices"
          defaultValue={initialServices}
          placeholder={pc.servicesPh}
          maxLength={2000}
          rows={3}
          required={onboarding}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 13 }}
        />
        <p style={hintStyle}>Your agent quotes <b>only</b> these prices and can collect them in the conversation.</p>
      </Step>

      {/* 4 — How customers pay */}
      <Step n={4} title="How do customers pay?">
        <input type="hidden" name="payType" value={payType} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PAY_OPTIONS.map((o) => {
            const active = payType === o.key;
            return (
              <button
                type="button"
                key={o.key}
                aria-pressed={active}
                onClick={() => setPayType(o.key)}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  borderRadius: "var(--r-xs)",
                  border: `1px solid ${active ? "var(--acc-deep)" : "var(--line-2)"}`,
                  background: active ? "rgba(14,158,108,0.06)" : "var(--bg-1)",
                  padding: "11px 13px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flex: "0 0 auto",
                    width: 15,
                    height: 15,
                    borderRadius: 999,
                    marginTop: 1,
                    border: `4px solid ${active ? "var(--acc-deep)" : "var(--line-3)"}`,
                    background: "var(--bg-1)",
                  }}
                />
                <span>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)" }}>{o.label}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>{o.sub}</span>
                </span>
              </button>
            );
          })}
          {/* Payment plan — placeholder, not built yet */}
          <div
            aria-disabled
            style={{
              borderRadius: "var(--r-xs)",
              border: "1px dashed var(--line-2)",
              background: "var(--bg-2)",
              padding: "11px 13px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              opacity: 0.7,
            }}
          >
            <span aria-hidden style={{ flex: "0 0 auto", width: 15, height: 15, borderRadius: 999, marginTop: 1, border: "2px solid var(--line-3)", background: "var(--bg-2)" }} />
            <span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "var(--fg-3)" }}>
                Payment plan
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)", border: "1px solid var(--line-2)", borderRadius: 999, padding: "1px 7px" }}>Coming soon</span>
              </span>
              <span style={{ display: "block", fontSize: 12, color: "var(--fg-4)", marginTop: 2 }}>Split a high-ticket offer into installments. On the roadmap.</span>
            </span>
          </div>
        </div>

        {payType === "deposit" && (
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle} htmlFor="depositAmount">Deposit amount</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {[25, 50, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDepositAmount(String(v))}
                  style={{
                    flex: 1, padding: "7px 4px", fontSize: 12.5, fontFamily: "var(--font-mono)", cursor: "pointer",
                    borderRadius: "var(--r-xs)",
                    border: `1px solid ${depositAmount === String(v) ? "var(--acc-deep)" : "var(--line-2)"}`,
                    background: depositAmount === String(v) ? "rgba(14,158,108,0.06)" : "var(--bg-1)",
                    color: depositAmount === String(v) ? "var(--acc-deep)" : "var(--fg-3)",
                    fontWeight: depositAmount === String(v) ? 600 : 400,
                  }}
                >
                  ${v}
                </button>
              ))}
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--line-2)", borderRadius: "var(--r-xs)", padding: "0 10px", background: "var(--bg-1)", maxWidth: 160 }}>
              <span style={{ color: "var(--fg-4)", fontSize: 13 }}>$</span>
              <input
                id="depositAmount"
                name="depositAmount"
                type="number"
                min={0.5}
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="deposit"
                style={{ ...inputStyle, fontFamily: "var(--font-mono)", border: "none", background: "transparent", padding: "9px 2px" }}
              />
            </div>
            <p style={hintStyle}>A deposit cuts no-shows and runs the first payment through Vraelis (your cut, automatically). Needs payouts connected below.</p>
          </div>
        )}
      </Step>

      {/* Advanced — collapsed by default so core setup stays to 3 steps */}
      <details style={{ borderTop: "1px solid var(--line-1)", paddingTop: 14 }}>
        <summary style={{ cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.04em", color: "var(--fg-3)", listStyle: "none" }}>
          <span style={{ color: "var(--acc-deep)" }}>+</span> How your agent qualifies &amp; where it works <span style={{ color: "var(--fg-5)" }}>(optional)</span>
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          <div>
            <label style={labelStyle} htmlFor="qualifyingQuestions">What should your agent ask to qualify buyers?</label>
            <textarea
              id="qualifyingQuestions"
              name="qualifyingQuestions"
              defaultValue={initialQualifying}
              placeholder={pc.qualPh}
              maxLength={1500}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <p style={hintStyle}>Your agent asks these naturally to separate serious buyers from browsers.</p>
          </div>
          <div>
            <label style={labelStyle} htmlFor="leadSources">Where do your leads come from?</label>
            <input
              id="leadSources"
              name="leadSources"
              defaultValue={initialLeadSources}
              placeholder={pc.srcPh}
              maxLength={500}
              style={inputStyle}
            />
            <p style={hintStyle}>{pc.srcHint}</p>
          </div>
        </div>
      </details>

      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          borderTop: "1px solid var(--line-1)", paddingTop: 16,
          // In the Setup-edit case, stick the save bar to the bottom of the
          // viewport so it's always reachable — the form is long and the
          // button was otherwise buried far below the fold.
          ...(onboarding ? {} : {
            position: "sticky", bottom: 0, zIndex: 1,
            background: "var(--bg-1)", marginInline: "calc(-1 * clamp(14px,1.8vw,20px))",
            paddingInline: "clamp(14px,1.8vw,20px)", paddingBottom: 14,
          }),
        }}
      >
        <button type="submit" className="btn" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
          {pending ? "Saving…" : onboarding ? "Finish setup →" : "Save setup"}
        </button>
        {state && (
          <span style={{ fontSize: 13, color: state.ok ? "var(--acc-deep)" : "#9F2D2D" }}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
