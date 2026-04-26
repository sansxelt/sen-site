// Persona presets, separate from the TTS *voice* (which is the
// audio voice). A persona overlays the system prompt with a style
// directive and a chunk-render speed multiplier. Same model under
// every persona; what changes is how it answers.

export type Persona = "direct" | "warm" | "technical" | "playful";

export type PersonaDescriptor = {
  key: Persona;
  display_name: string;
  blurb: string;
  // Appended to the base system prompt. Keep it short, the model
  // weighs longer instructions less consistently.
  style_directive: string;
  // Frontend hint: multiplier on the natural per-chunk render delay.
  // <1 = render faster (snappier), >1 = render slower (more
  // deliberate). The frontend uses this when streaming text.
  delay_multiplier: number;
};

export const PERSONA_REGISTRY: ReadonlyArray<PersonaDescriptor> = [
  {
    key: "direct",
    display_name: "Direct",
    blurb: "Short sentences. No hedging. Lead with the answer.",
    style_directive:
      "Persona: direct. Short sentences. No pleasantries. No qualifiers like 'I think' or 'It seems'. Lead with the answer in the first line. Avoid lists unless the user asked for one.",
    delay_multiplier: 0.8,
  },
  {
    key: "warm",
    display_name: "Warm",
    blurb: "Conversational. Patient. Light acknowledgments.",
    style_directive:
      "Persona: warm. Conversational, patient, slightly longer sentences. Small acknowledgments ('right', 'sure') are okay. Treat the user like a colleague you're helping at a desk.",
    delay_multiplier: 1.0,
  },
  {
    key: "technical",
    display_name: "Technical",
    blurb: "Precise. Code-first. Cite assumptions.",
    style_directive:
      "Persona: technical. Precise terminology. Code-first when relevant. Cite assumptions explicitly. No analogies unless the user asks. Be exact about types, edge cases, and side effects.",
    delay_multiplier: 0.9,
  },
  {
    key: "playful",
    display_name: "Playful",
    blurb: "Witty, light asides. Dry humor. Never mean.",
    style_directive:
      "Persona: playful. Witty, occasionally dry. Light asides are fine. Never mean, never at the user's expense. Keep the substance honest, humor is seasoning, not the whole dish.",
    delay_multiplier: 1.1,
  },
];

export function describePersona(key: Persona): PersonaDescriptor {
  return (
    PERSONA_REGISTRY.find((p) => p.key === key) ?? PERSONA_REGISTRY[0]
  );
}

export function isPersona(value: unknown): value is Persona {
  return (
    value === "direct" ||
    value === "warm" ||
    value === "technical" ||
    value === "playful"
  );
}
