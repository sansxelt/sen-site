import type { Metadata } from "next";
import "./public-v2.css";
import { ProofConsole } from "./proof-console";
import { RECORDS } from "./fixtures";

export const metadata: Metadata = {
  title: "Vraelis — public site prototype",
  robots: { index: false, follow: false },
};

// The gapped-ring mark: center = the requirement, ring = independent verification, the gap is the signature.
function Mark({ size = 22, dot = "#5CE5D5" }: { size?: number; dot?: string }) {
  const R = 7, C = 2 * Math.PI * R;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r={R} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray={`${C * 0.78} ${C}`} transform="rotate(-108 12 12)" />
      <circle cx="12" cy="12" r="2.1" fill={dot} />
    </svg>
  );
}

export default function PublicV2() {
  return (
    <div className="pv">
      <div className="pv-grid-bg" />

      <header className="pv-nav">
        <nav className="pv-wrap pv-nav-in" aria-label="Primary">
          <a href="#top" className="pv-brand"><Mark />Vraelis</a>
          <div className="pv-nav-links">
            <a href="#verify">Product</a>
            <a href="#records">Proof</a>
            <a href="/rank/how-it-works">Developers</a>
          </div>
          <div className="pv-nav-cta">
            <a href="/rank" className="pv-linkbtn">Sign in</a>
            <a href="/rank" className="pv-linkbtn pv-linkbtn--solid">Verify a deployment</a>
          </div>
        </nav>
      </header>

      <main id="top">
        {/* ── the flagship: the verification instrument IS the hero ── */}
        <section id="verify" className="pv-stage pv-rise">
          <div className="pv-wrap">
            <ProofConsole />
          </div>
        </section>

        {/* ── section two: the same claim, checked three times — the records evolve, none is overwritten ── */}
        <section id="records" className="pv-sec2">
          <div className="pv-wrap">
            <div className="pv-sec2-head pv-rise" data-d="2">
              <span className="pv-eyebrow">The same claim, three deployments</span>
              <h2 className="pv-sec2-h2">It failed, then failed again, then held. All three are kept.</h2>
              <p className="pv-sec2-lead">A coding agent repaired the app between each run. Vraelis checked the live product each time and preserved every result. A later Verified never rewrites an earlier failure.</p>
            </div>

            <div className="pv-lineage">
              {RECORDS.map((r, i) => (
                <div key={r.id} className="pv-lin-rec" data-v={r.conclusion}>
                  {i < RECORDS.length - 1 ? (
                    <span className="pv-lin-repair" aria-hidden>repair →</span>
                  ) : null}
                  <div className="pv-lin-h">
                    <span className="pv-lin-n">record {r.index}</span>
                    <span className="pv-lin-chip" data-v={r.conclusion}>{r.conclusion === "verified" ? "Verified" : "Failed"}</span>
                  </div>
                  <div className="pv-lin-label">{r.label}</div>
                  <p className="pv-lin-out">{r.outcome}</p>
                  <span className="pv-lin-meta">{r.id} · deploy {r.commit}</span>
                </div>
              ))}
            </div>
            <p className="pv-lineage-note">Three separate, preserved historical records — not one status that changed its mind.</p>
          </div>
        </section>

        {/* ── close ── */}
        <section className="pv-foot">
          <div className="pv-wrap">
            <h2 className="pv-foot-h">Stop taking the agent&rsquo;s word for it.</h2>
            <div className="pv-foot-row">
              <a href="/rank" className="pv-foot-cta pv-foot-cta--solid">Verify a deployment</a>
              <a href="#verify" className="pv-foot-cta pv-foot-cta--ghost">Watch the proof again</a>
            </div>
            <div className="pv-foot-meta">
              <span className="pv-brand" style={{ fontSize: 15 }}><Mark size={18} />Vraelis</span>
              <span>prototype · /dev-preview/public-v2 · not the live site</span>
            </div>
            <p className="pv-foot-note">
              Art-direction prototype. The verification replays anonymized fixture data based on a real Vraelis
              production sequence; it is not executing a live customer deployment, and shows no private identifiers,
              URLs, or evidence.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
