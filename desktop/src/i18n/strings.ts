// v0.1.4 i18n strings — UI translation table for the desktop app.
//
// Only EN is filled out for v0.1.4. The other locales reference EN
// directly so the rest of the app can already call t("chat") without
// crashing or having to handle undefined values. Real translations
// land in v0.1.5; until then every locale falls back to English at
// the value level (not the key level — the keys themselves are
// type-checked).
//
// LANGUAGES is duplicated here intentionally — the desktop tsconfig
// only `include`s src/, so it can't import from the Next.js
// lib/i18n module. The two lists must stay in sync (10 codes, same
// labels). Server-side detection still lives in lib/i18n/index.ts.

export type LanguageCode =
  | "en" | "es" | "fr" | "de" | "ja"
  | "zh" | "pt" | "ko" | "hi" | "ar";

export type LanguageEntry = {
  code: LanguageCode;
  label: string;
  native: string;
};

export const LANGUAGES: ReadonlyArray<LanguageEntry> = [
  { code: "en", label: "English",    native: "English"    },
  { code: "es", label: "Spanish",    native: "Español"    },
  { code: "fr", label: "French",     native: "Français"   },
  { code: "de", label: "German",     native: "Deutsch"    },
  { code: "ja", label: "Japanese",   native: "日本語"      },
  { code: "zh", label: "Chinese",    native: "中文"        },
  { code: "pt", label: "Portuguese", native: "Português"  },
  { code: "ko", label: "Korean",     native: "한국어"      },
  { code: "hi", label: "Hindi",      native: "हिन्दी"       },
  { code: "ar", label: "Arabic",     native: "العربية"     },
];

export const EN = {
  // Top-level nav / sections
  chat: "Chat",
  plan: "Plan",
  usage: "Usage",
  keys: "Keys",
  notes: "Notes",
  memory: "Memory",
  integrations: "Integrations",
  preferences: "Preferences",
  settings: "Settings",
  updates: "Updates",
  billing: "Billing",
  account: "Account",

  // Auth
  signIn: "Sign in",
  signOut: "Sign out",
  signUp: "Sign up",
  email: "Email",
  password: "Password",

  // Common actions
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  copy: "Copy",
  send: "Send",
  retry: "Retry",
  close: "Close",
  open: "Open",
  loading: "Loading…",

  // Chat surface
  newChat: "New chat",
  typeMessage: "Type a message",
  speak: "Speak",
  stop: "Stop",
} as const;

export type StringKey = keyof typeof EN;

// Other locales fall back to EN until v0.1.5 ships translations.
// `as const` everywhere so the inferred types stay narrow and
// downstream code can rely on string literal types.
export const ES = EN;
export const FR = EN;
export const DE = EN;
export const JA = EN;
export const ZH = EN;
export const PT = EN;
export const KO = EN;
export const HI = EN;
export const AR = EN;

export const STRINGS = {
  en: EN,
  es: ES,
  fr: FR,
  de: DE,
  ja: JA,
  zh: ZH,
  pt: PT,
  ko: KO,
  hi: HI,
  ar: AR,
} as const;

export type LocaleCode = keyof typeof STRINGS;

// t — tiny lookup helper. Falls back through:
//   requested locale -> EN -> the key itself
// so a missing translation never crashes the UI.
export function t(locale: string, key: StringKey): string {
  const table = (STRINGS as Record<string, typeof EN>)[locale] ?? EN;
  return table[key] ?? EN[key] ?? key;
}
