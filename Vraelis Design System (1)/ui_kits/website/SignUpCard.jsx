// SignUpCard.jsx — three-step waitlist enrollment.
// Designed to feel like a real product sign-up screen. No mono
// section markers, no fake telemetry chrome. Step dots only.

const { useState, useRef, useEffect } = React;

function SignUpCard() {
  const [step, setStep]   = useState(0);          // 0 email · 1 details · 2 done
  const [email, setEmail] = useState("");
  const [use, setUse]     = useState("");
  const emailRef = useRef(null);

  useEffect(() => {
    if (step === 0) emailRef.current?.focus({ preventScroll: true });
  }, [step]);

  const submitEmail = (e) => {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) return;
    setStep(1);
  };
  const submitDetails = (e) => {
    e.preventDefault();
    setStep(2);
  };

  return (
    <div className="vra-card-anim" style={{
      position: "relative",
      background: "var(--bg-1)",
      border: "1px solid var(--line-2)",
      padding: "36px 36px 32px",
      maxWidth: 460,
      width: "100%",
      overflow: "hidden",
    }}>
      {/* Edge accent — a thin live phosphor line that pulses */}
      <span aria-hidden style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 2,
        background: "var(--acc)",
        boxShadow: "0 0 12px var(--acc-glow)",
        animation: "vraPulse 2.4s ease-in-out infinite",
      }} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 22 }}>
        <StepDots step={step} total={3} />
      </div>

      {step === 0 && (
        <form onSubmit={submitEmail} className="vra-step-anim">
          <h2 style={{ fontSize: 26, color: "var(--fg-1)", letterSpacing: "-0.022em", marginBottom: 8, lineHeight: 1.15 }}>
            Get early access.
          </h2>
          <p style={{ fontSize: 14, color: "var(--fg-3)", marginBottom: 26, lineHeight: 1.5 }}>
            We'll write once when there's a dev-kit window. Not before.
          </p>

          <FocusInput
            inputRef={emailRef}
            value={email}
            onChange={(v) => setEmail(v)}
            placeholder="you@something.com"
            type="email"
            autoComplete="email"
            valid={/.+@.+\..+/.test(email)}
          />

          <button type="submit" className="btn" style={{ marginTop: 24, width: "100%", justifyContent: "center", padding: "14px 22px" }}>
            Continue
          </button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={submitDetails} className="vra-step-anim" key="step1">
          <h2 style={{ fontSize: 26, color: "var(--fg-1)", letterSpacing: "-0.022em", marginBottom: 8, lineHeight: 1.15 }}>
            One more thing.
          </h2>
          <p style={{ fontSize: 14, color: "var(--fg-3)", marginBottom: 22, lineHeight: 1.5 }}>
            What would you use them for? Helps us prioritize.
          </p>

          <div style={{ display: "grid", gap: 8 }}>
            {[
              { id: "daily",    label: "Daily wear" },
              { id: "field",    label: "Field recording, journalism" },
              { id: "access",   label: "Accessibility, captioning" },
              { id: "build",    label: "I'm building something on them" },
            ].map((o) => (
              <UseOption
                key={o.id}
                checked={use === o.id}
                onSelect={() => setUse(o.id)}
                label={o.label}
              />
            ))}
          </div>

          <button type="submit" className="btn" style={{ marginTop: 22, width: "100%", justifyContent: "center", padding: "14px 22px" }}>
            Add me to the list
          </button>

          <button type="button" onClick={() => setStep(2)}
            style={{ marginTop: 12, fontSize: 13, color: "var(--fg-4)", background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", textDecoration: "underline", textUnderlineOffset: 3 }}>
            skip
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="vra-step-anim" key="step2">
          <h2 style={{ fontSize: 30, color: "var(--fg-1)", letterSpacing: "-0.025em", marginBottom: 10, lineHeight: 1.1 }}>
            You're in.
          </h2>
          <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.5, marginBottom: 24 }}>
            We'll be in touch at <span style={{ color: "var(--fg-1)" }}>{email}</span> when the next dev-kit window opens.
          </p>

          <button type="button" onClick={() => { setStep(0); setEmail(""); setUse(""); }}
            className="btn btn--ghost" style={{ width: "100%", justifyContent: "center" }}>
            Add another email
          </button>
        </div>
      )}
    </div>
  );
}

function StepDots({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{
          width: i === step ? 16 : 4,
          height: 4,
          background: i <= step ? "var(--acc)" : "var(--line-3)",
          transition: "width 300ms var(--ease), background 300ms var(--ease)",
        }} />
      ))}
    </div>
  );
}

function FocusInput({ inputRef, value, onChange, placeholder, type = "text", autoComplete, valid }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{
      position: "relative",
      borderTop: "1px solid var(--line-3)",
      borderBottom: `1px solid ${focused ? "var(--acc)" : "var(--line-3)"}`,
      transition: "border-color 200ms var(--ease)",
    }}>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{
          width: "100%",
          border: "none",
          padding: "16px 0",
          background: "transparent",
          color: "var(--fg-1)",
          fontFamily: "var(--font-sans)",
          fontSize: 17,
          letterSpacing: "-0.005em",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function UseOption({ checked, onSelect, label }) {
  return (
    <button type="button" onClick={onSelect} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px",
      background: checked ? "var(--bg-3)" : "var(--bg-2)",
      border: `1px solid ${checked ? "var(--acc)" : "var(--line-2)"}`,
      borderRadius: "var(--r-xs)",
      color: "var(--fg-1)",
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      cursor: "pointer",
      textAlign: "left",
      transition: "border-color 180ms var(--ease), background 180ms var(--ease)",
    }}>
      <span style={{
        width: 14, height: 14, borderRadius: "50%",
        border: `1.5px solid ${checked ? "var(--acc)" : "var(--line-3)"}`,
        display: "grid", placeItems: "center",
        transition: "border-color 180ms var(--ease)",
      }}>
        {checked && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--acc)" }} />}
      </span>
      {label}
    </button>
  );
}

Object.assign(window, { SignUpCard, StepDots, FocusInput, UseOption });
