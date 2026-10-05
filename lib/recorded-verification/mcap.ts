import { McapStreamReader } from "@mcap/core";
import { parseRecording, SOURCES, type Recording, type Source } from "./evaluate";

export const MAX_MCAP_BYTES = 5_000_000;
export type McapChannel = { id: number; topic: string; encoding: string; count: number };
export type McapMessage = { channelId: number; index: number; logTimeNs: string; publishTimeNs: string; data: Uint8Array };
export type McapInspection = { profile: string; channels: McapChannel[]; messages: McapMessage[] };
export type McapMapping = { adapterVersion: "mcap-json-1"; channelSources: Record<string, Source>; capture: Omit<Recording, "events">; timePolicy: "payload.timeMs" };

/** Bounded, uncompressed MCAP container reader. Does not infer source identity or capture continuity. */
export function inspectMcap(bytes: Uint8Array): McapInspection {
  if (bytes.byteLength > MAX_MCAP_BYTES) throw new Error("MCAP files can be up to 5 MB.");
  const reader = new McapStreamReader({ includeChunks: true, validateCrcs: true });
  const channels = new Map<number, McapChannel>(); const messages: McapMessage[] = [];
  let profile = "", records = 0;
  try {
    reader.append(bytes);
    for (let record; (record = reader.nextRecord());) {
      if (++records > 20000) throw new Error("This recording exceeds the 20,000-record inspection limit.");
      if (record.type === "Header") profile = record.profile;
      if (record.type === "Chunk" && (record.compression || record.uncompressedSize > BigInt(MAX_MCAP_BYTES))) throw new Error("This version accepts uncompressed MCAP only. Export without LZ4 or Zstandard compression.");
      if (record.type === "Channel") {
        if (record.topic.length > 200 || record.messageEncoding.length > 100) throw new Error("A channel description exceeds supported limits.");
        const previous = channels.get(record.id);
        channels.set(record.id, { id: record.id, topic: record.topic, encoding: record.messageEncoding, count: previous?.count ?? 0 });
        if (channels.size > 100) throw new Error("This version inspects up to 100 channels.");
      }
      if (record.type === "Message") {
        if (messages.length >= 10000) throw new Error("This version inspects up to 10,000 messages.");
        const channel = channels.get(record.channelId);
        if (!channel) throw new Error("A message refers to an undeclared channel.");
        channel.count++;
        messages.push({ channelId: record.channelId, index: messages.length, logTimeNs: record.logTime.toString(), publishTimeNs: record.publishTime.toString(), data: record.data });
      }
    }
    if (!reader.done() || reader.bytesRemaining() !== 0) throw new Error("The MCAP is incomplete or has trailing bytes. Import a complete capture.");
  } catch (error) {
    throw new Error(error instanceof Error ? `MCAP import: ${error.message}` : "The MCAP could not be inspected.");
  }
  return { profile, channels: [...channels.values()], messages };
}

export function parseCaptureManifest(raw: string): Omit<Recording, "events"> {
  if (new TextEncoder().encode(raw).length > 100000) throw new Error("Capture manifests can be up to 100 KB.");
  let value;
  try { value = JSON.parse(raw.replace(/^\uFEFF/, "")); } catch { throw new Error("Use a valid JSON capture manifest."); }
  if (!value || typeof value !== "object" || Array.isArray(value) || "events" in value) throw new Error("A capture manifest supplies run, build, window and coverage, without events.");
  const recording = parseRecording(JSON.stringify({ ...value, events: [] }));
  const { events: _events, ...capture } = recording; void _events;
  return capture;
}

export function mapMcap(inspection: McapInspection, channelSources: Record<string, Source>, capture: Omit<Recording, "events">): { recording: Recording; mapping: McapMapping } {
  const entries = Object.entries(channelSources);
  if (!entries.length) throw new Error("Assign at least one JSON topic to an evidence source.");
  for (const [id, source] of entries) {
    const channel = inspection.channels.find(c => String(c.id) === id);
    if (!channel || channel.encoding !== "json" || !SOURCES.includes(source)) throw new Error("Only JSON channels can be mapped to control, service or device evidence.");
  }
  const messages = inspection.messages.filter(m => channelSources[String(m.channelId)]);
  if (!messages.length || messages.length > 2000) throw new Error("Select topics containing 1 to 2,000 task events.");
  const events = messages.map(message => {
    let payload;
    try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(message.data)); } catch { throw new Error(`Message ${message.index} is not a valid UTF-8 JSON event.`); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error(`Message ${message.index} needs an event object.`);
    return { id: `mcap:${message.channelId}:${message.index}`, timeMs: payload.timeMs, assetId: payload.assetId, taskId: payload.taskId, state: payload.state, source: channelSources[String(message.channelId)] };
  });
  const recording = parseRecording(JSON.stringify({ ...capture, events }));
  return { recording, mapping: { adapterVersion: "mcap-json-1", channelSources: { ...channelSources }, capture, timePolicy: "payload.timeMs" } };
}
