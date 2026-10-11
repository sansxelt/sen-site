import type { ReactNode } from "react";
import { SLUG_TAB, TABS, tabPages } from "./_data/pages";
import { assistantMode } from "./_data/assistant-mode";
import { loadDocsHost } from "./_data/host";
import { AskPanel } from "./_ui/ask";
import { DocsBar } from "./_ui/client";
import { DocsHostFooter, DocsHostHeader, DocsHostProvider } from "./_ui/host";
import { SearchModal } from "./_ui/search";
import "./docs.css";
import "./assistant.css";

// The docs, on two hosts (lib/docs-host.ts). On the main host they live inside the v8 site layout (its header and
// footer stay) at /dev-preview/v8/docs. On docs.vraelis.com the v8 layout steps aside and the docs draw their own
// header, with the way back to the main site, and a short footer. Below the header on both: the docs bar with the
// three sections, search and Ask AI, then each page. The search modal and the Ask AI panel are mounted once here,
// so Ctrl K and Cmd K work on every docs page and a conversation survives moving between pages.
export default async function DocsLayout({ children }: { children: ReactNode }) {
  const main = await loadDocsHost();
  const tabs = TABS.map((t) => ({ id: t.id, label: t.label, to: `/docs/${tabPages(t.id)[0].slug}` }));
  const docs = (
    <div className="v8-docs">
      <DocsBar tabs={tabs} slugTab={SLUG_TAB} />
      {children}
      <SearchModal tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} />
      <AskPanel mode={assistantMode()} />
    </div>
  );
  return (
    <DocsHostProvider main={main}>
      {main ? (
        <>
          <DocsHostHeader main={main} />
          <main id="v8-main" className="v8-main" tabIndex={-1}>{docs}</main>
          <DocsHostFooter main={main} />
        </>
      ) : docs}
    </DocsHostProvider>
  );
}
