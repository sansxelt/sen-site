import { v6meta } from "../_system/meta";
import { LegalPage, LegalTable, V6_LEGAL_PRIMS, type LegalCol } from "../_system/legal";
import { SUBPROCESSORS, SUBPROCESSORS_INTRO, SUBPROCESSORS_UPDATED, SubprocessorsTail } from "@/app/_content/legal";

export const metadata = v6meta({
  title: "Subprocessors",
  description: "The third-party services Vraelis relies on to run the product.",
  path: "/subprocessors",
  type: "website",
});

// Four columns: the table spans the 720 body (LegalTable, _system/legal.tsx). The rows are SUBPROCESSORS, the one
// list a customer DPA refers to; this page only lays it out.
const COLS: LegalCol[] = [{ label: "Subprocessor", kind: "name" }, { label: "Purpose" }, { label: "Data" }, { label: "Region", kind: "nowrap" }];

export default function V6SubprocessorsPage() {
  return (
    <LegalPage title="Subprocessors" updated={SUBPROCESSORS_UPDATED}>
      <p className="v6-lg__p">{SUBPROCESSORS_INTRO}</p>
      <LegalTable label="Subprocessors Vraelis uses" cols={COLS}
        rows={SUBPROCESSORS.map((s) => ({ key: s.name, cells: [s.name, s.purpose, s.data, s.region] }))} />
      <SubprocessorsTail {...V6_LEGAL_PRIMS} />
    </LegalPage>
  );
}
