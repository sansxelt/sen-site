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
    "/install.ps1": ["./cli/install.ps1"],
  },
  // Compress responses
  compress: true,
  // Cache static assets aggressively
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000, // 1 year
  },
  // Security headers. Nothing in this repository set any of these before: no headers() here, no `headers`
  // block in vercel.json, and none in proxy.ts — so the site shipped with no HSTS, no CSP, no framing
  // protection and no nosniff.
  //
  // Everything below is ENFORCED except the CSP, which ships Report-Only on purpose. An enforcing
  // script-src would break two real features today:
  //   - components/code-block.tsx renders previews in an <iframe srcDoc sandbox="allow-scripts">, and a
  //     srcdoc iframe INHERITS the parent document's CSP, so the esm.sh / jsdelivr / unpkg scripts those
  //     previews load would be blocked;
  //   - the PayPal and Stripe SDKs inject their own scripts and frames.
  // Report-Only lets the policy be observed against real traffic first. Promote it to
  // "Content-Security-Policy" once the violation reports are clean — that is a deliberate follow-up, not
  // something to flip blind.
  async headers() {
    // NOTE ON HONESTY OF THIS POLICY: as written it is a baseline, not a strong control. script-src still
    // carries 'unsafe-inline', 'unsafe-eval' and three arbitrary-code CDNs, because the code-preview
    // feature and Next's inline bootstrap need them today. Against script injection that combination stops
    // very little — the real value here is object-src/base-uri/form-action/frame-ancestors plus the
    // reporting channel. Tightening script-src (nonce or strict-dynamic, and moving the preview to a
    // sandboxed origin that does NOT inherit this policy) is the follow-up that makes it meaningful.
    const cspBase = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.network https://www.paypal.com https://www.paypalobjects.com https://c.paypal.com https://unpkg.com https://cdn.jsdelivr.net https://esm.sh https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
      "img-src 'self' data: blob: https:",
      // Pyodide (code-block.tsx) fetches its wasm//data payloads from jsdelivr at RUNTIME, and the ESM
      // previews fetch from esm.sh and unpkg — those are connect-src, not script-src. Omitting them was a
      // real break waiting to happen on promotion. q.stripe.com and c.paypal.com carry the fraud-detection
      // beacons; dropping them silently disables fraud checks rather than showing an error.
      "connect-src 'self' https://api.stripe.com https://m.stripe.network https://q.stripe.com https://www.paypal.com https://c.paypal.com https://*.supabase.co https://api.supabase.com https://www.facebook.com https://cdn.jsdelivr.net https://esm.sh https://unpkg.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://m.stripe.network https://www.paypal.com https://c.paypal.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
      // Violations are POSTed here. Without a reporting sink, "Report-Only" observes nothing and the
      // documented plan to promote the policy after reviewing reports could never actually happen.
      "report-uri /api/csp-report",
    ];
    // frame-ancestors is NOT in the shared list. It is a framing control, so it belongs only on the routes
    // that also get X-Frame-Options — putting it in the shared policy would silently undo the deliberate
    // /f/ embedding exclusion the moment this policy is promoted to enforcing.
    const csp = cspBase.join("; ");
    const cspFramed = [...cspBase, "frame-ancestors 'self'"].join("; ");

    const base = [
      // Two years, subdomains included. `preload` is deliberately OMITTED: submitting to the preload list
      // is effectively irreversible and must be a conscious decision, not a side effect of this change.
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Referer is stripped on cross-origin downgrades, so a token in a callback URL cannot leak to a
      // third party in the Referer header.
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Only powerful features the app genuinely never uses. `payment` is intentionally NOT disabled —
      // that would break the Stripe/PayPal payment flows.
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), magnetometer=(), gyroscope=()" },
    ];

    return [
      {
        // SAMEORIGIN rather than DENY, and scoped to exclude /f/ below: the checkout, credits and settings
        // pages are the clickjacking targets the audit named, and none of them is ever framed by a
        // third party. The CSP here carries frame-ancestors to match.
        source: "/((?!f/).*)",
        headers: [
          ...base,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy-Report-Only", value: cspFramed },
        ],
      },
      {
        // /f/[key] is the embeddable intake form — it is meant to be iframed on customer sites. It is
        // retired and 404s unless VRAELIS_LEAD_AGENT is on, but omitting X-Frame-Options here means
        // re-enabling the product does not require also remembering to unbreak it. Its CSP omits
        // frame-ancestors for the same reason.
        source: "/f/:path*",
        headers: [...base, { key: "Content-Security-Policy-Report-Only", value: csp }],
      },
    ];
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
