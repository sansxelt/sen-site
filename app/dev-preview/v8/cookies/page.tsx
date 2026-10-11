import { v8meta } from "../_kit/meta";
import { LegalPage, LegalTable, V8_LEGAL_PRIMS, type LegalCol } from "../_legal/legal";
import { CookiesBody, COOKIES_INTRO, COOKIES_UPDATED, type CookieRow } from "@/app/_content/legal";

export const metadata = v8meta({
  title: "Cookies",
  description: "Every cookie and item of browser storage Vraelis sets, what each one is for, how long it lasts, and how to change your choice.",
  path: "/cookies",
});

const { P } = V8_LEGAL_PRIMS;

// Five columns, so the table reaches past the 68ch measure where the page has the room, and each row stands as
// its own block on a phone (LegalTable, _legal/legal.tsx).
const COLS: LegalCol[] = [
  { label: "Name", kind: "code" }, { label: "Set by", kind: "short" }, { label: "Purpose" }, { label: "Category", kind: "nowrap" }, { label: "Duration", kind: "short" },
];

function CookieTable(rows: CookieRow[], label: string) {
  return (
    <LegalTable wide label={label} cols={COLS}
      rows={rows.map((r) => ({ key: r.name, cells: [r.name, r.setBy, r.purpose, r.category, r.duration] }))} />
  );
}

// The shared cookie policy (app/_content/legal.tsx), unchanged. Its sign-in, payment and console rows belong to
// the earlier product, so the page carries the review note above them.
export default function V8CookiesPage() {
  return (
    <LegalPage title="Cookies" updated={COOKIES_UPDATED} review>
      <P>{COOKIES_INTRO}</P>
      <CookiesBody {...V8_LEGAL_PRIMS} table={CookieTable} />
    </LegalPage>
  );
}
