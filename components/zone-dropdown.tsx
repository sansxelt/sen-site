"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  signedIn: boolean;
};

export function ZoneDropdown({ signedIn }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <Link
        href={signedIn ? "/chat" : "/signin?callbackUrl=%2Fchat"}
        style={{
          display: "inline-flex", alignItems: "center",
          padding: "10px 20px",
          background: "#ECEFF4", color: "#0A0F18",
          fontSize: 14, fontWeight: 500, letterSpacing: "-0.005em",
          textDecoration: "none", borderRadius: 4,
          fontFamily: '"Inter Tight", sans-serif',
          transition: "opacity 150ms",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      >
        {signedIn ? "Open Vraelis" : "Get started"}
      </Link>
    </div>
  );
}
