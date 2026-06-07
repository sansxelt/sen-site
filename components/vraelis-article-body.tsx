"use client";

// Renders a vraelis article's Markdown body with GFM support, styled by
// the .vra-prose rules in /vraelis/styles.css.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function VraelisArticleBody({ body }: { body: string }) {
  return (
    <div className="vra-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
