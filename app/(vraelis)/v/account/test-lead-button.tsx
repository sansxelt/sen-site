"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { sendTestLead } from "./actions";

/**
 * "Send a test lead" button. sendTestLead is a void server action that
 * creates a sample lead and revalidates the page; this client wrapper runs it
 * then soft-refreshes so the new lead shows in the inbox immediately instead of
 * after a manual refresh.
 */
export function TestLeadButton({
  label,
  className = "btn btn--ghost",
  style,
}: {
  label: string;
  className?: string;
  style?: CSSProperties;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <form
      action={async () => {
        setPending(true);
        try {
          await sendTestLead();
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
      style={{ display: "inline-block" }}
    >
      <button type="submit" disabled={pending} className={className} style={style}>
        {pending ? "Sending…" : label}
      </button>
    </form>
  );
}
