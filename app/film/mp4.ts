// A minimal MP4 writer for one H.264 video track, used by the film renderer (app/film/drone) to package what
// Chrome's WebCodecs encoder produces. Samples arrive in decode order, length-prefixed (avc.format = "avc"),
// with the avcC record from the encoder's decoderConfig. moov is written before mdat so the file can start
// playing before it has finished downloading.

export type Sample = { data: Uint8Array; pts: number; key: boolean }; // pts in microseconds

const enc = new TextEncoder();
function u16(n: number) { return [(n >>> 8) & 255, n & 255]; }
function u32(n: number) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
function i32(n: number) { return u32(n >>> 0); }
function str(s: string) { return Array.from(enc.encode(s)); }

function box(type: string, ...parts: (number[] | Uint8Array)[]): Uint8Array {
  const size = 8 + parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(size);
  out.set(u32(size), 0); out.set(str(type), 4);
  let o = 8;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const full = (type: string, version: number, flags: number, ...parts: (number[] | Uint8Array)[]) =>
  box(type, [version, (flags >>> 16) & 255, (flags >>> 8) & 255, flags & 255], ...parts);

const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].flatMap(u32);

export function muxMp4(opts: { width: number; height: number; fps: number; avcC: Uint8Array; samples: Sample[] }): Uint8Array {
  const { width, height, fps, avcC, samples } = opts;
  const timescale = fps * 1000;            // e.g. 30000 per second
  const delta = 1000;                      // one frame in that timescale
  const n = samples.length;
  const mdur = n * delta;                  // media duration
  const movieScale = 1000;
  const vdur = Math.round((n / fps) * movieScale);

  // Composition offsets, if the encoder reordered frames (B-frames): pts minus decode time.
  const offsets = samples.map((s, i) => Math.round((s.pts / 1e6) * timescale) - i * delta);
  const reordered = offsets.some((x) => x !== 0);

  const ftyp = box("ftyp", str("isom"), u32(512), str("isom"), str("iso2"), str("avc1"), str("mp41"));

  const build = (mdatOffset: number) => {
    const mvhd = full("mvhd", 0, 0, u32(0), u32(0), u32(movieScale), u32(vdur), u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0),
      MATRIX, new Array(24).fill(0), u32(2));
    const tkhd = full("tkhd", 0, 3, u32(0), u32(0), u32(1), u32(0), u32(vdur), u32(0), u32(0), u16(0), u16(0), u16(0), u16(0),
      MATRIX, u32(width << 16), u32(height << 16));
    const mdhd = full("mdhd", 0, 0, u32(0), u32(0), u32(timescale), u32(mdur), u16(0x55c4), u16(0));
    const hdlr = full("hdlr", 0, 0, u32(0), str("vide"), u32(0), u32(0), u32(0), str("VideoHandler"), [0]);
    const vmhd = full("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0));
    const dinf = box("dinf", full("dref", 0, 0, u32(1), full("url ", 0, 1)));
    const avc1 = box("avc1", new Array(6).fill(0), u16(1), u16(0), u16(0), new Array(12).fill(0), u16(width), u16(height),
      u32(0x00480000), u32(0x00480000), u32(0), u16(1), new Array(32).fill(0), u16(0x0018), u16(0xffff), box("avcC", avcC));
    const stsd = full("stsd", 0, 0, u32(1), avc1);
    const stts = full("stts", 0, 0, u32(1), u32(n), u32(delta));
    const keys = samples.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean);
    const stss = full("stss", 0, 0, u32(keys.length), keys.flatMap(u32));
    const ctts = reordered ? full("ctts", 1, 0, u32(n), offsets.flatMap((off) => [...u32(1), ...i32(off)])) : null;
    const stsc = full("stsc", 0, 0, u32(1), u32(1), u32(n), u32(1));
    const stsz = full("stsz", 0, 0, u32(0), u32(n), samples.flatMap((s) => u32(s.data.length)));
    const stco = full("stco", 0, 0, u32(1), u32(mdatOffset));
    const stbl = ctts ? box("stbl", stsd, stts, ctts, stss, stsc, stsz, stco) : box("stbl", stsd, stts, stss, stsc, stsz, stco);
    const minf = box("minf", vmhd, dinf, stbl);
    const mdia = box("mdia", mdhd, hdlr, minf);
    const trak = box("trak", tkhd, mdia);
    return box("moov", mvhd, trak);
  };

  const probe = build(0);
  const mdatHeader = 8;
  const moov = build(ftyp.length + probe.length + mdatHeader);
  const payload = samples.reduce((a, s) => a + s.data.length, 0);
  const out = new Uint8Array(ftyp.length + moov.length + mdatHeader + payload);
  let o = 0;
  out.set(ftyp, o); o += ftyp.length;
  out.set(moov, o); o += moov.length;
  out.set(u32(mdatHeader + payload), o); out.set(str("mdat"), o + 4); o += 8;
  for (const s of samples) { out.set(s.data, o); o += s.data.length; }
  return out;
}

