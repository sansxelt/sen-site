// Production crawl fetcher = the injectable Fetcher the discovery crawl uses. Wraps lib/safe-fetch.ts
// (https+443 only, DNS resolved + pinned, private/loopback/metadata blocked, rebinding-proof). Redirects
// are followed MANUALLY with re-validation of every hop (safe-fetch re-DNS-pins each target). Body reads
// are bounded; only text/html with a 2xx status returns ok. A bot user-agent identifies Vraelis.
import { safeFetch, unsafeHttpsUrlReason } from "../safe-fetch";
import { normalizeUrl } from "./url-policy";
import type { FetchResult, Fetcher } from "./discover-crawl";

const UA = "VraelisPreflightBot/1.0 (+https://vraelis.com; authorized production preflight; contact help@vraelis.com)";

export function makeSafeFetcher(opts: { maxHtmlBytes?: number; maxRedirects?: number; perRequestMs?: number } = {}): Fetcher {
  const maxBytes = opts.maxHtmlBytes ?? 2 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 3;
  const timeoutMs = opts.perRequestMs ?? 10000;
  return async (url: string): Promise<FetchResult> => {
    let target = url, redirects = 0;
    for (;;) {
      const reason = unsafeHttpsUrlReason(target);          // pre-DNS gate (https, port, no private literal)
      if (reason) return { ok: false, reason };
      let res: Response;
      try { res = await safeFetch(target, { redirect: "manual", headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(timeoutMs) }); }
      catch { return { ok: false, reason: "blocked_or_unreachable" }; } // safe-fetch throws "blocked" on any private/rebind
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || redirects >= maxRedirects) return { ok: false, reason: "too_many_redirects", status: res.status };
        let abs: string; try { abs = new URL(loc, target).toString(); } catch { return { ok: false, reason: "redirect_invalid" }; }
        const next = normalizeUrl(abs);
        if (!next) return { ok: false, reason: "redirect_blocked" };
        target = next; redirects++; continue;               // re-validate + re-fetch the redirect target
      }
      if (res.status >= 400) return { ok: false, reason: `http_${res.status}`, status: res.status };
      const ct = res.headers.get("content-type") || "";
      if (!/text\/html/i.test(ct)) return { ok: false, reason: "non_html", status: res.status };
      const buf = await res.arrayBuffer();
      if (buf.byteLength > maxBytes) return { ok: false, reason: "page_too_large", status: res.status };
      return { ok: true, status: res.status, contentType: ct, html: Buffer.from(buf).toString("utf8") };
    }
  };
}
