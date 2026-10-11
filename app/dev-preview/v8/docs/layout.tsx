import type { ReactNode } from "react";
import { SLUG_TAB, TABS, navModel } from "./_data/pages";
import { assistantMode } from "./_data/assistant-mode";
import { loadDocsHost } from "./_data/host";
import { AskPanel } from "./_ui/ask";
import { DocsFooter } from "./_ui/footer";
import { DocsHeader, DocsSidebar } from "./_ui/header";
import { DocsHostProvider } from "./_ui/host";
import { DocsReveal } from "./_ui/reveal";
import { SearchModal } from "./_ui/search";
import "./docs.css";
import "./assistant.css";

// THE DOCS, ON TWO HOSTS (lib/docs-host.ts), drawn after x.ai's docs. One docs header on both: the main site's header
// and footer step aside on docs paths (_kit/shell.tsx useOnDocs), and on docs.vraelis.com the v8 layout renders only
// the theme script. Then the sidebar (it stays mounted between pages), the page, and the docs footer. Search
// (Ctrl K / Cmd K) and the Ask AI panel are mounted once here, so the shortcut works on every page and a
// conversation survives moving between pages. On the main host this sits inside the v8 layout's <main>; on the docs
// host it draws its own.
//
// data-no-reveal keeps the site's RevealOnRoute off the docs; the docs have their own layered entrance (DocsReveal).
export default async function DocsLayout({ children }: { children: ReactNode }) {
  const main = await loadDocsHost();
  const nav = navModel();
  const docs = (
    <div className="v8-docs" data-no-reveal>
      <div className="v8-docs-shell">
        <aside className="v8-docs-side" aria-label="Documentation navigation"><DocsSidebar nav={nav} slugTab={SLUG_TAB} /></aside>
        <div id="v8-docs-content" className="v8-docs-main" tabIndex={-1}>{children}</div>
      </div>
      <DocsFooter />
      <SearchModal tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} />
      <AskPanel mode={assistantMode()} />
      <DocsReveal />
    </div>
  );
  return (
    <DocsHostProvider main={main}>
      <DocsHeader nav={nav} slugTab={SLUG_TAB} />
      {main ? <main id="v8-main" className="v8-main" tabIndex={-1}>{docs}</main> : docs}
    </DocsHostProvider>
  );
}
