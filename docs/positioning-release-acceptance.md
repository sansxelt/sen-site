# Positioning hypothesis: the release acceptance layer

**Status: HYPOTHESIS, not a decision. Nothing ships from this until the buyer test below passes.**

Same discipline as the two benchmarks: written down before the evidence, with a threshold that can fail.

---

## What actually happened

The founder is the audience we had been describing (heavy vibe coder, ships AI-built apps) and, asked
directly, said he would not use or pay for this. That is the strongest single piece of evidence collected so
far, and it beats every argument made for the old framing.

**It does not say verification is worthless. It says the buyer was wrong.**

The reason is specific and worth keeping: a vibe coder's side project has no users, so a broken checkout
costs nothing. No consequence, no purchase. The pain does not exist yet at that end of the market, and
$15 a run against an app nobody uses is an obviously bad trade.

## The mistake, named

Three different companies were being described at once:

1. **A testing tool for hobbyist vibe coders.** Weak. No felt pain, wrong price point. This is what the site
   and the pricing were built for.
2. **Release verification for people who owe software to someone else.** Believable, and untested.
3. **A verification layer embedded in AI builders and autonomous systems.** The big version, unreachable
   until 2 works.

Everything was aimed at 1.

## The hypothesis

> The buyer is not someone who built something. It is someone who is now **responsible to another person**
> for software an AI wrote.

Agencies delivering to clients. Freelancers with a contract. Founders with paying users. Internal teams
shipping AI-generated code someone else has to trust.

The shared condition is not "I vibe coded this." It is: **AI produced work that another person or business
is now accountable for.**

### Why this wedge fixes real problems rather than just sounding better

**It supplies the oracle.** The hardest open question has always been how Vraelis knows what an app is
supposed to do. For a delivery relationship, that answer already exists on paper: the scope of work, the
acceptance criteria, the user stories. Vraelis proposes flows and the two parties approve them. It stops
having to infer intent from a deployed page.

**It gives independence an economic reason.** "Nobody grades their own homework" was philosophy, and it was
correctly dismantled. In a delivery relationship it is a transaction: the builder wants to prove delivery,
the client wants evidence before paying, and neither accepts the builder's own agent marking its own work.

**It turns the report into the product.** Today the run report is a debugging screen. In this framing it is
delivery evidence: what was agreed, what was checked, what held, what did not, what was NOT checked, and a
rerun showing the issue no longer reproduces.

---

## What already exists and transfers

Everything. This is a repositioning, not a rebuild.

- Browser execution, the worker, leases, decisions, evidence
- Approved requirements and flows (the "contract" is already the right shape)
- Cross-run issue reconciliation and repair verification
- The repair prompt handed back to whatever built the app
- GitHub, Vercel, Stripe, Supabase, Slack connections
- Team accounts and roles

## What is missing for this wedge

**One thing, and it is not built: a shareable read-only report.** A contractor has to be able to send a
client a link showing the deployment checked, the approved requirements, what passed and failed, the
evidence, what was not covered, and the rerun history, without the client needing an account.

Note the truth problem attached to it: `/enterprise` currently claims *"Share a read-only launch report by
token."* That feature does not exist for preflight runs. Whatever happens to this hypothesis, **that claim
must be built or removed.**

Second, smaller: deploy-triggered reruns. The Vercel and GitHub connections become load-bearing rather than
decorative the moment a new deployment reruns the approved requirements automatically.

## What must NOT be built yet

- Anything for agencies specifically, before agencies say this is painful
- Pricing changes (see below)
- Mobile, desktop, SDK, device runtimes
- More connections (see `connections-queue.md`)

---

## Pricing: unchanged, and a correction worth recording

Founder decision: **keep the current plans.** Easy to honour, because a review of the code says the advice
to "kill per-pass pricing and test monthly plans" is mostly already done.

Monthly plans exist today, at almost exactly the shape that advice proposed:

| Plan | Monthly | Passes/mo | Flows/pass | Apps |
|---|---|---|---|---|
| Builder | $49 | 10 | 5 | 2 |
| Pro | $149 | 40 | 10 | 10 |
| Scale | $399 | 150 | 20 | unlimited |

Free tier: one lifetime pass, up to 3 flows, 1 application. Pay-as-you-go is $15 per pass (5 flows
included, $3 per extra flow).

So the per-run experience that put the founder off is **the pay-as-you-go path**, which is what a free
account falls to once a contract exceeds 3 flows. It is not the whole pricing model, it is the on-ramp.
That is a narrower problem than "the pricing is wrong", and it points at the free tier rather than the
plans.

Nothing changes now. The open question for the interviews is whether the first paid step is priced and
shaped right for someone delivering to a client, not whether subscriptions should exist.

---

## The test, before anything is built

Ten prospects who meet ALL of:

- The application has real users, revenue, or a client attached
- It was shipped with AI assistance
- They can name a recent production problem

Ask, without describing Vraelis first:

1. What did you ship?
2. Who were you responsible to?
3. What had to work before you handed it over?
4. How did you check it?
5. What broke after handoff, and how did you find out?
6. Would a shareable verification report have mattered?
7. Would you run it again on the next release?

### Two gates, kept separate

Mixing these was a mistake in the first draft. "Three failures the owner did not already know about" is
evidence the ENGINE works, and the seeded benchmarks already test that properly. Making it a demand
threshold would kill the thesis if five well-built apps happened to be clean, which says nothing about
whether their owners value release evidence.

**DEMAND gate. This is the one that decides.**

- At least **5** completed runs on consenting applications
- At least **3** owners ask to use it again on a later release
- At least **1** pays for another release

**Enthusiasm is not signal.** "That's cool" from someone who will not connect an application means no. The
threshold is a second run and a payment.

**PRODUCT evidence. Recorded, never a gate here.**

- Failures found that the owner did not already know about
- False alarms
- Setup time, from URL to first valid run
- Whether the report changed a release decision

That last one is the most interesting number nobody measures. A run that finds nothing but makes someone
ship with confidence is still doing work.

### Running the pilots

**Grant credits by hand.** The free tier is one lifetime pass at three flows, and a real delivery contract
exceeds that immediately, so every pilot would otherwise hit a paywall mid-experiment. That would be
measuring the on-ramp, not the demand. Use the same manual grant as the demo account
(`sql/vraelis-demo-credits.sql`).

**Do not redesign pricing around five free trials.** Whether they pay later is the question; what the first
run costs is a detail to settle afterwards.

Run them concierge-style. Sit with the owner, connect it yourself, watch what they do with the result. The
behaviour is the data; the compliments are not.

### If it fails

If people with real consequences still do not care, the pain is genuinely too weak, and that gets said
plainly rather than re-framed a fourth time.

---

## The sentence, if it survives

> Vraelis verifies AI-built releases before another person has to trust them.

The larger vision is unchanged and merely sequenced behind it. Agencies are the first buyer, not the
permanent identity, and the site should never start looking like agency-management software.

1. **Release acceptance.** Verify AI-built web applications before delivery. (Here.)
2. **Outcome verification.** Confirm a whole workflow succeeded across the browser, the payment provider,
   the database, and the messaging that follows it, rather than checking one surface. This is what
   `benchmark-outcome-chain-v2.md` measures.
3. **Embedded.** The builders call it themselves after every generated release. The primitive reduces to
   one instruction: *verify this outcome*.
4. **Autonomous systems.** An agent should not be able to say "done" on its own word. It should have to
   produce evidence that the outcome happened.
5. **Physical.** A command was sent, the device received it, the state changed, the sensor agrees, and the
   downstream system updated.

The through-line, and the reason this can grow rather than saturate: **AI will produce and operate more
systems than any human can personally inspect, and every autonomous action creates something that has to be
independently checked before someone relies on it.** Demand scales with AI usage rather than against it.

None of that is a plan yet. It is the direction stage 1 has to earn.
