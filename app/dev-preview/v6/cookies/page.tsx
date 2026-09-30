import { v6meta } from "../_system/meta";
import { LegalPage, V6_LEGAL_PRIMS } from "../_system/legal";
import { CookiesBody, COOKIES_INTRO, COOKIES_UPDATED, type CookieRow } from "@/app/_content/legal";

export const metadata = v6meta({
  title: "Cookies",
  description: "Every cookie and item of browser storage Vraelis sets, what each one is for, how long it lasts, and how to change your choice.",
  path: "/cookies",
  type: "website",
});

// Same table as Subprocessors. The wrapper is a focusable, labelled region because on a phone it scrolls
// sideways, and a scroll container a keyboard cannot reach hides its right-hand columns from keyboard users.
function CookieTable(rows: CookieRow[], label: string) {
  return (
    <div className="v6-lg__tablewrap" role="region" aria-label={label} tabIndex={0}>
      <table className="v6-lg__table v6-lg__table--cookies">
        <thead>
          <tr><th>Name</th><th>Set by</th><th>Purpose</th><th>Category</th><th>Duration</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="v6-lg__tcode">{r.name}</td>
              <td>{r.setBy}</td>
              <td>{r.purpose}</td>
              <td className="v6-lg__treg">{r.category}</td>
              <td>{r.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function V6CookiesPage() {
  return (
    <LegalPage title="Cookies" updated={COOKIES_UPDATED}>
      <p className="v6-lg__p">{COOKIES_INTRO}</p>
      <CookiesBody {...V6_LEGAL_PRIMS} table={CookieTable} />
    </LegalPage>
  );
}
