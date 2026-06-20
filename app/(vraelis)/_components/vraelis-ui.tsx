/* eslint-disable */
"use client";

// Vraelis marketing UI — ported from the standalone static site
// (Chrome/Hero/Sections/Lower/Dashboard JSX) into typed React
// components. Visuals are driven entirely by /vraelis/tokens.css +
// /vraelis/styles.css (loaded by the (vraelis) layout), so the markup
// stays close to the original. CTAs now route into the real NextAuth
// sign-in flow instead of the old fake "early access" modal.

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CUT_RATES } from "@/lib/vraelis-plans";
import { VraelisPromoBar } from "@/components/vraelis-promo-bar";

// Lets marketing CTAs know whether the visitor is signed in, so
// "Start free" becomes "Open app" instead of bouncing through /signin.
const SignedInContext = createContext(false);

// All CTAs land on the shared /signin page; afterward the user is sent
// into their vraelis account. The clean /account URL is rewritten to the
// vraelis account area (app/(vraelis)/v/account) by proxy.ts.
const ACCOUNT_HREF = "/account";
const SIGNIN_HREF = "/signin?callbackUrl=%2Faccount";
// Signup-intent CTAs ("Start free") open the auth surface in create-account
// mode so a brand-new visitor doesn't land on a "Welcome back" sign-in screen.
// Plain "Sign in" links keep using SIGNIN_HREF (defaults to sign-in mode).
const SIGNUP_HREF = "/signin?mode=signup&callbackUrl=%2Faccount";

// The marketing dashboard demo lives as a section on the home page
// (#dashboard) — not a separate route.
const DASHBOARD_HREF = "/demo";

// ── CTA: an anchor styled as the site's button ─────────────────────
function Cta({
  children,
  variant = "solid",
  large = false,
  style,
  href = SIGNUP_HREF,
}: {
  children: ReactNode;
  variant?: "solid" | "ghost";
  large?: boolean;
  style?: CSSProperties;
  href?: string;
}) {
  const signedIn = useContext(SignedInContext);
  const cls = [
    "btn",
    variant === "ghost" ? "btn--ghost" : "",
    large ? "btn--lg" : "",
  ]
    .filter(Boolean)
    .join(" ");
  // A signed-in visitor clicking a "Start free"/signup CTA shouldn't be
  // bounced through /signin — send them straight to the app instead.
  const isSignupCta = href === SIGNUP_HREF;
  const finalHref = signedIn && isSignupCta ? ACCOUNT_HREF : href;
  const content =
    signedIn && isSignupCta ? (
      <>Open app <span aria-hidden>→</span></>
    ) : (
      children
    );
  return (
    <a href={finalHref} className={cls} style={style}>
      {content}
    </a>
  );
}

// ── Reveal: fades + rises children when scrolled into view ─────────
function Reveal({
  children,
  d,
  as: Tag = "div",
  className = "",
  style,
}: {
  children: ReactNode;
  d?: string | number;
  as?: any;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("in");
            obs.unobserve(el);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <Tag ref={ref as any} className={`reveal ${className}`} data-d={d} style={style}>
      {children}
    </Tag>
  );
}

// ── Nav ─────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { href: "/how", label: "How it works", key: "how" },
  { href: DASHBOARD_HREF, label: "See it work", key: "dashboard" },
  { href: "/automates", label: "What it automates", key: "automates" },
  { href: "/pricing", label: "Pricing", key: "pricing" },
  { href: "/articles", label: "Resources", key: "articles" },
];

function Nav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() || "";
  const activeKey =
    NAV_LINKS.find((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))?.key ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  // Keep the header divider hidden at the very top so the page doesn't look
  // "blocked off"; fade the border in once the user scrolls past the top.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "16px var(--gutter)",
        background: "rgba(250, 248, 244, 0.86)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        // Borderless at the top (clean, not "blocked off"); divider fades in on scroll.
        borderBottom: `1px solid ${scrolled ? "var(--line-1)" : "transparent"}`,
        transition: "border-color 0.25s ease",
      }}
    >
      <a
        href="/"
        style={{
          gridColumn: 1,
          justifySelf: "start",
          display: "inline-flex",
          alignItems: "center",
          textDecoration: "none",
          color: "var(--fg-1)",
          fontFamily: "var(--font-display)",
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        Vraelis
      </a>
      <div className="vra-nav-links" style={{ justifySelf: "center", display: "flex", gap: 28, alignItems: "center" }}>
        {NAV_LINKS.map((l) => {
          const active = activeKey === l.key;
          const linkStyle = {
            fontSize: 14,
            color: active ? "var(--fg-1)" : "var(--fg-2)",
            fontWeight: active ? 600 : 400,
            textDecoration: "none",
            letterSpacing: "-0.005em",
            whiteSpace: "nowrap",
          } as const;
          // The tab for the page you're already on renders as plain text, not a
          // link — so re-clicking it can't reload/refresh the page.
          return active ? (
            <span key={l.key} aria-current="page" style={{ ...linkStyle, cursor: "default" }}>{l.label}</span>
          ) : (
            <a key={l.key} href={l.href} style={linkStyle}>{l.label}</a>
          );
        })}
      </div>
      <div style={{ gridColumn: 3, justifySelf: "end", display: "flex", alignItems: "center", gap: 18 }}>
        {signedIn ? (
          <>
            <button
              type="button"
              className="vra-nav-secondary"
              onClick={() => void signOut({ redirectTo: "/v" })}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                color: "var(--fg-2)",
                letterSpacing: "-0.005em",
                whiteSpace: "nowrap",
                padding: 0,
              }}
            >
              Sign out
            </button>
            <Cta href={ACCOUNT_HREF}>Open app <span aria-hidden>→</span></Cta>
          </>
        ) : (
          <>
            <a
              href={SIGNIN_HREF}
              className="vra-nav-secondary"
              style={{
                fontSize: 14,
                color: "var(--fg-2)",
                textDecoration: "none",
                letterSpacing: "-0.005em",
                whiteSpace: "nowrap",
              }}
            >
              Sign in
            </a>
            <Cta>Start free</Cta>
          </>
        )}
        <button
          type="button"
          className="vra-nav-burger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          style={{ display: "none", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--fg-1)", padding: 4, lineHeight: 0 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {menuOpen ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            background: "#FAF8F4", borderBottom: "1px solid var(--line-2)",
            boxShadow: "0 16px 30px -18px rgba(0,0,0,0.22)",
            display: "flex", flexDirection: "column", padding: "6px 0",
          }}
        >
          {NAV_LINKS.map((l) => {
            const active = activeKey === l.key;
            const mStyle = { padding: "13px var(--gutter)", fontSize: 15, textDecoration: "none", color: active ? "var(--fg-1)" : "var(--fg-2)", fontWeight: active ? 600 : 400 } as const;
            // Active tab is plain text (closes the menu, never reloads).
            return active ? (
              <span key={l.key} aria-current="page" onClick={() => setMenuOpen(false)} style={{ ...mStyle, cursor: "default" }}>{l.label}</span>
            ) : (
              <a key={l.key} href={l.href} onClick={() => setMenuOpen(false)} style={mStyle}>{l.label}</a>
            );
          })}
          {signedIn ? (
            <button
              type="button"
              onClick={() => { setMenuOpen(false); void signOut({ redirectTo: "/v" }); }}
              style={{ textAlign: "left", padding: "13px var(--gutter)", fontSize: 15, color: "var(--fg-3)", background: "none", border: "none", borderTop: "1px solid var(--line-1)", cursor: "pointer" }}
            >
              Sign out
            </button>
          ) : (
            <a
              href={SIGNIN_HREF}
              onClick={() => setMenuOpen(false)}
              style={{ padding: "13px var(--gutter)", fontSize: 15, color: "var(--fg-3)", textDecoration: "none", borderTop: "1px solid var(--line-1)" }}
            >
              Sign in
            </a>
          )}
        </div>
      )}
    </nav>
  );
}

// ── Lead data model + interactive dashboard ────────────────────────
type Stage = "new" | "contacted" | "qualified" | "booked" | "won";
type Message = { who: "lead" | "v"; t: string; time: string };
type Followup = { label: string; time: string; state: "done" | "now" | "next" };
type Lead = {
  id: string;
  name: string;
  company: string;
  source: string;
  status: Stage;
  value: number;
  ago: string;
  snippet: string;
  booking: string | null;
  messages: Message[];
  followups: Followup[];
};

const LEADS: Lead[] = [
  {
    id: "l1", name: "Marcus Bell", company: "Coaching · Instagram DM",
    source: "Instagram", status: "won", value: 4000, ago: "2m",
    snippet: "Paid in full — $4,000 transformation program.",
    booking: "Kickoff call — Thu, 12 Jun · 9:30 AM",
    messages: [
      { who: "lead", t: "Saw your post about the 12-week program. I'm serious about leveling up but I've wasted money on coaches before — what makes this different?", time: "9:14" },
      { who: "v", t: "Fair question, Marcus. The program is built around weekly 1:1 accountability, not just content — that's usually what makes it stick. Quick one so I point you right: are you looking to start this month, or planning ahead?", time: "9:14" },
      { who: "lead", t: "This month. What's the investment?", time: "9:21" },
      { who: "v", t: "The 12-week transformation program is $4,000 — pay in full, or split it. To lock your start date this week, want me to send a secure link to get going?", time: "9:21" },
      { who: "lead", t: "Pay in full works. Send it.", time: "9:38" },
      { who: "v", t: "Done — payment received, you're in 🎉. Your kickoff call is held for Thu 12 Jun, 9:30 AM. Onboarding sent to your email.", time: "9:38" },
    ],
    followups: [
      { label: "Instant reply sent", time: "9:14", state: "done" },
      { label: "Qualified: serious · starting this month", time: "9:21", state: "done" },
      { label: "Paid in full — $4,000", time: "9:38", state: "done" },
      { label: "Kickoff call held — Thu 9:30 AM", time: "9:38", state: "done" },
    ],
  },
  {
    id: "l2", name: "Priya Anand", company: "Course creator · Instagram",
    source: "Instagram", status: "won", value: 997, ago: "14m",
    snippet: "Bought the $997 course — mentorship upsell queued.",
    booking: null,
    messages: [
      { who: "lead", t: "Is the course still open? And is it beginner-friendly?", time: "13:02" },
      { who: "v", t: "It is — open now, and built to take you from zero. It's $997 for lifetime access plus the live Q&A calls. Want the secure checkout link?", time: "13:02" },
      { who: "lead", t: "Yes please.", time: "13:12" },
      { who: "v", t: "You're enrolled — payment received, access email on its way. Since you're starting fresh, a lot of students add the $2,500 1:1 mentorship to go faster. Want details on that?", time: "13:20" },
    ],
    followups: [
      { label: "Instant reply sent", time: "13:02", state: "done" },
      { label: "Paid — $997 course", time: "13:12", state: "done" },
      { label: "Upsell: $2,500 mentorship", time: "in 1h", state: "now" },
      { label: "Follow-up if no reply", time: "queued", state: "next" },
    ],
  },
  {
    id: "l3", name: "Dev Okonkwo", company: "Agency client · Referral",
    source: "Referral", status: "booked", value: 3000, ago: "31m",
    snippet: "Deposit paid — $3,000/mo retainer, onboarding booked.",
    booking: "Onboarding — Mon, 16 Jun · 2:00 PM",
    messages: [
      { who: "lead", t: "Tomás referred me. We need help with paid ads + creative, spending about $20k/mo right now.", time: "11:06" },
      { who: "v", t: "Glad Tomás sent you. At that spend our growth retainer is the right fit — $3,000/mo, month to month. To get you onboarded this week, we take the first month to reserve the slot. Want me to send the link?", time: "11:09" },
      { who: "lead", t: "Yeah let's do it.", time: "11:14" },
      { who: "v", t: "First month received — you're on the calendar. Onboarding call held for Mon 16 Jun, 2:00 PM. Welcome aboard.", time: "11:14" },
    ],
    followups: [
      { label: "Instant reply sent", time: "11:06", state: "done" },
      { label: "Qualified: $20k/mo ad spend", time: "11:09", state: "done" },
      { label: "First month paid — $3,000", time: "11:14", state: "done" },
      { label: "Onboarding booked — Mon 2:00 PM", time: "11:14", state: "done" },
    ],
  },
  {
    id: "l4", name: "Sara Lindqvist", company: "Mastermind lead · Webinar",
    source: "Webinar", status: "new", value: 5000, ago: "just now",
    snippet: "Asking about the $5k mastermind — qualifying now.",
    booking: null,
    messages: [
      { who: "lead", t: "I joined the webinar — interested in the mastermind but want to know if it's worth it at $5k for someone at my stage.", time: "now" },
      { who: "v", t: "Totally reasonable to ask. Quick read so I can tell you straight: roughly what does your business do per month right now, and what's the goal in the next 90 days?", time: "now" },
    ],
    followups: [
      { label: "Instant reply sent", time: "now", state: "done" },
      { label: "Qualifying: stage + 90-day goal", time: "live", state: "now" },
      { label: "Send payment plan if a fit", time: "pending", state: "next" },
    ],
  },
  {
    id: "l5", name: "Theo Marchetti", company: "Community · Link in bio",
    source: "Link in bio", status: "won", value: 1200, ago: "1h",
    snippet: "Joined — $1,200 annual membership paid.",
    booking: null,
    messages: [
      { who: "lead", t: "What do I get with the membership, and how much?", time: "10:02" },
      { who: "v", t: "Annual membership is $1,200 — daily community access, weekly live calls, and the full resource vault. Most people take the year since it's the best value. Want the link to join?", time: "10:02" },
      { who: "lead", t: "Let's do the annual.", time: "10:11" },
      { who: "v", t: "You're in — payment received, Discord invite + welcome sent to your email. See you on the next live call 👋", time: "10:11" },
    ],
    followups: [
      { label: "Instant reply sent", time: "10:02", state: "done" },
      { label: "Paid — $1,200 annual membership", time: "10:11", state: "done" },
      { label: "Access + welcome sent", time: "10:12", state: "done" },
      { label: "Marked won — member onboarded", time: "10:12", state: "done" },
    ],
  },
  {
    id: "l6", name: "Jordan Reyes", company: "Consulting · Email",
    source: "Email", status: "contacted", value: 2500, ago: "2h",
    snippet: "Deposit link sent for $2,500 strategy intensive.",
    booking: null,
    messages: [
      { who: "lead", t: "Do you offer a one-off strategy session? Not ready for a full retainer yet.", time: "8:40" },
      { who: "v", t: "We do — the strategy intensive is a focused half-day, $2,500, with a written action plan after. A deposit reserves your date; want me to send it?", time: "8:40" },
    ],
    followups: [
      { label: "Instant reply sent", time: "8:40", state: "done" },
      { label: "Offered: $2,500 strategy intensive", time: "8:40", state: "done" },
      { label: "Follow-up if deposit not paid", time: "tomorrow 9 AM", state: "next" },
    ],
  },
];

const STAGE_LABEL: Record<Stage, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified", booked: "Booked", won: "Won",
};

function StagePill({ status }: { status: Stage }) {
  return (
    <span className={`pill st-${status}`}><span className="dot" />{STAGE_LABEL[status]}</span>
  );
}

const AV_COLORS = ["#0E9E6C", "#2563EB", "#7C3AED", "#C2540C", "#0D9488", "#BE185D"];
function initials(name: string) {
  const w = name.replace(/[^a-zA-Z ]/g, "").trim().split(/\s+/);
  return ((w[0]?.[0] || "") + (w[1]?.[0] || "")).toUpperCase() || "·";
}
function Avatar({ lead, size = 32 }: { lead: Lead; size?: number }) {
  const idx = LEADS.findIndex((l) => l.id === lead.id);
  const color = AV_COLORS[idx % AV_COLORS.length];
  return (
    <span className="av" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>{initials(lead.name)}</span>
  );
}

function Conversation({ lead, height }: { lead: Lead; height: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "18px", overflowY: "auto", height }}>
      {lead.messages.map((m, i) => (
        <div key={i} className={`bub ${m.who === "v" ? "bub--out" : "bub--in"}`}>
          <div className="bub__who">{m.who === "v" ? "Vraelis" : lead.name.split(" ")[0]} · {m.time}</div>
          {m.t}
        </div>
      ))}
      {lead.status === "new" && (
        <div className="bub bub--out" style={{ display: "inline-flex", width: "auto", alignSelf: "flex-end" }}>
          <span className="typing"><i /><i /><i /></span>
        </div>
      )}
    </div>
  );
}

function FollowupTimeline({ lead }: { lead: Lead }) {
  return (
    <div className="tl">
      {lead.followups.map((f, i) => (
        <div key={i} className={`tl__item ${f.state}`}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
            <span style={{ fontSize: 13, color: f.state === "next" ? "var(--fg-4)" : "var(--fg-2)" }}>{f.label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)", whiteSpace: "nowrap" }}>{f.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ bars }: { bars: number[] }) {
  return (
    <div className="spark" style={{ marginTop: 8 }}>
      {bars.map((h, i) => <i key={i} className={i === bars.length - 1 ? "hi" : ""} style={{ height: `${h}%` }} />)}
    </div>
  );
}

type Metric = { label: string; val: ReactNode; delta?: ReactNode; spark?: number[]; money?: boolean };
function MetricStrip() {
  const metrics: Metric[] = [
    { label: "New leads · today", val: "18", delta: <>all answered <b>&lt; 1 min</b></> },
    { label: "Avg response time", val: "38s", delta: <>was <b>4h 12m</b> before</> },
    { label: "Booked this week", val: "23", spark: [30, 45, 38, 60, 52, 72, 90] },
    { label: "Revenue recovered", val: <span style={{ color: "var(--money)" }}>$31,400</span>, delta: <>est. last 30 days</>, money: true },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "1px solid var(--line-1)" }} className="metric-strip">
      {metrics.map((m, i) => (
        <div className="metric" key={i}>
          <div className="metric__label">{m.money && <span style={{ background: "var(--money)", width: 6, height: 6, borderRadius: "50%", display: "inline-block" }} />}{m.label}</div>
          <div className="metric__val tnum">{m.val}</div>
          {m.spark ? <Sparkline bars={m.spark} /> : <div className="metric__delta">{m.delta}</div>}
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const [selId, setSelId] = useState("l1");
  const sel = LEADS.find((l) => l.id === selId) ?? LEADS[0];
  return (
    <div className="win">
      <div className="win__bar">
        <div className="win__dots"><i /><i /><i /></div>
        <span className="win__addr"><span className="dot dot--acc pulse" /> app.vraelis.com/pipeline</span>
        <span style={{ marginLeft: "auto" }} className="pill"><span className="dot dot--acc" />all channels connected</span>
      </div>
      <MetricStrip />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)" }} className="dash-body">
        <div style={{ borderRight: "1px solid var(--line-1)", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--line-1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-3)" }}>Live pipeline</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>{LEADS.length} active</span>
          </div>
          <div style={{ overflowY: "auto", maxHeight: 360 }}>
            {LEADS.map((l) => (
              <button key={l.id} className={`leadrow ${l.id === selId ? "sel" : ""}`} onClick={() => setSelId(l.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <Avatar lead={l} size={34} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ color: "var(--fg-1)", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
                      <StagePill status={l.status} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "var(--fg-4)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.source} · {l.ago}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--money)", whiteSpace: "nowrap" }}>${l.value.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-1)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
              <Avatar lead={sel} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "var(--fg-1)", fontSize: 14.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sel.name}</div>
                <div style={{ color: "var(--fg-4)", fontSize: 12, fontFamily: "var(--font-mono)" }}>{sel.company}</div>
              </div>
            </div>
            <StagePill status={sel.status} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)", minHeight: 0 }} className="detail-body">
            <div style={{ borderRight: "1px solid var(--line-1)", minWidth: 0 }}>
              <Conversation lead={sel} height={300} />
            </div>
            <div style={{ padding: "16px 16px", minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>Automation</div>
              <FollowupTimeline lead={sel} />
              {sel.booking && (
                <div style={{ marginTop: 16, padding: "11px 13px", borderRadius: 4, border: "1px solid var(--acc-line)", background: "var(--acc-soft)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc)", marginBottom: 5 }}>Booked</div>
                  <div style={{ fontSize: 12.5, color: "var(--fg-1)", lineHeight: 1.4 }}>{sel.booking}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────
function Trust({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "var(--acc)" }}>✓</span>{children}
    </span>
  );
}

function Hero() {
  return (
    <section id="top" style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line-1)" }}>
      <div className="gridbg" />
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 55% 45% at 50% 8%, rgba(14,158,108,0.07) 0%, transparent 68%)" }} />
      <div className="wrap" style={{ position: "relative", paddingTop: "clamp(56px, 9vw, 104px)", paddingBottom: "clamp(40px, 6vw, 72px)" }}>
        <div style={{ maxWidth: 880 }}>
          <Reveal as="p" className="eyebrow rise" d="1">The AI agent that gets you paid</Reveal>
          <h1 className="display rise" data-d="2" style={{ marginBottom: 22, maxWidth: 940 }}>
            The AI agent that follows up, books leads, and <span className="em">collects payment</span>.
          </h1>
          <p className="rise" data-d="3" style={{ fontSize: "clamp(1.05rem, 1.5vw, 1.3rem)", color: "var(--fg-2)", maxWidth: 640, marginBottom: 18, lineHeight: 1.5 }}>
            Vraelis answers every lead in seconds, qualifies serious buyers, follows up on its own,
            books the call, and takes the payment, so your offers actually close.
          </p>
          <p className="rise" data-d="3" style={{ fontSize: "clamp(1rem, 1.3vw, 1.15rem)", fontWeight: 600, color: "var(--fg-1)", maxWidth: 640, marginBottom: 34, lineHeight: 1.45 }}>
            Free to start. Vraelis only earns when your agent gets you paid.
          </p>
          <div className="rise" data-d="4" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 26 }}>
            <Cta large>Start free <span aria-hidden>→</span></Cta>
            <a href="/how" className="btn btn--ghost btn--lg">See how it converts a lead</a>
          </div>
          <div className="rise" data-d="5" style={{ display: "flex", gap: 22, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", letterSpacing: "0.02em" }}>
            <Trust>Free to start. You pay only when you get paid</Trust>
            <Trust>Collects payment, not just the booking</Trust>
            <Trust>You close in your sleep</Trust>
          </div>
          <div className="rise" data-d="6" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 18, fontSize: 13, color: "var(--fg-3)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Built for</span>
            {["Coaches", "Course creators", "Agencies", "Communities", "Consultants"].map((w) => (
              <span key={w} className="pill">{w}</span>
            ))}
          </div>
        </div>
        <Reveal d="2" style={{ marginTop: "clamp(40px, 6vw, 64px)" }}>
          <Dashboard />
          <div style={{ display: "flex", alignItems: "center", gap: 9, justifyContent: "center", marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", letterSpacing: "0.04em" }}>
            <span className="dot dot--acc" /> Click any deal to see the real conversation, follow-up, and payment behind it
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Problem ─────────────────────────────────────────────────────────
function Problem() {
  const nodes = [
    { t: "0 min", l: "Enquiry lands", sub: "Warm. Ready to talk." },
    { t: "5 min", l: "Still no reply", sub: "They're filling out the next form." },
    { t: "1 hour", l: "Cooling fast", sub: "A faster seller already has their attention." },
    { t: "1 day", l: "Gone", sub: "Bought from someone else." },
  ];
  return (
    <section id="problem" className="section">
      <div className="wrap">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.85fr) minmax(0,1fr)", gap: "clamp(32px,5vw,72px)", alignItems: "end", marginBottom: "clamp(48px,6vw,80px)" }} className="cols-stack">
          <div>
            <Reveal as="p" className="eyebrow">The problem</Reveal>
            <Reveal as="h2" d="1" className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)" }}>
              Interested isn't the same as <span className="mark"><span>paid.</span></span>
            </Reveal>
          </div>
          <Reveal as="p" d="2" className="lead-copy" style={{ paddingBottom: 6 }}>
            You're delivering, on a call, or asleep when the DM comes in. So the lead waits — and a
            waiting buyer doesn't sit still. They cool by the minute, second-guess the price, and move on.
          </Reveal>
        </div>
        <Reveal d="1">
          <div className="cool">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "7px 13px", borderRadius: 999, background: "var(--acc)", color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} className="pulse" />
              Vraelis replies at 0:38 — while they're still warm
            </div>
            <div className="cool__track" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 18 }} className="cool-nodes">
              {nodes.map((n, i) => (
                <div key={n.t} style={{ position: "relative", paddingTop: 4 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: i === 3 ? "#B23A3A" : "var(--fg-3)", marginBottom: 6 }}>{n.t}</div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: i === 3 ? "#B23A3A" : "var(--fg-1)", marginBottom: 4, fontFamily: "var(--font-display)" }}>{n.l}</div>
                  <div style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.45 }}>{n.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── How it works ────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { k: "01", t: "A lead arrives", d: "An Instagram DM, a form, a link in bio, a webinar signup, an email. Vraelis grabs it wherever it lands — you don't lift a finger.", chips: ["DMs", "Link in bio", "Forms", "Webinars", "Email"] },
    { k: "02", t: "It replies in seconds", d: "Under a minute, in your voice, while their phone is still in their hand. No “sorry for the delay” three hours later.", chips: ["< 1 min", "Your voice"] },
    { k: "03", t: "It asks, then chases", d: "The same questions you'd ask — budget, timing, what they need — then it nudges the quiet ones until they answer.", chips: ["Qualifies", "Follows up"] },
    { k: "04", t: "It books and collects", d: "When they're ready, it offers your real openings, locks the slot with a deposit or payment, and reminds them so they actually show.", chips: ["Calendar", "Payment", "Reminders"] },
  ];
  return (
    <section id="how" className="section" style={{ background: "var(--bg-2)" }}>
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap", marginBottom: "clamp(40px,5vw,64px)" }}>
          <div style={{ maxWidth: 640 }}>
            <Reveal as="p" className="eyebrow">How it works</Reveal>
            <Reveal as="h2" d="1" className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)" }}>
              Set it up once.<br />Then it just <span className="mark"><span>runs.</span></span>
            </Reveal>
          </div>
          <Reveal as="div" d="2" className="kicker" style={{ paddingBottom: 8 }}>connect forms · inbox · calendar — 4 steps, no code</Reveal>
        </div>
        <div>
          {steps.map((s, i) => (
            <Reveal key={s.k} d={(i % 2) + 1}>
              <div className="erow" style={{ padding: "clamp(24px,3vw,38px) 0" }}>
                <div className="bignum bignum--ghost">{s.k}</div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "clamp(16px,3vw,48px)", alignItems: "center" }} className="cols-stack">
                  <div>
                    <h3 style={{ fontSize: "clamp(1.3rem,2.2vw,1.7rem)", marginBottom: 10 }}>{s.t}</h3>
                    <p style={{ fontSize: 15, color: "var(--fg-3)", lineHeight: 1.55, maxWidth: 560 }}>{s.d}</p>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "flex-start" }}>
                    {s.chips.map((c) => <span key={c} className="pill">{c}</span>)}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
          <div style={{ borderTop: "1px solid var(--line-1)" }} />
        </div>
      </div>
    </section>
  );
}

// ── What it automates ───────────────────────────────────────────────
function Automations() {
  return (
    <section id="automate" className="section">
      <div className="wrap">
        <div style={{ maxWidth: 720, marginBottom: "clamp(36px,4vw,52px)" }}>
          <Reveal as="p" className="eyebrow">What it handles</Reveal>
          <Reveal as="h2" d="1" className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)", marginBottom: 16 }}>
            The chasing you keep meaning to do.
          </Reveal>
          <Reveal as="p" d="2" className="lead-copy">Six things that quietly cost you sales when they don't happen. Vraelis just does them.</Reveal>
        </div>
        <Reveal d="1" as="div" className="bento">
          <div className="tile tile--accent span3">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.85 }}>replies in</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2.6rem,5vw,3.6rem)", lineHeight: 1, letterSpacing: "-0.03em" }}>38<span style={{ fontSize: "0.5em" }}>s</span></div>
            <h3 style={{ fontSize: 17 }}>Instant replies</h3>
            <p style={{ fontSize: 14, lineHeight: 1.5 }}>Every lead hears back in seconds, in your words — not a robot auto-reply that screams “bot.”</p>
          </div>
          <div className="tile span3">
            <h3 style={{ fontSize: 17 }}>Qualifying questions</h3>
            <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.5 }}>It asks what you'd ask, then tells you who's ready to buy and who's just pricing around.</p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: "auto" }}>
              <span className="pill st-qualified"><span className="dot" />Qualified</span>
              <span className="pill st-new"><span className="dot" />Just looking</span>
            </div>
          </div>
          <div className="tile span2">
            <h3 style={{ fontSize: 16 }}>Follow-ups</h3>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>Most leads need a few nudges. It sends them and stops the second someone replies.</p>
          </div>
          <div className="tile span2">
            <h3 style={{ fontSize: 16 }}>Booking & reminders</h3>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>Shares your real calendar, books the slot, reminds them the day before. Fewer no-shows.</p>
          </div>
          <div className="tile span2">
            <h3 style={{ fontSize: 16 }}>Owner handoff</h3>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>When a lead is big, ready, or stuck, it taps you on the shoulder instead of guessing.</p>
          </div>
          <div className="tile span6" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20, background: "var(--acc-soft)", borderColor: "var(--acc-line)" }}>
            <div style={{ maxWidth: 440 }}>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>Pipeline tracking</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--fg-3)" }}>Every lead, always placed — so you open the app and instantly know where the money is.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["New", "st-new"], ["Contacted", "st-contacted"], ["Qualified", "st-qualified"], ["Booked", "st-booked"], ["Won", "st-won"]].map(([l, c]) => (
                <span key={l} className={`pill ${c}`}><span className="dot" />{l}</span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Deep dashboard preview ──────────────────────────────────────────
function PanelLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line-1)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>
      {children}
    </div>
  );
}

function DeepDashboard() {
  const lead = LEADS[0];
  return (
    <section id="dashboard" className="section" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.4 }} />
      <div className="wrap" style={{ position: "relative" }}>
        <div style={{ maxWidth: 760, marginBottom: "clamp(36px, 5vw, 56px)" }}>
          <Reveal as="p" className="eyebrow">Inside the dashboard</Reveal>
          <Reveal as="h2" d="1" className="display" style={{ fontSize: "clamp(2rem, 3.6vw, 3.2rem)", marginBottom: 18 }}>
            How one <span className="em">$4,000</span> lead got paid.
          </Reveal>
          <Reveal as="p" d="2" className="lead-copy">
            Marcus DM'd at 9:14am asking about the coaching program. Here's the whole thing —
            engaged, qualified, closed, and paid in full — without you lifting a finger.
          </Reveal>
        </div>
        <Reveal d="1" className="win">
          <div className="win__bar">
            <div className="win__dots"><i /><i /><i /></div>
            <span className="win__addr"><span className="dot dot--acc" /> app.vraelis.com/leads/marcus-bell</span>
            <span style={{ marginLeft: "auto" }} className="pill st-booked"><span className="dot" />Booked</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)" }} className="deep-body">
            <div style={{ borderRight: "1px solid var(--line-1)", display: "flex", flexDirection: "column", minWidth: 0 }}>
              <PanelLabel>Conversation · {lead.source}</PanelLabel>
              <Conversation lead={lead} height={340} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <PanelLabel>Follow-up automation</PanelLabel>
              <div style={{ padding: "18px 18px 4px" }}><FollowupTimeline lead={lead} /></div>
              <div style={{ padding: "14px 18px", borderTop: "1px solid var(--line-1)", marginTop: "auto" }}>
                <div style={{ padding: "12px 14px", borderRadius: 4, border: "1px solid var(--acc-line)", background: "var(--acc-soft)", marginBottom: 12 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc)", marginBottom: 5 }}>Booking status</div>
                  <div style={{ fontSize: 13, color: "var(--fg-1)", lineHeight: 1.4 }}>{lead.booking}</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 }}>Revenue recovered</div>
                    <div className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--money)", lineHeight: 1 }}>${lead.value.toLocaleString()}</div>
                  </div>
                  <span className="pill"><span className="dot dot--acc" />0 min of staff time</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal d="2" style={{ marginTop: 28, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <Cta large>Start free <span aria-hidden>→</span></Cta>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>Connect your offer and watch your next lead move toward payment</span>
        </Reveal>
      </div>
    </section>
  );
}

// ── Use cases — pinned horizontal scroll ───────────────────────────
// On wide screens the section pins to the viewport and converts
// vertical scroll into horizontal travel across the cards; once the
// last card is reached, normal vertical scrolling resumes. Narrow
// screens (and reduced-motion users) fall back to a plain swipeable
// strip — and that's also the no-JS / pre-hydration default.
const USE_CASES = [
  { t: "Coaches", n: "01", d: "A DM about your program lands at midnight. By the time you're up, it's qualified, the kickoff is booked, and the $4k is already paid.", m: "Programs sold overnight", c: "#2563EB" },
  { t: "Course creators", n: "02", d: "Someone asks if the course is still open. Vraelis answers, sends the checkout, closes the sale, and queues the mentorship upsell.", m: "Courses sold on autopilot", c: "#0E9E6C" },
  { t: "Agencies", n: "03", d: "A referral wants help and has the budget. Vraelis qualifies the spend, collects the first month, and books onboarding before you reply.", m: "Retainers closed + deposited", c: "#0D9488" },
  { t: "Communities", n: "04", d: "Questions about joining land at 10pm. They get answered, the annual membership gets paid, and the access link goes out — then, not tomorrow.", m: "Memberships paid after hours", c: "#7C3AED" },
  { t: "Consultants", n: "05", d: "It screens the tire-kickers, sends serious buyers a deposit link for the engagement, and only puts paid calls on your calendar.", m: "Only paid calls get through", c: "#C2540C" },
];

// Static 3-on-top / 2-centered-below grid — fits on screen, no scroll.
// flex-wrap + justify-center means 3 cards fill the first row and the
// remaining 2 center under them; it collapses to 2-up then 1-up on
// smaller screens.
function UseCases() {
  return (
    <section id="usecases" className="section" style={{ overflow: "hidden" }}>
      <div className="wrap">
        <div style={{ maxWidth: 640, marginBottom: "clamp(28px,3vw,40px)" }}>
          <Reveal as="p" className="eyebrow">Who it's for</Reveal>
          <Reveal as="h2" d="1" className="display" style={{ fontSize: "clamp(2rem, 3.6vw, 3.1rem)" }}>
            If you lose money when leads wait, this is for <span className="mark"><span>you.</span></span>
          </Reveal>
        </div>
        <Reveal d="1">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center" }}>
            {USE_CASES.map((c) => (
              <div key={c.t} style={{ flex: "1 1 300px", maxWidth: 384, background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", boxShadow: "var(--shadow-card)", padding: 22, display: "flex", flexDirection: "column", gap: 11, minHeight: 210 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: c.c, display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5 }}>{c.n}</span>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.c }} />
                </div>
                <h3 style={{ fontSize: 20, letterSpacing: "-0.02em" }}>{c.t}</h3>
                <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.5, flex: 1 }}>{c.d}</p>
                <div style={{ paddingTop: 12, borderTop: "1px solid var(--line-1)", display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, fontWeight: 600, color: c.c }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.c }} />{c.m}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Pricing ─────────────────────────────────────────────────────────
type Cycle = "monthly" | "yearly" | "lifetime";
type CyclePrice = { price: string; unit: string; cut: string };
type Plan = {
  name: string;
  featured: boolean;
  who: string;
  feats: string[];
  cta: string;
  ctaHref?: string; // omit → signup CTA (becomes "Open app" when signed in)
  key?: "solo" | "growth"; // paid plans → Stripe Checkout
  prices: Record<Cycle, CyclePrice>;
};

// Lifetime ("all-time") plans cost more up front AND carry a higher cut
// of booked revenue — that's where the compensation comes from.
const PLANS: Plan[] = [
  {
    name: "Starter", featured: false,
    who: "For solo operators getting their first leads answered.",
    feats: ["1 inbound channel", "Instant AI replies", "Basic follow-up", "Calendar booking", "Pipeline tracking"],
    cta: "Start free",
    prices: {
      monthly: { price: "$0", unit: "free", cut: "20%" },
      yearly: { price: "$0", unit: "free", cut: "20%" },
      lifetime: { price: "$0", unit: "free", cut: "20%" },
    },
  },
  {
    name: "Solo", featured: false, key: "solo",
    who: "For a steady solo pipeline that's starting to add up.",
    feats: ["2 inbound channels", "Smart qualification", "Multi-step follow-up", "Reminders & no-show recovery", "Pipeline tracking"],
    cta: "Get Solo",
    prices: {
      monthly: { price: "$39", unit: "/ month", cut: "7%" },
      yearly: { price: "$390", unit: "/ year", cut: "7%" },
      lifetime: { price: "$590", unit: "one-time", cut: "10%" },
    },
  },
  {
    name: "Growth", featured: true, key: "growth",
    who: "For sellers with steady inbound demand.",
    feats: ["All channels connected", "Qualification & scoring", "Multi-step follow-up", "Owner handoff alerts", "Revenue-recovered reporting"],
    cta: "Get Growth",
    prices: {
      monthly: { price: "$89", unit: "/ month", cut: "5%" },
      yearly: { price: "$890", unit: "/ year", cut: "5%" },
      lifetime: { price: "$1,490", unit: "one-time", cut: "8%" },
    },
  },
  {
    name: "Agency", featured: false,
    who: "For teams managing leads across multiple clients.",
    feats: ["Multiple workspaces", "Per-client pipelines", "Shared team inbox", "Roles & permissions", "Priority support"],
    cta: "Contact sales", ctaHref: "/contact",
    prices: {
      monthly: { price: "Custom", unit: "talk to us", cut: "1–2%" },
      yearly: { price: "Custom", unit: "talk to us", cut: "1–2%" },
      lifetime: { price: "Custom", unit: "talk to us", cut: "3%" },
    },
  },
];

const CYCLES: { key: Cycle; label: string }[] = [
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
  { key: "lifetime", label: "Lifetime" },
];

// Keep-vs-cut calculator. Reads the real PLANS prices + CUT_RATES so the
// break-evens are always accurate, and respects the active billing cycle.
// Teaches the model: start free, upgrade when a lower cut beats the fee.
function PricingCalculator({ cycle }: { cycle: Cycle }) {
  // Controlled as a string so the field can be emptied (backspace works) and
  // never shows leading zeros like "094"; revenue is derived + clamped ≥ 0.
  const [revInput, setRevInput] = useState("1200");
  const revenue = Math.max(0, Number(revInput) || 0);

  const parsePrice = (s: string) => (s.toLowerCase().includes("custom") ? 0 : Number(s.replace(/[^0-9.]/g, "")) || 0);
  const planByName = (n: string) => PLANS.find((p) => p.name === n)!;
  // Plan cost expressed per month for fair comparison (lifetime = no monthly fee).
  const monthlyFee = (plan: Plan) => {
    if (cycle === "monthly") return parsePrice(plan.prices.monthly.price);
    if (cycle === "yearly") return parsePrice(plan.prices.yearly.price) / 12;
    return 0; // lifetime — one-time, charged separately
  };

  const rows = (["Starter", "Solo", "Growth"] as const).map((name) => {
    const plan = planByName(name);
    const key = name.toLowerCase();
    const cut = CUT_RATES[key]?.[cycle] ?? 0;
    const fee = monthlyFee(plan);
    const commission = revenue * cut;
    const total = fee + commission;
    return { name, cut, fee, commission, total, keep: revenue - total };
  });
  const best = rows.reduce((a, b) => (b.keep > a.keep ? b : a), rows[0]);
  const starter = rows[0];

  const fmt = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString();
  const pct = (n: number) => (n * 100).toFixed((n * 100) % 1 === 0 ? 0 : 1) + "%";

  let explain: string;
  if (best.name === "Starter") {
    // Derive the Solo break-even from live numbers (not hardcoded): the point
    // where Solo's lower cut offsets its fee. ~$300/mo monthly, ~$250 yearly,
    // and n/a on lifetime (no monthly fee → Solo always wins).
    const soloRow = rows.find((r) => r.name === "Solo");
    const be = soloRow && soloRow.cut < starter.cut ? soloRow.fee / (starter.cut - soloRow.cut) : Infinity;
    const tail = Number.isFinite(be) ? ` Once you're past about ${fmt(be)}/mo, Solo starts to win.` : "";
    explain = `At ${fmt(revenue)}/mo you keep the most on Starter — you're not doing enough volume yet for a paid plan's lower cut to beat its fee.${tail}`;
  } else {
    const saved = best.keep - starter.keep;
    explain = `At ${fmt(revenue)}/mo, ${best.name} keeps you the most — its ${pct(best.cut)} cut more than offsets the ${cycle === "lifetime" ? "one-time" : "plan"} cost, so you pocket about ${fmt(saved)}/mo more than on Starter.`;
  }
  const cycleNote =
    cycle === "yearly" ? "Plan cost shown per month (billed yearly)."
    : cycle === "lifetime" ? "Lifetime has no monthly fee — these figures exclude the one-time price."
    : "";

  const inputStyle: CSSProperties = {
    width: "100%", boxSizing: "border-box", border: "1px solid var(--line-2)", background: "var(--bg-2)",
    borderRadius: "var(--r-sm)", padding: "12px 14px 12px 28px", color: "var(--fg-1)",
    fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", outline: "none",
  };

  return (
    <Reveal
      style={{
        marginTop: "clamp(34px, 4vw, 52px)", borderRadius: "var(--r-sm)", background: "var(--bg-1)",
        border: "1px solid var(--line-2)", padding: "clamp(22px, 2.6vw, 34px)", boxShadow: "var(--shadow-card)",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(24px, 4vw, 48px)" }}>
        {/* input */}
        <div style={{ flex: "1 1 240px", minWidth: 220, maxWidth: 320 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>
            What you keep
          </p>
          <label style={{ display: "block", fontSize: 13, color: "var(--fg-3)", marginBottom: 8 }}>
            Monthly revenue Vraelis books for you
          </label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--fg-4)", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>$</span>
            <input
              type="text" inputMode="decimal" value={revInput}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") return setRevInput(""); // allow empty so backspace works
                if (!/^\d*\.?\d*$/.test(v)) return; // digits only — no negatives, no junk
                setRevInput(v.replace(/^0+(?=\d)/, "")); // strip leading zeros (094 → 94)
              }}
              style={inputStyle}
            />
          </div>
          <input
            type="range" min={0} max={10000} step={100}
            value={Math.min(revenue, 10000)}
            onChange={(e) => setRevInput(e.target.value)}
            style={{ width: "100%", marginTop: 14, accentColor: "var(--acc-deep)" }}
          />
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)", marginTop: 14, lineHeight: 1.5 }}>
            We only make more when you make more.
          </p>
        </div>

        {/* results */}
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r) => {
              const isBest = r.name === best.name;
              return (
                <div
                  key={r.name}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    padding: "13px 16px", borderRadius: "var(--r-sm)",
                    border: `1px solid ${isBest ? "var(--acc-deep)" : "var(--line-1)"}`,
                    background: isBest ? "rgba(14,158,108,0.06)" : "var(--bg-2)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-2)" }}>{r.name}</span>
                      {isBest && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--acc-deep)", fontWeight: 600 }}>Best pick</span>}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", marginTop: 3 }}>
                      {r.fee > 0 ? `${fmt(r.fee)} plan + ` : ""}{pct(r.cut)} cut = {fmt(r.total)} to Vraelis
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: isBest ? "var(--acc-deep)" : r.keep <= 0 ? "var(--fg-4)" : "var(--fg-1)" }}>{r.keep <= 0 ? "$0" : fmt(r.keep)}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-5)" }}>{r.keep <= 0 ? "no profit yet" : "you keep"}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, marginTop: 16 }}>{explain}</p>
          {cycleNote && <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", marginTop: 8 }}>{cycleNote}</p>}
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", marginTop: 8 }}>
            Doing more than this?{" "}
            <a href="/contact" style={{ color: "var(--acc-deep)" }}>Agency drops the cut to 1–2%.</a>
          </p>
        </div>
      </div>
    </Reveal>
  );
}

function Pricing() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  // Which plan the signed-in user already owns ("starter" = free, or
  // "solo"/"growth"); null = signed out / unknown. Used to show
  // "Current plan" instead of a buy button.
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/vraelis/me")
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.signedIn) setCurrentPlan(d.plan ?? "starter");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Take the buyer to the checkout page (card + PayPal) for this plan/cycle.
  function startCheckout(plan: "solo" | "growth") {
    window.location.href = `/checkout?plan=${plan}&cycle=${cycle}`;
  }

  return (
    <section id="pricing" className="section">
      <div className="wrap">
        <div style={{ maxWidth: 720, marginBottom: "clamp(28px, 4vw, 44px)" }}>
          <Reveal as="p" className="eyebrow">Pricing</Reveal>
          <Reveal as="h2" d="1" className="display" style={{ fontSize: "clamp(2rem, 3.6vw, 3.2rem)", marginBottom: 18 }}>
            We win when you get paid.
          </Reveal>
          <Reveal as="p" d="2" className="lead-copy">Low base, then we take a small cut of the revenue Vraelis books for you — we only earn when you do. The bigger your plan, the smaller our cut.</Reveal>
        </div>

        {/* billing cycle — underlined segmented control, no pills */}
        <div style={{ display: "flex", gap: "clamp(20px,3vw,34px)", borderBottom: "1px solid var(--line-2)", marginBottom: "clamp(30px,3.5vw,46px)" }}>
          {CYCLES.map((c) => {
            const on = cycle === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCycle(c.key)}
                style={{
                  border: "none", background: "none", cursor: "pointer",
                  padding: "0 1px 13px", marginBottom: -1,
                  fontFamily: "var(--font-mono)", fontSize: 13.5, letterSpacing: "0.01em",
                  color: on ? "var(--fg-1)" : "var(--fg-4)",
                  fontWeight: on ? 600 : 500,
                  borderBottom: `2px solid ${on ? "var(--acc)" : "transparent"}`,
                }}
              >
                {c.label}
                {c.key === "yearly" && (
                  <span style={{ marginLeft: 7, fontSize: 11, color: on ? "var(--acc-deep)" : "var(--fg-5)" }}>2 mo free</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="grid cols-4" style={{ alignItems: "stretch" }}>
          {PLANS.map((t, i) => {
            const ink = t.featured;
            const p = t.prices[cycle];
            // Featured plan = a solid emerald column (no badge needed).
            const c = ink
              ? { name: "rgba(255,255,255,0.78)", price: "#fff", unit: "rgba(255,255,255,0.65)", cutLabel: "rgba(255,255,255,0.7)", cutNum: "#fff", cutSub: "rgba(255,255,255,0.6)", who: "rgba(255,255,255,0.88)", rule: "rgba(255,255,255,0.20)", idx: "rgba(255,255,255,0.55)", feat: "rgba(255,255,255,0.95)" }
              : { name: "var(--fg-4)", price: "var(--fg-1)", unit: "var(--fg-4)", cutLabel: "var(--fg-4)", cutNum: "var(--acc-deep)", cutSub: "var(--fg-5)", who: "var(--fg-3)", rule: "var(--line-1)", idx: "var(--fg-4)", feat: "var(--fg-2)" };
            return (
              <Reveal
                key={t.name}
                d={(i % 3) + 1}
                style={{
                  display: "flex", flexDirection: "column", position: "relative", height: "100%",
                  borderRadius: "var(--r-sm)", padding: "clamp(24px,2.3vw,30px)",
                  background: ink ? "linear-gradient(158deg, var(--acc) 0%, var(--acc-deep) 100%)" : "var(--bg-1)",
                  border: ink ? "1.5px solid var(--acc-deep)" : "1px solid var(--line-2)",
                  boxShadow: ink ? "0 34px 70px -30px rgba(14,158,108,0.45)" : "var(--shadow-card)",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 18 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: c.name }}>{t.name}</span>
                  {ink && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Most popular</span>}
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                  <span className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1, color: c.price }}>{p.price}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: c.unit }}>{p.unit}</span>
                </div>

                {/* our cut — framed as a term-sheet stat, no pill */}
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${c.rule}`, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: c.cutLabel, marginBottom: 4 }}>Our cut</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: c.cutSub }}>of revenue we book</div>
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: c.cutNum }}>{p.cut}</div>
                </div>

                <p style={{ fontSize: 13, color: c.who, marginTop: 18, marginBottom: 22, lineHeight: 1.5 }}>{t.who}</p>

                {currentPlan === t.name.toLowerCase() ? (
                  <div style={{ width: "100%", textAlign: "center", borderRadius: 999, padding: "13px 22px", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-sans)", border: `1px solid ${ink ? "rgba(255,255,255,0.45)" : "var(--line-2)"}`, color: ink ? "rgba(255,255,255,0.9)" : "var(--fg-3)", background: ink ? "rgba(255,255,255,0.12)" : "var(--bg-2)" }}>
                    Your current plan
                  </div>
                ) : ink && t.key ? (
                  <button type="button" onClick={() => startCheckout(t.key!)} style={{ width: "100%", border: "none", cursor: "pointer", borderRadius: 999, padding: "13px 22px", fontSize: 15, fontWeight: 600, background: "#fff", color: "var(--acc-deep)", fontFamily: "var(--font-sans)" }}>
                    {t.cta} →
                  </button>
                ) : t.key ? (
                  <button type="button" className="btn" onClick={() => startCheckout(t.key!)} style={{ width: "100%", justifyContent: "center" }}>
                    {t.cta} →
                  </button>
                ) : (
                  <Cta variant="ghost" href={t.ctaHref} style={{ width: "100%", justifyContent: "center" }}>{t.cta}</Cta>
                )}

                {/* features — mono-indexed spec rows, no checkmarks */}
                <div style={{ marginTop: 26 }}>
                  {t.feats.map((f, idx) => (
                    <div key={f} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: `1px solid ${c.rule}`, alignItems: "baseline" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: c.idx, flex: "0 0 auto", width: 16 }}>{String(idx + 1).padStart(2, "0")}</span>
                      <span style={{ fontSize: 13, color: c.feat, lineHeight: 1.45 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal d="1" as="p" style={{ marginTop: 30, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", maxWidth: 620 }}>
          {cycle === "lifetime"
            ? "Lifetime is one-time — no subscription, just a higher cut of the revenue Vraelis books for you."
            : "We only take our cut from revenue Vraelis actually books for you — never your existing sales."}{" "}
          Plans are indicative while we finalize early access.
        </Reveal>

        <PricingCalculator cycle={cycle} />
      </div>
    </section>
  );
}

// ── Final CTA + footer ──────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="section" style={{ position: "relative", overflow: "hidden", textAlign: "center" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 50% 60% at 50% 45%, rgba(14,158,108,0.10) 0%, transparent 65%)" }} />
      <div className="wrap" style={{ position: "relative", maxWidth: 820 }}>
        <Reveal as="h2" className="display" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", marginBottom: 22 }}>
          Stop letting warm leads <span className="em">go cold.</span>
        </Reveal>
        <Reveal as="p" d="1" className="lead-copy" style={{ margin: "0 auto 34px", textAlign: "center" }}>
          Connect your offer in a few minutes. The next lead that comes in gets engaged, qualified, and moved toward payment — even if it's 2am and you're asleep.
        </Reveal>
        <Reveal d="2" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
          <Cta large>Start free <span aria-hidden>→</span></Cta>
          <Cta variant="ghost" large>Request access</Cta>
        </Reveal>
        <Reveal d="3" style={{ display: "flex", gap: 22, justifyContent: "center", flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>
          <span>No new sales stack</span><span style={{ color: "var(--fg-5)" }}>·</span>
          <span>Live in minutes</span><span style={{ color: "var(--fg-5)" }}>·</span>
          <span>Human handoff anytime</span>
        </Reveal>
      </div>
    </section>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {links.map((l) => <a key={l.label} href={l.href} style={{ fontSize: 13, color: "var(--fg-3)", textDecoration: "none" }}>{l.label}</a>)}
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer style={{ padding: "var(--s-16) var(--gutter) var(--s-12)" }}>
      <div style={{ maxWidth: "var(--max-content)", margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "clamp(32px, 5vw, 72px)", alignItems: "flex-start" }}>
        <div style={{ flex: "1.5 1 280px", minWidth: 240, maxWidth: 400 }}>
          <div style={{ display: "inline-flex", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--fg-1)" }}>Vraelis</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.55 }}>The revenue platform for high-ticket sellers. Vraelis engages, qualifies, follows up, books, and collects payment — turning interested leads into paying customers.</p>
          <a
            href="https://instagram.com/usevraelis"
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, fontWeight: 600, color: "var(--acc-deep)", textDecoration: "none" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="2" width="20" height="20" rx="5.5" />
              <circle cx="12" cy="12" r="4.2" />
              <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
            </svg>
            Follow @usevraelis
          </a>
        </div>
        <div style={{ flex: "2 1 340px", display: "flex", flexWrap: "wrap", gap: "clamp(24px, 4vw, 56px)" }}>
          <div style={{ flex: "1 1 110px", minWidth: 110 }}>
            <FooterCol title="Product" links={[{ label: "How it works", href: "/how" }, { label: "See it work", href: DASHBOARD_HREF }, { label: "What it automates", href: "/automates" }, { label: "Pricing", href: "/pricing" }]} />
          </div>
          <div style={{ flex: "1 1 110px", minWidth: 110 }}>
            <FooterCol title="Company" links={[{ label: "Resources", href: "/articles" }, { label: "Contact", href: "/contact" }, { label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }, { label: "Refunds", href: "/refunds" }]} />
          </div>
          <div style={{ flex: "1 1 110px", minWidth: 110 }}>
            <FooterCol title="Get started" links={[{ label: "Start free", href: SIGNUP_HREF }, { label: "Request access", href: SIGNUP_HREF }, { label: "Sign in", href: SIGNIN_HREF }]} />
          </div>
        </div>
      </div>
      <div style={{ maxWidth: "var(--max-content)", margin: "var(--s-12) auto 0", paddingTop: "var(--s-6)", borderTop: "1px solid var(--line-1)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)" }}>
        <span>© 2026 Vraelis</span>
        <span>The AI agent that follows up, books leads, and collects payment.</span>
      </div>
      <p style={{ maxWidth: "var(--max-content)", margin: "10px auto 0", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", lineHeight: 1.5 }}>
        Vraelis replies are AI-generated and may contain mistakes. Vraelis is a tool — you&apos;re responsible for your own business and customers.
      </p>
    </footer>
  );
}

// ── Shell (provided by the (vraelis) layout) ───────────────────────
export function VraelisShell({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  return (
    <SignedInContext.Provider value={signedIn}>
      <div className="vraelis-root">
        <div style={{ position: "sticky", top: 0, zIndex: 50 }}>
          <VraelisPromoBar />
          <Nav signedIn={signedIn} />
        </div>
        {children}
        <SiteFooter />
      </div>
    </SignedInContext.Provider>
  );
}

// ── Page content blocks (composed by each route's page.tsx) ────────
export function HomeContent() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <Automations />
      <DeepDashboard />
      <UseCases />
      <Pricing />
    </>
  );
}

export function HowContent() {
  return (
    <>
      <HowItWorks />
      <DeepDashboard />
    </>
  );
}

export function AutomatesContent() {
  return (
    <>
      <Automations />
      <UseCases />
    </>
  );
}

export function PricingContent() {
  return (
    <>
      <Pricing />
      <UseCases />
    </>
  );
}

// "See it work" — its own page (was the /#dashboard hash anchor). The live
// dashboard walkthrough + the automation scenarios.
export function DemoContent() {
  return (
    <>
      <DeepDashboard />
      <UseCases />
    </>
  );
}
