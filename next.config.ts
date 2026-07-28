import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tree-shake heavy packages so only used exports are bundled
    optimizePackageImports: ["resend", "@supabase/supabase-js", "stripe"],
  },
  // Load undici from node_modules at runtime instead of bundling it — the webhook
  // SSRF guard pairs undici's fetch with its Agent (IP pinning), and a bundled
  // copy mismatches the runtime and breaks deliveries.
  serverExternalPackages: ["undici", "pdf-parse"],
  // The CLI is served from its SOURCE file so there is never a second copy to go stale. cli/vraelis.mjs is
  // not imported by anything, so nothing would otherwise trace it into the route's bundle and the download
  // would 404 in production while working locally.
  outputFileTracingIncludes: {
    "/cli/vraelis.mjs": ["./cli/vraelis.mjs"],
    "/install": ["./cli/install.sh"],
  },
  // Compress responses
  compress: true,
  // Cache static assets aggressively
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000, // 1 year
  },
  // Routes from retired product generations. Their old destinations (/product, /account/plan, /whisper,
  // /chat) are retired too, so every source goes straight home in ONE permanent hop instead of bouncing
  // through a retired intermediate that the proxy would then redirect home anyway.
  async redirects() {
    return [
      { source: "/features", destination: "/", permanent: true },
      { source: "/function", destination: "/", permanent: true },
      { source: "/account/billing", destination: "/", permanent: true },
      { source: "/audio", destination: "/", permanent: true },
      { source: "/platform-soon", destination: "/", permanent: true },
      { source: "/platform-soon/:path*", destination: "/", permanent: true },
      // /platform IS A REAL PAGE ONCE V6 IS PROMOTED, and it is a main nav item.
      //
      // Config redirects run BEFORE middleware, so this fired before the proxy ever saw the request: with
      // the flag on, a top-level nav link bounced to the homepage and no amount of proxy work could stop it.
      // Retired while V6 is not public, absent once it is.
      //
      // Note the cost of `permanent: true` here: browsers cache a 308 indefinitely, so anyone who hit
      // /platform before promotion keeps being redirected until their cache clears. That is the price of
      // marking a redirect permanent on a path you might later want back.
      ...(process.env.NEXT_PUBLIC_VRAELIS_V6_PUBLIC === "1"
        ? []
        : [
          { source: "/platform", destination: "/", permanent: true },
          { source: "/platform/:path*", destination: "/", permanent: true },
        ]),
    ];
  },
};

export default nextConfig;
