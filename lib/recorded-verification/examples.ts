import type { Recording, Requirement } from "./evaluate";
export const EXAMPLE_REQUIREMENT: Requirement = { assetId: "Robot A", taskId: "task-104", completionWithinMs: 10000, untouchedAssetIds: ["Robot B"] };
const start = Date.UTC(2026, 9, 5, 10);
export function exampleRecording(kind: "broken" | "corrected" | "missing"): Recording {
  const events: Recording["events"] = [
    { id: "b-baseline", timeMs: start, source: "device", assetId: "Robot B", taskId: "standby-b", state: "idle" },
    { id: "requested", timeMs: start + 1000, source: "control", assetId: "Robot A", taskId: "task-104", state: "requested" },
    { id: "accepted", timeMs: start + 1200, source: "service", assetId: "Robot A", taskId: "task-104", state: "accepted" },
    { id: "ui-completed", timeMs: start + 6500, source: "control", assetId: "Robot A", taskId: "task-104", state: "completed" },
    { id: "b-final", timeMs: start + 11000, source: "device", assetId: "Robot B", taskId: kind === "broken" ? "task-104" : "standby-b", state: kind === "broken" ? "accepted" : "idle" },
  ];
  if (kind === "corrected") events.push({ id: "device-completed", timeMs: start + 6000, source: "device", assetId: "Robot A", taskId: "task-104", state: "completed" });
  return { schemaVersion: 1, runId: `simulation-${kind}`, buildId: kind === "corrected" ? "sim-build-002" : "sim-build-001", clock: "unix-ms", window: { startMs: start, endMs: start + 12000 }, coverage: ["control", "service", ...(kind === "missing" ? [] : ["device"])].map(source => ({ source: source as "control" | "service" | "device", startMs: start, endMs: start + 12000 })), events: kind === "missing" ? events.filter(e => e.source !== "device") : events };
}
