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
      <Image src={image.src} alt={image.alt} width={image.w} height={image.h} sizes="100vw" loading="lazy" />
      <figcaption className="photo-story__headline" data-media-copy=""><p className="photo-story__eyebrow">{content.eyebrow}</p><h2>{content.title}</h2></figcaption>
    </figure>
    <div className="photo-story__copy" data-media-copy="">
      <Reveal>
        <div className="photo-story__paragraphs">{content.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
        {content.link ? <Link className="photo-story__link" href={content.link.href}>{content.link.label}</Link> : null}
      </Reveal>
    </div>
  </section>;
}
