// Synthetic, SAFE test fixtures for the upload E2E suite — written to a temp dir at first use so
// setInputFiles can hand real file paths to the browser. Reuses the valid PNG/PDF encoders from
// scripts/fixtures.ts so images have real dimensions (the API rejects a garbage IHDR). No real user
// content, ever.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { screenshotPng, coloredScreenshotPng, makePdf, brandTxt } from "../../scripts/fixtures";

const DIR = path.join(os.tmpdir(), "vraelis-e2e-fixtures");
function write(name: string, bytes: Buffer): string {
  fs.mkdirSync(DIR, { recursive: true });
  const p = path.join(DIR, name);
  fs.writeFileSync(p, bytes);
  return p;
}

// A minimal but valid PK-zip carrying a .docx extension: sniffed as OOXML -> "not supported yet".
function fakeDocx(): Buffer {
  const eocd = Buffer.alloc(22);
  eocd.write("PK\x05\x06", 0, "latin1"); // empty-archive End Of Central Directory
  return Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(8), eocd]);
}
function encryptedPdf(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj<< /Encrypt 2 0 R >>endobj\ntrailer<< /Encrypt 2 0 R >>\n%%EOF");
}

export const fixtures = {
  screenshot: (n = "checkout-desktop.png") => write(n, screenshotPng()),
  screenshot2: (n = "checkout-mobile.png") => write(n, coloredScreenshotPng([40, 90, 160])),
  screenshotN: (i: number) => write(`screen-${i}.png`, coloredScreenshotPng([30 * i % 255, 80, 200 - 20 * i])),
  pdf: (n = "product-brief.pdf") => write(n, makePdf()),
  pdf2: (n = "spec-v2.pdf") => write(n, makePdf("Spec v2")),
  txt: (n = "notes.txt") => write(n, brandTxt()),
  md: (n = "guide.md") => write(n, Buffer.from("# Guide\n\n- One clear next step\n")),
  docx: (n = "deck.docx") => write(n, fakeDocx()),
  encryptedPdf: (n = "locked.pdf") => write(n, encryptedPdf()),
  oversized: (n = "huge.png") => write(n, Buffer.concat([screenshotPng(), Buffer.alloc(21 * 1024 * 1024, 0)])), // > 20 MB
  dir: DIR,
};
