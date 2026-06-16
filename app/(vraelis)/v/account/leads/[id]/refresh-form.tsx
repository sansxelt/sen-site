"use client";

import { useRouter } from "next/navigation";
import { useRef, type CSSProperties, type ReactNode } from "react";

/**
 * A <form> that runs a (void) server action and then soft-refreshes the page,
 * so the result shows instantly instead of after a manual refresh. Used for the
 * lead-detail inline deal/outcome forms, whose server actions call
 * revalidatePath() but otherwise leave the already-rendered page stale.
 *
 * Guards against a double-submit while a save is in flight (the actions are
 * idempotent, but this avoids redundant calls and a flicker).
 */
export function RefreshForm({
  action,
  children,
  style,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  return (
    <form
      action={async (formData) => {
        if (inFlight.current) return;
        inFlight.current = true;
        try {
          await action(formData);
          router.refresh();
        } finally {
          inFlight.current = false;
        }
      }}
      style={style}
    >
      {children}
    </form>
  );
}
