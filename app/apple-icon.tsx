import { ImageResponse } from "next/og";
import { headers } from "next/headers";

// Apple touch icon. Same per-host pinwheel as app/icon.tsx, scaled
// up to 180x180 for the iOS home screen / iPadOS dock. Replaces the
// static app/apple-icon.png so the mark stays in sync when the
// brand SVGs change.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

function pinwheelDataUri(accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 680"><rect width="680" height="680" fill="#0a0a0a" rx="24"/><polygon points="340,340 180,180 340,140" fill="#ffffff"/><polygon points="340,340 500,180 540,340" fill="${accent}"/><polygon points="340,340 380,540 200,500" fill="#ffffff"/><circle cx="340" cy="340" r="14" fill="#0a0a0a"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default async function AppleIcon() {
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
