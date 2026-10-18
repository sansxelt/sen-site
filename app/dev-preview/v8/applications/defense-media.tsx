import Link from "next/link";
import { href } from "../_kit/site";

// Public-domain U.S. Space Force photograph, DVIDS 8736415, July 22, 2024.
// Source, author and DoD non-endorsement notice: /image-sources#defense-photograph.
// Contextual sensing hardware, not a Vraelis product or deployment. Original photo bytes are unchanged.
const IMAGE = {
  src: "/site/photography/defense-cbrn-robot.jpg",
  srcSet: "/site/photography/defense-cbrn-robot-1000.jpg 1000w, /site/photography/defense-cbrn-robot.jpg 2000w",
  alt: "Close-up of chemical and radiological sensors mounted on the CHAPPIE quadruped robot at Buckley Space Force Base.",
  w: 2000,
  h: 1331,
};

export function DefensePhoto() {
  return (
    <figure className="rx-photo">
      <div className="rx-photo__frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMAGE.src} srcSet={IMAGE.srcSet} sizes="(max-width: 720px) 100vw, 1280px"
          alt={IMAGE.alt} width={IMAGE.w} height={IMAGE.h} fetchPriority="high" decoding="async" />
      </div>
    </figure>
  );
}

export function DefenseCard({ title, line }: { title: string; line: string }) {
  return (
    <Link href={href("/applications/defense")} className="v8-photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={IMAGE.src} srcSet={IMAGE.srcSet} sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 420px"
        alt={IMAGE.alt} width={IMAGE.w} height={IMAGE.h} loading="lazy" decoding="async" />
      <span className="v8-photo__label"><b>{title}</b><span>{line}</span></span>
    </Link>
  );
}
