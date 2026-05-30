"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Props = {
  email: string;
  isAdmin?: boolean;
};

const menuItems = [
  { href: "/account",          label: "Account",  icon: "◉" },
  { href: "/account/settings", label: "Settings", icon: "⊙" },
  { href: "/account/usage",    label: "Usage",    icon: "◈" },
];

export function AccountDropdown({ email, isAdmin = false }: Props) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
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

  const initial = email.trim().charAt(0).toUpperCase() || "?";
  const name    = email.split("@")[0].replace(/[._-]/g, " ");

  async function handleSignOut() {
    setSigningOut(true);
    setOpen(false);
    try {
      await signOut({ redirect: false });
      window.location.href = "/home";
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {/* Avatar trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={email}
        disabled={signingOut}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "rgba(92,229,213,0.12)",
          border: "1.5px solid rgba(92,229,213,0.35)",
          color: "#5CE5D5",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: '"Inter Tight", sans-serif',
          letterSpacing: "-0.01em",
          cursor: "pointer",
          transition: "border-color 150ms, background 150ms",
          opacity: signingOut ? 0.5 : 1,
        }}
      >
        {signingOut ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden style={{ animation: "spin 0.8s linear infinite" }}>
            <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : initial}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 10px)",
            zIndex: 50,
            width: 240,
            overflow: "hidden",
            borderRadius: 8,
            border: "1px solid rgba(199,205,215,0.12)",
            background: "#0E1421",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(92,229,213,0.06)",
          }}
        >
          {/* Profile header */}
          <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(199,205,215,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: "rgba(92,229,213,0.12)",
                border: "1.5px solid rgba(92,229,213,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#5CE5D5", fontSize: 14, fontWeight: 600,
                fontFamily: '"Inter Tight", sans-serif',
              }}>
                {initial}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: "#ECEFF4",
                  fontFamily: '"Inter Tight", sans-serif',
                  letterSpacing: "-0.01em", textTransform: "capitalize",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {name}
                </div>
                <div style={{
                  fontSize: 11, color: "#5A6478", marginTop: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }} title={email}>
                  {email}
                </div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: "4px 0" }}>
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 16px",
                  fontSize: 13, color: "#C7CDD7",
                  textDecoration: "none",
                  fontFamily: '"Inter Tight", sans-serif',
                  transition: "background 120ms, color 120ms",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(199,205,215,0.06)";
                  (e.currentTarget as HTMLElement).style.color = "#ECEFF4";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "#C7CDD7";
                }}
              >
                <span style={{ fontSize: 11, color: "#5A6478", width: 14, textAlign: "center" }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}

            {isAdmin && (
              <Link
                href="/account/content"
                role="menuitem"
                onClick={() => setOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 16px",
                  fontSize: 13, color: "#5CE5D5",
                  textDecoration: "none",
                  fontFamily: '"Inter Tight", sans-serif',
                  transition: "background 120ms",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(92,229,213,0.06)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 11, color: "#5CE5D5", width: 14, textAlign: "center" }}>⬡</span>
                Admin
              </Link>
            )}
          </div>

          {/* Sign out */}
          <div style={{ borderTop: "1px solid rgba(199,205,215,0.08)", padding: "4px 0 6px" }}>
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleSignOut()}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "8px 16px",
                fontSize: 13, color: "#5A6478",
                background: "transparent", border: "none",
                cursor: "pointer", textAlign: "left",
                fontFamily: '"Inter Tight", sans-serif',
                transition: "background 120ms, color 120ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(199,205,215,0.06)";
                (e.currentTarget as HTMLElement).style.color = "#ECEFF4";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "#5A6478";
              }}
            >
              <span style={{ fontSize: 11, color: "#5A6478", width: 14, textAlign: "center" }}>↳</span>
              Sign out
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
