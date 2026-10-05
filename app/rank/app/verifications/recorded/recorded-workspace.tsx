"use client";
import dynamic from "next/dynamic";
import type { McapInspection, McapMapping } from "@/lib/recorded-verification/mcap";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { evaluateRecording, parseRecording, MAX_RECORDING_BYTES, type Recording, type Requirement, type Evaluation, type Finding } from "@/lib/recorded-verification/evaluate";
import { EXAMPLE_REQUIREMENT, exampleRecording } from "@/lib/recorded-verification/examples";

const McapReview = dynamic(() => import("./mcap-review").then(m => m.McapReview), { loading: () => <p>Opening source mapping…</p> });
type Loaded = { recording: Recording; raw: string; name: string; example: boolean; bytes?: Uint8Array; mapping?: McapMapping };
type Result = { loaded: Loaded; evaluation: Evaluation };
const LABEL: Record<Finding["verdict"], string> = { passed: "Criteria met", failed: "Mismatch found", inconclusive: "Not enough evidence" };
const SOURCE = { control: "Control interface", service: "Service", device: "Device report" };
function bytesToBase64(bytes: Uint8Array): string {
  let text = ""; for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode(...bytes.subarray(i, i + 16384)); return btoa(text);
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fingerprint = (r: Requirement) => JSON.stringify({ ...r, untouchedAssetIds: [...r.untouchedAssetIds].sort() });
export function RecordedWorkspace() {
  const [pendingMcap, setPendingMcap] = useState<{ inspection: McapInspection; bytes: Uint8Array; name: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [asset, setAsset] = useState(""); const [task, setTask] = useState("");
  const [seconds, setSeconds] = useState("10"); const [untouched, setUntouched] = useState("");
  const [approved, setApproved] = useState(false); const [result, setResult] = useState<Result | null>(null);
  const [baseline, setBaseline] = useState<Result | null>(null); const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null); const [tab, setTab] = useState<"findings" | "events" | "comparison">("findings");
  const [fullscreen, setFullscreen] = useState(false); const [exporting, setExporting] = useState(false);
  const root = useRef<HTMLDivElement>(null); const file = useRef<HTMLInputElement>(null); const importSequence = useRef(0);
  useEffect(() => { const changed = () => setFullscreen(document.fullscreenElement === root.current); document.addEventListener("fullscreenchange", changed); return () => document.removeEventListener("fullscreenchange", changed); }, []);
  function criteriaChanged() { setApproved(false); setResult(null); setSelected(null); }
  function load(raw: string, name: string, example = false) {
    importSequence.current++; setPendingMcap(null); setImporting(false);
    try {
      const recording = parseRecording(raw); const request = recording.events.find(e => e.source === "control" && e.state === "requested");
      setLoaded({ recording, raw, name, example }); setAsset(request?.assetId ?? ""); setTask(request?.taskId ?? "");
      if (example) { setSeconds(String(EXAMPLE_REQUIREMENT.completionWithinMs / 1000)); setUntouched(EXAMPLE_REQUIREMENT.untouchedAssetIds.join(", ")); }
      else setUntouched("");
      setApproved(false); setResult(null); setSelected(null); setTab("findings"); setError("");
    } catch (e) { setLoaded(null); setResult(null); setApproved(false); setSelected(null); setError(e instanceof Error ? e.message : "The recording could not be read."); }
  }
  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const sequence = ++importSequence.current;
    setLoaded(null); setResult(null); setApproved(false); setPendingMcap(null); setSelected(null); setError(""); setImporting(true);
    try {
      const isMcap = f.name.toLowerCase().endsWith(".mcap");
      if (f.size > (isMcap ? 5_000_000 : MAX_RECORDING_BYTES)) throw new Error(isMcap ? "MCAP files can be up to 5 MB." : "JSON recordings can be up to 1 MB.");
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (isMcap) {
        const { inspectMcap } = await import("@/lib/recorded-verification/mcap");
        if (sequence !== importSequence.current) return;
        const inspection = inspectMcap(bytes); setPendingMcap({ inspection, bytes, name: f.name });
      } else {
        const raw = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
        if (sequence === importSequence.current) load(raw, f.name);
      }
    } catch (e) { if (sequence === importSequence.current) setError(e instanceof Error ? e.message : "The recording could not be read."); }
    finally { if (sequence === importSequence.current) setImporting(false); }
  }
  function applyMcap(recording: Recording, mapping: McapMapping) {
    if (!pendingMcap) return;
    const original = pendingMcap;
    load(JSON.stringify(recording), original.name);
    setLoaded({ recording, raw: JSON.stringify(recording), name: original.name, example: false, bytes: original.bytes, mapping });
  }

  function run() {
    if (!loaded || !approved) return;
    try {
      const requirement: Requirement = { assetId: asset.trim(), taskId: task.trim(), completionWithinMs: Number(seconds) * 1000, untouchedAssetIds: untouched.split(",").map(x => x.trim()).filter(Boolean) };
      const evaluation = evaluateRecording(loaded.recording, requirement);
      setResult({ loaded, evaluation }); setSelected(evaluation.findings.find(f => f.verdict !== "passed")?.id ?? evaluation.findings[0]?.id ?? null); setTab("findings"); setError("");
      if (window.innerWidth <= 800) requestAnimationFrame(() => root.current?.querySelector(".rv-result-head")?.scrollIntoView({ block: "start" }));
    } catch (e) { setError(e instanceof Error ? e.message : "The criteria could not be evaluated."); }
  }
  function useBaselineCriteria() {
    if (!baseline) return;
    const r = baseline.evaluation.requirement; setAsset(r.assetId); setTask(r.taskId); setSeconds(String(r.completionWithinMs / 1000)); setUntouched(r.untouchedAssetIds.join(", ")); criteriaChanged(); setError("");
  }
  async function exportReport() {
    if (!result) return;
    setExporting(true);
    try {
      const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(result.loaded.bytes ?? new TextEncoder().encode(result.loaded.raw)));
      download("vraelis-recorded-verification.json", { reportVersion: 1, recordedLocallyAt: new Date().toISOString(), recordingName: result.loaded.name, simulationExample: result.loaded.example, sourceSha256: Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join(""), scope: "Reported task states in this supplied JSON recording. Coverage and clock are declared by its author; physical behavior and authenticity are not established.", evaluation: result.evaluation, recording: result.loaded.recording, sourceRawJson: result.loaded.bytes ? undefined : result.loaded.raw, sourceMcapBase64: result.loaded.bytes ? bytesToBase64(result.loaded.bytes) : undefined, sourceFormat: result.loaded.bytes ? "mcap" : "json", mapping: result.loaded.mapping });
    } catch { setError("Export failed. Try again in a browser that supports secure file exports."); } finally { setExporting(false); }
  }
  async function toggleFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (root.current?.requestFullscreen) await root.current.requestFullscreen(); else setError("This browser does not support full screen. The workspace still adapts to your screen."); } catch { setError("Full screen is unavailable in this browser."); }
  }
  const recording = loaded?.recording; const evaluation = result?.evaluation;
  const finding = evaluation?.findings.find(f => f.id === selected);
  const matchingCriteria = baseline && result && fingerprint(baseline.evaluation.requirement) === fingerprint(result.evaluation.requirement);
  const evidenceIds = new Set(finding?.eventIds ?? []);
  return (
    <div className="rv" ref={root}>
      <header className="rv-head">
        <div><p className="rv-kicker">Verification tools <span>Beta</span></p><h1>Recorded evidence</h1><p className="rv-intro">Trace a task from request to reported completion.</p></div>
        <button className="rv-button" onClick={toggleFullscreen}>{fullscreen ? "Exit full screen" : "Full screen"}</button>
      </header>
      <div className="rv-scope"><span>Local evaluation</span><p>Your file stays in this browser tab. This evaluates recorded states, not physical safety.</p></div>
      <div className="rv-workspace">
        <aside className="rv-setup" aria-label="Recording and criteria">
          <section><h2><span>01</span> Recording</h2><input ref={file} type="file" accept=".json,.mcap,application/json,application/octet-stream" onChange={importFile} className="rv-file" tabIndex={-1} aria-label="Import a recording" />
            <button className="rv-import" onClick={() => file.current?.click()}><strong>{loaded ? "Replace recording" : "Import recording"}</strong><span>JSON 1 MB, MCAP 5 MB</span></button>
            {loaded && <div className="rv-file-info"><strong>{loaded.name}</strong><span>{loaded.example ? "Simulated example" : "Imported file"}</span><dl><div><dt>Run</dt><dd>{recording?.runId}</dd></div><div><dt>Build</dt><dd>{recording?.buildId}</dd></div><div><dt>Events</dt><dd>{recording?.events.length}</dd></div></dl></div>}
            <details className="rv-examples"><summary>Explore simulated examples</summary><div>{(["broken", "corrected", "missing"] as const).map(kind => <button key={kind} onClick={() => load(JSON.stringify(exampleRecording(kind), null, 2), `${kind}-handoff.json`, true)}>{kind === "broken" ? "Broken handoff" : kind === "corrected" ? "Corrected handoff" : "Missing device evidence"}</button>)}</div></details>
            <button className="rv-text-button" onClick={() => download("vraelis-example-recording.json", exampleRecording("corrected"))}>Download format example</button>
          </section>
          <section><h2><span>02</span> Criteria</h2><label className="rv-field">Asset<input value={asset} onChange={e => { setAsset(e.target.value); criteriaChanged(); }} placeholder="Robot A" maxLength={120} /></label>
            <label className="rv-field">Task<input value={task} onChange={e => { setTask(e.target.value); criteriaChanged(); }} placeholder="task-104" maxLength={120} /></label>
            <label className="rv-field">Complete within <span className="rv-unit">seconds</span><input type="number" value={seconds} onChange={e => { setSeconds(e.target.value); criteriaChanged(); }} min="0.001" max="3600" step="0.001" /></label>
            <label className="rv-field">Assets that must stay unchanged<input value={untouched} onChange={e => { setUntouched(e.target.value); criteriaChanged(); }} placeholder="Optional, separated by commas" /></label>
            <details className="rv-meaning"><summary>What these criteria require</summary><p>One fresh control request, service acceptance, device completion, then control completion within the time window. All three sources need uninterrupted capture through the deadline. Named unchanged assets also need a device baseline.</p><p>The file declares a shared Unix clock and source coverage. Those declarations are not independently attested.</p>{recording && <ul className="rv-coverage-list">{recording.coverage.map((c, i) => <li key={i}>{SOURCE[c.source]}: {((c.startMs - recording.window.startMs) / 1000).toFixed(3)} to {((c.endMs - recording.window.startMs) / 1000).toFixed(3)} seconds</li>)}{!recording.coverage.length && <li>No source coverage declared.</li>}</ul>}</details>
            <label className="rv-approval"><input type="checkbox" checked={approved} disabled={!loaded} onChange={e => setApproved(e.target.checked)} /><span>I reviewed the criteria and declared recording coverage.</span></label>
            <button className="rv-button rv-primary rv-run" disabled={!loaded || !approved} onClick={run}>Verify recording</button>
          </section>
        </aside>
        <section className="rv-results" aria-label="Evaluation workspace">
          {error && <p className="rv-error" role="alert">{error}</p>}
          {pendingMcap ? <McapReview inspection={pendingMcap.inspection} name={pendingMcap.name} onReady={applyMcap} onCancel={() => { importSequence.current++; setPendingMcap(null); }} /> : importing ? <div className="rv-empty" role="status"><h2>Inspecting your recording…</h2><p>The file is read locally.</p></div> : !recording ? <div className="rv-empty"><div className="rv-empty-symbol" aria-hidden><span /><span /><span /></div><h2>Follow the evidence.</h2><p>Import a task recording or explore an example. Review the criteria to see which sources agree and what remains unobserved.</p><button className="rv-button" onClick={() => load(JSON.stringify(exampleRecording("broken"), null, 2), "broken-handoff.json", true)}>Explore a broken handoff</button><p className="rv-small">Accepts normalized JSON and uncompressed MCAP with JSON task-event topics. ROS CDR and live connections are not supported yet.</p></div> : <>
            <div className="rv-result-head" aria-live="polite"><div><p className="rv-kicker">{loaded?.example ? "Simulated recording" : "Imported recording"}</p><h2>{evaluation ? LABEL[evaluation.verdict] : "Ready for review"}</h2><p>{evaluation ? `${evaluation.findings.filter(f => f.verdict === "passed").length} of ${evaluation.findings.length} criteria met for this recording.` : "Review the criteria before evaluating this recording."}</p></div>{evaluation && <span className="rv-verdict" data-verdict={evaluation.verdict}>{evaluation.verdict === "passed" ? "Recorded criteria met" : evaluation.verdict === "failed" ? "Failed criteria" : "Inconclusive"}</span>}</div>
            <div className="rv-timeline" aria-label="Source timeline"><div className="rv-timeline-key"><span>Declared capture and events</span><span>{((recording.window.endMs - recording.window.startMs) / 1000).toFixed(1)} seconds</span></div>{(["control", "service", "device"] as const).map(source => <div className="rv-lane" key={source}><span>{SOURCE[source]}</span><div>{recording.coverage.filter(c => c.source === source).map((c, i) => <span key={i} className="rv-capture" aria-hidden style={{ left: `${(c.startMs - recording.window.startMs) / Math.max(1, recording.window.endMs - recording.window.startMs) * 100}%`, width: `${(c.endMs - c.startMs) / Math.max(1, recording.window.endMs - recording.window.startMs) * 100}%` }} />)}{recording.events.filter(e => e.source === source).map(e => <button key={e.id} title={`${e.assetId}: ${e.state}`} aria-label={`${SOURCE[source]} event ${e.id}: ${e.assetId}, ${e.state}`} onClick={() => { setTab("events"); setSelected(e.id); }} className={evidenceIds.has(e.id) ? "is-evidence" : ""} style={{ left: `${Math.max(1, Math.min(98, (e.timeMs - recording.window.startMs) / Math.max(1, recording.window.endMs - recording.window.startMs) * 100))}%` }} />)}{!recording.coverage.some(c => c.source === source) && <em>No captured source</em>}</div></div>)}</div>
            <div className="rv-tabs" aria-label="Evidence views">{(["findings", "events", "comparison"] as const).map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t === "findings" ? "Criteria" : t === "events" ? "Source events" : "Compare runs"}</button>)}</div>
            {tab === "findings" && (evaluation ? <div className="rv-findings">{evaluation.findings.map(f => <button key={f.id} className={selected === f.id ? "is-selected" : ""} onClick={() => setSelected(f.id)}><span className="rv-finding-mark" data-verdict={f.verdict} aria-hidden>{f.verdict === "passed" ? "✓" : f.verdict === "failed" ? "×" : "?"}</span><span><strong>{f.label}</strong><small>{f.detail}</small></span><span className="rv-finding-state">{f.verdict === "passed" ? "Met" : f.verdict === "failed" ? "Failed" : "Unobserved"}</span></button>)}{finding && <div className="rv-cited"><h3>Evidence for {finding.label.toLowerCase()}</h3>{finding.eventIds.length ? <ul>{recording.events.filter(e => evidenceIds.has(e.id)).map(e => <li key={e.id}><span>{e.id}</span><strong>{e.assetId}: {e.state}</strong><span>{((e.timeMs - recording.window.startMs) / 1000).toFixed(3)} s</span></li>)}</ul> : <p>This finding has no supporting event. Its conclusion depends on the declared capture window.</p>}</div>}</div> : <div className="rv-notice">Review your criteria, then select Verify recording.</div>)}
            {tab === "events" && <div className="rv-table-wrap" tabIndex={0} role="region" aria-label="Recorded source events"><table><thead><tr><th>Time</th><th>Source</th><th>Asset</th><th>Task</th><th>State</th></tr></thead><tbody>{recording.events.map(e => <tr key={e.id} data-selected={selected === e.id}><td>{((e.timeMs - recording.window.startMs) / 1000).toFixed(3)} s</td><td>{SOURCE[e.source]}</td><td>{e.assetId}</td><td>{e.taskId}</td><td>{e.state}</td></tr>)}</tbody></table></div>}
            {tab === "comparison" && <div className="rv-compare">{!baseline ? <><h3>Keep a result to compare.</h3><p>Evaluate this recording, keep it as the baseline, then import a corrected run and evaluate the same criteria.</p></> : !result ? <p>Baseline: {baseline.evaluation.runId}. Import and evaluate the next recording using the same criteria.</p> : !matchingCriteria ? <p>The criteria changed. Use the baseline criteria before comparing these results.</p> : <><div className="rv-compare-head"><span>{baseline.evaluation.buildId}<strong>{LABEL[baseline.evaluation.verdict]}</strong></span><span>{result.evaluation.buildId}<strong>{LABEL[result.evaluation.verdict]}</strong></span></div>{result.evaluation.findings.map(f => <div className="rv-compare-row" key={f.id}><strong>{f.label}</strong><span>{baseline.evaluation.findings.find(b => b.id === f.id)?.verdict ?? "Not evaluated"}</span><span>{f.verdict}</span></div>)}</>}{evaluation && <button className="rv-button" onClick={() => { setBaseline(result); setTab("comparison"); }}>{baseline ? "Replace baseline with this result" : "Keep as baseline"}</button>}{baseline && <><button className="rv-text-button" onClick={useBaselineCriteria}>Use baseline criteria</button><button className="rv-text-button" onClick={() => setBaseline(null)}>Clear baseline</button></>}</div>}
            {evaluation && <footer className="rv-result-footer"><p>Applies to the supplied recording and reviewed criteria.</p><button className="rv-button" disabled={exporting} onClick={exportReport}>{exporting ? "Preparing export…" : "Export evidence"}</button></footer>}
          </>}
        </section>
      </div>
    </div>
  );
}
