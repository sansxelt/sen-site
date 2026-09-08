// ONE PAGE HEADER, BECAUSE THERE WERE SIX.
//
// Clicking down the sidebar made the title change size and the content column change width on almost every
// step. Measured across app/rank/app before this existed:
//
//   SIX h1 SIZES. 32px at tracking -0.022em (Account, Records, Developers, Billing, Credits, Organization,
//   Team, Plans), 32px at -0.025em (Usage, Limits, Guarantees, Review, Command line, Key detail), 38.4px
//   (Integrations, Deployments, Verifications, Systems, Issues, and every /systems/[id] page), 31.2px
//   (the Overview), 41.6 and 44.8px (Checkout, the signed-out Overview) and 22px at weight 700 (API
//   runtime). Weight varied too: .display is 600 and two pages hardcoded 700.
//
//   FIFTEEN CONTENT WIDTHS. 520, 640, 720, 820, 860, 880, 900, 940, 960, 1000, 1080, 1100, 1180, 1240 and
//   1280, each hardcoded onto its own page. The left edge of the content moved on nearly every navigation.
//
//   TWO THINGS BOTH CALLED "EYEBROW". The .eyebrow class is 13px Geist, weight 600, sentence case. A local
//   `const eyebrow` object in connections/page.tsx and credits/page.tsx is 10.5px Inter Tight, uppercase,
//   0.08em tracked. Billing rendered the class and Integrations rendered the object, so the identical word
//   in the identical position on two adjacent sidebar pages appeared in two typefaces, sizes and cases.
//   credits/page.tsx used BOTH, twenty lines apart.
//
//   MARGINS below the h1 spanned 0, "0 0 8px", "0 0 10px", "6px 0 10px", "4px 0 8px", "12px 0 10px" and
//   "8px 0 6px".
//
// None of that was intent. It is what happens when 108 files each hand-roll the same three elements. This
// component is the one place those decisions are made, so a page states WHAT it is called and not how big
// the words should be.
//
// A NOTE ON TOP PADDING, because it wastes an hour otherwise: rank-ui.tsx injects
// `.rank-root .app-main>.wrap { padding-top: clamp(12px,1.6vw,20px) !important }`. Sixty-one pages carry an
// inline paddingTop that therefore never renders. Do not add another one here; the shell owns it.
import type { ReactNode } from "react";

/** TWO measures, not fifteen.
 *
 *  `wide` is for lists, tables and evidence, which need the room. `prose` is for settings, forms and
 *  anything read as sentences, where a long line is harder to read rather than more generous. A page
 *  choosing between two named intentions is a decision; a page typing 940 is a coincidence. */
const MEASURE = { wide: 1240, prose: 820 } as const;
export type Measure = keyof typeof MEASURE;

export function Page({ measure = "wide", children }: { measure?: Measure; children: ReactNode }) {
  // .wrap carries the responsive gutter and the shell's top padding. maxWidth is set here rather than in
  // the stylesheet because it is the one thing that legitimately differs between the two measures.
  return <div className="wrap" style={{ maxWidth: MEASURE[measure] }}>{children}</div>;
}

export function PageHeader({
  eyebrow, title, lead, actions,
}: {
  /** The group this page belongs to, in the sidebar's own words. Rendered with the .eyebrow CLASS, which
   *  is the only correct one; the 10.5px uppercase local objects are the drift, not the standard. */
  eyebrow?: string;
  title: ReactNode;
  /** One sentence under the title. Optional, and genuinely optional: a page with nothing useful to add
   *  here should add nothing rather than restate its own name. */
  lead?: ReactNode;
  /** Buttons or links that act on the whole page. They sit on the title's baseline on a wide screen and
   *  wrap underneath it on a narrow one. */
  actions?: ReactNode;
}) {
  return (
    <header className="phead" style={{ marginBottom: "clamp(18px, 2.4vw, 28px)" }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow ? <p className="eyebrow eyebrow--mut">{eyebrow}</p> : null}
        {/* ONE size, ONE weight, ONE tracking, set by .display and .phead h1 together. A page that wants a
            different size wants a different component. */}
        <h1 className="display" style={{ margin: 0 }}>{title}</h1>
        {lead ? <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.55, color: "var(--fg-3)", maxWidth: "62ch" }}>{lead}</p> : null}
      </div>
      {actions ? <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>{actions}</div> : null}
    </header>
  );
}
