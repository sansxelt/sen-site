/** Local recorded-evidence evaluation, v1. No device commands or model-derived verdicts. */
export const SOURCES = ["control", "service", "device"] as const;
export type Source = typeof SOURCES[number];
export const STATES = ["idle", "requested", "accepted", "completed", "failed", "cancelled"] as const;
export type TaskState = typeof STATES[number];
export type RecordedEvent = { id: string; timeMs: number; source: Source; assetId: string; taskId: string; state: TaskState };
export type Recording = {
  schemaVersion: 1; runId: string; buildId: string; clock: "unix-ms";
  window: { startMs: number; endMs: number };
  coverage: { source: Source; startMs: number; endMs: number }[];
  events: RecordedEvent[];
};
export type Requirement = { assetId: string; taskId: string; completionWithinMs: number; untouchedAssetIds: string[] };
export type Finding = { id: string; label: string; verdict: "passed" | "failed" | "inconclusive"; detail: string; eventIds: string[] };
export type Evaluation = { evaluatorVersion: "recorded-1"; runId: string; buildId: string; requirement: Requirement; verdict: Finding["verdict"]; findings: Finding[] };
const obj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const text = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= 120 && !/[\u0000-\u001f]/.test(x);
const time = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
export const MAX_RECORDING_BYTES = 1_000_000;

export function parseRecording(raw: string): Recording {
  if (new TextEncoder().encode(raw).length > MAX_RECORDING_BYTES) throw new Error("Recordings must be smaller than 1 MB.");
  let x: unknown;
  try { x = JSON.parse(raw.replace(/^\uFEFF/, "")); } catch { throw new Error("Use a valid JSON recording. Download the example for the supported format."); }
  if (!obj(x) || x.schemaVersion !== 1 || x.clock !== "unix-ms" || !text(x.runId) || !text(x.buildId)) throw new Error("The recording needs schemaVersion 1, a run ID, a build ID and clock unix-ms.");
  if (!obj(x.window) || !time(x.window.startMs) || !time(x.window.endMs) || x.window.endMs < x.window.startMs) throw new Error("The recording window must have valid start and end times in milliseconds.");
  const startMs = x.window.startMs, endMs = x.window.endMs;
  if (!Array.isArray(x.coverage) || x.coverage.length > 100) throw new Error("Declare the captured time intervals in coverage.");
  const coverage = x.coverage.map((c) => {
    if (!obj(c) || !SOURCES.includes(c.source as Source) || !time(c.startMs) || !time(c.endMs) || c.endMs < c.startMs || c.startMs < startMs || c.endMs > endMs) throw new Error("A coverage interval is invalid or outside the recording window.");
    return { source: c.source as Source, startMs: c.startMs, endMs: c.endMs };
  });
  if (!Array.isArray(x.events) || x.events.length > 2000) throw new Error("A recording can contain up to 2,000 events.");
  const ids = new Set<string>();
  const events = x.events.map((e) => {
    if (!obj(e) || !text(e.id) || !text(e.assetId) || !text(e.taskId) || !time(e.timeMs) || !SOURCES.includes(e.source as Source) || !STATES.includes(e.state as TaskState)) throw new Error("Each event needs a unique ID, time, source, asset, task and supported state.");
    if (ids.has(e.id)) throw new Error("Event IDs must be unique.");
    ids.add(e.id);
    if (e.timeMs < startMs || e.timeMs > endMs) throw new Error("An event falls outside the recording window.");
    const eventTime = e.timeMs, eventSource = e.source;
    if (!coverage.some(c => c.source === eventSource && c.startMs <= eventTime && c.endMs >= eventTime)) throw new Error("An event falls outside its declared source coverage.");
    return { id: e.id, assetId: e.assetId, taskId: e.taskId, timeMs: e.timeMs, source: e.source as Source, state: e.state as TaskState };
  }).sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id));
  return { schemaVersion: 1, clock: "unix-ms", runId: x.runId, buildId: x.buildId, window: { startMs, endMs }, coverage, events };
}

export function validateRequirement(r: Requirement): void {
  if (!text(r.assetId) || !text(r.taskId)) throw new Error("Choose a task and an asset.");
  if (!Number.isSafeInteger(r.completionWithinMs) || r.completionWithinMs < 1 || r.completionWithinMs > 3_600_000) throw new Error("Choose a completion window between 1 millisecond and 1 hour.");
  if (!Array.isArray(r.untouchedAssetIds) || r.untouchedAssetIds.length > 20 || r.untouchedAssetIds.some(a => !text(a) || a === r.assetId) || new Set(r.untouchedAssetIds).size !== r.untouchedAssetIds.length) throw new Error("Unchanged assets must be distinct and different from the selected asset.");
}
/** Merge intervals; a partial recording cannot support a negative assertion across a gap. */
export function covers(r: Recording, source: Source, start: number, end: number): boolean {
  let cursor = start;
  const intervals = r.coverage.filter(c => c.source === source).toSorted((a, b) => a.startMs - b.startMs);
  for (const c of intervals) {
    if (c.endMs < cursor) continue;
    if (c.startMs > cursor) return false;
    cursor = Math.max(cursor, c.endMs);
    if (cursor >= end) return true;
  }
  return false;
}

export function evaluateRecording(r: Recording, requirement: Requirement): Evaluation {
  validateRequirement(requirement);
  const findings: Finding[] = [];
  const add = (id: string, label: string, verdict: Finding["verdict"], detail: string, events: RecordedEvent[] = []) => findings.push({ id, label, verdict, detail, eventIds: events.map(e => e.id) });
  const task = r.events.filter(e => e.assetId === requirement.assetId && e.taskId === requirement.taskId);
  const requests = task.filter(e => e.source === "control" && e.state === "requested");
  if (requests.length !== 1) {
    add("identity", "A single fresh request", "inconclusive", requests.length ? "Several requests use this task ID. Use a recording with one identifiable request." : "No control request was recorded for this task and asset.", requests);
  } else {
    const request = requests[0], deadline = request.timeMs + requirement.completionWithinMs;
    if (!Number.isSafeInteger(deadline)) throw new Error("The requested time window exceeds supported timestamp precision.");
    add("identity", "A single fresh request", "passed", `The request names ${requirement.assetId} and ${requirement.taskId}.`, [request]);
    const after = task.filter(e => e.timeMs >= request.timeMs);
    const terminals = after.filter(e => e.source === "device" && ["completed", "failed", "cancelled"].includes(e.state));
    const completion = terminals.find(e => e.state === "completed");
    
    for (const source of ["service", "device", "control"] as const) {
      const label = source === "service" ? "Service acceptance" : source === "device" ? "Reported device completion" : "Control completion";
      const state = source === "service" ? "accepted" : "completed";
      const candidates = after.filter(e => e.source === source && e.state === state);
      const candidate = candidates[0];
      const adverse = after.filter(e => e.source === source && e.timeMs <= deadline && ["failed", "cancelled"].includes(e.state));
      if (adverse.length) add(source, label, "failed", `The same task is reported failed or cancelled by the ${source} source.`, adverse);
      else if (candidate && candidate.timeMs <= deadline && !covers(r, source, request.timeMs, deadline)) add(source, label, "inconclusive", "The required event was recorded, but incomplete capture cannot exclude contradictory task states in the same window.", [candidate]);
      else if (candidate && candidate.timeMs <= deadline) add(source, label, "passed", `Recorded ${((candidate.timeMs - request.timeMs) / 1000).toFixed(3)} seconds after the request.`, [candidate]);
      else if (candidate) add(source, label, "failed", "The event arrived after the approved completion window.", [candidate]);
      else if (covers(r, source, request.timeMs, deadline)) add(source, label, "failed", `No ${state} event was recorded during the full completion window.`);
      else add(source, label, "inconclusive", "The required event is missing and source coverage does not span the full completion window.");
    }
    const controlComplete = after.find(e => e.source === "control" && e.state === "completed");
    const accepted = after.find(e => e.source === "service" && e.state === "accepted");
    if (completion && controlComplete && accepted) {
      const ordered = accepted.timeMs <= completion.timeMs && completion.timeMs <= controlComplete.timeMs;
      add("order", "Agreement across sources", ordered ? "passed" : "failed", ordered ? "Acceptance precedes reported device completion, then control completion." : "The reported events contradict the approved acceptance and completion order.", [accepted, completion, controlComplete]);
    } else add("order", "Agreement across sources", "inconclusive", "All three source events are needed to compare their order.");
    for (const asset of requirement.untouchedAssetIds) {
      const device = r.events.filter(e => e.assetId === asset && e.source === "device");
      const baseline = device.filter(e => e.timeMs <= request.timeMs).at(-1);
      const baselines = baseline ? device.filter(e => e.timeMs === baseline.timeMs) : [];
      const ambiguous = baseline && baselines.some(e => e.state !== baseline.state || e.taskId !== baseline.taskId);
      const observed = device.filter(e => e.timeMs > request.timeMs && e.timeMs <= deadline);
      const changed = baseline ? observed.filter(e => e.state !== baseline.state || e.taskId !== baseline.taskId) : [];
      if (!baseline) add(`unchanged:${asset}`, `${asset} stays unchanged`, "inconclusive", "No device-source baseline was recorded before the request.");
      else if (ambiguous) add(`unchanged:${asset}`, `${asset} stays unchanged`, "inconclusive", "Conflicting device observations share the baseline timestamp.", baselines);
      else if (changed.length) add(`unchanged:${asset}`, `${asset} stays unchanged`, "failed", "The recorded device task or state differs from its baseline.", [baseline, ...changed]);
      else if (!covers(r, "device", baseline.timeMs, deadline)) add(`unchanged:${asset}`, `${asset} stays unchanged`, "inconclusive", "Device source coverage does not span the baseline and full completion window.", [baseline]);
      else add(`unchanged:${asset}`, `${asset} stays unchanged`, "passed", "No task or state change appears in the declared device recording during the completion window.", [baseline, ...observed]);
    }
  }
  return { evaluatorVersion: "recorded-1", runId: r.runId, buildId: r.buildId, requirement: { ...requirement, untouchedAssetIds: [...requirement.untouchedAssetIds] }, verdict: findings.some(f => f.verdict === "failed") ? "failed" : findings.some(f => f.verdict === "inconclusive") ? "inconclusive" : "passed", findings };
}
