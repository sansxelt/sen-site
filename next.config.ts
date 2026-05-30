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
      { source: "/account/billing", destination: "/account/plan", permanent: true },
      { source: "/audio", destination: "/whisper", permanent: true },
      // Single-domain migration: /app → /chat, /platform-soon → /platform
      { source: "/app", destination: "/chat", permanent: false },
      { source: "/app/:path*", destination: "/chat/:path*", permanent: false },
      { source: "/platform-soon", destination: "/platform", permanent: false },
      { source: "/platform-soon/:path*", destination: "/platform/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
