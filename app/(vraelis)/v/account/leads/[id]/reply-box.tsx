"use client";

import { useActionState, useRef, type CSSProperties } from "react";
import { sendManualReply } from "../../actions";
import type { ActionResult } from "../../actions";
import { useRefreshOnSuccess } from "../../use-refresh-on-success";

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "var(--r-xs)",
  border: "1px solid var(--line-2)",
  background: "var(--bg-1)",
  padding: "12px 14px",
  fontSize: 14,
  color: "var(--fg-1)",
  outline: "none",
  fontFamily: "var(--font-sans)",
  resize: "vertical",
};

export function ReplyBox({ leadId }: { leadId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const res = await sendManualReply(prev, fd);
      if (res.ok) formRef.current?.reset();
      return res;
    },
    null,
  );
  useRefreshOnSuccess(state); // show the sent reply in the conversation thread immediately

  return (
    <form ref={formRef} action={action} style={{ marginTop: 16 }}>
      <input type="hidden" name="leadId" value={leadId} />
      <textarea
        name="body"
        rows={3}
        placeholder="Write a reply… (sends to the lead by email)"
        style={inputStyle}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <button type="submit" className="btn" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
          {pending ? "Sending…" : "Send reply"}
        </button>
        {state && (
          <span style={{ fontSize: 13, color: state.ok ? "var(--acc-deep)" : "#9F2D2D" }}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
