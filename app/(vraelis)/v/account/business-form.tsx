"use client";

import { useActionState, type CSSProperties } from "react";
import { updateVraelisBusiness, type ActionResult } from "./actions";
// (SmsForm lives in ./sms-form)

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "var(--r-xs)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  padding: "11px 13px",
  fontSize: 14,
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

export function BusinessForm({
  initialName,
  initialDescription,
  initialServices,
}: {
  initialName: string;
  initialDescription: string;
  initialServices: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateVraelisBusiness,
    null,
  );

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={labelStyle} htmlFor="businessName">Business name</label>
        <input id="businessName" name="businessName" defaultValue={initialName} placeholder="e.g. Bell & Co. Roofing" maxLength={120} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle} htmlFor="businessDescription">What your business does</label>
        <textarea id="businessDescription" name="businessDescription" defaultValue={initialDescription} placeholder="e.g. Residential roofing — repairs, re-roofs, free estimates across the metro area." maxLength={400} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        <p style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 6, lineHeight: 1.5 }}>
          Vraelis uses this to reply to your leads in your business&apos;s voice.
        </p>
      </div>
      <div>
        <label style={labelStyle} htmlFor="businessServices">Services &amp; prices <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--fg-5)" }}>(optional)</span></label>
        <textarea
          id="businessServices"
          name="businessServices"
          defaultValue={initialServices}
          placeholder={"One per line, e.g.\nInterior detail — $90\nFull detail — $150\nConsultation — free"}
          maxLength={2000}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 13 }}
        />
        <p style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 6, lineHeight: 1.5 }}>
          The AI quotes <b>only</b> these exact prices (never invents one) and can collect the matching amount on-platform. Leave blank to keep it quote-free.
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" className="btn" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state && (
          <span style={{ fontSize: 13, color: state.ok ? "var(--acc-deep)" : "#9F2D2D" }}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
