"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { mapMcap, parseCaptureManifest, type McapInspection, type McapMapping } from "@/lib/recorded-verification/mcap";
import { SOURCES, type Recording, type Source } from "@/lib/recorded-verification/evaluate";
const sourceLabels = { control: "Control interface", service: "Service", device: "Device report" };
export function McapReview({ inspection, name, onReady, onCancel }: { inspection: McapInspection; name: string; onReady: (recording: Recording, mapping: McapMapping) => void; onCancel: () => void }) {
  const [sources, setSources] = useState<Record<string, Source>>({});
  const [capture, setCapture] = useState<Omit<Recording, "events"> | null>(null);
  const [manifestName, setManifestName] = useState(""); const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null); const sequence = useRef(0);
  async function readManifest(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const current = ++sequence.current;
    setCapture(null); setManifestName(""); setError("");
    try {
      if (f.size > 100000) throw new Error("Capture manifests can be up to 100 KB.");
      const raw = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await f.arrayBuffer());
      const next = parseCaptureManifest(raw); if (current === sequence.current) { setCapture(next); setManifestName(f.name); }
    } catch (e) { if (current === sequence.current) setError(e instanceof Error ? e.message : "Use a UTF-8 JSON capture manifest."); }
  }
  function apply() {
    if (!capture) return;
    try { const mapped = mapMcap(inspection, sources, capture); onReady(mapped.recording, mapped.mapping); } catch (e) { setError(e instanceof Error ? e.message : "The selected topics could not be mapped."); }
  }
  const chosenCount = inspection.messages.filter(m => sources[String(m.channelId)]).length;
  return <div className="rv-mcap">
    <p className="rv-kicker">Native recording import</p><h2>Review the source mapping.</h2><p className="rv-mcap-intro">{name} contains {inspection.messages.length} messages across {inspection.channels.length} topics. Assign task-event topics, then provide the capture window and coverage.</p>
    <section><h3>Topic sources</h3><p>Supported JSON events contain timeMs, assetId, taskId and state. Event time comes from the payload. MCAP log and publish times are retained separately in the source file.</p>
      <div className="rv-mcap-topics">{inspection.channels.map(channel => <div key={channel.id}><label><span><strong>{channel.topic || "Unnamed topic"}</strong><small>Channel {channel.id}, {channel.encoding || "unspecified encoding"}, {channel.count} messages</small></span><select aria-label={`Source for channel ${channel.id}`} disabled={channel.encoding !== "json"} value={sources[String(channel.id)] ?? ""} onChange={e => { const next = { ...sources }; if (e.target.value) next[String(channel.id)] = e.target.value as Source; else delete next[String(channel.id)]; setSources(next); setError(""); }}><option value="">Skip topic</option>{SOURCES.map(source => <option key={source} value={source}>{sourceLabels[source]}</option>)}</select></label>{channel.encoding === "json" && <details className="rv-mcap-preview"><summary>Preview task-event payload</summary><pre>{new TextDecoder().decode(inspection.messages.find(m => m.channelId === channel.id)?.data.subarray(0, 600) ?? new Uint8Array()) || "No messages in this topic."}</pre><small>Preview limited to 600 bytes. The full message is validated during mapping.</small></details>}</div>)}</div>
      <p>{chosenCount} selected task events. Unselected topics are excluded from evaluation.</p>
    </section>
    <section><h3>Capture declaration</h3><p>Import a companion JSON manifest with runId, buildId, clock, window and coverage. Message timestamps do not establish uninterrupted capture. Edit the example to match your capture. It declares no coverage by default.</p><input ref={file} type="file" accept=".json,application/json" onChange={readManifest} className="rv-file" tabIndex={-1} aria-label="Import capture manifest" /><button className="rv-button" onClick={() => file.current?.click()}>{capture ? "Replace capture manifest" : "Import capture manifest"}</button><a className="rv-text-button" href="/recorded-evidence-capture-example.json" download>Download manifest example</a>
      {capture && <div className="rv-mcap-manifest"><strong>{manifestName}</strong><p>Run {capture.runId}, build {capture.buildId}</p><p>Unix milliseconds: {capture.window.startMs} to {capture.window.endMs}</p><ul>{capture.coverage.map((c, i) => <li key={i}>{sourceLabels[c.source]}: {c.startMs} to {c.endMs}</li>)}{!capture.coverage.length && <li>No coverage declared. Events require source coverage before evaluation.</li>}</ul></div>}
    </section>
    {error && <p className="rv-error" role="alert">{error}</p>}
    <div className="rv-mcap-actions"><button className="rv-button rv-primary" disabled={!capture?.coverage.length || !chosenCount} onClick={apply}>Apply mapping</button><button className="rv-button" onClick={onCancel}>Cancel import</button></div><p className="rv-small">Mapping does not prove source authenticity or physical behavior. Review the evaluation criteria after import.</p>
  </div>;
}
