import { ImageResponse } from "next/og";

// iOS home-screen icon (180x180): the Vraelis mark in white on a deep-green tile — high contrast,
// reads clearly as an app icon. iOS rounds the corners itself, so a full-bleed tile is correct.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0A7B54",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 2048 2048">
          <path
            d="M 1613.215 1181.880 A 610 610 0 1 1 1613.215 866.120"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="230"
            strokeLinecap="round"
          />
          <circle cx="1024" cy="1024" r="200" fill="#FFFFFF" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
