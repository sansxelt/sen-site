import { LazyStore } from "@tauri-apps/plugin-store";
import type { ChatMessage } from "./api";

const store = new LazyStore("chat-history.json");

const THREADS_KEY_PREFIX = "threads:";
const ACTIVE_KEY_PREFIX = "active:";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "help",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "make",
  "me",
  "my",
  "need",
  "of",
  "on",
  "or",
  "please",
  "so",
  "that",
  "the",
  "this",
  "to",
  "update",
  "want",
  "we",
  "with",
  "you",
  "your",
]);

export type DesktopThread = {
  id: string;
  title: string;
  preview: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  folded: boolean;
};

function threadsKey(email: string) {
  return `${THREADS_KEY_PREFIX}${email.toLowerCase()}`;
}

function activeKey(email: string) {
  return `${ACTIVE_KEY_PREFIX}${email.toLowerCase()}`;
}

export function createThread(seed?: Partial<DesktopThread>): DesktopThread {
  const now = new Date().toISOString();
  return {
    id:
      seed?.id ??
      `thread_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: seed?.title ?? "New chat",
    preview: seed?.preview ?? "Start a conversation",
    messages: seed?.messages ?? [],
    createdAt: seed?.createdAt ?? now,
    updatedAt: seed?.updatedAt ?? now,
    pinned: seed?.pinned ?? false,
    folded: seed?.folded ?? false,
  };
}

export async function loadChatState(email: string): Promise<{
  threads: DesktopThread[];
  activeThreadId: string | null;
}> {
  const rawThreads = await store.get<DesktopThread[]>(threadsKey(email));
  const rawActive = await store.get<string>(activeKey(email));

  const threads = Array.isArray(rawThreads)
    ? rawThreads
        .map((thread) => sanitizeThread(thread))
        .filter((thread): thread is DesktopThread => thread !== null)
        .sort(sortThreads)
    : [];

  const activeThreadId =
    typeof rawActive === "string" &&
    threads.some((thread) => thread.id === rawActive)
      ? rawActive
      : threads[0]?.id ?? null;

  return { threads, activeThreadId };
}

export async function saveChatState(
  email: string,
  threads: DesktopThread[],
  activeThreadId: string | null,
) {
  const nextThreads = threads
    .map((thread) => sanitizeThread(thread))
    .filter((thread): thread is DesktopThread => thread !== null)
    .sort(sortThreads);

  await store.set(threadsKey(email), nextThreads);
  if (activeThreadId) {
    await store.set(activeKey(email), activeThreadId);
  } else {
    await store.delete(activeKey(email));
  }
  await store.save();
}

export function sortThreads(a: DesktopThread, b: DesktopThread) {
  // Pinned threads always rise to the top, then sort by recency.
  const aPinned = a.pinned ? 1 : 0;
  const bPinned = b.pinned ? 1 : 0;
  if (aPinned !== bPinned) return bPinned - aPinned;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export function buildThreadPreview(messages: ChatMessage[]): string {
  const last = [...messages].reverse().find((message) => message.content.trim());
  if (!last) return "Start a conversation";
  return trimSentence(last.content, 78);
}

export function deriveThreadTitle(
  messages: ChatMessage[],
  previousTitle?: string,
): string {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean);

  if (userMessages.length === 0) return "New chat";

  const firstTitle = normalizeTitle(userMessages[0]);
  if (userMessages.length === 1) return firstTitle;

  const latestTitle = normalizeTitle(userMessages[userMessages.length - 1]);
  if (!previousTitle || previousTitle === "New chat") return latestTitle;

  return shouldRetitle(previousTitle, latestTitle) ? latestTitle : firstTitle;
}

function sanitizeThread(thread: DesktopThread | null | undefined): DesktopThread | null {
  if (!thread || typeof thread !== "object") return null;
  if (typeof thread.id !== "string" || !thread.id.trim()) return null;

  const messages = Array.isArray(thread.messages)
    ? thread.messages.filter(isChatMessage)
    : [];

  const title =
    typeof thread.title === "string" && thread.title.trim()
      ? thread.title.trim()
      : deriveThreadTitle(messages);

  const preview =
    typeof thread.preview === "string" && thread.preview.trim()
      ? thread.preview.trim()
      : buildThreadPreview(messages);

  return {
    id: thread.id,
    title,
    preview,
    messages,
    createdAt:
      typeof thread.createdAt === "string" && thread.createdAt
        ? thread.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof thread.updatedAt === "string" && thread.updatedAt
        ? thread.updatedAt
        : new Date().toISOString(),
    pinned: typeof thread.pinned === "boolean" ? thread.pinned : false,
    folded: typeof thread.folded === "boolean" ? thread.folded : false,
  };
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as ChatMessage;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function normalizeTitle(text: string): string {
  const firstLine = text
    .replace(/\s+/g, " ")
    .split(/[.!?]/)
    .map((part) => part.trim())
    .find(Boolean) ?? text.trim();

  let candidate = firstLine
    .replace(
      /^(please\s+)?((can|could|would|will|should|do)\s+you\s+|i\s+(need|want)\s+to\s+|help\s+me\s+|let'?s\s+|lets\s+|show\s+me\s+|tell\s+me\s+|explain\s+|fix\s+|build\s+|make\s+|create\s+|add\s+)/i,
      "",
    )
    .replace(/^how\s+do\s+i\s+/i, "")
    .replace(/^how\s+to\s+/i, "")
    .replace(/^what(?:'s| is)\s+/i, "")
    .trim();

  if (!candidate) candidate = firstLine.trim();
  if (!candidate) return "New chat";

  candidate = candidate.charAt(0).toUpperCase() + candidate.slice(1);
  return trimSentence(candidate, 38);
}

function shouldRetitle(currentTitle: string, nextTitle: string): boolean {
  if (currentTitle === nextTitle) return false;
  const currentTokens = keywordTokens(currentTitle);
  const nextTokens = keywordTokens(nextTitle);
  if (nextTokens.length < 2) return false;
  if (currentTokens.length === 0) return true;

  const overlap = nextTokens.filter((token) => currentTokens.includes(token)).length;
  return overlap / nextTokens.length < 0.25;
}

function keywordTokens(text: string): string[] {
  return Array.from(
    new Set(
      (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
        (token) => token.length > 2 && !STOPWORDS.has(token),
      ),
    ),
  );
}

function trimSentence(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const sliced = text.slice(0, limit + 1);
  const boundary = Math.max(sliced.lastIndexOf(" "), sliced.lastIndexOf("-"));
  return `${(boundary > 14 ? sliced.slice(0, boundary) : sliced.slice(0, limit)).trim()}...`;
}
