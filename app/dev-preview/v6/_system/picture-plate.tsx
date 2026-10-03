import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import { photograph, type PhotographKey } from "../_content/photography";
import "./picture-plate.css";

/** A picture with its source outside the image. No app chrome, overlays, or invented controls. */
export function PicturePlate({ src, alt, w, h, caption, credit, source, evidence = false, eager = false }: {
  src: string | StaticImageData; alt: string; w?: number; h?: number; caption?: ReactNode;
  credit?: ReactNode; source?: string; evidence?: boolean; eager?: boolean;
}) {
  const naturalWidth = typeof src === "string" ? w : src.width;
  return (
    <figure className="v6-plate" data-kind={evidence ? "evidence" : "photograph"}
      style={evidence ? { width: "100%", maxWidth: Math.min(640, naturalWidth ?? 640) } : undefined}>
      <div className="v6-plate__image">
        <Image src={src} alt={alt} width={w} height={h}
          sizes={evidence ? "(max-width: 700px) calc(100vw - 40px), 640px" : "(max-width: 900px) 100vw, 60vw"}
          loading={eager ? "eager" : undefined} fetchPriority={eager ? "high" : undefined} />
      </div>
      {caption || credit ? <figcaption className="v6-plate__caption">
        {caption ? <span>{caption}</span> : null}
        {credit ? source ? <a href={source} target="_blank" rel="noopener noreferrer" data-no-translate>{credit}</a> : <span>{credit}</span> : null}
      </figcaption> : null}
    </figure>
  );
}
export function Photograph({ name, caption, eager }: { name: PhotographKey; caption?: ReactNode; eager?: boolean }) {
  const p = photograph(name);
  return <PicturePlate {...p} caption={caption} credit={`${p.author}, Pexels`} source={p.source} eager={eager} />;
}
