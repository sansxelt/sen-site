import Link from "next/link";
import type { ReactNode } from "react";
import { EDITORIAL_PHOTOGRAPHS } from "../../v6/_content/editorial-photography";
import { CAPTURES, Capture, PageHero, Section, Wrap, captureSrc, type CaptureName } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";
import "./image-sources.css";

export const metadata = v8meta({
  title: "Image sources",
  description: "Where every picture on the Vraelis site comes from: captures of the Vraelis Contour app, licensed editorial photographs and the systems film.",
  path: "/image-sources",
});

// Credits for every picture the v8 site can show. Photographs come from EDITORIAL_PHOTOGRAPHS (the registry the kit's
// photo helpers read), with authors and Pexels ids as recorded in public/site/photography/CREDITS.md. Film shots are
// the seven Pexels clips in the homepage film (/home/systems-film-civil.mp4), as listed in
// public/home/systems-film-sources.txt and scripts/field-film/SOURCES.md. The v8 site shows no military footage.
// Product pictures come from CAPTURES in the kit: real captures, never rebuilt windows.
const PEXELS_LICENSE = "https://www.pexels.com/license/";

const RECORDINGS = [
  { file: "/v8/contour/contour-compare-tile.mp4", what: "A cropped screen recording of the app's destination screen stepping through the four recorded observations." },
  { file: "/v8/contour/contour-observations.mp4", what: "A screen recording of the app's destination screen stepping through the four recorded observations, with a WebM copy." },
];

const FILM_SHOTS: { shot: string; source: string; url: string; rights: string }[] = [
  { shot: "Industrial robot arm on a production line", source: "Usman AbdulrasheedGambo, Pexels 32386532", url: "https://www.pexels.com/video/32386532/", rights: "Pexels License" },
  { shot: "Factory floor with mobile robots", source: "Usman AbdulrasheedGambo, Pexels 32386627", url: "https://www.pexels.com/video/32386627/", rights: "Pexels License" },
  { shot: "Drone view of a power substation", source: "Thanh Văn, Pexels 10416553", url: "https://www.pexels.com/video/10416553/", rights: "Pexels License" },
  { shot: "Civilian quadcopter in flight", source: "Grisha Grishkoff, Pexels 4446375", url: "https://www.pexels.com/video/4446375/", rights: "Pexels License" },
  { shot: "Drone view of a solar farm", source: "Roman Odintsov, Pexels 7042814", url: "https://www.pexels.com/video/7042814/", rights: "Pexels License" },
  { shot: "Warehouse robotic arm stacking pallets", source: "Ocelotwood, Pexels 16938947", url: "https://www.pexels.com/video/16938947/", rights: "Pexels License" },
  { shot: "Software on screen", source: "cottonbro studio, Pexels 5473798", url: "https://www.pexels.com/video/5473798/", rights: "Pexels License" },
];

function Out({ to, children }: { to: string; children: ReactNode }) {
  return <a className="v8-under" href={to} rel="noopener noreferrer" target="_blank">{children}<span className="v8-sr"> (opens in a new tab)</span></a>;
}

export default function ImageSources() {
  const photos = Object.values(EDITORIAL_PHOTOGRAPHS);
  const captures = Object.keys(CAPTURES) as CaptureName[];
  return (
    <div className="imgs">
      <PageHero
        eyebrow="Resources"
        title="Image sources."
        lead="Where every picture comes from. Photographs and films are context, not Vraelis customers, deployments or hardware."
      />

      <nav className="imgs-toc" aria-label="On this page">
        <Wrap>
          <ul>
            <li><a href="#product-captures">Product captures</a></li>
            <li><a href="#photographs">Photographs</a></li>
            <li><a href="#films">Systems film</a></li>
          </ul>
        </Wrap>
      </nav>

      <Section rule id="product-captures" className="imgs-sec">
        <Wrap>
          <div className="imgs-split">
            <div className="v8-head">
              <span className="v8-eyebrow">Product captures</span>
              <h2 className="v8-h2">Captures of the real app.</h2>
              <p className="v8-lead">Screenshots and recordings of the read-only app, captured October 10, 2026.</p>
            </div>
            <Capture name="app-overview" small />
          </div>
          <div className="v8-table-wrap imgs-table-wrap">
            <table className="v8-table imgs-table">
              <caption className="v8-sr">Captures of the Vraelis Contour app</caption>
              <thead><tr><th scope="col">File</th><th scope="col">What it shows</th></tr></thead>
              <tbody>
                {captures.map((c) => (
                  <tr key={c}><td><code className="imgs-file">{captureSrc(c)}</code></td><td>{CAPTURES[c].alt}</td></tr>
                ))}
                {RECORDINGS.map((r) => (
                  <tr key={r.file}><td><code className="imgs-file">{r.file}</code></td><td>{r.what}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="v8-small imgs-after">Crops, half-width copies (-1200 before the extension) and recording posters come from the same captures.</p>
        </Wrap>
      </Section>

      <Section rule id="photographs" className="imgs-sec">
        <Wrap>
          <div className="v8-head imgs-head">
            <span className="v8-eyebrow">Photographs</span>
            <h2 className="v8-h2">{photos.length} licensed editorial photographs.</h2>
            <p className="v8-body">From Pexels under the <Out to={PEXELS_LICENSE}>Pexels License</Out>, browser cropping only. No endorsement or relationship is implied.</p>
          </div>
          <div className="v8-table-wrap imgs-table-wrap">
            <table className="v8-table imgs-table">
              <caption className="v8-sr">Photographs, photographers and sources</caption>
              <thead><tr><th scope="col">Photograph</th><th scope="col">Photographer</th><th scope="col">Source</th></tr></thead>
              <tbody>
                {photos.map((p) => (
                  <tr key={p.file}>
                    <td><span className="imgs-alt">{p.alt}</span><code className="imgs-file">/site/photography/{p.file}.jpg</code></td>
                    <td>{p.author}</td>
                    <td><Out to={`https://www.pexels.com/photo/${p.id}/`}>Pexels {p.id}</Out></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Wrap>
      </Section>

      <Section rule id="films" className="imgs-sec">
        <Wrap>
          <div className="v8-head imgs-head">
            <span className="v8-eyebrow">Films</span>
            <h2 className="v8-h2">Systems film.</h2>
            <p className="v8-body">A silent original edit of these seven clips from Pexels under the <Out to={PEXELS_LICENSE}>Pexels License</Out> (file /home/systems-film-civil.mp4, poster from the same edit). It plays on the homepage and on the Applications overview. The footage is context, not Vraelis hardware, customers or deployments. No endorsement or relationship is implied.</p>
          </div>
          <div className="v8-table-wrap imgs-table-wrap">
            <table className="v8-table imgs-table">
              <caption className="v8-sr">Film shots and their sources</caption>
              <thead><tr><th scope="col">Shot</th><th scope="col">Source</th><th scope="col">Rights</th></tr></thead>
              <tbody>
                {FILM_SHOTS.map((f) => (
                  <tr key={f.url}>
                    <td>{f.shot}</td>
                    <td><Out to={f.url}>{f.source}</Out></td>
                    <td>{f.rights === "Pexels License" ? <Out to={PEXELS_LICENSE}>Pexels License</Out> : f.rights}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Wrap>
      </Section>

      <Section rule id="partner-logos" className="imgs-sec">
        <Wrap>
          <div className="v8-stack">
            <h2 className="v8-h2">Partner names and photographs.</h2>
            <p className="v8-body">The homepage band and the Partners pages show each partner&apos;s official logo as the company publishes it: Reddit&apos;s lockup from Reddit&apos;s brand page, ByteDance&apos;s logo from bytedance.com and the Stripe Startups lockup from stripe.com/startups, the last two shown in white on our dark pages. Reddit, ByteDance, Stripe and Stripe Startups are trademarks of their owners. The partner pages also use three licensed Pexels photographs: an aerial view of a city at night by Denys Mikhalevych (photo 12534226), a person holding a phone in the dark by Jaroslav Maléř (photo 19949818) and a hand holding a black card by cottonbro studio (photo 8657364).</p>
          </div>
        </Wrap>
      </Section>
      <Section rule tight>
        <Wrap>
          <p className="v8-body">A question about a picture or its credit? <Link className="v8-under" href={href("/contact")}>Contact us</Link>.</p>
        </Wrap>
      </Section>
    </div>
  );
}
