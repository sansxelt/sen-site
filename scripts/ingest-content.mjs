#!/usr/bin/env node
// Learn content ingester. Takes a topic and content type, pulls
// open-licensed sources (Wikipedia for now, arXiv/GitHub later),
// asks Claude to draft a piece grounded in those sources, and
// saves it as a draft in Supabase for review.
//
// Run with:
//   node --env-file=.env.local scripts/ingest-content.mjs \
//     --type article --topic ai --title "What is RAG?"
//
// CLI args:
//   --type    article | info | research        (required)
//   --topic   ai | coding | databases | etc.  (required, matches lib/learn-content TOPICS)
//   --title   piece title (drives the search query and the slug)
//   --subtopic   optional taxonomy refinement
//   --query   override the Wikipedia search term (defaults to title)
//
// The script does NOT publish. Pieces land as `draft` and need
// approval through /account/content. That is intentional: thousands
// of pages with no review step is how a domain gets de-indexed.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// --- args ----------------------------------------------------------

const args = parseArgs(process.argv.slice(2));
if (!args.type || !args.topic || !args.title) {
  console.error("usage: ingest-content.mjs --type <article|info|research> --topic <key> --title <title> [--subtopic <key>] [--query <wiki search>]");
  process.exit(2);
}
if (!["article", "info", "research"].includes(args.type)) {
  console.error("--type must be one of: article, info, research");
  process.exit(2);
}

// --- clients -------------------------------------------------------

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// --- pipeline ------------------------------------------------------

const query = args.query ?? args.title;
console.log(`[1/4] researching "${query}" across Wikipedia + arXiv…`);
const [wiki, arxiv] = await Promise.all([
  fetchWikipediaSources(query),
  fetchArxivSources(query, args.type === "research" ? 3 : 2),
]);
const sources = [...wiki, ...arxiv];
if (sources.length === 0) {
  console.error("no usable sources. try a broader --query");
  process.exit(1);
}
console.log(`      found ${sources.length} source(s) (${wiki.length} wiki, ${arxiv.length} arxiv)`);

console.log(`[2/4] drafting ${args.type} with claude-opus-4-7…`);
const draft = await draftPiece({
  type: args.type,
  topic: args.topic,
  subtopic: args.subtopic,
  title: args.title,
  sources,
});
console.log(`      title: ${draft.title}`);
console.log(`      slug:  ${draft.slug}`);
console.log(`      excerpt: ${(draft.excerpt ?? "").slice(0, 80)}…`);

console.log(`[3/4] checking slug uniqueness…`);
const existing = await supabase
  .from("learn_pieces")
  .select("id")
  .eq("slug", draft.slug)
  .maybeSingle();
if (existing.data) {
  draft.slug = `${draft.slug}-${Date.now().toString(36)}`;
  console.log(`      slug collided, using ${draft.slug}`);
}

console.log(`[4/4] saving draft to Supabase…`);
const { data: pieceRow, error: pieceErr } = await supabase
  .from("learn_pieces")
  .insert({
    type: args.type,
    slug: draft.slug,
    title: draft.title,
    excerpt: draft.excerpt ?? null,
    topic: args.topic,
    subtopic: args.subtopic ?? null,
    cover_emoji: draft.cover_emoji ?? null,
    read_minutes: draft.read_minutes ?? null,
    author_email: process.env.INGEST_AUTHOR_EMAIL ?? null,
    status: "draft",
  })
  .select("*")
  .single();
if (pieceErr) {
  console.error("piece insert failed:", pieceErr.message);
  process.exit(1);
}
const pieceId = pieceRow.id;

const chapters = (draft.chapters ?? [{ title: draft.title, body_md: draft.body_md ?? "" }]).map((c, i) => ({
  piece_id: pieceId,
  ord: i,
  slug: c.slug ?? slugify(c.title) ?? `chapter-${i + 1}`,
  title: c.title,
  body_md: c.body_md,
}));
const { error: chErr } = await supabase.from("learn_chapters").insert(chapters);
if (chErr) {
  await supabase.from("learn_pieces").delete().eq("id", pieceId);
  console.error("chapters insert failed:", chErr.message);
  process.exit(1);
}

const sourceRows = sources.map((s, i) => ({
  piece_id: pieceId,
  ord: i,
  url: s.url,
  title: s.title,
  source_type: s.source_type,
  excerpt: s.excerpt?.slice(0, 800) ?? null,
}));
const { error: srcErr } = await supabase.from("learn_sources").insert(sourceRows);
if (srcErr) console.warn("sources insert failed (non-fatal):", srcErr.message);

console.log(`\n✓ draft saved as ${pieceId}`);
console.log(`  review at: /account/content/${pieceId}`);

// --- helpers -------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function slugify(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

async function fetchWikipediaSources(q) {
  // 1. Search Wikipedia for relevant article titles.
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search=${encodeURIComponent(q)}&limit=3&namespace=0`;
  const searchRes = await fetch(searchUrl, {
    headers: { "User-Agent": "sansxel-content-ingester/0.1 (+https://sansxel.ai)" },
  });
  if (!searchRes.ok) return [];
  const searchJson = await searchRes.json();
  const titles = searchJson?.[1] ?? [];
  const urls = searchJson?.[3] ?? [];

  // 2. Pull each article's REST summary (no auth, CC-BY-SA, we cite).
  const out = [];
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const url = urls[i];
    try {
      const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const r = await fetch(sumUrl, {
        headers: { "User-Agent": "sansxel-content-ingester/0.1 (+https://sansxel.ai)" },
      });
      if (!r.ok) continue;
      const j = await r.json();
      out.push({
        title: j.title ?? title,
        url: url ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        source_type: "wikipedia",
        excerpt: j.extract ?? "",
      });
    } catch {
      // skip a flaky article rather than abort
    }
  }
  return out;
}

// arXiv API. Atom XML response. Pulls top-N papers matching the
// query and returns abstract excerpts. We extract via regex
// because the alternative (xml2js / fast-xml-parser) would add a
// dep just for this. Fields we need (title, summary, id, authors)
// have stable shapes.
async function fetchArxivSources(q, max = 2) {
  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&max_results=${max}&sortBy=relevance&sortOrder=descending`;
    const res = await fetch(url, {
      headers: { "User-Agent": "sansxel-content-ingester/0.1 (+https://sansxel.ai)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split("<entry>").slice(1);
    const out = [];
    for (const raw of entries) {
      const block = raw.split("</entry>")[0];
      const pick = (tag) => {
        const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
        return m ? m[1].trim().replace(/\\s+/g, " ") : null;
      };
      const idUrl = pick("id");
      const title = pick("title");
      const summary = pick("summary");
      const authorMatches = block.match(/<name>([^<]+)<\/name>/g) || [];
      const authors = authorMatches
        .map((m) => m.replace(/<\/?name>/g, ""))
        .slice(0, 3)
        .join(", ");
      if (idUrl && title && summary) {
        out.push({
          title: title.replace(/\s+/g, " ").trim(),
          url: idUrl,
          source_type: "arxiv",
          excerpt: `${authors ? `Authors: ${authors}. ` : ""}${summary.slice(0, 700)}`,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function draftPiece({ type, topic, subtopic, title, sources }) {
  const sourceBlock = sources
    .map(
      (s, i) =>
        `[Source ${i + 1}] ${s.title} (${s.url})\n${s.excerpt}`,
    )
    .join("\n\n");

  const lengthGuidance = {
    info: "single chapter, 300-600 words. Glossary or definition feel: concise and structured.",
    article: "single chapter, 1500-3000 words. Educational essay feel.",
    research: "3-6 chapters, ~600-1200 words each. Deep-dive feel, split by concept rather than by length.",
  }[type];

  const prompt = `Write a ${type} for the sansxel.ai Learn library on this topic.

TITLE: ${title}
TOPIC: ${topic}${subtopic ? ` / ${subtopic}` : ""}

LENGTH: ${lengthGuidance}

SOURCES (ground every claim in these. Do NOT invent facts. Use [Source N] inline citations where you draw on a specific source):

${sourceBlock}

INSTRUCTIONS:
- Write like a real human, not an AI assistant. The piece should sound like a developer-friend explaining the topic over coffee, not like a Wikipedia summary or a corporate blog.
  Specific tells to AVOID:
    * em dashes (—) anywhere. use commas, periods, colons, or parentheses.
    * "In this article we will explore..." / "Let's dive into..." / "In conclusion..." / "It's worth noting that..." / "It is important to note...". cut all of it.
    * over-hedging ("might possibly suggest", "tends to often"). pick a stance.
    * lists for things that should be a sentence. lists for things that ARE actually a list, fine.
    * three-adjective stacks ("clear, concise, and structured"). pick one.
    * the word "delve" or "leverage" as a verb. never.
  Specific things to DO:
    * vary sentence length. short ones land. medium ones build. occasionally a longer one stretches the thought.
    * concrete examples over abstractions. "GPT-5 has a 256k context window" beats "modern LLMs support large context windows".
    * contractions when natural ("doesn't", "you'll").
    * speak directly to the reader ("you"). don't narrate ("we will see").
- Ground every claim in the SOURCES above. Inline cite as [Source N] where N matches the numbered list. If a claim isn't supported, omit it. Do not hallucinate.
- Use markdown for headings, lists, and code blocks where they actually help. Don't sprinkle them just to look structured.
- Pick a short URL slug (kebab-case, max 60 chars).
- Pick a 1-emoji cover relevant to the topic.
- Estimate read minutes honestly (about 200 wpm).
- Return ONLY a JSON object. No commentary, no markdown fences around it. Schema:

${type === "research"
    ? `{"title":"...","slug":"...","excerpt":"...","cover_emoji":"📚","read_minutes":12,"chapters":[{"slug":"...","title":"...","body_md":"..."}]}`
    : `{"title":"...","slug":"...","excerpt":"...","cover_emoji":"📚","read_minutes":4,"body_md":"..."}`}`;

  const resp = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt }],
  });
  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  // Strip stray code fences if Claude wraps anyway.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("claude returned non-JSON:", cleaned.slice(0, 400));
    throw err;
  }
  // Normalize slug since the model occasionally returns spaces or punctuation.
  parsed.slug = slugify(parsed.slug ?? parsed.title);
  return parsed;
}
