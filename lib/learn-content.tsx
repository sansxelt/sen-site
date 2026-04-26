import {
  Bold,
  BulletList,
  Callout,
  CodeBlock,
  CodeInline,
  Diagram,
  H2,
  H3,
  P,
  StepList,
  TryItCTA,
} from "@/components/learn/article-blocks";
import type { ReactNode } from "react";

// Sansxel Learn — content registry. Articles are typed objects with
// a render() function returning JSX, so authoring is just composing
// blocks from components/learn/article-blocks. Schema is hierarchical:
//
//   topic       → top-level subject (ai / coding / databases / api / …)
//   subtopic?   → optional second level (javascript under coding, etc.)
//   level       → difficulty pill (beginner / intermediate / advanced)
//
// Routes:
//   /learn                                  → hub (sidebar + featured)
//   /learn/topics/[topic]                   → all articles in a topic
//   /learn/topics/[topic]/[subtopic]        → narrowed to a subtopic
//   /learn/[slug]                           → article detail
//
// Topic URLs are nested under /learn/topics/ so they don't collide
// with the article slug route at /learn/[slug].

// ───────────────────────────────────────────────────────────────
// Topic tree
// ───────────────────────────────────────────────────────────────

export type TopicKey =
  | "ai"
  | "coding"
  | "databases"
  | "api"
  | "mcp"
  | "systems"
  | "build"
  | "skills"
  | "monetization";

export type Subtopic = { key: string; label: string };
export type Topic = {
  key: TopicKey;
  label: string;
  description: string;
  emoji: string;
  subtopics: Subtopic[];
};

export const TOPICS: Topic[] = [
  {
    key: "ai",
    label: "AI",
    emoji: "🧠",
    description: "What AI actually is, how it works, what it can and can't do.",
    subtopics: [
      { key: "concepts", label: "Concepts" },
      { key: "how-it-works", label: "How it works" },
      { key: "voice", label: "Voice" },
      { key: "vision", label: "Vision" },
    ],
  },
  {
    key: "coding",
    label: "Coding",
    emoji: "💻",
    description: "Languages, web, frontend, backend — the actual stack.",
    subtopics: [
      { key: "javascript", label: "JavaScript" },
      { key: "python", label: "Python" },
      { key: "web-dev", label: "Web dev" },
      { key: "frontend", label: "Frontend" },
      { key: "backend", label: "Backend" },
    ],
  },
  {
    key: "databases",
    label: "Databases",
    emoji: "🗄️",
    description: "SQL, NoSQL, schema design — picking + using the right store.",
    subtopics: [
      { key: "sql", label: "SQL" },
      { key: "nosql", label: "NoSQL" },
      { key: "design", label: "Schema design" },
    ],
  },
  {
    key: "api",
    label: "APIs",
    emoji: "🔌",
    description: "REST, auth, requests — talking to other services and ours.",
    subtopics: [
      { key: "rest", label: "REST" },
      { key: "auth", label: "Auth" },
      { key: "requests", label: "Requests" },
    ],
  },
  {
    key: "mcp",
    label: "MCP",
    emoji: "🪝",
    description: "The Model Context Protocol — connecting tools to AIs.",
    subtopics: [
      { key: "concepts", label: "Concepts" },
      { key: "integration", label: "Integration" },
      { key: "use-cases", label: "Use cases" },
    ],
  },
  {
    key: "systems",
    label: "Systems",
    emoji: "🏗️",
    description: "Architecture, scaling, performance — making things hold up.",
    subtopics: [
      { key: "architecture", label: "Architecture" },
      { key: "scaling", label: "Scaling" },
      { key: "performance", label: "Performance" },
    ],
  },
  {
    key: "build",
    label: "Build",
    emoji: "🛠️",
    description: "Hands-on tutorials. Real projects, full apps, AI builds.",
    subtopics: [
      { key: "projects", label: "Projects" },
      { key: "full-apps", label: "Full apps" },
      { key: "ai-apps", label: "AI apps" },
    ],
  },
  {
    key: "skills",
    label: "Skills",
    emoji: "🧩",
    description: "Debugging, thinking, problem solving — the meta game.",
    subtopics: [
      { key: "debugging", label: "Debugging" },
      { key: "thinking", label: "Thinking" },
      { key: "problem-solving", label: "Problem solving" },
    ],
  },
  {
    key: "monetization",
    label: "Monetization",
    emoji: "💸",
    description: "Turning what you build into something that pays.",
    subtopics: [
      { key: "saas", label: "SaaS" },
      { key: "apis", label: "APIs" },
      { key: "pricing", label: "Pricing" },
    ],
  },
];

export const TOPIC_BY_KEY: Record<TopicKey, Topic> = Object.fromEntries(
  TOPICS.map((t) => [t.key, t]),
) as Record<TopicKey, Topic>;

export function getTopic(key: string): Topic | null {
  return TOPIC_BY_KEY[key as TopicKey] ?? null;
}

export function getSubtopic(topic: Topic, key: string): Subtopic | null {
  return topic.subtopics.find((s) => s.key === key) ?? null;
}

// ───────────────────────────────────────────────────────────────
// Difficulty levels
// ───────────────────────────────────────────────────────────────

export type LevelKey = "beginner" | "intermediate" | "advanced";

export const LEVELS: Array<{ key: LevelKey; label: string }> = [
  { key: "beginner",     label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced",     label: "Advanced" },
];

export const LEVEL_TONE: Record<LevelKey, string> = {
  beginner:     "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-300",
  intermediate: "border-sky-400/25 bg-sky-400/[0.06] text-sky-300",
  advanced:     "border-violet-400/25 bg-violet-400/[0.06] text-violet-300",
};

// ───────────────────────────────────────────────────────────────
// Article schema
// ───────────────────────────────────────────────────────────────

export type ArticleMeta = {
  slug: string;
  title: string;
  excerpt: string;
  topic: TopicKey;
  subtopic?: string;     // matches a Subtopic.key under the topic
  level: LevelKey;
  readMinutes: number;
  publishedAt: string;   // ISO
  coverEmoji: string;
};

export type Article = ArticleMeta & {
  render: () => ReactNode;
};

// ───────────────────────────────────────────────────────────────
// Articles
// ───────────────────────────────────────────────────────────────

export const ARTICLES: Article[] = [
  {
    slug: "what-is-ai",
    title: "What is AI, really?",
    excerpt:
      "AI like ChatGPT works by predicting the next word — kind of like autocomplete, but way smarter. Here's the plain-English version of what's happening under the hood.",
    topic: "ai",
    subtopic: "concepts",
    level: "beginner",
    readMinutes: 4,
    publishedAt: "2026-04-25",
    coverEmoji: "🧠",
    render: () => (
      <>
        <P>
          When people say <Bold>&quot;AI&quot;</Bold> in 2026, they almost always mean
          one specific thing: a <Bold>large language model</Bold> (LLM). The same
          tech behind ChatGPT, Claude, Gemini, and yes — sansxel.
        </P>

        <Diagram
          emoji="📝 → 🧠 → 📝"
          caption="You give it text. It thinks. It gives you text back."
        />

        <H2>What it actually does</H2>
        <P>
          An LLM is trained on billions of pages of text — books, websites, code,
          conversations. The training boils all of that down to one skill:
        </P>
        <Callout tone="tip" title="The one trick">
          Given some text, predict the next word. That&apos;s it. Then predict the
          next one. Then the next. Until it&apos;s done.
        </Callout>
        <P>
          That&apos;s not as boring as it sounds. To predict the next word well,
          the model has to understand grammar, facts, code, tone, the user&apos;s
          intent, jokes, sarcasm, and how to follow instructions. All of that
          falls out of the &quot;just predict the next word&quot; goal when you
          train at huge scale.
        </P>

        <H2>So how does it &quot;think&quot;?</H2>
        <P>
          It doesn&apos;t — not the way you do. There&apos;s no inner voice. The
          model is a giant math function: text in, probabilities out, pick the
          most likely next word, repeat. What looks like reasoning is the model
          composing patterns it learned from training.
        </P>
        <P>
          That&apos;s why AI can sound brilliant on a topic in its training
          data and totally make stuff up on a niche question — it&apos;s
          pattern-matching what an answer <em>should look like</em>, not
          checking facts.
        </P>

        <H2>Why it feels different now</H2>
        <BulletList
          items={[
            <>Models got way bigger — more parameters, more training data.</>,
            <>They learned to use <Bold>tools</Bold> — search the web, run code, fetch a URL.</>,
            <>They got better at following instructions instead of just continuing your sentence.</>,
            <>Voice + image inputs landed, so you can talk and drop images, not just type.</>,
          ]}
        />

        <H2>What you can do with it</H2>
        <StepList
          items={[
            <><Bold>Ask anything in plain English.</Bold> No keyword tricks. Just type how you&apos;d talk.</>,
            <><Bold>Drop in a file or screenshot.</Bold> The model reads it and works from it.</>,
            <><Bold>Generate stuff.</Bold> Images, code, summaries, plans, documents.</>,
            <><Bold>Iterate.</Bold> The first reply is rarely perfect — refine with follow-ups.</>,
          ]}
        />

        <Callout tone="note" title="Next">
          New to this? Try a simple prompt on sansxel — &quot;explain X like
          I&apos;m 12&quot; — and see what comes back. That&apos;s the fastest
          way to build intuition for what AI can and can&apos;t do.
        </Callout>

        <TryItCTA text="Try sansxel free" />
      </>
    ),
  },

  {
    slug: "how-voice-ai-works",
    title: "How voice AI works (talk → text → AI → speech)",
    excerpt:
      "When you talk to an AI, three different models are running in sequence. Here's what each one does and why latency matters more than you think.",
    topic: "ai",
    subtopic: "voice",
    level: "beginner",
    readMinutes: 5,
    publishedAt: "2026-04-25",
    coverEmoji: "🎙️",
    render: () => (
      <>
        <P>
          Voice AI feels like one thing — you talk, it talks back. Under the
          hood it&apos;s actually <Bold>three separate models</Bold> chained
          together, and each one adds latency. Knowing the chain helps you
          understand why some voice apps feel snappy and others feel laggy.
        </P>

        <Diagram
          emoji="🎙️ → 📝 → 🧠 → 🔊"
          caption="Speech → Text (STT) → LLM → Speech (TTS)"
        />

        <H2>Step 1 — Speech to text (STT)</H2>
        <P>
          Your microphone records audio. A speech recognition model
          (Whisper is the popular open one) converts that audio into a text
          transcript. This usually takes 200ms to 1s depending on how long
          you spoke and which model is doing it.
        </P>

        <H2>Step 2 — The LLM thinks</H2>
        <P>
          The transcript gets sent to a language model — same kind that
          powers a normal text chat. It generates a reply, usually streaming
          word by word so the next step can start before it&apos;s finished.
        </P>

        <H2>Step 3 — Text to speech (TTS)</H2>
        <P>
          A speech synthesis model takes the text reply and turns it into
          audio. Modern TTS models sound very natural — they handle pauses,
          emphasis, and emotion, not just word-by-word reading.
        </P>

        <Callout tone="tip" title="The trick to feeling fast">
          Good voice apps don&apos;t wait for the LLM to finish writing
          before starting TTS. They stream sentences as they come out, TTS
          each one immediately, and play them back-to-back. Cuts perceived
          latency in half.
        </Callout>

        <H2>What sansxel does differently</H2>
        <BulletList
          items={[
            <><Bold>Two voice modes:</Bold> Dictate (talk → AI types) and Talk (full hands-free conversation).</>,
            <><Bold>VAD (voice activity detection):</Bold> the mic figures out when you&apos;re done — no push-to-talk button.</>,
            <><Bold>Live preview transcript:</Bold> Web Speech API runs in parallel so you see your words as you speak, while Whisper still produces the canonical version.</>,
          ]}
        />

        <TryItCTA text="Hit Voice in the workshop" />
      </>
    ),
  },

  {
    slug: "build-your-first-ai-app",
    title: "Build your first AI app in 10 minutes",
    excerpt:
      "A real working chat app, end to end. JavaScript, no framework, ~50 lines. You'll get a feel for how requests, streaming, and prompts fit together.",
    topic: "build",
    subtopic: "ai-apps",
    level: "beginner",
    readMinutes: 10,
    publishedAt: "2026-04-25",
    coverEmoji: "🛠️",
    render: () => (
      <>
        <P>
          You don&apos;t need a framework, a backend, or a degree to build a
          working AI app. You need an API key, an HTML file, and 10 minutes.
          By the end you&apos;ll have a chat box that streams real responses
          from a real model.
        </P>

        <H2>1. Get an API key</H2>
        <P>
          Sign up for sansxel and head to{" "}
          <CodeInline>/account/keys</CodeInline> to make one. Treat it like a
          password — don&apos;t commit it to git.
        </P>

        <H2>2. Make an HTML file</H2>
        <P>
          Save this as <CodeInline>index.html</CodeInline> and open it in your
          browser. That&apos;s your whole app.
        </P>
        <CodeBlock
          lang="html"
          code={`<!DOCTYPE html>
<html>
<body>
  <textarea id="prompt" rows="4" cols="60" placeholder="Ask anything…"></textarea>
  <button id="send">Send</button>
  <pre id="reply" style="white-space: pre-wrap;"></pre>

  <script>
    const KEY = "sk_your_api_key_here"; // your sansxel API key
    document.getElementById("send").onclick = async () => {
      const prompt = document.getElementById("prompt").value;
      const out = document.getElementById("reply");
      out.textContent = "";

      const res = await fetch("https://sansxel.ai/api/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + KEY,
        },
        body: JSON.stringify({ prompt, stream: true }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        out.textContent += decoder.decode(value);
      }
    };
  </script>
</body>
</html>`}
        />

        <H2>3. What just happened</H2>
        <StepList
          items={[
            <>You sent a <CodeInline>POST</CodeInline> request to the chat API with your prompt.</>,
            <>The server forwarded it to a model and started streaming the reply back.</>,
            <>You read the stream chunk by chunk and appended each chunk to the page — that&apos;s why you see words appearing in real time.</>,
            <><Bold>Stop = no auth header.</Bold> The bearer token is what lets the server know which account is sending the request.</>,
          ]}
        />

        <Callout tone="warn" title="Don't ship this as-is">
          The API key is exposed in the HTML — anyone who opens DevTools can
          steal it. For a real app, make a tiny backend (Cloudflare Worker,
          Vercel function, anything) that proxies the request and keeps the
          key server-side.
        </Callout>

        <H2>What to add next</H2>
        <BulletList
          items={[
            <>A conversation history — keep an array of past messages and send the whole list each turn.</>,
            <>System prompt — set the AI&apos;s personality with a starting instruction.</>,
            <>File upload — accept an image or document and pass it as part of the request.</>,
            <>Stop button — abort the fetch with an AbortController so the user can cut a reply short.</>,
          ]}
        />

        <TryItCTA text="See sansxel's API docs" href="/account/keys" />
      </>
    ),
  },

  {
    slug: "sansxel-rest-api-quickstart",
    title: "Sansxel REST API — quickstart",
    excerpt:
      "Authenticate, send a chat request, stream a reply. Three steps. Copy-paste examples in JavaScript and Python.",
    topic: "api",
    subtopic: "rest",
    level: "beginner",
    readMinutes: 6,
    publishedAt: "2026-04-25",
    coverEmoji: "🔌",
    render: () => (
      <>
        <P>
          The sansxel API is a thin REST surface. One endpoint for chat,
          one for image generation, one for voice. Everything streams,
          everything uses bearer auth.
        </P>

        <H2>1. Get a key</H2>
        <P>
          Head to <CodeInline>/account/keys</CodeInline>, click <Bold>New key</Bold>,
          copy it. Keys are shown once — store them somewhere safe.
        </P>

        <H2>2. Authenticate</H2>
        <P>
          Send your key in the <CodeInline>Authorization</CodeInline> header
          on every request:
        </P>
        <CodeBlock
          lang="bash"
          code={`Authorization: Bearer sk_your_api_key_here`}
        />

        <H2>3. Send a chat request</H2>
        <P>JavaScript:</P>
        <CodeBlock
          lang="javascript"
          code={`const res = await fetch("https://sansxel.ai/api/v1/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": \`Bearer \${process.env.SANSXEL_KEY}\`,
  },
  body: JSON.stringify({
    messages: [{ role: "user", content: "Hello!" }],
    stream: true,
  }),
});

// Stream the reply
const reader = res.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  process.stdout.write(decoder.decode(value));
}`}
        />

        <P>Python:</P>
        <CodeBlock
          lang="python"
          code={`import os, requests

with requests.post(
    "https://sansxel.ai/api/v1/chat",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {os.environ['SANSXEL_KEY']}",
    },
    json={
        "messages": [{"role": "user", "content": "Hello!"}],
        "stream": True,
    },
    stream=True,
) as res:
    for chunk in res.iter_content(chunk_size=None):
        print(chunk.decode(), end="", flush=True)`}
        />

        <H2>What you get back</H2>
        <P>
          With <CodeInline>stream: true</CodeInline> the response body is
          plain UTF-8 text streamed chunk by chunk. With{" "}
          <CodeInline>stream: false</CodeInline> you get a single JSON
          object with <CodeInline>{`{ text, usage }`}</CodeInline> after the
          model finishes.
        </P>

        <H3>Rate limits</H3>
        <BulletList
          items={[
            <><Bold>Free:</Bold> 50 chats / week.</>,
            <><Bold>Core:</Bold> 500 chats / week.</>,
            <><Bold>Plus:</Bold> 1,500 chats / week (unlimited with Copilot Pro Pack — included).</>,
            <><Bold>Pro / Teams / Enterprise:</Bold> unlimited.</>,
          ]}
        />

        <Callout tone="tip" title="Hit a 429?">
          Buy a Weekly Boost (+500 chats, $5) or top up credits at{" "}
          <CodeInline>/account/billing</CodeInline>. Both work as overflow when
          you blow past your weekly cap.
        </Callout>

        <TryItCTA text="Get an API key" href="/account/keys" />
      </>
    ),
  },
];

export const ARTICLE_BY_SLUG: Record<string, Article> = Object.fromEntries(
  ARTICLES.map((a) => [a.slug, a]),
);

// Filtering helpers used by the topic / subtopic landing pages.
export function articlesInTopic(topic: TopicKey): Article[] {
  return ARTICLES.filter((a) => a.topic === topic);
}

export function articlesInSubtopic(topic: TopicKey, subtopic: string): Article[] {
  return ARTICLES.filter((a) => a.topic === topic && a.subtopic === subtopic);
}

export function countArticlesInTopic(topic: TopicKey): number {
  return articlesInTopic(topic).length;
}
