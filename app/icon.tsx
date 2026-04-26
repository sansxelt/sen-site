import { ImageResponse } from "next/og";
import { headers } from "next/headers";

// Per-host favicon. Pinwheel mark with one accent triangle that
// changes per zone — same geometry as the brand logos in
// public/logo-{violet,cyan,amber}.svg.
//
//   sansxel.ai          → violet pinwheel (main)
//   chat.sansxel.ai     → cyan   pinwheel (workshop)
//   platform.sansxel.ai → amber  pinwheel (developer console)
//
// Inlined as a data URI <img> so Satori (next/og) rasterizes it
// reliably — direct <svg> JSX inside ImageResponse is finicky.

export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export const dynamic = "force-dynamic"; // host-aware, can't be cached statically

function pinwheelDataUri(accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 680"><rect width="680" height="680" fill="#0a0a0a" rx="24"/><polygon points="340,340 116,116 340,60" fill="#ffffff"/><polygon points="340,340 564,116 620,340" fill="${accent}"/><polygon points="340,340 396,620 144,564" fill="#ffffff"/><circle cx="340" cy="340" r="14" fill="#0a0a0a"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default async function Icon() {
  const h = await headers();
  const host = (h.get("host") ?? "").toLowerCase();
  const accent = host.startsWith("chat.")
    ? "#22D3EE"
    : host.startsWith("platform.")
      ? "#FBBF24"
      : "#A78BFA";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pinwheelDataUri(accent)}
          width={size.width}
          height={size.height}
          alt=""
        />
      </div>
    ),
    { ...size },
  );
}
