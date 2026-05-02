// Minimal OpenNext config for Cloudflare Workers / Pages.
// Required by `opennextjs-cloudflare build` (per the error in
// the CF deploy log: "No `open-next.config.ts` file was found").
//
// defineCloudflareConfig({}) accepts the OpenNext defaults — no
// custom overrides — which is what we want for v1: a vanilla
// Next.js 16 app with no special routing / cache layers.
//
// If we later want incremental cache, ISR caching, or a custom
// asset binding, override fields here. Docs:
//   https://opennext.js.org/cloudflare/config

import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
