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
                  {/* THE LABEL FOLLOWS THE ENTRY, IT IS NOT ALWAYS "DIRECTION".
                      It was hardcoded, which silently meant a SHIPPED entry could not carry a caveat: the
                      note would have been introduced as Direction, i.e. the page would have announced a
                      capability as unbuilt in the same breath as dating its release. Shipped work still has
                      boundaries worth stating, and stating them is the point of this site. A "wait" entry
                      keeps Direction; a "go" entry gets Boundary. */}
                  {e.note ? (
                    <div className="v6-note" style={{ marginTop: 6 }}>
                      <b>{e.tag === "wait" ? "Direction" : "Boundary"}</b>{" "}{e.note}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
