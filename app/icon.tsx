import { ImageResponse } from "next/og";

// Favicon: the Vraelis mark (gapped ring + solid core), monochrome — ink on a cream tile so it reads
// clearly in a browser tab. Rendered with next/og; served at a hashed URL (auto cache-bust on change).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#FAF8F4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="30" height="30" viewBox="0 0 2048 2048">
          <path
            d="M 1613.215 1181.880 A 610 610 0 1 1 1613.215 866.120"
            fill="none"
            stroke="#141310"
            strokeWidth="240"
            strokeLinecap="round"
          />
          <circle cx="1024" cy="1024" r="205" fill="#141310" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
