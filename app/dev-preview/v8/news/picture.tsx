import type { ArticleImage } from "../_content/articles";

/** An article's picture. Product captures keep their top-left corner in view; photographs fill the frame. */
export function ArticlePicture({ image, priority }: { image: ArticleImage; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image.src} alt={image.alt} width={image.w} height={image.h} data-capture={!image.photo || undefined}
      loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" />
  );
}
