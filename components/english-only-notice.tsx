"use client";

// Shown at the top of a legal document when the reader chose another language. The document itself is
// marked [data-no-translate]: the English text is the one that applies, so it is not machine-rendered into
// anything that could be read as binding. This notice is translated like the rest of the page.
import { useLocale } from "@/lib/i18n/client";

export function EnglishOnlyNotice() {
  const locale = useLocale();
  if (locale === "en") return null;
  return (
    <p role="note" style={{
      margin: "0 0 24px", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(10,10,11,0.12)",
      background: "#F7F7F8", color: "#2E2F33", fontSize: 14, lineHeight: 1.5,
    }}>
      This page is available in English only. The English text is the version that applies.
    </p>
  );
}
