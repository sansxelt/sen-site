// Startup evidence for the actual server process. Never log environment variables,
// request data, or credentials. A build log alone does not verify production.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.info(`[vraelis-runtime] node=${process.versions.node} brotli=${process.versions.brotli ?? "unknown"}`);
  }
}
