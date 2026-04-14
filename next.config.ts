import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tree-shake heavy packages so only used exports are bundled
    optimizePackageImports: ["resend", "@supabase/supabase-js", "stripe"],
    viewTransition: true,
  },
  // Compress responses
  compress: true,
  // Cache static assets aggressively
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000, // 1 year
  },
};

export default nextConfig;
