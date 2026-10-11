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
// belong to the earlier product, so the page carries the review note above them.
const COLS: LegalCol[] = [{ label: "Subprocessor", kind: "name" }, { label: "Purpose" }, { label: "Data" }, { label: "Region", kind: "nowrap" }];

export default function V8SubprocessorsPage() {
  return (
    <LegalPage title="Subprocessors" updated={SUBPROCESSORS_UPDATED} review>
      <P>{SUBPROCESSORS_INTRO}</P>
      <LegalTable label="Subprocessors Vraelis uses" cols={COLS}
        rows={SUBPROCESSORS.map((s) => ({ key: s.name, cells: [s.name, s.purpose, s.data, s.region] }))} />
      <SubprocessorsTail {...V8_LEGAL_PRIMS} />
    </LegalPage>
  );
}
