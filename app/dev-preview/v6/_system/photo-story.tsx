"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { photograph, type PhotographKey } from "../_content/photography";
import { MediaReadyFallback, useMediaReady } from "./media-ready";
import { Reveal } from "./ui";
import "./photo-story.css";

export type PhotoStoryContent = {
  photo: PhotographKey;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  link?: { label: string; href: string };
};

/** Licensed editorial photography describes the setting, never product output. */
export function PhotoStory({ content }: { content: PhotoStoryContent }) {
  const root = useRef<HTMLElement>(null);
  useMediaReady(root);
  const image = photograph(content.photo);
  return <section ref={root} className="photo-story v6-wrap" data-media-ready="pending" data-nav-theme="dark">
    <MediaReadyFallback />
    <figure className="photo-story__figure">
      <Image src={image.src} alt={image.alt} width={image.w} height={image.h} sizes="(max-width:900px) 100vw, 55vw" loading="lazy" />
      <figcaption><a href="/site/photography/CREDITS.md">Illustrative photography · Sources</a></figcaption>
    </figure>
    <div className="photo-story__copy" data-media-copy="">
      <Reveal>
        <p className="photo-story__eyebrow">{content.eyebrow}</p>
        <h2>{content.title}</h2>
        {content.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        {content.link ? <Link className="photo-story__link" href={content.link.href}>{content.link.label}</Link> : null}
      </Reveal>
    </div>
  </section>;
}
