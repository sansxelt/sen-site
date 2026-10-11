import { showsLogo, type Partner } from "../_content/partners";

/** A partner's card on a dark ground with a faint brand-coloured glow (x.ai's story cards). The official logo,
 *  unmodified, appears once permission is on record (logoCleared) or the founder has decided to show it (logoShown,
 *  2026-10-11); otherwise the card sets the company's name in our own type. */
export function LogoCard({ p, className }: { p: Partner; className?: string }) {
  return (
    <div className={`pt-logo pt-logo--${p.slug}${className ? ` ${className}` : ""}`} style={{ background: p.glow }}>
      {showsLogo(p) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.logo.src} alt={p.logo.alt} width={p.logo.w} height={p.logo.h} loading="lazy" decoding="async" />
      ) : (
        <span className="pt-logo__name">{p.name}</span>
      )}
    </div>
  );
}

export const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
