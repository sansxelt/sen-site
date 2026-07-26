import { v6meta } from "../_system/meta";
import { LegalPage, V6_LEGAL_PRIMS } from "../_system/legal";
import { SUBPROCESSORS, SUBPROCESSORS_INTRO, SUBPROCESSORS_UPDATED, SubprocessorsTail } from "@/app/_content/legal";

export const metadata = v6meta({
  title: "Subprocessors",
  description: "The third-party services Vraelis relies on to run the product.",
  path: "/subprocessors",
  type: "website",
});

export default function V6SubprocessorsPage() {
  return (
    <LegalPage title="Subprocessors" updated={SUBPROCESSORS_UPDATED}>
      <p className="v6-lg__p">{SUBPROCESSORS_INTRO}</p>
      <div className="v6-lg__tablewrap">
        <table className="v6-lg__table">
          <thead>
            <tr><th>Subprocessor</th><th>Purpose</th><th>Data</th><th>Region</th></tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name}>
                <td className="v6-lg__tname">{s.name}</td>
                <td>{s.purpose}</td>
                <td>{s.data}</td>
                <td className="v6-lg__treg">{s.region}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SubprocessorsTail {...V6_LEGAL_PRIMS} />
    </LegalPage>
  );
}
