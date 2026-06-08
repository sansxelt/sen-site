import { redirect } from "next/navigation";

// /app is the legacy chat route. Now lives at /chat.
export default function LegacyAppPage() {
  redirect("/chat");
}
