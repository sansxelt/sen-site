import { v6meta } from "../_system/meta";
import { LegalPage, LegalTable, V6_LEGAL_PRIMS, type LegalCol } from "../_system/legal";
import { CookiesBody, COOKIES_INTRO, COOKIES_UPDATED, type CookieRow } from "@/app/_content/legal";

export const metadata = v6meta({
  title: "Cookies",
  description: "Every cookie and item of browser storage Vraelis sets, what each one is for, how long it lasts, and how to change your choice.",
  path: "/cookies",
  type: "website",
});

// Five columns, so the table breaks out to 960 beside the contents list where the page has the room, and each
// row stands as its own block on a phone (LegalTable, _system/legal.tsx).
const COLS: LegalCol[] = [
  { label: "Name", kind: "code" }, { label: "Set by", kind: "short" }, { label: "Purpose" }, { label: "Category", kind: "nowrap" }, { label: "Duration", kind: "short" },
];

function CookieTable(rows: CookieRow[], label: string) {
  return (
    <LegalTable wide label={label} cols={COLS}
      rows={rows.map((r) => ({ key: r.name, cells: [r.name, r.setBy, r.purpose, r.category, r.duration] }))} />
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
