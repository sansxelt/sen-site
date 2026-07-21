# Lumen Notes — a deliberately broken checkout

A fixture app for demonstrating Vraelis. It exists to have **one specific bug**, and to have it in the way
real shipped software has it.

## The bug

Paying for Pro records the payment and never grants the plan.

`checkout.html` writes `ln_paid=1` and sends the customer to a success page that says "Your Pro subscription
is active." `account.html` reads `ln_plan`, which nothing ever writes, so the customer sees **Free**.

## Why this bug and not a louder one

Everything about it looks fine from outside:

- No page errors, no console exception, no failed request. Every response is a 200.
- Clicking through it as a human feels correct. The page that confirms success is not the page that would
  reveal the failure, so you have to keep going to find out.
- A unit test on the payment function passes, because the payment function does exactly what it says.
- A screenshot test passes, because every page renders correctly.

It is only visible if you complete the whole journey and then check whether the outcome is actually true.
That is the gap this fixture is here to show.

It is also the single most common way a vibe-coded checkout ships broken: the payment integration is the
part you test, and the entitlement is the part you assume.

## Deploy

No build step, no dependencies. Static files.

```bash
cd demo/broken-checkout
vercel deploy --prod
```

Or drag the folder into any static host.

## Run the verification

```bash
vraelis verify \
  --url https://<your-deployment> \
  --claim "A customer who pays for Pro gets Pro access on their account, and still has it after signing in again" \
  --wait
```

Expected: **exit 1, failed**, with evidence that the account page still reports Free after a successful
payment, plus a repair prompt.

## The fix

One line in `checkout.html`. Uncomment it:

```js
document.cookie = "ln_plan=pro; path=/; max-age=86400";
```

Redeploy, run the same command, and it should verify.

## Honesty about what this proves

It proves the loop: Vraelis finds a real outcome failure, explains it, and accepts the claim once the
outcome is actually true.

It does **not** prove Vraelis would have found this bug without being told what to look for. The claim names
the outcome, and the claim is the input. A fair demo says that out loud rather than implying Vraelis
discovered the bug unprompted.
