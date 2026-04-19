// Parses <think>...</think> blocks out of streaming assistant content
// so the frontend can render them as a dim "thinking" pre-section
// above the actual answer. Tolerant of unclosed <think> tags during
// streaming — treats anything after an unclosed open tag as thinking.

export type Section =
  | { type: "thinking"; text: string }
  | { type: "answer"; text: string };

const OPEN = "<think>";
const CLOSE = "</think>";

export function parseSections(content: string): Section[] {
  const out: Section[] = [];
  let cursor = 0;
  while (cursor < content.length) {
    const openIdx = content.indexOf(OPEN, cursor);
    if (openIdx === -1) {
      const tail = content.slice(cursor);
      if (tail) out.push({ type: "answer", text: tail });
      break;
    }
    if (openIdx > cursor) {
      out.push({ type: "answer", text: content.slice(cursor, openIdx) });
    }
    const innerStart = openIdx + OPEN.length;
    const closeIdx = content.indexOf(CLOSE, innerStart);
    if (closeIdx === -1) {
      // Unclosed — still streaming, render the rest as thinking
      out.push({ type: "thinking", text: content.slice(innerStart) });
      break;
    }
    out.push({
      type: "thinking",
      text: content.slice(innerStart, closeIdx),
    });
    cursor = closeIdx + CLOSE.length;
  }
  return out;
}
