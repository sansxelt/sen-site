# Vraelis launch kit

Ready-to-post assets for a first traffic push. The free check is the hook. Everything here is
accurate to the product and honest about stage (solo, early). Copy the blocks as-is, or edit
to taste. Nothing here fabricates numbers or testimonials, so it holds up under scrutiny.

Core facts to keep straight:
- Vraelis Rank is QA for AI output. Paste one or more versions of an AI-generated output, get
  per-criterion scores, the version to ship, and line-level flags that quote the exact problem
  and give a concrete fix. About 20 seconds.
- Output types today: support replies, onboarding, marketing copy, agent actions.
- 1 credit = 1 check. First 25 checks free after a one-step signup, no card. See a sample
  without signing up at vraelis.com/r/check.
- Optional second layer: validate an output on real people.
- Developer API with a CI/CD quality gate: POST /api/v1/check with a threshold, get back
  passed true/false, so you can fail a build when output scores below the bar.

The honest objection to get ahead of: "you're using an LLM to grade an LLM." True. The value
is a structured second pass with a fixed rubric that quotes the exact line to change, plus an
optional human layer when the call matters. It is a fast gate, not an oracle. Say that plainly.

---

## 1. Show HN

Post at https://news.ycombinator.com/submit . Best window: weekday, roughly 8-10am ET. Title
must be plain, no hype.

**Title:**
```
Show HN: Vraelis – QA for AI output (scores and line-level fixes in ~20s)
```

**URL:**
```
https://vraelis.com/r/check
```

**Text (paste into the text field):**
```
I keep shipping AI-generated text (support replies, onboarding, marketing copy) and the
failure mode is always the same: it reads well and is quietly wrong. It skips the apology,
invents a refund policy, promises a timeline you can't hit. A quick human skim misses it
because the writing is fluent.

Vraelis is a small tool that does a structured second pass. You paste one or more versions
of an output, and it returns a score per criterion (for a support reply: empathy, resolution,
tone, accuracy), the version to ship, and line-level flags that quote the exact span and give
a concrete fix. Takes about 20 seconds.

The obvious objection is that this is an LLM grading an LLM. That's fair, and I won't pretend
it's perfectly repeatable: run the same copy twice and the scores move a little and a
borderline flag can shift severity. What makes it useful anyway is that it runs a fixed rubric
with a pinned model and returns a specific edit ("this line promises an instant refund you
can't deliver, say the real 5 to 10 day timeline") instead of a vibe, and there's an optional
layer that routes an output to real people when the decision actually matters. I'm measuring
its run-to-run consistency and working it down; happy to share the numbers if you ask.

There's a developer API with a threshold mode, so you can run it as a CI gate: POST an output,
get back passed true/false, and fail the build if it scores below your bar. Same call takes a
batch for a whole release.

You can see a sample without signing up at the link. First 25 checks are free after signup, no
card. I'm solo on this and it's early, so I'd genuinely like to hear where it's wrong, what's
missing, and whether the line-level fixes are actually good on your real output.
```

Comment-thread notes: reply to everyone, especially critics. If someone says "AI can't judge
this," agree on the limits and show the concrete flag it produces. Do not ask for upvotes.

---

## 2. Product Hunt

Submit at https://www.producthunt.com/posts/new . Schedule for 12:01am PT on launch day.

**Name:** Vraelis

**Tagline (max 60 chars):**
```
QA for AI output: scores and line-level fixes in 20s
```

**Topics:** Artificial Intelligence, Developer Tools, SaaS, Productivity

**Description (the short gallery blurb):**
```
Paste any AI-generated output (a support reply, onboarding message, ad, or an agent's next
action) and get per-criterion scores, the version to ship, and line-level flags that quote
the exact problem with a fix. About 20 seconds. There's a developer API with a CI quality
gate, and an optional layer to validate an output on real people. First 25 checks are free.
```

**First comment (the maker's story, post it yourself right after launch):**
```
Hi Product Hunt. I'm the solo maker of Vraelis.

I built this because I kept shipping AI-generated text that read well and was quietly wrong:
a support reply that skips the apology and promises a refund speed we couldn't hit, marketing
copy with a claim we couldn't back. Fluent writing hides these, so a quick review misses them.

Vraelis does a structured second pass. Paste one or more versions of an output and it scores
each on a rubric, picks the one to ship, and flags the exact lines to fix with a concrete
rewrite, not a vibe score. For teams gating AI in production, there's an API with a threshold
so you can fail a deploy when output scores too low.

It's early and I'm one person, so I'd love your honest take: run it on your own real output
and tell me if the fixes are actually good. First 25 checks are free, no card. Sample without
signing up: vraelis.com/r/check
```

---

## 3. Twitter / X thread

Post as a thread. Tweet 1 is the hook, keep it under 280 chars each.

```
1/ I kept shipping AI-generated support replies and copy that read perfectly and were quietly
wrong. Skipped the apology. Invented a refund policy. Promised a timeline we couldn't hit.

So I built a QA pass for AI output. Here's how it works.

2/ You paste one or more versions of an AI output. You get back:
- a score per criterion (empathy, resolution, tone, accuracy for a support reply)
- the version to ship
- line-level flags that quote the exact problem and give a fix

About 20 seconds.

3/ Example. AI writes: "your refund will be back within the hour, guaranteed."

The flag: overpromise. Card refunds don't post in an hour, so you've guaranteed a broken
promise and a second angry ticket.

The fix it suggests: state the real 5 to 10 day timeline and commit to confirming.

4/ It runs a fixed rubric with a pinned model and returns a specific edit, not a mood, and it
quotes the exact line. It's an LLM grading an LLM, so it isn't perfectly repeatable and I don't
claim it is; I measure the run-to-run consistency and publish it. For the calls that matter
there's an optional layer that routes the output to real people.

5/ For teams: there's an API with a threshold. POST an output, get back passed true/false, and
fail your build when AI output scores below the bar. One call takes a batch for a whole
release.

6/ It's early and I'm solo. First 25 checks are free, no card. You can see a sample without
even signing up.

Try it on your own real output and tell me where it's wrong: vraelis.com/r/check
```

---

## 4. LinkedIn post

```
Every team I know ships AI-generated text now. Support replies, onboarding, marketing copy,
agent actions. Almost nobody reviews it, because it reads well.

That's the trap. Fluent AI output hides its own mistakes: the reply that skips the apology,
the copy with a claim you can't back, the refund promise your team can't keep. A quick skim
misses all of it.

I built Vraelis to add a QA pass. You paste one or more versions of an output and get a score
per criterion, the version to ship, and the exact lines to fix with a concrete rewrite. About
20 seconds. For teams running AI in production, there's an API with a threshold so you can gate
a release on it, the same way you gate on tests.

It's early and I'm building it solo, so I'd value honest feedback from people who ship this
stuff daily. First 25 checks are free, no card. Sample here: vraelis.com/r/check

What's your current process for checking AI output before it reaches a customer? Curious how
others handle this.
```

---

## 5. Reddit

Reddit punishes anything that reads as an ad. Lead with the problem and your story, disclose
that it's yours, and actually engage. Check each subreddit's self-promotion rules first; some
require a ratio of non-promo participation or a specific flair. Space these out over days, do
not blast them all at once.

Good fits: r/SideProject (launch-friendly), r/SaaS (feedback-friendly), r/artificial or
r/LLMDevs (technical audience), and a domain sub like r/CustomerSuccess or r/CustomerService
for the support-reply angle. Post to at most one or two to start.

**r/SideProject (title):**
```
I built a QA pass for AI-generated text after shipping too much that was quietly wrong
```
**Body:**
```
Context: I keep using AI to draft support replies and marketing copy, and the failure mode is
always the same. It reads well and is subtly wrong: skips the apology, invents a policy,
promises something the team can't deliver. Fluent writing hides it.

So I built Vraelis. You paste one or more versions of an output and it scores each on a rubric,
picks the one to ship, and flags the exact lines to fix with a concrete rewrite. About 20
seconds. There's an API with a threshold if you want to gate it in CI.

It's mine and it's early (solo). Sample without signing up: vraelis.com/r/check, and the first
25 checks are free. I'd really like feedback on whether the line-level fixes are good on real
output, and what output types I should support next. Happy to answer anything.
```

**r/SaaS (title):**
```
Solo founder: built an AI output QA tool, looking for honest feedback on the wedge
```
**Body:**
```
Vraelis does QA on AI-generated output: paste a support reply, onboarding message, ad, or an
agent's next action and get per-criterion scores, the version to ship, and line-level fixes.
There's an API with a CI quality gate for teams running AI in production.

The bet is that everyone ships AI text now and almost nobody reviews it because it reads well.
I'd love a gut check from this community: is "QA for AI output" a real wedge or a vitamin? What
would make it a must-have vs a nice-to-have for you?

Early and solo. Free to try (25 checks, no card), sample at vraelis.com/r/check. Not looking
for upvotes, looking for the objection I'm not seeing.
```

---

## Launch-day playbook

- Do not launch everywhere at once. Sequence: Show HN or Product Hunt first (pick one as the
  main event), then the Twitter thread and LinkedIn the same day, then Reddit spaced over the
  next few days.
- Be at your desk for the first 3 to 4 hours. The single biggest driver of a launch is you
  replying fast and honestly to every comment, especially the skeptical ones.
- Never ask for upvotes anywhere. It backfires on all of these platforms.
- When someone hits the "AI grading AI" objection, agree on the limit and show a concrete flag
  the tool produces. Winning that exchange in public sells better than any tagline.
- Have the free check working and fast. The whole funnel depends on the first visit landing on
  a real result, so test vraelis.com/r/check end to end before you post.
- Watch it work: turn on analytics first (GA4 and Meta env vars in Vercel) so you can see what
  the traffic actually does. Otherwise you are flying blind on launch day.
- Capture the wins. If anyone says something quotable, ask if you can use it. Real early quotes
  are worth more than any copy in this file.
```
