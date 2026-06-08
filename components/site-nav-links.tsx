"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string; authOnly?: boolean };

export function SiteNavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              fontSize: 14,
              color: active ? "#ECEFF4" : "#8B95A6",
              textDecoration: "none",
              letterSpacing: "-0.005em",
              fontWeight: active ? 500 : 400,
              transition: "color 120ms",
              fontFamily: '"Inter Tight", sans-serif',
            }}
            className="vra-nav-link"
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
