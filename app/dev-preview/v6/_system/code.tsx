// Code blocks for design 06, shared by the product pages (/developers, /agents, /integrations).
//
// These lived inside developers/page.tsx while it was the only page that showed a command. /agents became
// the setup guide the CLI's `vraelis init` links to, and a setup guide is mostly commands and config, so the
// block moved here rather than being copied: two copies of a tokenizer drift the same way two copies of any
// claim do. Server-rendered, no state. The copy button is wired once per page by <CopyScript />.
//
// THE BLOCK IS REFERENCE MATERIAL (plan 0.3 and A5): .v6-code, styled in pagekit.css, a 40px bar with the
// language in mono 12 and a 28px ghost Copy button that reads "Copied" for 1.6 s. The translator never touches
// what is inside pre and code, and the language label is machine text; the two button words are translated,
// and "Copied", which only appears after a click, is seeded once per page by CopyScript so the crawl finds it.

import { CopyWiring } from "./copy-wiring";

// A char-exact tokenizer: the final [\s\S] alternative matches every remaining character, so the rendered
// text always equals the source byte for byte and the copy button returns exactly what is shown.
type Seg = string | [string, string];

const RE: Record<string, RegExp> = {
  // A bare URL is one plain token, matched before the command words, so the "vraelis" in
  // https://vraelis.com/install is not set as a command.
  bash: /#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\B--?[A-Za-z][\w-]*|https?:\/\/[^\s"'|\\]+|\b(?:curl|export|npx|vraelis|uuidgen|claude|codex|gemini|irm|iex|sh)\b|[\s\S]/g,
  json: /"(?:[^"\\]|\\.)*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?|[\s\S]/g,
  js: /\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(?:import|from|const|let|await|async|for|switch|case|default|return|new|function|process|Boolean|Buffer)\b|[\s\S]/g,
  // A request as it goes over the wire: the request line, header names at the start of a line, then a JSON body.
  http: /^[A-Za-z][\w-]*(?=:\s)|"(?:[^"\\]|\\.)*"|\b(?:POST|GET|true|false|null)\b|\b\d+(?:\.\d+)?\b|[\s\S]/gm,
};

function highlight(lang: string, src: string): Seg[] {
  const re = RE[lang];
  if (!re) return [src];
  const out: Seg[] = [];
  const push = (t: string, c?: string) => {
    if (c) out.push([t, c]);
    else if (typeof out[out.length - 1] === "string") out[out.length - 1] = (out[out.length - 1] as string) + t;
    else out.push(t);
  };
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const t = m[0];
    const first = t[0];
    if (lang === "json") {
      if (first === '"') {
        let k = re.lastIndex;
        while (src[k] === " " || src[k] === "\t") k++;
        push(t, src[k] === ":" ? "p" : "s");
      } else if (/^(?:true|false|null|-?\d)/.test(t)) push(t, "k");
      else push(t);
    } else if (lang === "http") {
      if (first === '"') {
        let k = re.lastIndex;
        while (src[k] === " " || src[k] === "\t") k++;
        push(t, src[k] === ":" ? "p" : "s");
      } else if (t.length > 1 && /^[A-Za-z]/.test(t) && src[re.lastIndex] === ":") push(t, "p");
      // a digit inside a word (sha256) arrives one character at a time and stays plain
      else if (/^(?:POST|GET|true|false|null)$/.test(t) || (/^\d/.test(t) && !/\w/.test(src[m.index - 1] ?? ""))) push(t, "k");
      else push(t);
    } else {
      if (/^https?:\/\//.test(t)) push(t);
      else if (first === "#" || (first === "/" && t[1] === "/")) push(t, "c");
      else if (first === '"' || first === "'" || first === "`") push(t, "s");
      else if (first === "-") push(t, "p");
      else if (/^[A-Za-z]/.test(t) && t.length > 1) push(t, "k");
      else push(t);
    }
  }
  return out;
}

export function Code({ lang, src }: { lang: string; src: string }) {
  const segs = highlight(lang, src.replace(/\n+$/, ""));
  return (
    <div className="v6-code">
      <div className="v6-code__bar">
        <span className="v6-code__lang" data-no-translate>{lang}</span>
        {/* A 28px ghost (plan A5). Colour and border read two custom properties so a stylesheet can light them on
            hover (hero-asides.css) without fighting these inline values; the fallbacks are the resting look. */}
        <button
          type="button"
          data-v6-copy
          aria-label={`Copy ${lang} snippet`}
          style={{
            fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, lineHeight: 1,
            color: "var(--v6-copy-c, var(--ink-3))", background: "transparent",
            border: "1px solid var(--v6-copy-b, var(--line-strong))",
            borderRadius: 6, padding: "0 10px", height: 28, minWidth: 28, cursor: "pointer",
            transition: "color 160ms var(--ease-out), border-color 160ms var(--ease-out)",
          }}
        >
          Copy
        </button>
      </div>
      {/* tabIndex so keyboard users can scroll a line wider than the block (axe scrollable-region-focusable). */}
      <pre tabIndex={0}><code>{segs.map((s, i) => (typeof s === "string" ? s : <span key={i} className={s[1]}>{s[0]}</span>))}</code></pre>
    </div>
  );
}

// The copy wiring, rendered once per page: the click handler (CopyWiring, a client effect, so it also runs after a
// client-side navigation) and a hidden seed that puts "Copy" and "Copied" in the page once, where the translation
// crawl can collect them (plan 0.6).
export function CopyScript() {
  return (
    <>
      <CopyWiring />
      <div hidden data-i18n-seed>
        <span>Copy</span>
        <span>Copied</span>
      </div>
    </>
  );
}
