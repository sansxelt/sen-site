import { v6meta } from "../_system/meta";
import { IndexHero } from "../_system/kit";
import { SolutionCards } from "../_system/sector";
import { ClosingScene } from "../_system/close";
import { SOLUTIONS_INDEX } from "../_content/sector-pages";

// THE SOLUTIONS INDEX (plan S2 and template T14): the same loop in one line, then every sector in the registry's
// two groups, "Sectors" and "Teams" (_content/sectors.ts, never hand-listed), then the closing.

export const metadata = v6meta({
  title: SOLUTIONS_INDEX.meta.title,
  description: SOLUTIONS_INDEX.meta.description,
  path: "/solutions",
});

export default function SolutionsIndex() {
  return (
    <>
      <IndexHero eyebrow={SOLUTIONS_INDEX.eyebrow} title={SOLUTIONS_INDEX.title} lead={SOLUTIONS_INDEX.lead} />
      <section className="v6-sec v6-si-sec">
        <div className="v6-wrap">
          <SolutionCards />
        </div>
      </section>
      <ClosingScene />
    </>
  );
}
