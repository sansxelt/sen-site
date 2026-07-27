// Guarantee status -> the warm-neutral verdict tone + label + in-pill mark, reusing the result-page palette so
// a guarantee reads the same vocabulary as every verification surface. Pure + server-safe (no hooks), used by
// both the Systems Guarantees section and the guarantee detail page.
import { Ic, I } from "@/app/rank/_components/icons";
import type { GuaranteeStatus } from "@/lib/preflight/guarantee-status";

type DisplayKey = GuaranteeStatus | "draft";

const TONE: Record<DisplayKey, { fg: string; bg: string; line: string; label: string; mark: string }> = {
  // The labels say "most recently" on purpose. A guarantee reports its LATEST verification and is never a
  // claim of continuous coverage; a bare "Verified" invites reading it as permanent health, which is the one
  // thing this product must never imply.
  verified: { fg: "var(--go-ink)", bg: "var(--go-wash)", line: "var(--go-line)", label: "Verified most recently", mark: I.check },
  // Verified, and it got there by fixing something. Same tone as verified, because it IS verified; the word
  // carries the story, which is the most persuasive thing a guarantee can say.
  reverified: { fg: "var(--go-ink)", bg: "var(--go-wash)", line: "var(--go-line)", label: "Reverified after a failure", mark: I.wrenchCheck },
  // A failure with work under way against it. Waiting rather than stop: something is happening.
  repairing: { fg: "var(--wait-ink)", bg: "var(--wait-wash)", line: "var(--wait-line)", label: "Repair in progress", mark: I.wrench },
  failed: { fg: "var(--stop-ink)", bg: "var(--stop-wash)", line: "var(--stop-line)", label: "Failed most recently", mark: I.x },
  blocked: { fg: "var(--wait-ink)", bg: "var(--wait-wash)", line: "var(--wait-line)", label: "Blocked most recently", mark: I.dash },
  plan_review_required: { fg: "var(--wait-ink)", bg: "var(--wait-wash)", line: "var(--wait-line)", label: "Review required", mark: I.eye },
  checking: { fg: "var(--fg-3)", bg: "var(--bg-2)", line: "var(--line-2)", label: "Checking", mark: I.dash },
  unproven: { fg: "var(--fg-4)", bg: "var(--bg-2)", line: "var(--line-2)", label: "Never verified", mark: I.dash },
  draft: { fg: "var(--fg-4)", bg: "var(--bg-2)", line: "var(--line-2)", label: "Draft", mark: I.dash },
};

// A guarantee with no approved plan reads as "Draft"; otherwise its derived run status. The two never blur.
export function guaranteeDisplayKey(planState: string, status: GuaranteeStatus): DisplayKey {
  return planState === "draft" ? "draft" : status;
}
export function guaranteeTone(key: DisplayKey) { return TONE[key]; }

export function GuaranteeStatusPill({ planState, status, size = 10.5 }: { planState: string; status: GuaranteeStatus; size?: number }) {
  const t = TONE[guaranteeDisplayKey(planState, status)];
  return (
    <span className="pill" style={{ fontSize: size, color: t.fg, background: t.bg, borderColor: t.line, flex: "none" }}>
      <span aria-hidden style={{ display: "inline-flex", marginRight: 3 }}><Ic d={t.mark} size={11} sw={2.4} /></span>{t.label}
    </span>
  );
}
