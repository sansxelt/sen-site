"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { PREVIEW } from "./config";

export function DocNavigation({ docs, slug }: { docs: { slug: string; title: string }[]; slug?: string }) {
  const [query, setQuery] = useState("");
  const id = useId();
  const filtered = docs.filter(d => d.title.toLowerCase().includes(query.trim().toLowerCase()));
  return <><label className="v7-doc-search" htmlFor={id}><span>Find a guide</span><input id={id} type="search" value={query} placeholder="Filter documentation…" onChange={event => setQuery(event.target.value)} /></label><nav aria-label="Documentation">{filtered.map(d => <Link href={`${PREVIEW}/docs/${d.slug}`} key={d.slug} aria-current={slug === d.slug ? "page" : undefined}>{d.title}</Link>)}</nav>{filtered.length === 0 && <p className="v7-doc-search-empty" role="status">No matching guide.</p>}</>;
}

export function CodeBlock({ label, code }: { label?: string; code: string }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(code); setStatus("Copied"); }
    catch { setStatus("Copy unavailable. Select the code below."); }
  }
  return <figure className="v7-doc-code"><figcaption><span>{label ?? "Example"}</span><button type="button" onClick={copy} aria-label="Copy code">Copy</button></figcaption><p className="v7-copy-status" role="status">{status}</p><pre><code>{code}</code></pre></figure>;
}
