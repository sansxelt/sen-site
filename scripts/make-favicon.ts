// Generates app/favicon.ico from lib/brand-mark.
//
// WHY THIS FILE HAS TO EXIST AT ALL. app/icon.tsx already renders the mark, and Next serves it at a hashed
// URL with a <link rel="icon"> pointing at it. That is the correct modern setup and it is not enough:
// /favicon.ico returned 404 in production, because nothing was serving the root path.
//
// A large share of the things that show a site's icon never read the <link> tag. They request
// /favicon.ico at the domain root by convention, and when that 404s they fall back to whatever they
// cached the last time they got one — which is how a rebranded site keeps showing its old mark in search
// results and AI answers long after the tab icon is right. That was the reported symptom.
//
// app/favicon.ico is the file convention that fills the gap (docs: 01-app/03-api-reference/
// 03-file-conventions/01-metadata/app-icons.md — "The favicon image can only be located in the top level
// of app/"). It has to be a real .ico, so it is generated rather than hand-drawn.
//
// DRAWN FROM lib/brand-mark, not from public/icon-original.png. The same reasoning icon.tsx gives: one
// definition shared with the iOS icon, the site header and the OG card, so the mark cannot drift between
// the tab and the search result. Rasterising the artwork PNG instead would make this the one icon on the
// site with its own source.
//
// Run: npx tsx scripts/make-favicon.ts
import { readdirSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { MARK_FACETS, MARK_VIEWBOX } from "../lib/brand-mark";

// sharp is a transitive dependency here and is not hoisted under pnpm's strict layout, so it is resolved
// out of the store rather than by bare name. Declaring it just for a one-off asset script would add a
// direct dependency to the app for something the app never imports.
// createRequire is given a path rather than import.meta.url: tsx transforms this to CJS, where
// import.meta does not exist.
const require_ = createRequire(`${process.cwd()}/package.json`);
const sharpDir = readdirSync("node_modules/.pnpm").find((d) => /^sharp@/.test(d));
if (!sharpDir) throw new Error("sharp not found in the pnpm store; run pnpm install");
const sharp = require_(`./node_modules/.pnpm/${sharpDir}/node_modules/sharp`);

// Transparent, exactly like app/icon.tsx. That was a deliberate call recorded there: a tile competes with
// every other tile in the tab strip, and the mark's right facets run dark enough to hold the silhouette
// against a pale tab strip as well as a dark one.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}">${
  MARK_FACETS.map((f) => `<path d="${f.d}" fill="${f.fill}"/>`).join("")
}</svg>`;

/** The three sizes that actually get used: tab strip, retina tab strip, and Windows shortcuts. */
const SIZES = [16, 32, 48];

/** ICO container around PNG payloads. Every consumer that matters has read PNG-in-ICO since Vista, and it
 *  keeps the alpha channel that a classic BMP-in-ICO would need a separate mask for. */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // reserved
  header.writeUInt16LE(1, 2);            // 1 = icon
  header.writeUInt16LE(images.length, 4);

  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach((img, i) => {
    const at = i * 16;
    // 256 is encoded as 0 in this field. None of SIZES hit that, but the rule is worth honouring so a
    // later addition does not silently write 256 as-is.
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, at);
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, at + 1);
    dir.writeUInt8(0, at + 2);           // palette size, 0 for truecolour
    dir.writeUInt8(0, at + 3);           // reserved
    dir.writeUInt16LE(1, at + 4);        // colour planes
    dir.writeUInt16LE(32, at + 6);       // bits per pixel
    dir.writeUInt32LE(img.data.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += img.data.length;
  });

  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

// Wrapped rather than top-level await: tsx's CJS output does not support it.
async function main() {
  const images: { size: number; data: Buffer }[] = [];
  for (const size of SIZES) {
    images.push({
      size,
      data: await sharp(Buffer.from(svg), { density: 384 })
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    });
  }
  const out = ico(images);
  writeFileSync("app/favicon.ico", out);
  console.log(`app/favicon.ico written: ${SIZES.join("/")}px, ${out.length} bytes`);
}

void main();
