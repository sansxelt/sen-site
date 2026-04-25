import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const anthropic = new Anthropic();
const openai = new OpenAI();

console.log("Testing Anthropic...");
try {
  const a = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 5,
    messages: [{ role: "user", content: "Say hi." }],
  });
  console.log("  ✅ Anthropic OK —", a.content[0].text.trim().slice(0, 30));
} catch (e) {
  console.log("  ❌ Anthropic failed:", e.message);
}

console.log("Testing OpenAI...");
try {
  const o = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 5,
    messages: [{ role: "user", content: "Say hi." }],
  });
  console.log("  ✅ OpenAI OK —", o.choices[0].message.content?.trim().slice(0, 30) || "(empty)");
} catch (e) {
  console.log("  ❌ OpenAI failed:", e.message);
}
