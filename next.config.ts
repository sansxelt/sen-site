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
      { source: "/platform", destination: "/", permanent: true },
      { source: "/platform/:path*", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
