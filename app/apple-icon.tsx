import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000000", display: "flex" }}>
        <div style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          clipPath: "polygon(14% 23%, 17% 19%, 33% 19%, 25% 32%, 50% 55%, 75% 32%, 67% 19%, 83% 19%, 86% 23%, 50% 82%)",
        }} />
      </div>
    ),
    { ...size },
  );
}
