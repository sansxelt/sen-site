import type { ReactNode } from "react";

// Legacy /app layout — page immediately redirects to /chat.
export default function LegacyAppLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
