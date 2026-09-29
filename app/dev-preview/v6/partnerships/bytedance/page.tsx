import { v6meta } from "../../_system/meta";
import { MARK_PATH, MARK_VIEWBOX } from "@/lib/brand-mark";
import "../reddit/partnership.css";
import "./bytedance.css";

// Official partnership record, in the same form as Reddit's. ByteDance's AI partnerships team first reached out
// on 2026-08-17 about its Seed models; the partnership is now official.
export const metadata = v6meta({
  title: "ByteDance partnership",
  description:
    "The public record of Vraelis's 2026 partnership with ByteDance, the company behind TikTok, centred on its Seed model family.",
  path: "/partnerships/bytedance",
  type: "website",
  ogTitle: "Vraelis × ByteDance",
  ogDescription: "A 2026 partnership with ByteDance, the company behind TikTok, centred on its Seed models.",
});

function VraelisMark() {
  return <svg viewBox={MARK_VIEWBOX} role="img" aria-label="Vraelis"><path d={MARK_PATH} fill="currentColor" /></svg>;
}

function ByteDanceMark() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="ByteDance">
      <rect x="8" y="22" width="9" height="30" rx="2" fill="currentColor" />
      <rect x="21" y="30" width="9" height="22" rx="2" fill="currentColor" opacity=".8" />
      <rect x="34" y="14" width="9" height="38" rx="2" fill="currentColor" />
      <rect x="47" y="10" width="9" height="42" rx="2" fill="currentColor" opacity=".8" />
    </svg>
  );
}

export default function ByteDancePartnershipPage() {
  return (
    <main className="v6-pr v6-pr--long" data-nav-dark data-nav-theme="dark">
      <div className="v6-pr__wrap">
        <header className="v6-pr__mast">
          <p className="v6-pr__index">Partnership record</p>
          <p className="v6-pr__date">September 27, 2026</p>
        </header>

        <section className="v6-pr__hero" aria-labelledby="partnership-title">
          <div className="v6-pr__identity">
            <div className="v6-pr__marks" aria-label="Vraelis and ByteDance">
              <span><VraelisMark /></span>
              <i aria-hidden="true">×</i>
              <span><ByteDanceMark /></span>
            </div>
            <h1 id="partnership-title">Vraelis <span>×</span><br />ByteDance</h1>
          </div>

          <div className="v6-pr__story">
            <p className="v6-pr__overline">AI models, from the company behind TikTok</p>
            <h2>A partnership around the models underneath.</h2>
            <p>
              ByteDance, the company behind TikTok, first reached out to Vraelis through its AI partnerships team
              on August 17, 2026, about its Seedream, Seedance and Seed LLM models. Vraelis and ByteDance are now
              official partners.
            </p>
            {/* ONE FACTUAL LINE, added 2026-09-28 and nothing more: Trae, ByteDance's AI coding editor, is one of
                the assistants `vraelis init` supports over MCP. It is not a claim about the partnership's scope
                and says nothing about endorsement, testing or any other ByteDance product. */}
            <p>Vraelis connects to Trae, ByteDance&rsquo;s AI coding editor, over MCP.</p>
            <div className="v6-pr__links" aria-label="Partnership links">
              <a href="https://www.bytedance.com/en/" target="_blank" rel="noopener noreferrer">Visit ByteDance <span aria-hidden="true">↗</span></a>
              <a href="https://seed.bytedance.com/en/" target="_blank" rel="noopener noreferrer">ByteDance Seed <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
