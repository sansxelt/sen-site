// Frames in, MP4 out, in the browser: WebCodecs encodes H.264 and ../mp4.ts packs it. Shared by every film
// renderer in app/film. A development tool only; nothing here ships to a visitor.
import { muxMp4, type Sample } from "./mp4";

export type EncodeOptions = {
  width: number;
  height: number;
  fps: number;
  frames: number;
  bitrate: number;
  /** Draws frame i onto ctx (already sized width x height). May be async. */
  draw: (i: number, ctx: OffscreenCanvasRenderingContext2D) => void | Promise<void>;
  /** A keyframe every this many frames (default two seconds). */
  gop?: number;
};

export async function encodeMp4(o: EncodeOptions): Promise<{ bytes: Uint8Array; frames: number; keys: number }> {
  const canvas = new OffscreenCanvas(o.width, o.height);
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const samples: Sample[] = [];
  let avcC: Uint8Array | null = null;
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      samples.push({ data, pts: chunk.timestamp, key: chunk.type === "key" });
      const desc = meta?.decoderConfig?.description;
      if (desc && !avcC) avcC = new Uint8Array(desc instanceof ArrayBuffer ? desc.slice(0) : (desc as ArrayBufferView).buffer.slice(0));
    },
    error: (e) => { failure = e; },
  });
  // Level 5.1 above 720p, 3.1 at or below it.
  encoder.configure({
    codec: o.width * o.height > 1280 * 720 ? "avc1.640033" : "avc1.64001f",
    width: o.width, height: o.height, bitrate: o.bitrate, framerate: o.fps,
    latencyMode: "quality", avc: { format: "avc" },
  });
  const gop = o.gop ?? o.fps * 2;
  for (let i = 0; i < o.frames; i++) {
    if (failure) throw failure;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, o.width, o.height);
    await o.draw(i, ctx);
    ctx.globalAlpha = 1;
    const vf = new VideoFrame(canvas, { timestamp: Math.round((i / o.fps) * 1e6), duration: Math.round(1e6 / o.fps) });
    encoder.encode(vf, { keyFrame: i % gop === 0 });
    vf.close();
    while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
  if (!avcC) throw new Error("the encoder gave no avcC");
  const bytes = muxMp4({ width: o.width, height: o.height, fps: o.fps, avcC, samples });
  return { bytes, frames: samples.length, keys: samples.filter((s) => s.key).length };
}

/** Bytes to base64 slices, so a page never hands back one enormous string. */
export function sliceBase64(bytes: Uint8Array | null, i: number, size = 1_500_000): string {
  if (!bytes) return "";
  const part = bytes.subarray(i * size, (i + 1) * size);
  let s = "";
  for (let j = 0; j < part.length; j += 0x8000) s += String.fromCharCode(...part.subarray(j, j + 0x8000));
  return btoa(s);
}
