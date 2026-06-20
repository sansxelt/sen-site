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
  // The embeddable vote widget must be framable on any external site.
  async headers() {
    return [
      { source: "/embed/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
    ];
  },
  async redirects() {
    return [
      { source: "/features", destination: "/product", permanent: true },
      { source: "/function", destination: "/product", permanent: true },
      { source: "/account/billing", destination: "/account/plan", permanent: true },
      { source: "/audio", destination: "/whisper", permanent: true },
      // Legacy route redirects ( /app is now the Flip tool — handled by proxy.ts )
      { source: "/platform-soon", destination: "/chat", permanent: false },
      { source: "/platform-soon/:path*", destination: "/chat", permanent: false },
      { source: "/platform", destination: "/chat", permanent: false },
      { source: "/platform/:path*", destination: "/chat", permanent: false },
    ];
  },
};

export default nextConfig;
