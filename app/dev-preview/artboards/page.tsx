import Link from "next/link";

// Index for the three art-direction artboards. Each linked page is a single full-viewport static composition,
// authored independently for desktop (1440x900) and mobile (390x844).
export default function ArtboardsIndex() {
  const boards: [string, string, string][] = [
    ["01", "home-open", "Homepage opening"],
    ["02", "proof", "Production proof, Failed to Verified"],
    ["03", "guarantee", "The Guarantee object"],
  ];
  return (
    <div className="ab ab-gallery">
      <h1>Art direction</h1>
      <p>Three static compositions. Each must be excellent as a still, with no scroll narrative and no motion. Approve the frames before any site system is rebuilt.</p>
      <ol>
        {boards.map(([n, slug, title]) => (
          <li key={slug}>
            <Link href={`/dev-preview/artboards/${slug}`}>
              <span className="n">{n}</span>
              <span className="t">{title}</span>
              <span className="d">1440×900 · 390×844</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
