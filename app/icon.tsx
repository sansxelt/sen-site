import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          clipPath: "polygon(10% 18%, 26% 18%, 50% 68%, 74% 18%, 90% 18%, 50% 88%)",
        }} />
      </div>
    ),
    { ...size },
  );
}
