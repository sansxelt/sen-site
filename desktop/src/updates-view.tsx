import { useEffect, useState } from "react";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { API_BASE, type DesktopSession } from "./auth";

// v0.1.13 \u2014 fetched from /api/desktop/releases on mount so the desktop
// Updates view stays in sync with the canonical changelog in
// lib/desktop-release.ts. Used to be a hardcoded list that was stuck
// at v0.1.4 forever \u2014 now ships release notes without rebuilding.
type ReleaseChangeType = "new" | "fix" | "improve";
type Release = {
  version: string;
  dateLabel: string;
  dateIso: string;
  channel: "stable" | "beta" | "alpha";
  summary: string;
  changes: Array<{ type: ReleaseChangeType; text: string }>;
};
type ReleasesResponse = {
  currentCodeVersion: string;
  latestShippedVersion: string;
  nextVersion: string;
  nextVersionHighlights: string[];
  releases: Release[];
};

export function DesktopUpdatesView({ session: _session }: { session: DesktopSession }) {
  const [data, setData] = useState<ReleasesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // v0.1.14 \u2014 Use tauriFetch (Tauri HTTP plugin) so the request
        // bypasses the WebView2 CORS gate. Regular fetch from
        // tauri://localhost to https://vraelis.ai was failing with
        // "Failed to fetch" because the route doesn't return
        // Access-Control-Allow-Origin headers.
        const res = await tauriFetch(`${API_BASE}/api/desktop/releases`);
        if (!res.ok) throw new Error(`releases ${res.status}`);
        const body = (await res.json()) as ReleasesResponse;
        if (!cancelled) setData(body);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load updates.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="view view--updates">
      <div className="view-head">
        <h1>Updates</h1>
        <p>What&rsquo;s new in Vraelis.</p>
      </div>

      <div className="view-body">
        {error && (
          <div className="view-error">Couldn&rsquo;t load release notes &mdash; {error}</div>
        )}

        {data && (
          <>
            {data.nextVersionHighlights.length > 0 && (
              <div className="update-card update-card--next">
                <div className="update-card-head">
                  <span className="update-card-version">v{data.nextVersion}</span>
                  <span className="update-card-date">In progress</span>
                  <span className="update-card-tag">Next</span>
                </div>
                <ul className="update-card-changes">
                  {data.nextVersionHighlights.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="updates-list">
              {data.releases.map((rel, idx) => {
                const isLatest = rel.version === data.latestShippedVersion;
                return (
                  <div
                    key={rel.version}
                    className={`update-card${isLatest || idx === 0 ? " update-card--highlight" : ""}`}
                  >
                    <div className="update-card-head">
                      <span className="update-card-version">v{rel.version}</span>
                      <span className="update-card-date">{rel.dateLabel}</span>
                      {isLatest && <span className="update-card-tag">Latest</span>}
                      {!isLatest && idx === 0 && (
                        <span className="update-card-tag">Code &mdash; build pending</span>
                      )}
                    </div>
                    {rel.summary && (
                      <p className="update-card-summary">{rel.summary}</p>
                    )}
                    <ul className="update-card-changes">
                      {rel.changes.map((c, i) => (
                        <li key={i}>
                          <span className={`update-card-tag-inline update-card-tag-inline--${c.type}`}>
                            {c.type}
                          </span>
                          {c.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!data && !error && (
          <div className="view-loading">Loading release notes\u2026</div>
        )}
      </div>
    </div>
  );
}
