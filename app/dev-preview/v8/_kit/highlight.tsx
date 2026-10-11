import { Fragment, type ReactNode } from "react";

// CODE HIGHLIGHTING, shared by the site's code windows (_kit/client.tsx CodeTabs) and the docs' code blocks, which
// render on the server. Not a client module, so a server component can use it without shipping the code twice.
// The colours are the .hl-* classes in v8.css (GitHub dark family, founder 2026-10-10).

/** A shell prompt line reads like a terminal ("$" in the prompt colour, the command bright); JSON keys, strings and
 *  numbers each take their colour; punctuation is dim. */
export function Highlight({ code }: { code: string }) {
  return (
    <>
      {code.split("\n").map((line, i) => {
        const nl = i === 0 ? null : "\n";
        if (line.startsWith("$ ")) return <Fragment key={i}>{nl}<span className="hl-p">$</span> <span className="hl-cmd">{line.slice(2)}</span></Fragment>;
        const out: ReactNode[] = []; let last = 0;
        const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?\b|[{}[\],]/g;
        for (let m = re.exec(line); m; m = re.exec(line)) {
          if (m.index > last) out.push(line.slice(last, m.index));
          const cls = m[1] ? (m[2] ? "hl-k" : "hl-s") : m[3] || /^-?\d/.test(m[0]) ? "hl-n" : "hl-d";
          out.push(<span key={m.index} className={cls}>{m[1] && m[2] ? m[1] : m[0]}</span>);
          if (m[1] && m[2]) out.push(<span key={`${m.index}c`} className="hl-d">{m[2]}</span>);
          last = m.index + m[0].length;
        }
        if (last < line.length) out.push(line.slice(last));
        return <Fragment key={i}>{nl}{out}</Fragment>;
      })}
    </>
  );
}

