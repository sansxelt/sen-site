import { v8meta } from "../_kit/meta";
import { LegalPage, LegalTable, V8_LEGAL_PRIMS, type LegalCol } from "../_legal/legal";
import { CookiesBody, COOKIES_INTRO, COOKIES_UPDATED, STORAGE, type CookieRow } from "@/app/_content/legal";

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

/* v8's view of the shared rows (2026-10-11 audit). The sign-in, console and checkout rows belong to the earlier
   product and are marked so; the theme switch, which only v8 has, adds its own row to the storage table
   (_kit/theme.tsx: session storage on every toggle, local storage only while Preferences are allowed). */
const EARLIER_PRODUCT = new Set([
  "__Secure-authjs.session-token", "__Host-authjs.csrf-token", "__Secure-authjs.callback-url", "__Secure-authjs.pkce.code_verifier",
  "sx_signup_claim", "v_sso_oidc", "vws", "vr_two_step_nudge", "vr_oauth_<provider>, vr_oauth_acct_<provider>, vr_pkce_<provider>, vr_oauth_popup",
  "__stripe_mid, __stripe_sid",
  "vraelis:scratchpad", "vraelis:scratchpad-open, vraelis:scratchpad-view", "vraelis-connect-draft-v1", "vraelis-flow-draft-<id>",
  "vraelis-oauth", "vraelis:balance-before-topup", "__paypal_storage__",
]);
const THEME_ROW: CookieRow = {
  name: "vraelis-theme", setBy: "Website, session and local storage",
  purpose: "The light or dark theme you picked with the theme switch. Kept in session storage when you toggle the theme, and in local storage, so it lasts between visits, only when Preferences are allowed.",
  category: "Preferences", duration: "Session storage: until you close the tab. Local storage: until you clear it or turn Preferences off",
};

function CookieTable(rows: CookieRow[], label: string) {
  const all = rows === STORAGE ? [THEME_ROW, ...rows] : rows;
  return (
    <LegalTable wide label={label} cols={COLS}
      rows={all.map((r) => ({ key: r.name, cells: [r.name, r.setBy, EARLIER_PRODUCT.has(r.name) ? `Earlier product: ${r.purpose}` : r.purpose, r.category, r.duration] }))} />
  );
}

// The shared cookie policy (app/_content/legal.tsx), with its rows drawn as above. Its sign-in, payment and console
// sections belong to the earlier product, so the page carries the review note above them.
export default function V8CookiesPage() {
  return (
    <LegalPage title="Cookies" updated={COOKIES_UPDATED} review>
      <P>{COOKIES_INTRO}</P>
      <CookiesBody {...V8_LEGAL_PRIMS} table={CookieTable} />
    </LegalPage>
  );
}
