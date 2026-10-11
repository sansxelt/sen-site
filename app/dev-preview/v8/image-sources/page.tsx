import Link from "next/link";
import type { ReactNode } from "react";
import { EDITORIAL_PHOTOGRAPHS } from "../../v6/_content/editorial-photography";
import { CAPTURES, Capture, PageHero, Section, Wrap, captureSrc, type CaptureName } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";
import "./image-sources.css";

export const metadata = v8meta({
  title: "Image sources",
  description: "Where every picture on the Vraelis site comes from: captures of the Vraelis Contour app, licensed editorial photographs and the systems films.",
  path: "/image-sources",
});

// Credits for every picture the v8 site can show. Photographs come from EDITORIAL_PHOTOGRAPHS (the registry the kit's
// photo helpers read), with authors and Pexels ids as recorded in public/site/photography/CREDITS.md. Film shots are
// the six clips listed in public/home/systems-film-sources.txt, restated here without that file's older product
// sentence. Product pictures come from CAPTURES in the kit: real captures, never rebuilt windows.
const PEXELS_LICENSE = "https://www.pexels.com/license/";

const RECORDINGS = [
  { file: "/v8/contour/contour-compare-tile.mp4", what: "A cropped screen recording of the app's destination screen stepping through the four recorded observations." },
  { file: "/v8/contour/contour-observations.mp4", what: "A screen recording of the app's destination screen stepping through the four recorded observations, with a WebM copy." },
];

const FILM_SHOTS: { shot: string; source: string; url: string; rights: string; commons?: string }[] = [
  { shot: "Warehouse robotic arm", source: "Ocelotwood, Pexels 16938947", url: "https://www.pexels.com/video/16938947/", rights: "Pexels License" },
  { shot: "Software on screen", source: "cottonbro, Pexels 5473798", url: "https://www.pexels.com/video/5473798/", rights: "Pexels License" },
  { shot: "LS3 quadruped research robot with Marines, July 10, 2014", source: "Sgt. William Holdaway, DVIDS 349764", url: "https://www.dvidshub.net/video/349764/ls3-action-along-side-3-3-marines", rights: "U.S. federal government work, public domain", commons: "https://commons.wikimedia.org/wiki/File:349764-LS3_in_action_along_side_3-3_Marines.webm" },
  { shot: "MQ-9 training flight over Nevada, July 15, 2019", source: "Senior Airman Haley Stevens, DVIDS 708466", url: "https://www.dvidshub.net/video/708466/mq-9-reaper-aerial-video", rights: "U.S. federal government work, public domain", commons: "https://commons.wikimedia.org/wiki/File:MQ-9_Reaper_aerial_video_DOD_107212162-5e1342c0d88af.webm" },
  { shot: "AH-64 Apache capability demonstration, Latvia, May 2, 2025", source: "Sgt. Charlie Duke, DVIDS 962366", url: "https://www.dvidshub.net/video/962366", rights: "U.S. federal government work, public domain", commons: "https://commons.wikimedia.org/wiki/File:AH-64_Apache_Capability_Demostration_(962366).webm" },
  { shot: "Apache live-fire training, Ustka, Poland, August 27, 2025", source: "Sgt. Jamie Robinson, DVIDS 975462", url: "https://www.dvidshub.net/video/975462/12th-combat-aviation-brigade-employs-spike-nlos-missile-system-historic-live-fire-event", rights: "U.S. federal government work, public domain", commons: "https://commons.wikimedia.org/wiki/File:U.S._Army_AH-64E_Apache_Guardian_Launching_a_SPIKE_NLOS_Missile.webm" },
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
            <li><a href="#films">Systems films</a></li>
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
            <h2 className="v8-h2">Systems films.</h2>
            <p className="v8-body">Silent original edits of these six clips (files /home/systems-film-*, posters from the same edits). No U.S. government relationship or endorsement is implied.</p>
          </div>
          <div className="v8-table-wrap imgs-table-wrap">
            <table className="v8-table imgs-table">
              <caption className="v8-sr">Film shots and their sources</caption>
              <thead><tr><th scope="col">Shot</th><th scope="col">Source</th><th scope="col">Rights</th></tr></thead>
              <tbody>
                {FILM_SHOTS.map((f) => (
                  <tr key={f.url}>
                    <td>{f.shot}</td>
                    <td><Out to={f.url}>{f.source}</Out>{f.commons ? <span className="imgs-also">Also on <Out to={f.commons}>Wikimedia Commons</Out></span> : null}</td>
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
            <h2 className="v8-h2">Partner logos and photographs.</h2>
            <p className="v8-body">The Reddit lockup is Reddit&apos;s own file from redditinc.com, and the ByteDance logo is ByteDance&apos;s own file from bytedance.com, both shown unmodified on the Partners pages. They are trademarks of their owners. The partner pages also use two licensed Pexels photographs: an aerial view of a city at night by Denys Mikhalevych (photo 12534226) and a person holding a phone in the dark by Jaroslav Maléř (photo 19949818).</p>
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
