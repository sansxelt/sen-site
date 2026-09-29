// Code blocks for design 06, shared by /developers and /agents.
//
// These lived inside developers/page.tsx while it was the only page that showed a command. /agents became
// the setup guide the CLI's `vraelis init` links to, and a setup guide is mostly commands and config, so the
// block moved here rather than being copied: two copies of a tokenizer drift the same way two copies of any
// claim do. Server-rendered, no state. The copy button is wired once per page by <CopyScript />.

// A char-exact tokenizer: the final [\s\S] alternative matches every remaining character, so the rendered
// text always equals the source byte for byte and the copy button returns exactly what is shown.
type Seg = string | [string, string];

const RE: Record<string, RegExp> = {
  bash: /#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\B--?[A-Za-z][\w-]*|\b(?:curl|export|npx|vraelis|uuidgen|claude|codex|gemini|irm|iex|sh)\b|[\s\S]/g,
  json: /"(?:[^"\\]|\\.)*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?|[\s\S]/g,
  js: /\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(?:import|from|const|let|await|async|for|switch|case|default|return|new|function|process|Boolean|Buffer)\b|[\s\S]/g,
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
    } else {
      if (first === "#" || (first === "/" && t[1] === "/")) push(t, "c");
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
        <span className="v6-code__lang">{lang}</span>
        <button
          type="button"
          data-v6-copy
          aria-label={`Copy ${lang} snippet`}
          style={{
            fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--g-fg-3)", background: "transparent", border: "1px solid var(--g-line)",
            borderRadius: 6, padding: "4px 11px", minHeight: 28, cursor: "pointer",
          }}
        >
          Copy
        </button>
      </div>
      <pre><code>{segs.map((s, i) => (typeof s === "string" ? s : <span key={i} className={s[1]}>{s[0]}</span>))}</code></pre>
    </div>
  );
}

// Delegated, idempotent copy wiring. Rendered once per page. Reads the block's rendered text (which equals
// the source exactly) and writes it to the clipboard; falls back to execCommand where the async API is absent.
export function CopyScript() {
  const js =
    "(function(){if(window.__v6copy)return;window.__v6copy=1;" +
    "document.addEventListener('click',function(e){" +
    "var t=e.target;var b=t&&t.closest&&t.closest('[data-v6-copy]');if(!b)return;" +
    "var box=b.closest('.v6-code');if(!box)return;var code=box.querySelector('code');if(!code)return;" +
    "var text=code.innerText;var prev=b.getAttribute('data-label')||b.textContent;b.setAttribute('data-label',prev);" +
    "var done=function(){b.textContent='Copied';setTimeout(function(){b.textContent=prev;},1400);};" +
    "if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done).catch(function(){});}" +
    "else{try{var a=document.createElement('textarea');a.value=text;a.setAttribute('readonly','');a.style.position='absolute';a.style.left='-9999px';document.body.appendChild(a);a.select();document.execCommand('copy');document.body.removeChild(a);done();}catch(_){}}" +
    "});})();";
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
