import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { McapWriter } from "@mcap/core";
import { inspectMcap, mapMcap, parseCaptureManifest, MAX_MCAP_BYTES } from "../lib/recorded-verification/mcap";
import { EXAMPLE_REQUIREMENT, exampleRecording } from "../lib/recorded-verification/examples";
import { evaluateRecording } from "../lib/recorded-verification/evaluate";

async function fixture(options: { kind?: "broken" | "corrected"; compression?: boolean; encoding?: string; invalidJson?: boolean; chunks?: boolean } = {}) {
  const chunks: Uint8Array[] = []; let position = BigInt(0);
  const writer = new McapWriter({ writable: { position: () => position, write: async data => { chunks.push(data.slice()); position += BigInt(data.length); } }, useChunks: options.chunks ?? true, ...(options.compression ? { compressChunk: (data: Uint8Array) => ({ compression: "zstd", compressedData: data }) } : {}) });
  await writer.start({ profile: "", library: "vraelis-test-fixture" });
  const channels: Record<string, number> = {};
  for (const source of ["control", "service", "device"]) channels[source] = await writer.registerChannel({ topic: `/task/${source}`, schemaId: 0, messageEncoding: options.encoding ?? "json", metadata: new Map() });
  const r = exampleRecording(options.kind ?? "corrected");
  for (const [i, e] of r.events.entries()) await writer.addMessage({ channelId: channels[e.source], sequence: i, logTime: BigInt(e.timeMs) * BigInt(1000000) + BigInt(123), publishTime: BigInt(e.timeMs) * BigInt(1000000) - BigInt(123), data: new TextEncoder().encode(options.invalidJson ? "{" : JSON.stringify(e)) });
  await writer.end(); const bytes = new Uint8Array(Number(position)); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const { events: _events, ...capture } = r; void _events;
  return { bytes, capture, channels };
}
async function main() {
 let passed = 0;const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`PASS ${name}`); };
 const f = await fixture(); const inspected = inspectMcap(f.bytes); const sources = Object.fromEntries(Object.entries(f.channels).map(([source,id])=>[String(id),source])) as Parameters<typeof mapMcap>[1];
 test("real MCAP writer output inspects channels once despite summary repeats",()=>{assert.equal(inspected.channels.length,3);assert.equal(inspected.messages.length,6);assert.equal(inspected.channels.reduce((n,c)=>n+c.count,0),6);});
 test("reviewed JSON topics evaluate the same corrected task",()=>{assert.equal(evaluateRecording(mapMcap(inspected,sources,f.capture).recording,EXAMPLE_REQUIREMENT).verdict,"passed");});
 test("payload clock is used while original nanosecond timestamps stay exact",()=>{const m=inspected.messages[0];assert.equal(BigInt(m.logTimeNs)-BigInt(m.publishTimeNs),BigInt(246));assert.equal(mapMcap(inspected,sources,f.capture).recording.events[0].timeMs,exampleRecording("corrected").window.startMs);});
 test("channel and message offsets make stable event citations",()=>assert.match(mapMcap(inspected,sources,f.capture).recording.events[0].id,/^mcap:\d+:\d+$/));
 test("no implicit source assignment is allowed",()=>assert.throws(()=>mapMcap(inspected,{},f.capture)));
 test("unknown channel mapping is rejected",()=>assert.throws(()=>mapMcap(inspected,{"999":"device"},f.capture)));
 test("missing capture is not inferred from message timing",()=>assert.throws(()=>mapMcap(inspected,sources,{...f.capture,coverage:[]})));
 test("capture gaps cannot become a pass",()=>{const mapped=mapMcap(inspected,sources,{...f.capture,coverage:f.capture.coverage.flatMap(c=>c.source==="service"?[{...c,endMs:c.startMs+2000},{...c,startMs:c.startMs+4000}]:[c])});assert.equal(evaluateRecording(mapped.recording,EXAMPLE_REQUIREMENT).verdict,"inconclusive");});
 test("corrupt nonzero-checksum chunks are rejected",()=>{const b=f.bytes.slice();const position=Buffer.from(b).indexOf(Buffer.from('"taskId":"task-104"'));assert.ok(position>0);b[position+15]^=1;assert.throws(()=>inspectMcap(b),/CRC|crc|checksum/);});
 test("truncated native files are rejected",()=>assert.throws(()=>inspectMcap(f.bytes.subarray(0,f.bytes.length-12))));
 test("trailing bytes are rejected",()=>{const b=new Uint8Array(f.bytes.length+1);b.set(f.bytes);assert.throws(()=>inspectMcap(b));});
 test("oversize native files are rejected before parsing",()=>assert.throws(()=>inspectMcap(new Uint8Array(MAX_MCAP_BYTES+1))));
 test("manifests containing a second event stream are rejected",()=>assert.throws(()=>parseCaptureManifest(JSON.stringify({...f.capture,events:[]}))));
 test("invalid manifest clocks are rejected",()=>assert.throws(()=>parseCaptureManifest(JSON.stringify({...f.capture,clock:"device-ticks"}))));
 const compressed=await fixture({compression:true});test("compressed chunks fail clearly without decompression",()=>assert.throws(()=>inspectMcap(compressed.bytes),/uncompressed/));
 const cdr=await fixture({encoding:"cdr"});test("CDR topics are visible but cannot be treated as JSON",()=>assert.throws(()=>mapMcap(inspectMcap(cdr.bytes),sources,cdr.capture),/Only JSON/));
 const bad=await fixture({invalidJson:true});test("invalid selected JSON fails rather than silently dropping events",()=>assert.throws(()=>mapMcap(inspectMcap(bad.bytes),sources,bad.capture),/valid UTF-8 JSON/));
 const broken=await fixture({kind:"broken",chunks:false});test("unchunked broken capture retains actual failure findings",()=>assert.equal(evaluateRecording(mapMcap(inspectMcap(broken.bytes),sources,broken.capture).recording,EXAMPLE_REQUIREMENT).verdict,"failed"));
 writeFileSync('/tmp/vraelis-corrected-task.mcap',f.bytes);writeFileSync('/tmp/vraelis-capture.json',JSON.stringify(f.capture));
 writeFileSync('/tmp/vraelis-broken-task.mcap',broken.bytes);
 console.log(`${passed} native MCAP checks passed`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
