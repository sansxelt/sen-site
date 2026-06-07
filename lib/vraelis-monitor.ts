// Lightweight, dependency-free error/event capture. Always logs structured
// JSON (shows up in Vercel logs). If SENTRY_DSN is set, it also POSTs a
// minimal event to Sentry's store endpoint — no @sentry/nextjs package
// required. Used to track AI, Stripe, and Twilio failures.
//
// To upgrade to full Sentry later: `npm i @sentry/nextjs`, add the
// instrumentation files, and this util can forward to it instead.

type Extra = Record<string, unknown>;

function parseDsn(dsn: string): { url: string; key: string } | null {
  // https://<key>@<host>/<project>
  const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!m) return null;
  const [, key, host, project] = m;
  return { url: `https://${host}/api/${project}/store/`, key };
}

async function forwardToSentry(level: "error" | "info", message: string, extra?: Extra) {
  const dsn = (process.env.SENTRY_DSN || "").trim();
  if (!dsn) return;
  const parsed = parseDsn(dsn);
  if (!parsed) return;
  try {
    await fetch(parsed.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=vraelis/1.0`,
      },
      body: JSON.stringify({
        platform: "node",
        level,
        message,
        environment: process.env.VERCEL_ENV || "production",
        tags: { service: "vraelis" },
        extra: extra ?? {},
      }),
    });
  } catch {
    /* never let monitoring throw */
  }
}

// Capture an error with a `where` tag (e.g. "ai", "stripe", "twilio").
export function captureError(where: string, error: unknown, extra?: Extra): void {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(JSON.stringify({ evt: "error", where, message: msg, ...extra }));
  void forwardToSentry("error", `[${where}] ${msg}`, { stack, ...extra });
}

// Capture a noteworthy non-error event (e.g. a Stripe webhook handled).
export function captureEvent(name: string, data?: Extra): void {
  console.log(JSON.stringify({ evt: name, ...data }));
}
