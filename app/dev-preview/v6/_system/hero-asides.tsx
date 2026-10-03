// Public reference text and links. Hero imagery lives in _content/photography.ts.
import type { ReactNode } from "react";
import { V6_BASE } from "@/lib/v6-routes";
import { EditorialLink } from "./ui";
import "./hero-asides.css";

export const WAYS_IN = [
  { key: "console", name: "Console", who: "When you want to see it",
    more: "Name the deployed app and write one sentence about what should work. Read the answer with its screenshots and every step.",
    entry: "app.vraelis.com", docs: `${V6_BASE}/docs/getting-started` },
  { key: "cli", name: "CLI", who: "From a terminal",
    more: "Prints the plan and the approval link, waits, then runs the check. Exits 0 only when the claim held.",
    entry: "vraelis verify", docs: `${V6_BASE}/docs/cli` },
  { key: "api", name: "CI and the API", who: "From a pipeline",
    more: "Send a deployment and a claim from a pipeline, read the answer, and gate the release on it. Re-check the same plan after a fix.",
    entry: "POST /api/v1/verifications", docs: `${V6_BASE}/docs/api` },
  { key: "mcp", name: "AI assistants, over MCP", who: "From the assistant that made the change",
    more: "Coding assistants run the local server and ask for a check before they say a change is done. ChatGPT and Claude connect to the hosted one.",
    entry: "vraelis_verify", docs: `${V6_BASE}/docs/ai-assistants` },
] as const;

export function ProductPanel({ left, right, caption, children }: {
  left?: ReactNode; right?: ReactNode; caption?: ReactNode; crop?: number; children: ReactNode;
}) {
  return <div className="v6-reference" data-panel="">
    {left || right ? <p className="v6-reference__label">{left ? <span data-no-translate>{left}</span> : null}{right ? <span>{right}</span> : null}</p> : null}
    <div className="v6-reference__body">{children}</div>
    {caption ? <p className="v6-reference__caption">{caption}</p> : null}
  </div>;
}

/** The one line a product page gives its limits (plan A9, T1 step 6): a whole sentence, then the link after it,
 *  never inside it (the translator keys on whole sentences). */
export function LimitsLine({ text, label = "Read the limitations" }: { text: string; label?: string }) {
  return (
    <section className="v6-sec ha-limits">
      <div className="v6-wrap">
        <div className="ha-limits__row">
          <p className="ha-limits__t">{text}</p>
          <EditorialLink href={`${V6_BASE}/limitations`}>{label}</EditorialLink>
        </div>
      </div>
    </section>
  );
}
