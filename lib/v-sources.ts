// Privacy-safe judgment source derivation. We store ONLY a coarse normalized
// channel, a referrer HOSTNAME (never the full URL — so no share tokens / query
// params), and short sanitized utm_source/utm_campaign. Never raw IPs, user
// agents, or full referrers.

const OUR_HOSTS = ["vraelis.com", "www.vraelis.com", "localhost"];

function hostFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try { return (new URL(referer).hostname || "").toLowerCase().slice(0, 120) || null; } catch { return null; }
}
function cleanUtm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return s || null;
}

export type SourceFields = { source: string; referrerHost: string | null; utmSource: string | null; utmCampaign: string | null };

// channel "internal" = the Vraelis evaluate-&-earn pool (/api/v/vote);
// channel "embed"    = the embeddable widget / shared vote link (/api/embed/vote).
export function deriveSource(opts: { channel: "internal" | "embed"; referer: string | null; utmSource?: unknown; utmCampaign?: unknown }): SourceFields {
  const host = hostFromReferer(opts.referer);
  const external = host && !OUR_HOSTS.includes(host) && !host.endsWith(".vercel.app") ? host : null;
  const utmSource = cleanUtm(opts.utmSource);
  const utmCampaign = cleanUtm(opts.utmCampaign);
  let source: string;
  if (opts.channel === "internal") source = "internal";
  else if (utmSource) source = "campaign";
  else if (external) source = "embed";        // embedded on / referred from an external host
  else source = "direct_link";                 // opened the vote link directly
  return { source, referrerHost: external, utmSource, utmCampaign };
}

export const SOURCE_LABEL: Record<string, string> = {
  internal: "Vraelis pool", embed: "Embed", campaign: "Campaign", direct_link: "Direct link",
  referral: "Referral", web: "Direct link",
};
export function sourceLabel(s: string | null | undefined): string { return s ? (SOURCE_LABEL[s] ?? "Unknown") : "Unknown"; }
