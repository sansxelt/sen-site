import { redirect } from "next/navigation";

// Platform section removed — product is focused on /chat.
export default function PlatformPage() {
  redirect("/chat");
}
