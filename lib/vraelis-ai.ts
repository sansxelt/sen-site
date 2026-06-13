// Generates the first AI reply to an inbound lead, in the business's
// voice. Uses Claude (same model the rest of the app uses). Falls back
// to a safe generic reply if the API key isn't set or the call fails —
// the intake flow must never hard-fail just because the model is down.

import Anthropic from "@anthropic-ai/sdk";
import { captureError } from "./vraelis-monitor";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "missing" });

type ReplyInput = {
  businessName: string;
  businessDescription: string;
  leadName: string;
  leadMessage: string;
  businessServices?: string; // freeform "service — $price" lines the AI may quote
  qualifyingQuestions?: string | null; // owner's own questions to qualify buyers
  agentName?: string | null;
  agentTone?: string | null;
};

function fallbackReply({ businessName, leadName }: ReplyInput) {
  const who = leadName ? ` ${leadName}` : "";
  return `Hi${who}, thanks for reaching out to ${businessName || "us"}! We'd love to help. Could you share a bit more about what you're looking for and your ideal timing? I'll get you sorted right away.`;
}

export type ConvoTurn = { role: "lead" | "agent"; body: string };
export type ConvoPayment = { kind: "deposit" | "full"; amountCents: number; label: string };
export type ConvoResult = { reply: string; status: string | null; payment: ConvoPayment | null };

// Shared rule: keep every payment on-platform so the cut can't be bypassed.
const OFFPLATFORM_RULE =
  "All payments happen ONLY through the secure Vraelis link provided in this chat. If the lead offers or asks to pay another way (Venmo, PayPal, Cash App, Zelle, cash, wire, ACH, gift card, crypto, etc.), politely decline and explain payment is handled securely through Vraelis so their booking is protected and guaranteed. Never share or accept off-platform payment handles, account numbers, or external links.";

const ALLOWED_STATUSES = ["contacted", "qualifying", "qualified", "booking_ready", "needs_owner", "lost"];

// Tone presets the owner picks for their agent. Maps the stored key to a
// short instruction the model follows. Unknown/empty → balanced default.
const TONE_INSTRUCTION: Record<string, string> = {
  friendly: "Voice: warm and friendly — approachable and personable, like a helpful person who genuinely likes their customers.",
  professional: "Voice: polished and professional — clear, competent, and respectful, the way a trusted business represents itself.",
  direct: "Voice: direct and efficient — concise and to the point, no filler, respects the lead's time while staying courteous.",
  casual: "Voice: casual and relaxed — conversational and easygoing, like texting a friend, while still helpful.",
};
function toneLine(tone?: string | null): string {
  return TONE_INSTRUCTION[(tone ?? "").toLowerCase()] ?? "Voice: warm, efficient, and human — friendly but not chatty.";
}
// How the agent refers to itself. Owner can name it; otherwise it speaks
// as the business's assistant without inventing a persona name.
function agentIdentity(agentName: string | null | undefined, business: string): string {
  return agentName?.trim()
    ? `You are ${agentName.trim()}, the AI sales agent for ${business}.`
    : `You are the AI sales agent for ${business}.`;
}

// Multi-turn: continue an ongoing lead conversation. Returns the next
// reply plus a suggested status (or null to leave unchanged).
export async function continueLeadConversation(input: {
  businessName: string;
  businessDescription: string;
  history: ConvoTurn[]; // full prior thread, oldest first (includes the new lead message as the last turn)
  businessServices?: string; // freeform "service — $price" lines the AI may quote
  qualifyingQuestions?: string | null; // owner's own questions to qualify buyers
  canTakePayment?: boolean; // payouts connected → AI may request payment in-chat
  depositLabel?: string | null; // e.g. "$30" when a booking deposit is configured
  agentName?: string | null; // owner-named agent (e.g. "Ava"); blank → unnamed
  agentTone?: string | null; // tone preset key: friendly | professional | direct | casual
}): Promise<ConvoResult> {
  const business = input.businessName || "the business";
  const description = input.businessDescription
    ? `What the business does: ${input.businessDescription}.`
    : "There is no detailed business description configured, so do not invent specifics.";

  const servicesBlock = input.businessServices?.trim()
    ? `Services and prices you can quote (use ONLY these exact prices — never invent, estimate, or round a price):\n${input.businessServices.trim()}`
    : "No services or prices are configured. Do NOT quote any price or amount; if asked about price, say the team will confirm.";

  const qualifyingBlock = input.qualifyingQuestions?.trim()
    ? `When you need to qualify the lead, prefer the owner's own questions (ask the most relevant one, naturally, not as a list):\n${input.qualifyingQuestions.trim()}`
    : "";

  const canPay = Boolean(input.canTakePayment);
  const paymentBlock = canPay
    ? `You can take payment securely in THIS chat. When the lead agrees to a specific service that has a listed price above and is ready to pay, set payment {"kind":"full","amountCents":<that listed price in cents>,"label":"<service name>"}.${input.depositLabel ? ` To lock in a booking you may instead take a deposit of ${input.depositLabel}: set payment {"kind":"deposit","amountCents":0,"label":"Deposit to confirm booking"} (the system fills the deposit amount).` : ""} Only set payment when a real listed price or deposit genuinely applies AND the lead is ready to pay; never put a price that isn't in the list above. Otherwise payment must be null.`
    : "Payments are not enabled for this business yet. Do not offer to take payment; payment must be null.";

  const system = [
    `${agentIdentity(input.agentName, business)} You are talking with an inbound lead in a live chat.`,
    toneLine(input.agentTone),
    description,
    servicesBlock,
    "Your job: reply briefly (1–2 short sentences) and move the lead toward a booking or payment as fast as is natural. Be efficient and human — not chatty.",
    "Speed to booking (important): ask AT MOST ONE qualifying question. Once the lead is clearly a fit and understands the relevant service or price, set status qualified. The moment they want a time, want to move forward, or are ready to pay, set status booking_ready and offer the next step. Don't keep asking questions or stalling; when in doubt, offer the booking. Aim to reach qualified or booking_ready within 1–2 messages.",
    qualifyingBlock,
    "Hard rules: Never collect card numbers, bank/routing details, SSNs, or sensitive medical/legal/financial info. Never promise exact prices that aren't in the services list. Never claim an appointment is booked yourself. You are an assistant, not the owner — don't dishonestly impersonate them. No emojis.",
    OFFPLATFORM_RULE,
    paymentBlock,
    "Critical — don't overpromise: only engage with a request if the business description/services clearly cover it. If they're missing/vague or the lead asks about something you can't confirm the business offers, do NOT ask qualifying questions about it or imply they might provide it — instead say the owner will need to confirm that and set status needs_owner.",
    "You MAY: ask their name and contact info, ask what service they need, and ask a general preferred time/date. Speak as the AUTOMATED assistant — say things like 'I can get you booked' or 'you'll get a confirmation'. Do NOT promise that a person/team member will call or follow up unless you genuinely can't help (then set needs_owner and say the owner will confirm).",
    "Meta/product messages: if a message is clearly about the Vraelis software itself — the chat, a link, formatting, a bug, or it reads like an internal test (e.g. 'make the link shorter', 'this is a test') — do NOT roleplay as the business and do NOT say you'll pass it to the team. Briefly reply that you're the live customer assistant and product feedback belongs in the Vraelis dashboard, and keep status as-is.",
    `Also classify the conversation into exactly one status from this list: ${ALLOWED_STATUSES.join(", ")}.`,
    "- contacted: early, just chatting.",
    "- qualifying: you're still gathering fit, service, timing, or price context.",
    "- qualified: they're a real fit and interested, but not at the booking/payment step yet.",
    "- booking_ready: they want a call/appointment/visit, want to move forward now, or are ready to pay.",
    "- needs_owner: they ask something specific you can't answer, or it clearly needs a human.",
    "- lost: they say they're not interested.",
    'Respond with ONLY a JSON object, no other text: {"reply": "<your message to the lead>", "status": "<one status>", "payment": null OR {"kind":"deposit"|"full","amountCents":<integer cents>,"label":"<short label>"}}',
  ]
    .filter(Boolean)
    .join("\n");

  const messages = input.history.map((t) => ({
    role: (t.role === "agent" ? "assistant" : "user") as "assistant" | "user",
    content: t.body,
  }));
  // Ensure the conversation ends on a user turn for the model to answer.
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    messages.push({ role: "user", content: "(the lead is waiting for your reply)" });
  }

  const fallback: ConvoResult = {
    reply: "Thanks! Could you tell me a bit more about what you're looking for, and a rough timeframe?",
    status: null,
    payment: null,
  };
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  try {
    const result = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system,
      messages,
    });
    const raw = result.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Parse the JSON object (tolerate stray text around it).
    let parsed: { reply?: string; status?: string; payment?: unknown } | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = null;
        }
      }
    }

    const reply = (parsed?.reply ?? (parsed ? "" : raw)).trim();
    const status = parsed?.status && ALLOWED_STATUSES.includes(parsed.status) ? parsed.status : null;

    // Validate the optional payment object — only honored if payouts are on.
    let payment: ConvoPayment | null = null;
    const p = parsed?.payment as { kind?: string; amountCents?: unknown; label?: unknown } | null | undefined;
    if (canPay && p && (p.kind === "deposit" || p.kind === "full")) {
      const amt = Math.round(Number(p.amountCents));
      payment = {
        kind: p.kind,
        amountCents: Number.isFinite(amt) && amt > 0 ? amt : 0, // deposit amount is filled server-side
        label: (typeof p.label === "string" ? p.label : "").slice(0, 80),
      };
    }
    return { reply: reply || fallback.reply, status, payment };
  } catch (error) {
    captureError("ai", error, { fn: "continueLeadConversation" });
    return fallback;
  }
}

// OUTBOUND: write a proactive first-touch message to a lead the business
// wants to reach out to (a missed call, referral, list, etc.).
export async function generateOutreach(input: {
  businessName: string;
  businessDescription: string;
  leadName: string;
  note: string; // owner's note about who this lead is / why reach out
}): Promise<string> {
  const business = input.businessName || "us";
  const who = input.leadName ? ` ${input.leadName}` : "";
  const fallback = `Hi${who}, this is ${business} reaching out — we'd love to help you out. What are you looking for, and when works for a quick chat?`;
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  const system = [
    `You are writing a SHORT, warm first-touch outreach message FROM ${business} to a lead they want to contact proactively (not a reply — you're reaching out first).`,
    input.businessDescription ? `What the business does: ${input.businessDescription}.` : "No detailed business description — keep it general, don't invent services.",
    input.note ? `Context the owner gave about this lead: ${input.note}.` : "",
    "Goal: open warmly, reference why you're reaching out if context allows, invite them to reply or book a quick call. Under 60 words. Plain, human, no emojis, no markdown. Don't promise prices/availability or claim anything is booked. Only mention services the description supports.",
    "Write only the message text.",
  ].filter(Boolean).join("\n");

  try {
    const result = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: "Write the outreach message." }],
    });
    const text = result.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || fallback;
  } catch (error) {
    console.error("generateOutreach failed:", error);
    return fallback;
  }
}

// A short, friendly nudge for a lead who's gone quiet. attempt is 1-based.
export async function generateFollowupMessage(input: {
  businessName: string;
  businessDescription: string;
  history: ConvoTurn[];
  attempt: number;
}): Promise<string> {
  const business = input.businessName || "us";
  const fallback = `Just following up from ${business} — still happy to help whenever you're ready. Want to grab a quick time to chat?`;
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  const system = [
    `You are the AI assistant for ${business}, writing a brief follow-up to a lead who hasn't replied in a while.`,
    input.businessDescription ? `What the business does: ${input.businessDescription}.` : "No detailed description — keep it general, don't invent services.",
    `This is follow-up #${input.attempt} (of at most 3). Keep it SHORT (1–2 sentences), warm, low-pressure, and reference the prior conversation naturally. Gently move toward a reply or booking. Don't be pushy or guilt-trippy. No emojis, no markdown. Don't promise prices/availability or claim anything is booked.`,
    "Write only the follow-up message.",
  ].filter(Boolean).join("\n");

  const messages = input.history.map((t) => ({
    role: (t.role === "agent" ? "assistant" : "user") as "assistant" | "user",
    content: t.body,
  }));
  messages.push({ role: "user", content: "(no reply yet — write the follow-up)" });

  try {
    const result = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 250,
      system,
      messages,
    });
    const text = result.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || fallback;
  } catch (error) {
    console.error("generateFollowupMessage failed:", error);
    return fallback;
  }
}

export async function generateLeadReply(input: ReplyInput): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackReply(input);
  }

  const business = input.businessName || "the business";
  const description = input.businessDescription
    ? `What the business does: ${input.businessDescription}.`
    : "";
  const agentName = input.agentName?.trim();
  const servicesBlock = input.businessServices?.trim()
    ? `Services and prices you can quote (use ONLY these exact prices — never invent, estimate, or round a price):\n${input.businessServices.trim()}`
    : "";
  const qualifyingBlock = input.qualifyingQuestions?.trim()
    ? `When you qualify the lead, prefer the owner's own questions (ask the most relevant one or two, naturally):\n${input.qualifyingQuestions.trim()}`
    : "";
  const toneLine = input.agentTone ? TONE_INSTRUCTION[input.agentTone.trim()] : "";

  const system = [
    `You are ${agentName ? `${agentName}, the` : "the"} AI assistant for ${business}, replying to a brand-new inbound lead.`,
    description,
    servicesBlock,
    qualifyingBlock,
    "Goal: reply instantly like a sharp, warm human on the team — acknowledge what they want, answer briefly if you can (including price when they ask and you have it above), ask AT MOST two qualifying questions (what they need + timing/budget), and move toward booking a call or visit.",
    "Rules: under 90 words. Plain, friendly, confident. No emojis. No markdown. Don't invent prices, availability, or specifics you weren't given — if asked something you don't have, say you'll confirm. Sign off as the business, not as 'AI'.",
    toneLine,
    OFFPLATFORM_RULE,
  ]
    .filter(Boolean)
    .join("\n");

  const user = [
    input.leadName ? `Lead name: ${input.leadName}` : null,
    `Their message: "${input.leadMessage}"`,
    "Write only the reply text to send back to them.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = result.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    return text || fallbackReply(input);
  } catch (error) {
    console.error("generateLeadReply failed:", error);
    return fallbackReply(input);
  }
}
