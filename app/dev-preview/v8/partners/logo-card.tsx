import type { Partner } from "../_content/partners";

/** A partner's official logo, unmodified, on a dark card with a faint brand-coloured glow (x.ai's story cards). */
export function LogoCard({ p, className }: { p: Partner; className?: string }) {
  return (
    <div className={`pt-logo pt-logo--${p.slug}${className ? ` ${className}` : ""}`} style={{ background: p.glow }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.logo.src} alt={p.logo.alt} width={p.logo.w} height={p.logo.h} loading="lazy" decoding="async" />
    </div>
  );
}

export const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
