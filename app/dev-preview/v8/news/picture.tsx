import type { Article } from "../_content/articles";

/** A story's picture: a licensed library photograph or a real Contour capture, unique to the story. */
export function Cover({ a, priority, sizes = "(max-width: 900px) 100vw, 640px" }: { a: Article; priority?: boolean; sizes?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={a.cover.src} srcSet={a.cover.srcSet} sizes={sizes} alt={a.cover.alt} width={a.cover.w} height={a.cover.h} data-capture={a.cover.capture || undefined}
      loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" />
  );
}
