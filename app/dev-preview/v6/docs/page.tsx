import type { Metadata } from "next";
import Link from "next/link";
import { v6meta } from "../_system/meta";
import { DocShell } from "../_content/docs-ui";
import { docsByGroup } from "../_content/docs";
import { V6_BASE } from "@/lib/v6-routes";

const BASE = V6_BASE;
export const metadata: Metadata = v6meta({
  title: "Documentation",
  description: "Use Vraelis: write one sentence about your deployed app, approve the plan, read the decision, and re-check after a fix, from the console, the CLI, the API or an AI assistant.",
  path: "/docs",
});

// The docs home: what the docs cover, then every page under its group with its one-line summary. It was a
// grid of equal cards, which read as a marketing section and hid the order the pages are meant to be read in.
export default function DocsIndex() {
  return (
    <DocShell crumb={["Documentation", "Overview"]}>
      <div className="v6-docs__article v6-prose">
        <h1>Vraelis documentation</h1>
        <p className="v6-docs__lead">Everything from your first check to re-checking a fix, in the console, the CLI, the API or an AI assistant. Each page has one outcome and says what it does not do.</p>
        {docsByGroup().map((g) => (
          <section key={g.group} className="v6-docs__index">
            <h2 id={g.group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}>{g.group}</h2>
            <div role="list">
              {g.docs.map((d) => (
                <Link key={d.slug} role="listitem" href={`${BASE}/docs/${d.slug}`} className="v6-docs__row">
                  <span className="t">{d.title}</span>
                  <span className="s">{d.summary}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </DocShell>
  );
}
