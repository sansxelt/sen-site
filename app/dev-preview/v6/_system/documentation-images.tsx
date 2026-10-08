import Image from "next/image";
import { photograph } from "../_content/photography";
import { DOCUMENTATION_PHOTOGRAPHS } from "../_content/documentation-photography";

export function DocumentationImages({ slug }: { slug: string }) {
  const photos = DOCUMENTATION_PHOTOGRAPHS[slug];
  if (!photos) return null;
  return <figure className="v6-docs__photography">
    <div className="v6-docs__photography-grid">
      {photos.map(key => {
        const photo = photograph(key);
        return <div key={key} className="v6-docs__photography-image">
          <Image src={photo.src} alt={photo.alt} width={photo.w} height={photo.h}
            sizes="(max-width: 880px) calc((100vw - 60px) / 2), 340px" loading="lazy" />
        </div>;
      })}
    </div>
    <figcaption>Engineering context · Stock photography</figcaption>
  </figure>;
}
