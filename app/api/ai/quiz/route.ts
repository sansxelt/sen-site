import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { getPlanForEmail } from "../../../../lib/account-billing";
import { descriptorForTier, resolveTier } from "../../../../lib/ai-models";
import { recordUsage } from "../../../../lib/usage";

export const runtime = "nodejs";

const client = new Anthropic();

// POST /api/ai/quiz
// Body: { topic: string, count?: number }  (default count = 5)
// Returns: { questions: Array<{ question, options, correct_index, explanation }> }
//
// One-shot quiz generator. Always Haiku, cheap and fast, the structure
// is what matters here, not deep reasoning. JSON-only system prompt;
// we strip code fences if the model adds them anyway.

const DEFAULT_COUNT = 5;
const MIN_COUNT = 1;
const MAX_COUNT = 20;

export type QuizQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

type QuizBody = { topic?: unknown; count?: unknown };

function clampCount(raw: unknown): number {
  const n = typeof raw === "number" ? Math.floor(raw) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, n));
}

function sanitizeQuestion(raw: unknown): QuizQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const question =
    typeof obj.question === "string" ? obj.question.trim() : "";
  const options = Array.isArray(obj.options)
    ? obj.options
        .filter((o): o is string => typeof o === "string")
        .map((o) => o.trim())
    : [];
  const correctIndex =
    typeof obj.correct_index === "number"
      ? Math.floor(obj.correct_index)
      : -1;
  const explanation =
    typeof obj.explanation === "string" ? obj.explanation.trim() : "";

  if (!question || options.length !== 4) return null;
  if (correctIndex < 0 || correctIndex >= options.length) return null;

  return { question, options, correct_index: correctIndex, explanation };
}

export async function POST(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: QuizBody;
  try {
    payload = (await request.json()) as QuizBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const topic = typeof payload.topic === "string" ? payload.topic.trim() : "";
  if (!topic) {
    return NextResponse.json({ error: "Missing topic." }, { status: 400 });
  }
  const safeTopic = topic.slice(0, 400);
  const count = clampCount(payload.count);

  // Always Haiku, quizzes are structured + cheap, no need for the
  // user's tier resolution beyond making sure they at least have fast.
  const plan = await getPlanForEmail(email);
  const descriptor = descriptorForTier(resolveTier(plan, "fast"));

  const surface =
    request.headers.get("x-VRAELIS-surface") === "desktop" ? "desktop" : "web";

  const systemPrompt = `Generate ${count} multiple-choice questions about ${safeTopic}. Each question has 4 options. Return STRICT JSON only.

Schema:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correct_index": 0,
      "explanation": "string"
    }
  ]
}

Rules:
- Output ONLY the JSON object, no markdown, no fences, no preamble.
- Exactly 4 options per question.
- correct_index is the 0-based index of the correct option.
- explanation is one short sentence (under 30 words) explaining why.
- Vary difficulty across the set; avoid trick questions.`;

  const startedAt = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await client.messages.create({
      model: descriptor.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Topic: ${safeTopic}\nCount: ${count}\n\nReturn the JSON.`,
        },
      ],
    });
    inputTokens = response.usage?.input_tokens ?? 0;
    outputTokens = response.usage?.output_tokens ?? 0;

    const block = response.content.find((c) => c.type === "text");
    let questions: QuizQuestion[] = [];
    if (block && block.type === "text") {
      const raw = block.text.trim();
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "");
      try {
        const parsed = JSON.parse(cleaned) as { questions?: unknown };
        if (Array.isArray(parsed.questions)) {
          questions = parsed.questions
            .map(sanitizeQuestion)
            .filter((q): q is QuizQuestion => q !== null);
        }
      } catch (err) {
        console.warn("ai/quiz JSON parse failed:", err);
      }
    }

    void recordUsage({
      email,
      kind: "quiz",
      model: descriptor.model,
      surface,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      duration_ms: Date.now() - startedAt,
    });

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "Could not generate a valid quiz. Try a different topic." },
        { status: 502 },
      );
    }

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("ai/quiz failed:", err);
    return NextResponse.json(
      { error: "Could not generate quiz." },
      { status: 500 },
    );
  }
}
