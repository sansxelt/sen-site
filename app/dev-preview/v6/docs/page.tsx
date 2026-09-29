import type { Metadata } from "next";
import Link from "next/link";
import { v6meta } from "../_system/meta";
import { DocShell } from "../_content/docs-ui";
import { DOCS } from "../_content/docs";
import { V6_BASE } from "@/lib/v6-routes";

const BASE = V6_BASE;
export const metadata: Metadata = v6meta({
  title: "Documentation",
  description: "Use Vraelis: write one sentence about your deployed app, approve the plan, read the decision, and re-check after a fix, from the console, the CLI, the API or an AI assistant.",
  path: "/docs",
});

export default function DocsIndex() {
  return (
    <DocShell>
      <div>
          <p className="v6-eyebrow v6-phero__k">Documentation</p>
          <h1 className="v6-dxl" style={{ marginTop: 12 }}>Use and administer Vraelis.</h1>
          <p className="v6-lead" style={{ marginTop: 16, maxWidth: "58ch" }}>Everything from your first check to re-checking a fix, in the console, the CLI, the API or an AI assistant. Each page has one clear outcome and links to the next step.</p>
          <div className="v6-grid3" style={{ marginTop: "clamp(28px,3vw,40px)" }}>
            {DOCS.map((d) => (
              <Link key={d.slug} href={`${BASE}/docs/${d.slug}`} className="v6-gcard" style={{ textDecoration: "none", display: "block" }}>
                <h2>{d.title}</h2>
                <p>{d.summary}</p>
              </Link>
            ))}
          </div>
      </div>
    </DocShell>
  );
}
