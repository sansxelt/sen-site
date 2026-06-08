// Dashboard.jsx — the interactive lead-pipeline dashboard.
// Click a lead on the left; the detail panel rebuilds on the right.
// Exports LEADS + sub-panels so the deeper section can reuse them.

const LEADS = [
  {
    id: "l1", name: "Marcus Bell", company: "Bell & Co. Roofing",
    source: "Website form", status: "booked", value: 4200, ago: "2m",
    snippet: "Need a quote for a full re-roof, ~1800 sq ft.",
    booking: "Thu, 12 Jun · 9:30 AM — On-site estimate",
    messages: [
      { who: "lead", t: "Hi, need a quote for a full re-roof, around 1800 sq ft. How soon can someone come out?", time: "9:14" },
      { who: "v", t: "Thanks Marcus — I can help with that. Is this for a residential property, and is the current roof asphalt shingle?", time: "9:14" },
      { who: "lead", t: "Yep, residential, asphalt. Roof is about 20 years old.", time: "9:21" },
      { who: "v", t: "Got it. We have an estimator near you. I can hold Thursday 9:30 AM or Friday 2:00 PM for an on-site visit — which works?", time: "9:21" },
      { who: "lead", t: "Thursday morning is good.", time: "9:38" },
      { who: "v", t: "Booked — Thu 12 Jun, 9:30 AM. You'll get a text reminder the day before. Anything else I should pass to the estimator?", time: "9:38" },
    ],
    followups: [
      { label: "Instant reply sent", time: "9:14", state: "done" },
      { label: "Qualified: residential · asphalt · 1800 sq ft", time: "9:21", state: "done" },
      { label: "Estimate booked — Thu 9:30 AM", time: "9:38", state: "done" },
      { label: "Reminder text — day before", time: "Wed 6:00 PM", state: "now" },
    ],
  },
  {
    id: "l2", name: "Priya Anand", company: "Inbound · Instagram DM",
    source: "Instagram", status: "qualified", value: 2800, ago: "14m",
    snippet: "Saw your studio — do you do brand photo days?",
    booking: null,
    messages: [
      { who: "lead", t: "Saw your studio on IG — do you do brand photo days for small teams?", time: "13:02" },
      { who: "v", t: "We do. Roughly how many people, and is there a date you're aiming for?", time: "13:02" },
      { who: "lead", t: "About 6 people, sometime in July.", time: "13:20" },
      { who: "v", t: "Perfect — a half-day session covers a team that size. Want me to send a few July dates and a sample gallery?", time: "13:20" },
    ],
    followups: [
      { label: "Instant reply sent", time: "13:02", state: "done" },
      { label: "Qualified: 6 people · July", time: "13:20", state: "done" },
      { label: "Follow-up: send dates + gallery", time: "in 1h", state: "now" },
      { label: "Booking link", time: "queued", state: "next" },
    ],
  },
  {
    id: "l3", name: "Dev Okonkwo", company: "Northgate Dental",
    source: "Missed call", status: "contacted", value: 900, ago: "31m",
    snippet: "Missed call recovered — texted back in 40s.",
    booking: null,
    messages: [
      { who: "v", t: "Hi, this is Northgate Dental — sorry we missed your call. How can we help? (You can just text back here.)", time: "11:06" },
      { who: "lead", t: "Trying to book a cleaning + checkup, new patient.", time: "11:09" },
      { who: "v", t: "Welcome! For a new-patient cleaning we'll book a 60-min slot. Mornings or afternoons better for you?", time: "11:09" },
    ],
    followups: [
      { label: "Missed call → text in 40s", time: "11:06", state: "done" },
      { label: "Replied: new patient cleaning", time: "11:09", state: "done" },
      { label: "Follow-up if no reply", time: "in 3h", state: "next" },
    ],
  },
  {
    id: "l4", name: "Sara Lindqvist", company: "Lindqvist Consulting",
    source: "Website form", status: "new", value: 6500, ago: "just now",
    snippet: "Looking for help with a go-to-market plan.",
    booking: null,
    messages: [
      { who: "lead", t: "Looking for help with a go-to-market plan for a B2B launch in Q3. Do you take projects like this?", time: "now" },
      { who: "v", t: "We do — GTM for B2B launches is core work for us. To point you to the right person: is this a new product, or repositioning an existing one?", time: "now" },
    ],
    followups: [
      { label: "Instant reply sent", time: "now", state: "done" },
      { label: "Qualifying questions in progress", time: "live", state: "now" },
      { label: "Route to owner if budget > $5k", time: "pending", state: "next" },
    ],
  },
  {
    id: "l5", name: "Theo Marchetti", company: "Marchetti Fitness Studio",
    source: "Website chat", status: "won", value: 1560, ago: "1h",
    snippet: "Signed up — 12-week transformation plan.",
    booking: "Intro session — Mon, 9 Jun · 6:00 PM",
    messages: [
      { who: "lead", t: "Interested in personal training, want to lose weight before the summer.", time: "10:02" },
      { who: "v", t: "Great goal. Our 12-week plan is built for exactly that. Want to start with a free intro session this week?", time: "10:02" },
      { who: "lead", t: "Yes! Monday evening?", time: "10:11" },
      { who: "v", t: "Done — Mon 9 Jun, 6:00 PM with Coach Theo. Confirmation + intake form sent to your email.", time: "10:11" },
    ],
    followups: [
      { label: "Instant reply sent", time: "10:02", state: "done" },
      { label: "Intro session booked", time: "10:11", state: "done" },
      { label: "Intake form sent", time: "10:12", state: "done" },
      { label: "Marked won — plan purchased", time: "10:55", state: "done" },
    ],
  },
  {
    id: "l6", name: "Wholesale enquiry", company: "Email · orders@",
    source: "Email", status: "contacted", value: 3100, ago: "2h",
    snippet: "Bulk order question — replied + asked volume.",
    booking: null,
    messages: [
      { who: "lead", t: "Do you offer wholesale pricing? We'd be ordering monthly.", time: "8:40" },
      { who: "v", t: "We do offer wholesale tiers. Roughly what monthly volume are you expecting, and which products?", time: "8:40" },
    ],
    followups: [
      { label: "Instant reply sent", time: "8:40", state: "done" },
      { label: "Asked: volume + products", time: "8:40", state: "done" },
      { label: "Follow-up if no reply", time: "tomorrow 9 AM", state: "next" },
    ],
  },
];

const STAGE_LABEL = { new: "New", contacted: "Contacted", qualified: "Qualified", booked: "Booked", won: "Won" };

function StagePill({ status }) {
  return (
    <span className={`pill st-${status}`}><span className="dot" />{STAGE_LABEL[status]}</span>
  );
}

// ── avatars ─────────────────────────────────────────────────────────
const AV_COLORS = ["#0E9E6C", "#2563EB", "#7C3AED", "#C2540C", "#0D9488", "#BE185D"];
function initials(name) {
  const w = name.replace(/[^a-zA-Z ]/g, "").trim().split(/\s+/);
  return ((w[0]?.[0] || "") + (w[1]?.[0] || "")).toUpperCase() || "·";
}
function Avatar({ lead, size = 32 }) {
  const idx = LEADS.findIndex((l) => l.id === lead.id);
  const color = AV_COLORS[idx % AV_COLORS.length];
  return (
    <span className="av" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>{initials(lead.name)}</span>
  );
}

// ── conversation panel (reused in deep section) ─────────────────────
function Conversation({ lead, height }) {
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

// ── follow-up timeline (reused in deep section) ─────────────────────
function FollowupTimeline({ lead }) {
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

// ── metric strip ────────────────────────────────────────────────────
function Sparkline({ bars }) {
  return (
    <div className="spark" style={{ marginTop: 8 }}>
      {bars.map((h, i) => <i key={i} className={i === bars.length - 1 ? "hi" : ""} style={{ height: `${h}%` }} />)}
    </div>
  );
}
function MetricStrip() {
  const metrics = [
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

// ── full dashboard ──────────────────────────────────────────────────
function Dashboard() {
  const [selId, setSelId] = React.useState("l1");
  const sel = LEADS.find((l) => l.id === selId) || LEADS[0];
  return (
    <div className="win">
      <div className="win__bar">
        <div className="win__dots"><i /><i /><i /></div>
        <span className="win__addr"><span className="dot dot--acc pulse" /> app.vraelis.com/pipeline</span>
        <span style={{ marginLeft: "auto" }} className="pill"><span className="dot dot--acc" />all channels connected</span>
      </div>
      <MetricStrip />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)" }} className="dash-body">
        {/* pipeline list */}
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
        {/* detail */}
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

Object.assign(window, { LEADS, Dashboard, Conversation, FollowupTimeline, MetricStrip, StagePill });
