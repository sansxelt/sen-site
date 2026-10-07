import { isAppPath } from "./app-routes";

// Access is deliberately closed while the AI-security product is built.
// Reopening requires a reviewed code change; an existing session grants no bypass.
export const APP_ACCESS_OPEN: boolean = false;
export const WORKSPACE_HOST = "data.vraelis.com";

export function isWorkspaceHost(host: string): boolean {
  return host === WORKSPACE_HOST || /^data\.localhost(?::\d+)?$/.test(host);
}

// A concrete public next step while the product is private.
export const SYSTEM_INQUIRY_LABEL = "Talk AI security";
export const SYSTEM_INQUIRY_PATH = "/contact?topic=ai-security";

const at = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

export function isClosedProductPage(path: string, host: string): boolean {
  if (APP_ACCESS_OPEN) return false;
  const appHost = isWorkspaceHost(host) || host === "app.vraelis.com" || host === "console.vraelis.com" || host.startsWith("app.localhost");
  return (appHost && !at(path, "/api")) || isAppPath(path)
    || ["/rank/app", "/dev-preview/v6/app", "/dev-preview/v6/signin", "/dev-preview/recorded-app", "/console", "/r", "/rank/r",
      "/signin", "/signup", "/auth/signin", "/auth/auto-signin"].some(root => at(path, root));
}

export function isClosedProductApi(path: string): boolean {
  if (APP_ACCESS_OPEN) return false;
  // Keep existing payment notifications and account/data-rights requests operational.
  if (["/api/v/paypal/webhook", "/api/v/account/delete", "/api/v/data-requests"].some(root => at(path, root))) return false;
  return ["/api/fixtures", "/api/preflight", "/api/v", "/api/v1", "/api/mcp", "/api/oauth",
    "/api/auth/signin", "/api/auth/callback", "/api/auth/register", "/api/auth/two-step",
    "/api/stripe/payment-intent", "/api/vraelis/checkout", "/api/vraelis/pay/create", "/api/vraelis/billing/portal"
  ].some(root => at(path, root));
}

/** Public links cannot offer authentication or product access while the console is closed. */
export function isProductEntryHref(href: string): boolean {
  try {
    const url = new URL(href, "https://vraelis.com");
    if (!["vraelis.com", "www.vraelis.com", "app.vraelis.com", "console.vraelis.com", WORKSPACE_HOST].includes(url.hostname)) return false;
    const path = url.pathname.startsWith("/dev-preview/v6/") ? url.pathname.slice("/dev-preview/v6".length) : url.pathname;
    return isClosedProductPage(path, url.host);
  } catch {
    return false;
  }
}
