import type { Metadata } from "next";
import { v6meta } from "../_system/meta";
import { EditorialLink } from "../_system/ui";
import { IndexHero, MediaPanel } from "../_system/kit";
import { CHANGELOG, entryId, type Entry } from "../_content/changelog";
import { V6_BASE } from "@/lib/v6-routes";

const BASE = V6_BASE;

export const metadata: Metadata = v6meta({
  title: "Changelog",
  description: "What Vraelis has shipped, dated and newest first. Each entry is written from the code that shipped it, and direction is labelled as direction.",
  path: "/changelog",
  ogTitle: "Vraelis changelog",
});

function fmt(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** The entry's picture (plan T10: a MediaPanel, 24 above and below). A run's own screenshot is evidence and never
 *  wider than 640; a portrait capture is held to 480 so it does not fill a whole screen; everything else takes the
 *  680 body. The caption is a whole sentence, and the run id follows it in its own mono element. `eager` is for the
 *  newest entry's picture, which is in the first screen and is the page's largest paint: it loads at once, at high
 *  priority, instead of lazily. */
function EntryMedia({ m, eager = false }: { m: NonNullable<Entry["media"]>; eager?: boolean }) {
  const portrait = m.h > m.w;
  return (
    <div className="v6-clog__media" data-portrait={portrait ? "" : undefined}>
      <MediaPanel
        src={m.src} alt={m.alt} w={m.w} h={m.h} evidence={m.evidence} eager={eager}
        sizes={m.evidence ? "(max-width: 700px) 100vw, 640px" : portrait ? "(max-width: 540px) 100vw, 480px" : "(max-width: 760px) 100vw, 680px"}
        bar={m.address || m.label ? { left: m.address, right: m.label } : undefined}
        caption={m.caption || m.run ? (
          <>
            {m.caption ? <span>{m.caption}</span> : null}
            {m.run ? <span className="v6-clog__run" data-no-translate>{m.run}</span> : null}
          </>
        ) : undefined}
      />
    </div>
  );
}

export default function Changelog() {
  return (
    <>
      <IndexHero
        compact
        eyebrow="Changelog"
        title="What Vraelis has shipped."
        lead="Dated milestones from the product, newest first. Each entry says what shipped, and where one points at the future, it says so."
      />
      <section className="v6-clog-sec">
        <div className="v6-wrap">
          <div className="v6-clog">
            {CHANGELOG.map((e, i) => (
              <article key={entryId(e)} id={entryId(e)} className="v6-clog__entry">
                {/* The date column holds its place while a long entry scrolls past (plan T10). The tag is a word,
                    in mono and without colour: no chip, no state colour, because "Shipped" is not a result. */}
                <div className="v6-clog__when">
                  <p className="v6-clog__stick">
                    <time className="v6-clog__date" dateTime={e.date}>{fmt(e.date)}</time>
                    <span className="v6-clog__tag">{e.tagLabel}</span>
                  </p>
                </div>
                {/* A DIRECTION ENTRY IS A RECORD OF WHAT WAS SAID ON ITS DATE. It stays exactly as written (plan
                    0.3: the changelog's existing entries are records), so it is marked as reference material, which
                    the site's copy lint reads as a record rather than as today's pitch. Shipped entries are not
                    marked: they are held to today's rules. */}
                <div className="v6-clog__main" data-reference={e.tag === "wait" ? "" : undefined}>
                  <h2 className="v6-clog__t">{e.title}</h2>
                  {e.media ? <EntryMedia m={e.media} eager={i === 0} /> : null}
                  <div className="v6-clog__b">{e.body.map((p, i) => <p key={i}>{p}</p>)}</div>
                  {/* THE LABEL FOLLOWS THE ENTRY, IT IS NOT ALWAYS "DIRECTION". A shipped entry can still carry a
                      caveat, and stating it is the point of this site: a "wait" entry keeps Direction, a "go" entry
                      gets Boundary. */}
                  {e.note ? (
                    <div className="v6-clog__note">
                      <b>{e.tag === "wait" ? "Direction" : "Boundary"}</b>
                      <span>{e.note}</span>
                    </div>
                  ) : null}
                  {e.href ? (
                    <div className="v6-clog__link">
                      <EditorialLink href={`${BASE}${e.href}`}>{e.hrefLabel ?? "Read the record"}</EditorialLink>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          {/* THE OTHER HALF OF THE RECORD. _content/changelog.ts keeps future scope off this page on purpose, and that
              only holds if a reader can reach the list of what is built and what is planned. The sentence is whole and
              the link follows it, so the translator keeps the sentence in one piece. */}
          <div className="v6-clog__end">
            <p>This page is a record of the past. What is built today, and what is planned, is listed on the platform page. When a planned line is built, the day it shipped is recorded here.</p>
            <EditorialLink href={`${BASE}/platform#current`}>What is built today</EditorialLink>
          </div>
        </div>
      </section>
    </>
  );
}
