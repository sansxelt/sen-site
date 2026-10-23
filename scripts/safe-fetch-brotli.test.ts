// Node CVE-2026-111497: safeFetch must refuse brotli responses before undici builds a decoder.
// Run: npm run safe-fetch:brotli:test. A local plain-HTTP server stands in for a hostile host. safeFetch itself only
// talks to public https:443 hosts, so the test drives the same interceptor and header helper it uses.
import http from "node:http";
import zlib from "node:zlib";
import { Agent, fetch as undiciFetch } from "undici";
import { blockedFetchReason, noBrotliOffer, refuseBrotli } from "../lib/safe-fetch";

let pass = 0, fail = 0;
const t = async (name: string, fn: () => Promise<void> | void) => {
  try { await fn(); pass++; console.log("PASS ", name); } catch (e) { fail++; console.log("FAIL ", name, "-", (e as Error).message); }
};
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };

let brotliDecoders = 0;
// Count every chunk any brotli decoder processes in this process (module exports are read-only on Node 24, so the
// decoder class's prototype is instrumented instead).
const proto = (zlib.BrotliDecompress as unknown as { prototype: { _transform: (...a: unknown[]) => unknown } }).prototype;
const realTransform = proto._transform;
proto._transform = function (this: unknown, ...a: unknown[]) { brotliDecoders++; return realTransform.apply(this, a); };

const BODY = JSON.stringify({ ok: true, pad: "x".repeat(2000) });
let lastAcceptEncoding = "";
const server = http.createServer((req, res) => {
  lastAcceptEncoding = String(req.headers["accept-encoding"] ?? "");
  const enc = req.url!.slice(1);
  if (enc === "br") { res.writeHead(200, { "content-encoding": "br" }); res.end(zlib.brotliCompressSync(BODY)); return; }
  if (enc === "gzip-br") { res.writeHead(200, { "content-encoding": "gzip, br" }); res.end(zlib.brotliCompressSync(zlib.gzipSync(BODY))); return; }
  if (enc === "BR") { res.writeHead(200, { "content-encoding": "BR" }); res.end(zlib.brotliCompressSync(BODY)); return; }
  if (enc === "gzip") { res.writeHead(200, { "content-encoding": "gzip" }); res.end(zlib.gzipSync(BODY)); return; }
  if (enc === "redirect-br") { res.writeHead(302, { location: "/br" }); res.end(); return; }
  res.writeHead(200); res.end(BODY);
});
async function main() {
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const guarded = () => new Agent().compose(refuseBrotli);

async function get(path: string, dispatcher: Agent | ReturnType<Agent["compose"]>) {
  return undiciFetch(base + path, { dispatcher, headers: noBrotliOffer(undefined) } as never);
}
async function refused(path: string) {
  const before = brotliDecoders;
  const err = await get(path, guarded()).then(() => null, (e) => e);
  if (!err) throw new Error("expected a rejection");
  eq(blockedFetchReason((err as { cause?: unknown }).cause), "unsupported_encoding");
  eq(brotliDecoders - before, 0);
}

await t("instrument check: without the guard, a br response IS decoded (the counter sees it)", async () => {
  const before = brotliDecoders;
  const r = await get("/br", new Agent());
  eq(JSON.parse(await r.text()).ok, true); if (brotliDecoders - before < 1) throw new Error("brotli decoder never ran");
});
await t("br response refused before any brotli decoder exists", () => refused("/br"));
await t("'gzip, br' refused", () => refused("/gzip-br"));
await t("upper-case 'BR' refused", () => refused("/BR"));
await t("redirect to a br response refused", () => refused("/redirect-br"));
await t("gzip response still decoded", async () => { eq(JSON.parse(await (await get("/gzip", guarded())).text()).ok, true); });
await t("plain response unchanged", async () => { const r = await get("/plain", guarded()); eq([r.status, JSON.parse(await r.text()).ok], [200, true]); });
await t("brotli is not offered to servers", async () => { await (await get("/plain", guarded())).text(); eq(lastAcceptEncoding, "gzip, deflate"); });
await t("an explicit caller accept-encoding is kept", () => { eq(noBrotliOffer({ "accept-encoding": "identity" }).get("accept-encoding"), "identity"); });

server.close();
console.log(`\n${fail ? "FAILED" : "ALL PASS"}  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
}
void main();
