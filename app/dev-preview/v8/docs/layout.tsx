import type { ReactNode } from "react";
import { SLUG_TAB, TABS, tabPages } from "./_data/pages";
import { DocsBar } from "./_ui/client";
import { SearchModal } from "./_ui/search";
import "./docs.css";

// The docs live inside the v8 site layout (its header and footer stay). Below the header: the docs bar with the
// three product tabs and the search pill, then each page. The search modal is mounted once here, so Ctrl K and
// Cmd K work on every docs page.
export default function DocsLayout({ children }: { children: ReactNode }) {
  const tabs = TABS.map((t) => ({ id: t.id, label: t.label, to: `/docs/${tabPages(t.id)[0].slug}` }));
  return (
    <div className="v8-docs">
      <DocsBar tabs={tabs} slugTab={SLUG_TAB} />
      {children}
      <SearchModal tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} />
    </div>
  );
}
