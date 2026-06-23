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

// Normalized coarse source. channel "internal" = the Vraelis evaluate-&-earn pool
// (/api/v/vote); channel "embed" = the embeddable widget / shared vote link
// (/api/embed/vote). `framed` (client-detected window.self !== window.top) marks a
// true embedded widget; an external referrer without a frame is a referral.
export function deriveSource(opts: { channel: "internal" | "embed"; referer: string | null; framed?: boolean; utmSource?: unknown; utmCampaign?: unknown }): SourceFields {
  const host = hostFromReferer(opts.referer);
  const external = host && !OUR_HOSTS.includes(host) && !host.endsWith(".vercel.app") ? host : null;
  const utmSource = cleanUtm(opts.utmSource);
  const utmCampaign = cleanUtm(opts.utmCampaign);
  let source: string;
  if (opts.channel === "internal") source = "internal";
  else if (opts.framed) source = "embed";      // actually rendered inside a widget iframe
  else if (utmSource) source = "campaign";     // came through a UTM/campaign link
  else if (external) source = "referral";       // linked from another site, not framed
  else source = "direct_link";                  // opened the vote link directly
  return { source, referrerHost: external, utmSource, utmCampaign };
}

// Coarse source labels.
export const SOURCE_LABEL: Record<string, string> = {
  internal: "Vraelis pool", embed: "Embed", campaign: "Campaign", direct_link: "Direct link",
  referral: "Referral", web: "Direct link",
};
export function sourceLabel(s: string | null | undefined): string { return s ? (SOURCE_LABEL[s] ?? "Unknown") : "Unknown"; }

// Collection-link channel presets (label + the channel key stored as source/utm_source).
export const CHANNEL_PRESETS: { key: string; label: string }[] = [
  { key: "direct_link", label: "Direct link" }, { key: "instagram", label: "Instagram" }, { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" }, { key: "discord", label: "Discord" }, { key: "email", label: "Email" },
  { key: "embed", label: "Website embed" }, { key: "client_review", label: "Client review" }, { key: "internal", label: "Internal team" },
  { key: "paid", label: "Paid traffic" }, { key: "other", label: "Other" },
];
const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(CHANNEL_PRESETS.map((p) => [p.key, p.label]));

// Channel = utm_source (a named collection-link channel) when present, else the
// coarse source. Used by the source/channel analytics views.
export function channelLabel(key: string | null | undefined): string {
  if (!key) return "Unknown";
  return CHANNEL_LABEL[key] ?? SOURCE_LABEL[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
