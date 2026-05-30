"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Props = {
  email: string;
  image?: string | null;
  isAdmin?: boolean;
};

const menuItems = [
  { href: "/account",          label: "Account",  icon: AccountIcon  },
  { href: "/account/settings", label: "Settings", icon: SettingsIcon },
  { href: "/account/usage",    label: "Usage",    icon: UsageIcon    },
  { href: "/account/plan",     label: "Plan",     icon: PlanIcon     },
];

function AccountIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 12.5C1.5 10.01 4.01 8 7 8s5.5 2.01 5.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.46 2.46l1.06 1.06M10.48 10.48l1.06 1.06M2.46 11.54l1.06-1.06M10.48 3.52l1.06-1.06" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function UsageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.5" y="8" width="2" height="4.5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="6" y="5" width="2" height="7.5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="10.5" y="2" width="2" height="10.5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 7h10M7 2l4.5 5L7 12M7 2 2.5 7 7 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1.5 8.5 5h3.5l-2.9 2.1 1.1 3.4L7 8.5l-3.2 2L4.9 7.1 2 5h3.5L7 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1 4h9M8 2l2 2-2 2M13 10H4m7-2 2 2-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M5.5 12H2.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M9.5 10l3-3-3-3M12.5 7h-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AccountDropdown({ email, image, isAdmin = false }: Props) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [imgError, setImgError] = useState(false);
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
  const displayName = email.split("@")[0].replace(/[._-]/g, " ");
  const showPhoto = !!image && !imgError;

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

  function handleSwitchAccount() {
    setOpen(false);
    void signOut({ callbackUrl: "/signin" });
  }

  const avatarStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: "50%",
    overflow: "hidden",
    background: "rgba(92,229,213,0.10)",
    border: showPhoto ? "1.5px solid rgba(255,255,255,0.10)" : "1.5px solid rgba(92,229,213,0.30)",
    color: "#5CE5D5",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: '"Inter Tight", sans-serif',
    letterSpacing: "-0.01em",
    cursor: "pointer",
    transition: "border-color 150ms, opacity 150ms",
    opacity: signingOut ? 0.5 : 1,
    flexShrink: 0,
  };

  const Avatar = ({ size = 34 }: { size?: number }) =>
    showPhoto ? (
      <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
        <Image
          src={image!}
          alt={displayName}
          width={size}
          height={size}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
          onError={() => setImgError(true)}
          unoptimized
        />
      </div>
    ) : (
      <div style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: "rgba(92,229,213,0.10)",
        border: "1.5px solid rgba(92,229,213,0.28)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#5CE5D5", fontSize: size * 0.38, fontWeight: 600,
        fontFamily: '"Inter Tight", sans-serif',
      }}>
        {initial}
      </div>
    );

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={email}
        disabled={signingOut}
        style={avatarStyle}
      >
        {signingOut ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden style={{ animation: "spin 0.8s linear infinite" }}>
            <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : showPhoto ? (
          <Image
            src={image!}
            alt={displayName}
            width={34}
            height={34}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
            onError={() => setImgError(true)}
            unoptimized
          />
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
            width: 256,
            overflow: "hidden",
            borderRadius: 10,
            border: "1px solid rgba(199,205,215,0.10)",
            background: "#0E1421",
            boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(92,229,213,0.05)",
          }}
        >
          {/* Profile header */}
          <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(199,205,215,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar size={40} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 600, color: "#ECEFF4",
                  fontFamily: '"Inter Tight", sans-serif',
                  letterSpacing: "-0.015em", textTransform: "capitalize",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {displayName}
                </div>
                <div style={{
                  fontSize: 11.5, color: "#5A6478", marginTop: 2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontFamily: '"Inter Tight", sans-serif',
                }} title={email}>
                  {email}
                </div>
              </div>
            </div>
          </div>

          {/* Primary nav items */}
          <div style={{ padding: "6px 0" }}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
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
                  <span style={{ color: "#5A6478", width: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon />
                  </span>
                  {item.label}
                </Link>
              );
            })}

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
                <span style={{ color: "#5CE5D5", width: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AdminIcon />
                </span>
                Admin
              </Link>
            )}
          </div>

          {/* Switch account + sign out */}
          <div style={{ borderTop: "1px solid rgba(199,205,215,0.07)", padding: "6px 0 6px" }}>
            <button
              type="button"
              role="menuitem"
              onClick={handleSwitchAccount}
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
                (e.currentTarget as HTMLElement).style.color = "#C7CDD7";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "#5A6478";
              }}
            >
              <span style={{ color: "#5A6478", width: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SwitchIcon />
              </span>
              Switch account
            </button>

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
              <span style={{ color: "#5A6478", width: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SignOutIcon />
              </span>
              Sign out
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
