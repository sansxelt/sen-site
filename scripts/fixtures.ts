// Synthetic, non-private fixtures for the multimodal harness. A real PNG (hand-encoded via zlib) with
// deliberately planted VISUAL defects (a dominant bright block over a small pale one = hierarchy/
// dominance; a misaligned block; a low-contrast block) and a real PDF with a planted layout defect
// (overlapping labels + a cramped table column). No private data. Used only by the harness.
import zlib from "node:zlib";

type RGBA = [number, number, number, number];
function fillRect(buf: Buffer, w: number, x0: number, y0: number, x1: number, y1: number, [r, g, b, a]: RGBA) {
  for (let y = Math.max(0, y0); y < y1; y++) for (let x = Math.max(0, x0); x < x1; x++) {
    const i = (y * w + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  }
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0, 0);
  return Buffer.concat([len, t, data, crc]);
}
export function makePng(w: number, h: number, draw: (buf: Buffer) => void): Buffer {
  const rgba = Buffer.alloc(w * h * 4, 0xff); // white opaque background
  draw(rgba);
  const stride = w * 4;
  const rawData = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { rawData[y * (stride + 1)] = 0; rgba.copy(rawData, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(rawData)), pngChunk("IEND", Buffer.alloc(0))]);
}

// A "screen" with planted visual issues (no text, so any finding is necessarily visual).
export const screenshotPng = (): Buffer => makePng(480, 360, (b) => {
  fillRect(b, 480, 40, 40, 360, 110, [220, 40, 40, 255]);      // large SATURATED block (dominant "secondary")
  fillRect(b, 480, 40, 180, 150, 220, [225, 225, 225, 255]);   // small PALE block (the real primary, under-emphasized)
  fillRect(b, 480, 210, 186, 320, 226, [225, 225, 225, 255]);  // sibling block MISALIGNED by 6px vertically
  fillRect(b, 480, 40, 280, 360, 330, [246, 246, 246, 255]);   // very low-contrast block on white
});

// Minimal valid PDF with text + a table drawn with line ops + a planted overlap/cramped-column defect.
export function makePdf(): Buffer {
  const content =
    "BT /F1 20 Tf 72 740 Td (Q3 Performance Report) Tj ET\n" +
    "BT /F1 11 Tf 72 712 Td (Revenue grew across every region this quarter.) Tj ET\n" +
    "BT /F1 11 Tf 72 694 Td (The regional breakdown is in the table below.) Tj ET\n" +
    "72 640 m 520 640 l S\n72 600 m 520 600 l S\n72 640 m 72 590 l S\n300 640 m 300 590 l S\n520 640 m 520 590 l S\n" +
    "BT /F1 10 Tf 80 615 Td (Region) Tj ET\n" +
    "BT /F1 10 Tf 83 615 Td (Revenue) Tj ET\n" +               // planted defect: two labels overlap
    "BT /F1 10 Tf 505 615 Td (12,345,678) Tj ET\n";           // planted defect: value crammed at the column edge
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

export const brandTxt = (): Buffer => Buffer.from("# Brand rules\n\n- Tone: confident, plain\n- Never promise a refund or a specific delivery date\n- Every message ends with a clear next step\n");
export const guideMd = (): Buffer => Buffer.from("# Style guide\n\n## Voice\n- Warm, direct.\n\n## Rules\n1. No em dashes.\n2. One CTA per message.\n\n```\nExample: Thanks for reaching out. Here's the next step.\n```\n");
