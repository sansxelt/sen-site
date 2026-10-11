import { v8meta } from "../_kit/meta";
import { LegalPage, LegalTable, V8_LEGAL_PRIMS, type LegalCol } from "../_legal/legal";
import { SUBPROCESSORS, SUBPROCESSORS_INTRO, SUBPROCESSORS_UPDATED, SubprocessorsTail } from "@/app/_content/legal";

export const metadata = v8meta({
  title: "Subprocessors",
  description: "The third-party services Vraelis relies on to run the product.",
  path: "/subprocessors",
});

const { P } = V8_LEGAL_PRIMS;

// Four columns: the table keeps to the body's measure. The rows are SUBPROCESSORS, the one list a customer DPA
// refers to; this page only lays it out. Several rows (authentication, balance, subscription billing, sign-on)
// belong to the earlier product, so the page carries the review note above them. The line under the table covers the
// docs assistant, which only the v8 docs have, so it is here and not in the shared list.
const COLS: LegalCol[] = [{ label: "Subprocessor", kind: "name" }, { label: "Purpose" }, { label: "Data" }, { label: "Region", kind: "nowrap" }];

export default function V8SubprocessorsPage() {
  return (
    <LegalPage title="Subprocessors" updated={SUBPROCESSORS_UPDATED} review>
      <P>{SUBPROCESSORS_INTRO}</P>
      <LegalTable label="Subprocessors Vraelis uses" cols={COLS}
        rows={SUBPROCESSORS.map((s) => ({ key: s.name, cells: [s.name, s.purpose, s.data, s.region] }))} />
      <P>Documentation assistant: by default Ask AI on the documentation quotes the docs and uses no AI provider. Only if generated answers are switched on does it send your question, the earlier messages of that conversation and the documentation sections retrieved for it to Anthropic to write the answer. Vraelis does not log the question text.</P>
      <SubprocessorsTail {...V8_LEGAL_PRIMS} />
    </LegalPage>
  );
}
