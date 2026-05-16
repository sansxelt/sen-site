import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

function vChevronSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#000000"/><path fill="#ffffff" d="M 14,23 L 17,19 L 33,19 L 25,32 L 50,55 L 75,32 L 67,19 L 83,19 L 86,23 L 50,82 Z"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={vChevronSvg()} width={size.width} height={size.height} alt="" />
      </div>
    ),
    { ...size },
  );
}
