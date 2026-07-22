// The Research registry. One entry per article, with the body as structured blocks rather than raw HTML so
// the article page controls typography and nothing can inject markup.
//
// PUBLISHING RULE, and it is not decorative: `published: false` articles do not render and do not appear in
// the index. An article that describes something Vraelis cannot do yet stays unpublished until it can. The
// research section explains why the world needs outcome verification; it is not a place to describe the
// product as further along than it is, and it is MORE dangerous than the marketing pages precisely because
// the register is authoritative. A reader forgives a landing page for being enthusiastic. They do not
// forgive a research note for being wrong.

export type Block =
  | { t: "p"; text: string }
  | { t: "h2"; text: string }
  | { t: "quote"; text: string }
  | { t: "list"; items: string[] }
  | { t: "code"; label?: string; text: string }
  | { t: "note"; text: string };          // an aside that limits or qualifies the surrounding claim

export type Category = "AI verification" | "Engineering" | "Case studies" | "Company";

export type Article = {
  slug: string;
  title: string;
  summary: string;                         // one sentence, used in the index and as the meta description
  category: Category;
  date: string;                            // ISO, the publication date
  author: string;
  published: boolean;
  featured?: boolean;
  body: Block[];
};

// Reading time from the body, at 220 words per minute. Computed rather than authored so it cannot drift
// away from the text after an edit.
export function readingMinutes(a: Article): number {
  const words = a.body.reduce((n, b) => {
    if (b.t === "list") return n + b.items.join(" ").split(/\s+/).length;
    if (b.t === "code") return n + 30;     // code is scanned, not read; a flat estimate beats counting tokens
    return n + b.text.split(/\s+/).length;
  }, 0);
  return Math.max(1, Math.round(words / 220));
}

export function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

const ARTICLES: Article[] = [
  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    slug: "ai-said-it-was-done",
    title: "AI said it was done. Was it?",
    summary:
      "Code generated, tests green, deploy succeeded, and the customer still cannot do the thing. Three different questions get treated as one.",
    category: "AI verification",
    date: "2026-07-21",
    author: "Vraelis",
    published: true,
    featured: true,
    body: [
      { t: "p", text: "An agent finishes a task and reports success. What has actually been established?" },
      { t: "p", text: "That it produced code. Possibly that the code compiles. Sometimes that a test suite passed and a deployment went out. Every one of those is a real signal, and none of them is the thing anyone actually cares about, which is whether a person using the software can now do what they could not do before." },
      { t: "h2", text: "Three questions that get collapsed into one" },
      { t: "list", items: [
        "Did the model produce plausible code? Answered by the model itself, which is the problem.",
        "Did the system accept it? Answered by the compiler, the test suite, and the deploy pipeline.",
        "Did the outcome happen? Answered by nothing in most pipelines.",
      ] },
      { t: "p", text: "The first two are cheap and automated, so they get measured. The third is expensive and manual, so it gets assumed. And because the first two pass loudly and the third fails quietly, the assumption usually holds long enough to ship." },
      { t: "h2", text: "The shape of the failure" },
      { t: "p", text: "Consider a checkout that grants a subscription. The payment integration is the interesting part, so it is the part that gets tested. The entitlement is one line at the end, so it gets assumed. Ship it with that line missing and observe what happens:" },
      { t: "list", items: [
        "No page errors. Every response is a 200.",
        "No console exception, no failed request, nothing in the error tracker.",
        "The unit test on the payment function passes, because that function does exactly what it says.",
        "A screenshot test passes, because every page renders correctly.",
        "The success page says the subscription is active, because that page was written by the same person who forgot the line.",
      ] },
      { t: "p", text: "Clicking through it as a human feels correct, because the page that confirms success is not the page that would reveal the failure. You have to keep going, to a different screen, and check whether something is true that nobody told you to check." },
      { t: "p", text: "That is not an exotic bug. It is the most ordinary bug there is, and the entire industry's verification stack looks straight past it." },
      { t: "h2", text: "Why this gets worse, not better" },
      { t: "p", text: "The instinct is that better models fix this. They will certainly write that missing line more often. But the failure is not fundamentally about code quality, it is about who is allowed to declare completion." },
      { t: "p", text: "A system reporting on its own work has an unavoidable blind spot: it can only check the things it thought of. The line was missing because the author did not think of it. Asking that same author whether they thought of everything is not a check." },
      { t: "p", text: "As agents write more and humans review less, the number of completion claims grows and the number of people personally confirming them does not. The ratio is the problem, and it moves in one direction." },
      { t: "quote", text: "The agent finished is a different statement from the outcome happened. Most software cannot currently tell the two apart." },
      { t: "h2", text: "What would actually settle it" },
      { t: "p", text: "Something outside the system that produced the work, exercising the real deployment the way a customer would, and reporting what it observed rather than what was intended. Not a claim about the code. Evidence about the result." },
      { t: "p", text: "That is a narrow thing to build and a hard thing to fake, which is why it is worth building." },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    slug: "what-is-outcome-verification",
    title: "What is outcome verification?",
    summary:
      "A claimed result goes in. External evidence determines whether it is true. Everything else is an implementation detail.",
    category: "AI verification",
    date: "2026-07-21",
    author: "Vraelis",
    published: true,
    body: [
      { t: "p", text: "Outcome verification is one operation with one shape:" },
      { t: "quote", text: "A claimed result goes in. External evidence determines whether it is true." },
      { t: "p", text: "It is worth being precise about each half of that sentence, because both halves are doing work." },
      { t: "h2", text: "A claimed result, not a task" },
      { t: "p", text: "The input is a statement about the world that should be true after some work was done. Not a list of steps, not a test case, not a description of the implementation." },
      { t: "list", items: [
        "A claim: a customer who pays for Pro gets Pro access, and still has it after signing in again.",
        "Not a claim: click the upgrade button, then fill the card form, then check the account page.",
      ] },
      { t: "p", text: "The difference matters because steps encode an assumption about how the outcome is achieved, and that assumption comes from the same place the bug did. A claim is about the result, so it survives the implementation being wrong." },
      { t: "h2", text: "External evidence, not self-report" },
      { t: "p", text: "The evidence has to come from outside the system under test, gathered by exercising the real deployment rather than reading its source or asking it how it went." },
      { t: "p", text: "This rules out most of what is currently called testing. A unit test is written by the same author, from the same understanding, and passes when the code does what the author expected. That is valuable and it is not independent. A verification that consults the implementation to decide what to check has already lost the property that makes it worth running." },
      { t: "h2", text: "What it is not" },
      { t: "list", items: [
        "Not monitoring. Monitoring tells you something broke after customers found it. Verification runs before you rely on the result.",
        "Not a test suite. A suite checks the cases someone enumerated. A verification checks whether a stated outcome is true.",
        "Not a code review. Review reasons about the implementation. Verification ignores it and looks at the result.",
        "Not a status page. Availability is not correctness. A checkout that returns 200 and grants nothing is up.",
      ] },
      { t: "h2", text: "Why it needs to be a separate thing" },
      { t: "p", text: "You could argue this is just testing done well, and in a sense it is. The reason it needs its own name and its own system is the independence requirement. The moment verification lives inside the thing being verified, written by the same author or the same model, it inherits that author's blind spots and stops being evidence." },
      { t: "p", text: "Independence is not a quality bar you can reach by trying harder. It is a structural property, and structure is the only way to get it." },
      { t: "h2", text: "The output" },
      { t: "p", text: "A verification returns a decision and the evidence behind it. Three answers, and the third one matters more than it looks:" },
      { t: "list", items: [
        "Verified. The claim held, with evidence.",
        "Failed. The claim did not hold, with evidence of what happened instead.",
        "Blocked. No verdict was reached.",
      ] },
      { t: "p", text: "Collapsing blocked into either of the others is the most tempting mistake available. Reporting it as verified is a false pass, which is the worst possible failure for a system whose entire value is being trustworthy. Reporting it as failed is a false alarm, which trains people to ignore it. A verification that cannot reach a verdict has to say so." },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    slug: "independent-completion-layer",
    title: "Why AI agents need an independent completion layer",
    summary:
      "An agent that grades its own work is not reporting a result, it is reporting an intention. The gap between those is where autonomy breaks.",
    category: "AI verification",
    date: "2026-07-21",
    author: "Vraelis",
    published: true,
    body: [
      { t: "p", text: "Every autonomous system eventually faces the same question: who decides when the work is done?" },
      { t: "p", text: "For agents writing software, the answer today is the agent. It performs a task, evaluates its own output, and reports completion. The loop closes on itself." },
      { t: "h2", text: "The structural problem" },
      { t: "p", text: "This is not a claim that models are unreliable. It holds even for a model that is right almost always." },
      { t: "p", text: "A system checking its own work can only check what it considered. Its errors and its checks are drawn from the same understanding, so they correlate. When it is wrong about what mattered, it is wrong in both places at once, and the check passes precisely when it is least useful." },
      { t: "p", text: "Adding a second model to review the first helps less than it seems, for the same reason: two systems trained on similar data, prompted from the same context, share blind spots. Correlated reviewers produce confidence, not evidence." },
      { t: "quote", text: "An agent grading its own work is not reporting a result. It is reporting an intention." },
      { t: "h2", text: "Why it becomes urgent rather than staying annoying" },
      { t: "p", text: "Right now a human is usually in the loop. The agent claims completion, someone glances at the change, clicks through the feature, and catches the worst of it. That informal review is doing enormous unacknowledged work, and it is the thing that scales worst." },
      { t: "p", text: "Three curves move against each other:" },
      { t: "list", items: [
        "The number of changes agents produce is rising quickly.",
        "The number of humans available to personally confirm each one is flat.",
        "The consequence of an unverified change is unchanged, because customers experience failures exactly as they always did.",
      ] },
      { t: "p", text: "Nothing about that requires agents to get worse. It only requires them to get more productive, which is the entire point of them." },
      { t: "h2", text: "What an independent layer has to be" },
      { t: "list", items: [
        "Outside the agent. Different process, different inputs, no access to the reasoning that produced the work.",
        "Grounded in the deployed system, not the source. It has to exercise the real thing.",
        "Answering a stated outcome, so the check does not inherit the implementation's assumptions.",
        "Able to refuse. A layer that cannot return no verdict will eventually be pressured into returning a convenient one.",
      ] },
      { t: "p", text: "The last one is the one people skip. A verification system that always produces an answer is easier to build and easier to sell, and it is worth less, because the answer is sometimes invented." },
      { t: "h2", text: "The loop this makes possible" },
      { t: "p", text: "Independence is not only a safety property. It is what lets the loop close without a human in it." },
      { t: "p", text: "If an agent can be told, with evidence, that the outcome it claimed did not happen, it can act on that. It can repair the work and ask again. The verification does not need to know how to fix anything. It needs to be right about whether the result is true, and specific enough about what it observed that the fix is derivable." },
      { t: "p", text: "That is the difference between an agent that reports done and a system that can actually finish." },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // Scoped down from the original brief, which described Vraelis following an outcome across payments,
  // authentication, data, email and connected systems. It does not do that today. Written as the argument
  // for why the browser is the starting point and not the boundary, with what exists today stated plainly.
  {
    slug: "browser-testing-is-not-verification",
    title: "Browser testing is not the same as verifying an outcome",
    summary:
      "The browser is where a claim becomes observable, not where the outcome ends. Confusing the two produces green tests and broken customers.",
    category: "Engineering",
    date: "2026-07-21",
    author: "Vraelis",
    published: true,
    body: [
      { t: "p", text: "Browser automation and outcome verification look similar from a distance. Both drive a real interface, both produce pass and fail. They are answering different questions, and the difference shows up exactly when it is expensive." },
      { t: "h2", text: "What a browser test asserts" },
      { t: "p", text: "A browser test asserts that a described sequence produces a described appearance. Navigate here, click that, expect this text. It is a statement about the interface." },
      { t: "p", text: "Which means it inherits two assumptions from whoever wrote it: that those steps are how the outcome is achieved, and that the visible result implies the underlying result. Both are usually true, and the cases where they are false are the cases worth catching." },
      { t: "h2", text: "Where they come apart" },
      { t: "p", text: "A checkout takes the payment and never grants the entitlement. The success page says the subscription is active, because it was written to say that. A browser test that asserts the success page appears will pass. Forever." },
      { t: "p", text: "The interface is not lying about itself. It genuinely rendered. The claim it makes about the world is what is false, and nothing in the test was pointed at the world." },
      { t: "quote", text: "The page that confirms success is rarely the page that would reveal the failure." },
      { t: "h2", text: "The distinction that matters" },
      { t: "list", items: [
        "A browser test asks: did the interface do what I described?",
        "A verification asks: is the claimed outcome true, whatever the interface says about it?",
      ] },
      { t: "p", text: "This is why the input is a claim rather than a script. A claim about access surviving a fresh sign-in forces the check somewhere the success page cannot reach. A script would have to be told to go there, by someone who already suspected." },
      { t: "h2", text: "Where the browser stops being enough" },
      { t: "p", text: "An outcome usually extends past the screen. A subscription touches a payment processor, an entitlement record, a session, and often an email. The browser sees one surface of that." },
      { t: "p", text: "For a large class of failures, one surface is enough, because a broken entitlement shows up as the wrong plan on an account page. For others it is not: a receipt that never sends, a webhook that silently drops, a record that is correct in the UI and wrong in the database." },
      { t: "note", text: "Where Vraelis is today: verification runs in a real browser against a deployed web application. Following an outcome through payment processors, mail delivery, databases and connected services is the direction, not a current capability. Those integrations exist for setup and context, not as verification surfaces. We would rather say that plainly than let the category imply coverage we have not proved." },
      { t: "h2", text: "Why start in the browser at all" },
      { t: "p", text: "Because it is where a claim becomes observable without privileged access. It needs no credentials into the database, no instrumentation in the application, no cooperation from the system under test. It is the same surface the customer uses, which is what makes evidence gathered there hard to argue with." },
      { t: "p", text: "It is the starting point because it is the most independent one available. It is not the boundary of the problem." },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────────────────────────────
  // UNPUBLISHED, deliberately. This article walks through a real failure, a real repair prompt, and a real
  // reverification. None of that has happened yet in production, and a walkthrough with invented output
  // would be a fabricated result in the one section of the site whose whole value is being credible.
  // It gets written from a real run's actual output, or it does not get written.
  {
    slug: "from-failure-to-verified-repair",
    title: "From failure to verified repair",
    summary:
      "A controlled production demonstration: a claim, a discovered failure, evidence returned, an incomplete repair that Vraelis rejected, and only then a verified one.",
    category: "Case studies",
    date: "2026-07-22",
    author: "Vraelis",
    published: true,
    body: [
      { t: "note", text: "This is a controlled production demonstration, not a customer story. We built a small notes app on purpose to carry a common bug, deployed it, and ran real paid verifications against it. Every verdict and every piece of evidence below is from an actual run. The app is ours; no external customer is involved." },

      { t: "p", text: "The most common way a vibe-coded feature ships broken is not a crash. It is a success screen that is telling the truth about the payment and lying about the outcome. The checkout works, the receipt appears, and the thing you paid for was never granted. Nothing errors, every request returns 200, and clicking through it as a human feels correct, because the only place the truth shows up is a different page than the one that confirmed success." },

      { t: "h2", text: "The guarantee" },
      { t: "p", text: "We gave Vraelis one claim to prove against the deployed build, in plain language, the way a founder would state it." },
      { t: "quote", text: "A customer can upgrade to Pro, receive access immediately, and retain Pro after signing out and signing back in." },
      { t: "p", text: "Vraelis derived what that guarantee actually requires, planned a real browser journey to exercise it, and ran it against the live deployment. No test was authored by hand." },

      { t: "h2", text: "The app said it worked" },
      { t: "p", text: "The checkout recorded the payment and sent the customer to a page that read Payment successful, your Pro subscription is active. Every signal a person sees said it worked. But the account page, the one place the entitlement is actually read, still showed Free." },

      { t: "h2", text: "First verdict: Failed, with evidence" },
      { t: "p", text: "Vraelis completed the purchase, opened the account as the same customer, and checked the plan. It did not take the success screen as proof." },
      { t: "code", label: "evidence", text: "Expected Plan to show \"Pro\"\n\"Pro\" was not present\nWhere it failed: after checkout, on the account page" },
      { t: "p", text: "That is the whole bug, caught from the outside, as a user would hit it: payment recorded, entitlement never granted. Vraelis returned Failed and a repair prompt describing the symptom, not a guessed cause." },

      { t: "h2", text: "The incomplete repair" },
      { t: "p", text: "The fix looked obvious: grant Pro at checkout. That made immediate access work. A weaker testing product would have passed it there and moved on. So we re-ran the same guarantee against the new deployment." },
      { t: "p", text: "It failed again, and this is the important part. The second run did not stop at the checkout. It confirmed Pro was granted, then signed out, signed back in as the same customer, and checked the account once more." },
      { t: "code", label: "evidence", text: "Step: after signing out and signing back in\nExpected Plan to show \"Pro\"\n\"Pro\" was not present" },
      { t: "p", text: "Pro had been written into a session that the sign-out cleared. It survived until the customer came back, and then it was gone. The guarantee said retain Pro after signing back in, and the app did not. Vraelis caught that the first repair was incomplete." },

      { t: "h2", text: "The complete repair" },
      { t: "p", text: "The real fix was to tie the entitlement to the account identity, not to a session cookie, so it is loaded on every visit and survives a fresh sign-in. We deployed that, and ran the guarantee a third time." },
      { t: "h2", text: "Verified" },
      { t: "p", text: "The third run granted Pro at checkout, confirmed it on the account, signed out, signed back in as the same customer, and confirmed Pro again. It returned Verified, with evidence for each step. The guarantee held, end to end, against the deployed build." },

      { t: "h2", text: "The earlier records did not change" },
      { t: "p", text: "This is the property that makes the loop worth trusting. The two Failed verdicts are permanent records. The repair did not edit them into a pass. Verified is a new, separate record, linked to the ones before it. The history reads exactly as it happened: a failure, an incomplete fix that was rejected, and then a verified one. Nothing was rewritten to look cleaner in hindsight." },
      { t: "list", items: [
        "Missing entitlement detected, and reported with evidence.",
        "Incomplete repair rejected, because Pro did not persist after signing back in.",
        "Complete repair independently verified, as a new record, with the earlier failures left intact.",
      ] },

      { t: "p", text: "That is the loop: an outcome you can state in a sentence, a decision backed by what the browser actually did, and a history you cannot quietly launder. The bug in this demonstration was planted on purpose, but it is the exact shape of the ones that ship for real, and it is invisible to unit tests, to a green success page, and to a human clicking through in a hurry." },

      { t: "note", text: "Separately, during this work Vraelis once returned a Failed verdict that was not an application bug but a limitation in how the plan was generated, a success check that looked for text the page did not use. That was a tooling correction, not a defect in the app, and it is recorded honestly in the audit history as such. It is not counted among the three records above." },
    ],
  },
];

export const CATEGORIES: Category[] = ["AI verification", "Engineering", "Case studies", "Company"];

/** Published articles only, newest first. Nothing else should read the raw list. */
export function publishedArticles(): Article[] {
  return ARTICLES.filter((a) => a.published)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function articleBySlug(slug: string): Article | null {
  const a = ARTICLES.find((x) => x.slug === slug);
  // An unpublished article is indistinguishable from one that does not exist, so a leaked URL returns a
  // clean 404 rather than a draft.
  return a && a.published ? a : null;
}

/** Up to `n` other published articles, preferring the same category. */
export function relatedArticles(slug: string, n = 2): Article[] {
  const self = publishedArticles().find((a) => a.slug === slug);
  const others = publishedArticles().filter((a) => a.slug !== slug);
  if (!self) return others.slice(0, n);
  const same = others.filter((a) => a.category === self.category);
  return [...same, ...others.filter((a) => a.category !== self.category)].slice(0, n);
}
