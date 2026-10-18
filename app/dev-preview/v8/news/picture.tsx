import { COVER, coverSet, coverSrc, type Article } from "../_content/articles";

/** An article's own cover (2400 x 1500, with a 1200 version). */
export function Cover({ a, priority, sizes = "(max-width: 900px) 100vw, 640px" }: { a: Article; priority?: boolean; sizes?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={coverSrc(a.cover.name, true)} srcSet={coverSet(a.cover.name)} sizes={sizes} alt={a.cover.alt} width={COVER.w} height={COVER.h}
      loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" />
  );
}
