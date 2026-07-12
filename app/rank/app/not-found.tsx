import Link from "next/link";
import { I, EmptyIcon } from "@/app/rank/_components/icons";

// Not-found boundary for the signed-in app segment: rendered when a page in
// /app calls notFound(). Unmatched URLs are still handled by the root
// app/not-found.tsx.
export default function AppNotFound() {
  return (
    <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="empty">
        <EmptyIcon d={I.help} />
        <h3>This page does not exist.</h3>
        <p>The link may be out of date, or the page may have moved. Your applications and runs are still on the overview.</p>
        <Link href="/app" className="btn">Back to overview</Link>
      </div>
    </div>
  );
}
