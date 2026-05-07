import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tree-shake heavy packages so only used exports are bundled
    optimizePackageImports: ["resend", "@supabase/supabase-js", "stripe"],
  },
  // Compress responses
  compress: true,
  // Cache static assets aggressively
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000, // 1 year
  },
  // /features and /function were merged into /product. Permanent
  // redirects so old links + indexed pages land on the canonical
  // route without a 404.
  async redirects() {
    return [
      { source: "/features", destination: "/product", permanent: true },
      { source: "/function", destination: "/product", permanent: true },
      // Legacy single-page billing was split into Plan / Addons /
      // Credits under Shop. Old bookmarks land on Plan.
      { source: "/account/billing", destination: "/account/plan", permanent: true },
      // Audio rebranded to Whisper, the speaking + hearing layer.
      { source: "/audio", destination: "/whisper", permanent: true },
    ];
  },
};

export default nextConfig;
