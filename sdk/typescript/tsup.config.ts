import { defineConfig } from "tsup";

// Dual ESM + CJS build with type declarations. With `"type": "module"` in
// package.json, tsup emits index.js (ESM), index.cjs (CJS), and index.d.ts.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: false,
  treeshake: true,
  target: "node18",
  outDir: "dist",
});
