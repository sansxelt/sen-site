// Programmatic-SEO QA guides. Each guide is a genuinely useful, self-contained QA guide for
// one AI output type, grounded in the product's real evaluation framework (the same criteria
// and issue taxonomy the checker uses). Adding a well-formed entry here mints a new indexed
// page (route + sitemap + internal links) with no other changes. Quality over volume: a few
// strong pages beat many thin ones on a young domain.

export type GuideCriterion = { name: string; what: string; check: string };
export type GuideFailure = { issueKey: IssueKey; label: string; example: string; fix: string };
export type GuideFaq = { q: string; a: string };

export type IssueKey = "dismissive" | "overpromise" | "confusing" | "risky" | "inaccurate" | "tone";

export const ISSUE_LABEL: Record<IssueKey, string> = {
  dismissive: "Dismissive", overpromise: "Overpromise", confusing: "Confusing",
  risky: "Risky", inaccurate: "Inaccurate", tone: "Tone",
};

export type GuideContent = {
  metaTitle: string;        // SEO <title> (brand suffix added at render)
  metaDescription: string;
  eyebrow: string;
  h1: string;
  intro: string;            // paragraphs separated by "\n\n"
  criteria: GuideCriterion[];
  failures: GuideFailure[];
  checklist: string[];
  faq: GuideFaq[];
};

export type Guide = {
  slug: string;
  outputType: string;       // maps to a checker output type; used to prefill the free check
  cardBlurb: string;        // one-liner for the index + related-guides lists
  content: GuideContent;
};

// Populated from the drafting workflow, then hand-tightened for voice (no em dashes).
export const GUIDES: Guide[] = [
  {
    "slug": "ai-support-reply-quality",
    "outputType": "support_reply",
    "cardBlurb": "Empathy, resolution, tone, and accuracy, plus the exact lines AI gets wrong on refunds and cancellations.",
    "content": {
      "metaTitle": "QA for AI-Generated Customer Support Replies",
      "metaDescription": "Score AI-drafted support replies on empathy, resolution, tone, accuracy and safety. Real examples: double charges, invented refund policies.",
      "eyebrow": "AI SUPPORT REPLY QA",
      "h1": "How to QA AI-generated customer support replies",
      "intro": "AI drafts support replies fast, and most of them are fine. The ones that aren't fail in a specific way: the model sounds calm and polished while it skips the apology, invents a refund policy, or promises a timeline your team can't hit. On a double charge or an angry cancellation, a reply that reads well but gets the facts or the feeling wrong does more damage than a slow human answer.\n\nGood QA on a support reply is not a quick skim for tone. It scores the reply on the four things that decide whether the customer walks away calmer: empathy, resolution, tone, and accuracy and safety. Then it flags the exact line that fails and says how to fix it. This guide works through each criterion with real replies from real situations, so you can catch a bad answer before it reaches someone who is already upset.",
      "criteria": [
        {
          "name": "Empathy",
          "what": "Whether the reply shows it understood the customer's actual situation and what it cost them, before it moves to logistics.",
          "check": "Does the first sentence name the specific problem and own it, or does it jump straight to policy and process?"
        },
        {
          "name": "Resolution",
          "what": "Whether the reply actually moves the issue toward solved, with a concrete action rather than a holding message.",
          "check": "Is there one clear next step with an owner and a timeframe, or just 'we're looking into it'?"
        },
        {
          "name": "Tone",
          "what": "Whether the register matches the customer's state, warm and steady for someone who is angry, and never defensive or robotic.",
          "check": "Read it aloud as the upset customer. Does any line sound cold, corporate, or like it's shifting blame back to them?"
        },
        {
          "name": "Accuracy and safety",
          "what": "Whether every fact, number, and promise in the reply is correct and safe to send, with no invented policy or commitment you can't keep.",
          "check": "Can you verify each claim (refund amount, timeline, account detail) against the real system, and is no irreversible action stated as done unless it truly is?"
        }
      ],
      "failures": [
        {
          "issueKey": "dismissive",
          "label": "Policy before apology on a double charge",
          "example": "I understand your concern. Please note that billing disputes must be submitted through our online portal for review.",
          "fix": "I'm sorry, you were charged twice for order #4821 and that's our error. I've already refunded the extra $49.00, so there's nothing you need to file."
        },
        {
          "issueKey": "overpromise",
          "label": "Guarantees a refund speed support can't control",
          "example": "Absolutely! Your refund will be back in your account within the hour, guaranteed.",
          "fix": "I've issued the refund now. It usually posts within 5 business days, depending on your bank. If it isn't there by Monday the 14th, reply here and I'll chase it."
        },
        {
          "issueKey": "inaccurate",
          "label": "Cites a refund policy that doesn't exist",
          "example": "No problem, our 30-day money-back guarantee covers this, so you'll get a full refund for the year.",
          "fix": "You can cancel today and you won't be billed again. Your plan stays active through October 31, the end of the period you've already paid for."
        },
        {
          "issueKey": "risky",
          "label": "Claims an irreversible action is already done",
          "example": "Done. I've permanently deleted your account and wiped all your data so this can't happen again.",
          "fix": "I've cancelled your subscription so you won't be charged again. I've kept your data for 30 days in case you change your mind; tell me if you'd like it erased sooner."
        }
      ],
      "checklist": [
        "Confirm the reply names the customer's real problem before it offers any fix.",
        "Check every number (charge amount, refund total, dates) against the account, not the model's guess.",
        "Cut any policy the reply cites unless you can link to the real one.",
        "Remove any promise support can't keep: instant refunds, guaranteed timelines, specific outcomes.",
        "Read the reply aloud as the angry customer and flag any cold or blame-shifting line.",
        "Make sure there is exactly one concrete next step, with an owner and a timeframe.",
        "Verify no irreversible action (deletion, cancellation) is stated as done unless it truly is.",
        "Add a plain apology and ownership when the company was at fault, before the logistics."
      ],
      "faq": [
        {
          "q": "What should every AI support reply get right before it sends?",
          "a": "Two things the model most often skips: an accurate account of what happened (the right charge amount, the real policy, a timeline you can keep) and one concrete next step. A reply can be warm and well written and still fail if it invents a refund window or promises something support can't do. Check the facts first, then the feeling."
        },
        {
          "q": "How do you score empathy without it being purely subjective?",
          "a": "You look for specific, checkable moves, not a mood. Does the reply name the exact problem (charged twice for order #4821), own it when the company was at fault, and acknowledge the cost to the customer before pivoting to process? Vraelis scores empathy on those signals and flags the line where the reply goes cold, so two reviewers land in the same place."
        },
        {
          "q": "Can I compare two versions of the same reply?",
          "a": "Yes. Paste both the terse draft and the warmer rewrite. The check scores each one on empathy, resolution, tone, and accuracy and safety, recommends the version to send, and quotes the exact lines that made the difference. You can try it free at /r/check first."
        },
        {
          "q": "What's the difference between a tone flag and a safety flag?",
          "a": "A tone flag means the reply sounds wrong (defensive, robotic, dismissive) but the facts are fine, so you rewrite the wording. A safety flag means the reply is unsafe to send as is: a wrong refund amount, an invented policy, or an irreversible action claimed as done. Tone problems annoy the customer. Safety problems create a promise or a fact you have to walk back, so fix those first."
        }
      ]
    }
  },
  {
    "slug": "ai-onboarding-message-quality",
    "outputType": "onboarding",
    "cardBlurb": "Clarity, next step, reassurance, and tone, so a message never leaves a new user stuck.",
    "content": {
      "metaTitle": "QA for AI Onboarding and Activation Messages",
      "metaDescription": "How to QA AI-generated welcome messages, first-run nudges, and setup reminders. Score clarity, next step, reassurance, and tone before you send.",
      "eyebrow": "ONBOARDING & ACTIVATION QA",
      "h1": "QA for AI-generated onboarding and activation messages",
      "intro": "AI is good at writing onboarding copy that sounds warm and moves fast. It is bad at noticing when that copy leaves the user stuck. A welcome message that says \"you're all set\" when the user has not done anything, a first-run nudge that lists five options instead of one, a setup reminder that reads like a threat: each one passes a quick read and still costs you the activation.\n\nGood QA on these messages is not proofreading. It is checking whether a real person, mid-signup and slightly unsure, knows exactly what to do next and feels safe doing it. Score every version on four things before it sends: is it clear, does it name one next step, does it lower the stakes, and does the tone land. Then quote the exact line that fails and rewrite just that line.",
      "criteria": [
        {
          "name": "Clarity",
          "what": "The message is understandable in one read, with no jargon or ambiguity about what just happened or what to do.",
          "check": "Read it once at normal speed. If you have to re-read to find the action, or it uses product-internal terms like 'provision your workspace', it fails clarity."
        },
        {
          "name": "Next step",
          "what": "The message points to one concrete first action, not an open-ended 'get started' or a menu of five options.",
          "check": "Look for a single verb-first instruction ('Import a project'). Count the actions offered; more than one, or a vague 'explore', is a miss."
        },
        {
          "name": "Reassurance",
          "what": "The message lowers the stakes so the user acts: nothing to break, easy to undo, short, reversible.",
          "check": "Ask whether a nervous first-timer would hesitate. If there is no signal that the step is safe or reversible ('you can undo anything', 'takes about 30 seconds'), add one."
        },
        {
          "name": "Tone",
          "what": "Welcoming and human, not corporate, condescending, or dismissive. Fits someone who just arrived and has not committed yet.",
          "check": "Read the closing line aloud. Sign-offs like 'let us know if you need anything' read as dismissive; a specific, warm offer of help does not."
        }
      ],
      "failures": [
        {
          "issueKey": "dismissive",
          "label": "Dismissive close on a welcome message",
          "example": "Welcome aboard! Let us know if you need anything.",
          "fix": "Welcome. One thing to do first: import a project from GitHub. Stuck on it? Reply to this email and a human answers."
        },
        {
          "issueKey": "inaccurate",
          "label": "'You're all set' when nothing is set up",
          "example": "You're all set! Your account is fully configured and ready to go.",
          "fix": "Your account is created. One step left: connect a data source (Stripe, Postgres, or a CSV). Then your dashboard fills in."
        },
        {
          "issueKey": "confusing",
          "label": "First-run nudge with no single next step",
          "example": "Explore your dashboard, connect integrations, invite your team, or customize your settings to get the most out of the app.",
          "fix": "Start with one step: connect your Google Calendar. It takes about 30 seconds, and you can invite your team later."
        },
        {
          "issueKey": "tone",
          "label": "Setup reminder that reads as a threat",
          "example": "You STILL haven't finished setting up. Don't miss out. Complete your setup before your access expires.",
          "fix": "You're one step from done: connect a data source and your dashboard fills in, about a minute. Everything you've added so far is saved."
        }
      ],
      "checklist": [
        "Read the message once at normal speed; if you re-read to find the action, fix clarity first.",
        "Name exactly one next step, verb-first and specific ('Import a project'), not 'get started'.",
        "Cut the menu: if the message offers three or more actions, keep the one that drives activation and drop the rest.",
        "Add one reassurance: how long it takes, that it is reversible, or that nothing breaks.",
        "Check the closing line for dismissiveness; replace 'let us know if you need anything' with a specific offer of help.",
        "Verify every completion claim; do not say 'you're all set' unless setup is actually done.",
        "Strip guilt and fake urgency from reminders: state what is left and why it helps, not what they will lose.",
        "Score all versions on clarity, next step, reassurance, and tone, ship the one that wins, and quote the line you changed."
      ],
      "faq": [
        {
          "q": "What counts as a good 'next step' in an onboarding message?",
          "a": "One concrete action the user can take right now, written verb-first: 'Import a project', 'Connect your calendar', 'Add a data source'. Not 'get started', 'explore', or a list of options. If a first-timer would have to decide where to begin, the message has not named a next step, it has handed the decision back to them."
        },
        {
          "q": "Why do AI-written welcome messages so often read as dismissive?",
          "a": "Because models default to friendly-sounding sign-offs like 'let us know if you need anything', which sound warm but put all the work back on the user. To someone who just arrived and is not sure what to do, that reads as being handed the keys and shown the door. A specific offer ('stuck on the import? reply and a human answers') lands as help; a generic one lands as a brush-off."
        },
        {
          "q": "How should a 'you haven't finished setup' email differ from a welcome message?",
          "a": "A welcome message introduces the one first step. A setup reminder assumes the user started and stalled, so it should name the single remaining step and what finishing it gets them, with no guilt or fake urgency. Skip 'don't miss out' and 'before it's too late'. Say what is left, how long it takes, and that their progress is saved."
        },
        {
          "q": "Can I check these messages automatically before they send?",
          "a": "The checklist above is the fastest manual review for an individual message. Vraelis itself focuses one level up: it runs the AI-built app those messages live in like production, in a real browser, and returns a launch decision with the exact blockers to fix, so a message that reads well never ships inside a flow that loses data."
        }
      ]
    }
  },
  {
    "slug": "ai-marketing-copy-quality",
    "outputType": "marketing_copy",
    "cardBlurb": "Clarity, persuasion, overpromise, and brand tone, with real before-and-after fixes.",
    "content": {
      "metaTitle": "QA Checklist for AI Marketing Copy",
      "metaDescription": "Score AI-generated marketing copy on clarity, persuasion, overpromise, and brand tone. Real before-and-after fixes for heroes, subject lines, and ads.",
      "eyebrow": "MARKETING COPY QA",
      "h1": "How to QA AI-Generated Marketing Copy Before You Ship It",
      "intro": "AI drafts marketing copy in seconds, and that speed is the risk. The failure mode is almost never bad grammar. It is fluent filler that could describe any product, a confident claim the product cannot back, or a voice that drifts off brand. Copy like that reads fine in review and converts worse once it ships. Worse, an overpromise can turn into a refund thread or a legal note.\n\nGood QA does not argue about taste. It scores each version on four things: clarity, persuasion, overpromise, and brand tone. Then it quotes the exact line that fails and rewrites just that span, so the fix is concrete instead of a vibe. This guide walks each criterion with real hero, subject-line, ad, and feature-announcement examples.",
      "criteria": [
        {
          "name": "Clarity",
          "what": "Whether a first-time reader gets the value in one pass, with no vague or abstract filler.",
          "check": "Read the copy once at normal speed, then say out loud what the product does and who it is for. If you cannot answer both from the words on the page, it fails. Filler like 'streamline your workflow' or 'built for modern teams' could describe anything, so it counts as unclear even when it sounds polished."
        },
        {
          "name": "Persuasion",
          "what": "Whether the copy gives a concrete reason to act, grounded in a real benefit instead of an adjective.",
          "check": "Find the specific benefit or proof. 'Cut invoice approval from 3 days to 4 hours' persuades; 'powerful invoicing' does not. If every line is an adjective with no number, named outcome, or real example behind it, persuasion is thin no matter how confident the tone."
        },
        {
          "name": "Overpromise",
          "what": "Whether any claim outruns what the product can actually deliver, inviting distrust, churn, or legal risk.",
          "check": "Underline every claim and ask if you could defend it to a skeptical customer or a regulator with evidence you already have. Flag absolutes like 'guaranteed', 'never', 'instantly', and '10x' when nothing on the page backs them. Unbacked claims cost more in trust than they win in clicks."
        },
        {
          "name": "Brand tone",
          "what": "Whether the voice stays consistent and fits the audience across the whole piece.",
          "check": "Hold the draft next to two or three lines of your best existing copy and read them back to back. Flag drift in either direction: a playful brand gone stiff and corporate, or a serious B2B brand slipping into exclamation points and 'game-changer'."
        }
      ],
      "failures": [
        {
          "issueKey": "overpromise",
          "label": "Hero promises a guarantee you cannot back",
          "example": "The only tool that guarantees you will never miss a deadline again.",
          "fix": "Teams using shared deadlines here cut missed handoffs by about 30% in their first month."
        },
        {
          "issueKey": "confusing",
          "label": "Feature announcement buries what actually changed",
          "example": "We have reimagined our platform to unlock powerful new synergies across your workflow.",
          "fix": "You can now assign one task to two people. Both see it in their queue, and either one can mark it done."
        },
        {
          "issueKey": "tone",
          "label": "Subject line breaks brand voice",
          "example": "DON'T MISS OUT!! Your account is about to EXPLODE with growth!!",
          "fix": "A faster way to send invoices, starting today"
        },
        {
          "issueKey": "inaccurate",
          "label": "Ad states a spec that is not true",
          "example": "Set up in 30 seconds. No credit card, no code, works with every tool you use.",
          "fix": "Set up in about 5 minutes, no credit card. Connects with Slack, Gmail, and Notion today, with more coming."
        }
      ],
      "checklist": [
        "Read each version once at speed and write the value in one sentence; if you cannot, it fails clarity.",
        "Underline every claim and mark whether you could prove it to a skeptical buyer today.",
        "Cut absolute words (guaranteed, never, instantly, 10x) unless data on the page backs them.",
        "Replace at least one adjective with a number, a named outcome, or a real example.",
        "Compare the draft against two lines of your best existing copy and flag any tone drift.",
        "Check that the first five words of a hero or subject line carry the value, since that is what gets read.",
        "Score two or three versions on the same rubric instead of picking by gut.",
        "Confirm every product spec (setup time, integrations, price) is literally true as written."
      ],
      "faq": [
        {
          "q": "Why does AI marketing copy need QA if it already reads well?",
          "a": "Reading well is the trap. AI copy is fluent by default, so it hides vague claims and overpromises behind clean sentences. QA checks whether the copy is actually clear, persuasive, honest, and on brand, not just whether it sounds smooth."
        },
        {
          "q": "What is the difference between clarity and persuasion here?",
          "a": "Clarity is whether a reader understands the offer in one pass. Persuasion is whether they have a concrete reason to act. Copy can be perfectly clear and still flat, like 'We sell project software', so you score the two separately and fix whichever is weak."
        },
        {
          "q": "How do I catch overpromising before support or legal does?",
          "a": "Underline every claim and ask if you could defend it with evidence you already have. Absolutes like 'guaranteed', 'never', and 'instant' are the usual offenders. If you cannot show the proof, soften the claim to what is actually true and keep the specific number that does hold up."
        },
        {
          "q": "Can I compare two versions of the same ad objectively?",
          "a": "Yes, if you score both on the same four criteria instead of debating taste. Give each version a clarity, persuasion, overpromise, and brand-tone score, then ship the one that wins on the numbers. Vraelis Rank does exactly this and flags the exact line to fix in the version you drop."
        }
      ]
    }
  },
  {
    "slug": "ai-agent-action-safety",
    "outputType": "agent_action",
    "cardBlurb": "Correctness, safety, completeness, and reversibility, checked on the actual call before it runs.",
    "content": {
      "metaTitle": "AI Agent Action QA: Check Tool Calls Before They Run",
      "metaDescription": "Score an AI agent's proposed action (refund, delete, bulk send, setting change) on correctness, safety, completeness, and reversibility before it runs.",
      "eyebrow": "AGENT ACTION QA",
      "h1": "QA for AI Agent Actions: Checking Tool Calls Before They Run",
      "intro": "The risky part of an autonomous agent is not the text it writes, it is the actions it takes. A clumsy paragraph gets edited before anyone sees it. A DELETE on the wrong filter, a refund sent to the wrong card, or an apology email blasted to 18,400 people including churned and unsubscribed users all land the instant the tool call fires. By the time you read the transcript, the money has moved and the records are gone.\n\nGood QA on an agent action reviews the one call that is about to run, with its actual arguments, not the model in the abstract. It asks four things. Is this the right operation on the right target for what was asked? Does it stay inside the scope the agent was granted? Does it handle the obvious edge cases, not just the happy path? And can it be undone if it turns out wrong? A useful check names the blast radius in real numbers and flags every step that cannot be reversed.",
      "criteria": [
        {
          "name": "Correctness",
          "what": "Whether this is the right operation on the right target for what was actually asked.",
          "check": "Trace each argument against the request: does the refund amount, the record ID, or the recipient list match what was asked, or a broader guess the agent filled in?"
        },
        {
          "name": "Safety",
          "what": "Whether the action stays inside its granted scope and avoids destructive or out-of-scope effects that were not asked for.",
          "check": "Find the blast radius before it runs: how many records, which customers, whose money, and is that scope authorized by the request or wider than it?"
        },
        {
          "name": "Completeness",
          "what": "Whether the plan handles the whole task including the obvious edge cases, not just the happy path.",
          "check": "Look for the skipped cases: unsubscribed addresses in the send, charges already refunded, records that other rows depend on."
        },
        {
          "name": "Reversibility",
          "what": "Whether the agent prefers reversible steps and gives a concrete undo path when the action is permanent.",
          "check": "For each permanent step (hard delete, sent email, money moved), check for a dry run, a soft delete, or a stated rollback."
        }
      ],
      "failures": [
        {
          "issueKey": "risky",
          "label": "Irreversible delete on a loose match",
          "example": "Cleaning up now: deleting the 1,240 contacts that look like duplicates.",
          "fix": "Found 1,240 contacts matching on email alone. That is permanent, so I will archive them (reversible) and show you the list before anything is deleted for good."
        },
        {
          "issueKey": "inaccurate",
          "label": "Right action, wrong target",
          "example": "Issuing a full $480 refund on order #8842 to fix the double charge.",
          "fix": "Only the $60 add-on was charged twice, not the $480 order. Refunding $60 to the card ending 4242."
        },
        {
          "issueKey": "overpromise",
          "label": "Claims success it has not verified",
          "example": "All done, the refund is complete and the customer already has their money back.",
          "fix": "Refund submitted to the processor. It settles in 5 to 10 business days. I will confirm once the webhook reports 'succeeded.'"
        },
        {
          "issueKey": "confusing",
          "label": "Vague action preview you cannot approve",
          "example": "Cleaning up the account and fixing the settings like you asked.",
          "fix": "About to do two things: merge 3 duplicate contacts into the oldest record, and set the workspace timezone to America/New_York. Nothing else changes."
        }
      ],
      "checklist": [
        "Confirm the operation matches the request: right verb, right target, right amount.",
        "State the blast radius in numbers before running: how many rows, recipients, or dollars.",
        "Flag every irreversible step and offer a reversible alternative (archive over delete, dry run over live).",
        "List the edge cases the action touches: unsubscribed users, already-refunded charges, linked records.",
        "Require an explicit human preview for destructive or bulk actions.",
        "Verify success from the tool's real result, not the agent's narration of it.",
        "Check the action stays in granted scope: one workspace, not the org-wide default.",
        "Give a concrete rollback path for anything that moves money or deletes data."
      ],
      "faq": [
        {
          "q": "What counts as an agent action to check?",
          "a": "Any side-effecting step an autonomous agent proposes before it runs: issuing a refund, deleting records, sending a bulk email, changing a setting, or calling an external API. You paste the proposed action, and the agent's narration of it, and get scored on correctness, safety, completeness, and reversibility."
        },
        {
          "q": "How is this different from unit tests or evals on the agent?",
          "a": "Tests check code paths in general. This checks the one specific call about to happen, with its specific arguments, in context. A refund tool can be fully tested and still be about to refund the wrong charge because the amount argument is wrong. The check reads the actual proposed call, not the average case."
        },
        {
          "q": "Can I gate an agent on this in production?",
          "a": "The check returns per-criterion scores and line-level flags in about 20 seconds, so you can run it as an approval step before high-risk actions like delete, refund, or bulk send, and hold for a human when the safety or reversibility score is low. Low-risk reads can pass straight through."
        },
        {
          "q": "What does a flag actually give me?",
          "a": "It quotes the exact problem span in the proposed action verbatim, says why it is risky (for example, a hard delete on a match by email alone), and gives a concrete fix (archive the 1,240 contacts instead, and show the list first). It is a specific edit, not a vibe score."
        }
      ]
    }
  }
];

export function getGuide(slug: string): Guide | null {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}

export function allGuideSlugs(): string[] {
  return GUIDES.map((g) => g.slug);
}

// The other guides, for internal linking (SEO + keeps readers on-site).
export function relatedGuides(slug: string, limit = 3): Guide[] {
  return GUIDES.filter((g) => g.slug !== slug).slice(0, limit);
}
