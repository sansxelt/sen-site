// Vraelis articles — lightweight, file-based content. Edit this list
// to add/change posts; each `body` is plain Markdown (GFM) rendered by
// the article page. No CMS, no DB — just data.

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  tag: string;
  date: string; // ISO yyyy-mm-dd
  readingMinutes: number;
  body: string;
};

export const ARTICLES: Article[] = [
  {
    slug: "speed-to-lead",
    title: "Speed-to-lead: why the first five minutes decide the deal",
    excerpt:
      "The single biggest predictor of whether an inbound lead converts isn't price or pitch — it's how fast you reply. Here's the data, and how to win the window.",
    tag: "Playbook",
    date: "2026-05-20",
    readingMinutes: 6,
    body: `Most businesses lose deals they never knew they had. Not to a better competitor — to a faster one.

## The five-minute cliff

Study after study lands on the same number: contacting a lead within **five minutes** of their enquiry makes them dramatically more likely to convert than waiting even thirty. After an hour, your odds fall off a cliff. The lead has moved on, filled out the next form, and started talking to whoever answered first.

The problem is that "five minutes" is brutal in practice. Leads arrive at 11pm, during a job, mid-meeting, on a weekend. No human team answers every one inside five minutes, every time.

## What actually wins the window

- **Reply instantly, in your voice.** A real, relevant first message — not a "we'll get back to you" autoresponder that screams *bot*.
- **Qualify while they're warm.** Ask the two or three questions you'd ask anyway: what they need, timing, budget.
- **Move toward a booking.** The goal of the first exchange isn't to close — it's to hold attention and put a time on the calendar.

## Where Vraelis fits

Vraelis answers every inbound lead in under a minute, any hour, then qualifies and books — so the five-minute window stops being something you hope to hit and becomes something that just happens.`,
  },
  {
    slug: "follow-up-sequences",
    title: "The follow-up sequence most businesses never send",
    excerpt:
      "A lead going quiet isn't a no — it's usually a 'not yet.' The money is in the nudges nobody has time to send. Here's a sequence that works.",
    tag: "Playbook",
    date: "2026-05-12",
    readingMinutes: 5,
    body: `Here's an uncomfortable truth: most leads need more than one touch, and most businesses send exactly one.

## Silence is not rejection

When someone goes quiet, the natural read is "they weren't serious." Usually they were — they just got busy. The deal didn't die; it stalled. A well-timed nudge restarts it.

## A sequence that respects the lead

1. **Instant reply** — within a minute, acknowledge and ask one qualifying question.
2. **Same-day nudge** — if no reply, a short, specific follow-up referencing what they asked.
3. **Next-day value** — send something useful: a relevant example, a price range, available times.
4. **The gentle close** — a final "still want me to hold a slot?" that's easy to say yes to.

The art is stopping the instant they reply, and never sounding like a drip campaign.

## The hard part is consistency

Sending this every time, to every lead, is exactly the work that falls through the cracks when you're busy. That's the work Vraelis does on autopilot — and stops the second a human replies.`,
  },
  {
    slug: "missed-calls-cost",
    title: "What a missed call actually costs you",
    excerpt:
      "Every unanswered call is a lead handing itself to your competitor. Here's how to put a number on it — and how to recover them automatically.",
    tag: "Operations",
    date: "2026-04-28",
    readingMinutes: 4,
    body: `A missed call feels free. It isn't. It's a warm lead, already interested enough to pick up the phone, deciding what to do next — and usually that's calling the next business on the list.

## Put a number on it

Take your average job value and your typical close rate on phone enquiries. Multiply that by the calls you miss in a week. The number is almost always bigger than people expect, because missed calls cluster exactly when you're most valuable elsewhere — on a job, with a customer, after hours.

## Recovery beats prevention

You can't answer every call live. But you *can* make sure no missed call goes dark:

- **Text back in seconds.** A friendly "sorry we missed you — how can we help?" keeps the lead in your hands.
- **Capture the need.** Find out what they want before they've redialed someone else.
- **Book it.** Turn the recovered conversation into an appointment.

Vraelis treats a missed call like any other lead: it texts back in under a minute, finds out what they need, and books them — before they try the place down the road.`,
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getAllArticleSlugs(): string[] {
  return ARTICLES.map((a) => a.slug);
}

export function formatArticleDate(iso: string): string {
  // Deterministic, locale-independent (avoids SSR/CSR hydration drift).
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  if (!y || !m || !d) return iso;
  return `${months[m - 1]} ${d}, ${y}`;
}
