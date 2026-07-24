import type { Metadata } from "next";
import { v6meta } from "../_system/meta";
import { PageHero, Signal } from "../_system/ui";
import { CHANGELOG } from "../_content/changelog";

export const metadata: Metadata = v6meta({
  title: "Changelog",
  description: "What Vraelis has shipped, dated. Seeded only with real milestones; direction is labeled as direction.",
  path: "/changelog",
  ogTitle: "Vraelis changelog",
});

function fmt(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export default function Changelog() {
  return (
    <>
      <PageHero kicker="Changelog" title="What Vraelis has shipped." lead="Dated milestones from the product. Real work only; where something points at the future, it is labeled as direction." />
      <section className="v6-sec" style={{ paddingTop: 0 }}>
        <div className="v6-wrap">
          <div className="v6-clog">
            {CHANGELOG.map((e) => (
              <article key={e.date + e.title} className="v6-clog__entry">
                <div>
                  <div className="v6-clog__date">{fmt(e.date)}</div>
                  <div className="v6-clog__tag"><Signal state={e.tag}>{e.tagLabel}</Signal></div>
                </div>
                <div>
                  <h2 className="v6-clog__t">{e.title}</h2>
                  <div className="v6-clog__b">{e.body.map((p, i) => <p key={i}>{p}</p>)}</div>
                  {e.note ? <div className="v6-note" style={{ marginTop: 6 }}><b>Direction</b>{e.note}</div> : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
