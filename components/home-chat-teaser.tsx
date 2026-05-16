"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Hero chat input on /home, anonymous visitors can type a question
 * and hit send; we route them through sign-in (if needed) into the
 * workspace with their prompt pre-filled. ChatGPT/Claude pattern.
 *
 * Pre-fills only, we don't auto-send. The user clicks Send in the
 * workspace once they see their text loaded, so they retain agency
 * (and can edit if they want).
 */
export function HomeChatTeaser({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    const target = `/app?prompt=${encodeURIComponent(t)}`;
    if (signedIn) {
      router.push(target);
    } else {
      router.push(`/signin?callbackUrl=${encodeURIComponent(target)}`);
    }
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="home-teaser"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Ask VRAELIS anything, &ldquo;summarize this PDF&rdquo;, &ldquo;build me an app&rdquo;, &ldquo;humanize this essay&rdquo;…"
        rows={2}
        className="home-teaser-input"
      />
      <div className="home-teaser-row">
        <span className="home-teaser-hint">
          {signedIn ? "Press Enter to open in the workshop" : "Press Enter, sign in is one step"}
        </span>
        <button
          type="submit"
          disabled={!text.trim()}
          className="home-teaser-send"
        >
          Send →
        </button>
      </div>
    </form>
  );
}
