// Find local businesses via OpenStreetMap (Nominatim) — free, no API key,
// no billing. Returns prospects (name / address / phone / website) the
// owner reviews and imports as leads. Data is sparser than Google's
// (many OSM entries lack phone/website), but it costs nothing.
//
// Nominatim usage policy: identify with a User-Agent, keep volume low
// (owner searches, not bulk). https://operations.osmfoundation.org/policies/nominatim/

export type Prospect = {
  name: string;
  address: string;
  phone: string;
  website: string;
};

export async function findBusinesses(
  query: string,
): Promise<{ ok: boolean; prospects?: Prospect[]; error?: string }> {
  if (!query.trim()) return { ok: false, error: "empty_query" };

  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: query.trim(),
      format: "jsonv2",
      limit: "25",
      extratags: "1",
      addressdetails: "1",
    }).toString();

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Vraelis Lead Finder (+https://vraelis.com)",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) return { ok: false, error: "search_failed" };
    const rows = (await res.json()) as Array<{
      name?: string;
      display_name?: string;
      extratags?: Record<string, string> | null;
      addresstype?: string;
    }>;

    const prospects: Prospect[] = rows
      .map((r) => {
        const tags = r.extratags ?? {};
        const name = (r.name || (r.display_name ?? "").split(",")[0] || "").trim();
        return {
          name,
          address: r.display_name ?? "",
          phone: tags.phone || tags["contact:phone"] || tags["contact:mobile"] || "",
          website: tags.website || tags["contact:website"] || "",
        };
      })
      // Keep results that have a real business-looking name.
      .filter((p) => p.name && p.name.length > 1);

    return { ok: true, prospects };
  } catch (error) {
    console.error("findBusinesses failed:", error);
    return { ok: false, error: "search_failed" };
  }
}
