// The guarantee's status badge. Pure + server-safe (no hooks), used by both the Systems Guarantees section
// and the guarantee detail page.
//
// THIS FILE USED TO BE A THIRD VOCABULARY, SITTING BETWEEN TWO THAT ALREADY AGREED.
//
// It held a nine-row TONE table of its own: an ink, a wash, a line, a LABEL and a mark for each state. Two
// of those columns were already decided elsewhere and were being restated here by hand:
//
//   THE WORDS. lib/preflight/guarantee-status.ts exports GUARANTEE_STATUS_LABEL and says of it "ONE mapping,
//   so no surface can invent its own vocabulary". This file then wrote the same nine labels out again. They
//   happened to match, which is worse than a mismatch, because it meant nothing would catch the day they
//   stopped: a label edited in lib/ would have kept rendering the old word from here with nothing failing.
//   "Never verified" is that vocabulary's word for a guarantee nothing has proven, and it stays that word;
//   what changes is that this file no longer claims to be the place that decides it.
//
//   THE COLOURS. Every tone here was the go/wait/stop triad, re-derived per row. The same triad is in
//   <Verdict>, which is where the product's badge is drawn, and GUARANTEE_STATUS_LABEL already carries the
//   tone for each status in exactly the union <Verdict> takes. So the two halves fit together with no
//   translation at all, and there is no table left to drift.
//
// DRAFT IS THE ONE THING STILL DECIDED HERE, and deliberately so: it is not a status in that vocabulary and
// must not be rendered as one. A guarantee whose plan has never been approved has not failed, has not been
// blocked and is not "not yet verified" — there is nothing to verify yet, because nobody has said what the
// promise is. It is the absence of a plan, so it renders as the quiet, unsignalled marker it always was.
import { Ic, I } from "@/app/rank/_components/icons";
import { Verdict } from "@/app/rank/_components/verdict";
import { GUARANTEE_STATUS_LABEL, type GuaranteeStatus } from "@/lib/preflight/guarantee-status";

/** A guarantee with no approved plan reads as "Draft"; otherwise its derived run status. The two never blur.
 *  Not exported: the two functions this file used to export beside the table (guaranteeDisplayKey and
 *  guaranteeTone) had one internal caller and none at all, and a dead export is a second public surface to
 *  keep honest. Both call sites take the same two props they always did. */
function guaranteeIsDraft(planState: string): boolean {
  return planState === "draft";
}

export function GuaranteeStatusPill({ planState, status }: { planState: string; status: GuaranteeStatus }) {
  if (guaranteeIsDraft(planState)) {
    return (
      <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-4)", background: "var(--bg-2)", borderColor: "var(--line-2)", flex: "none" }}>
        <span aria-hidden style={{ display: "inline-flex", marginRight: 3 }}><Ic d={I.dash} size={11} sw={2.4} /></span>Draft
      </span>
    );
  }
  // GUARANTEE_STATUS_LABEL is { label, tone } — the exact shape <Verdict> takes — so the status crosses from
  // the module that derives it to the component that draws it with nothing in between to get wrong.
  return <Verdict verdict={GUARANTEE_STATUS_LABEL[status]} style={{ flex: "none" }} />;
}
