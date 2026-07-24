import Home from "./home";

// Server wrapper: metadata lives on the segment layout (noindex). The homepage view is a client component
// because it carries the reveal + Failed-to-Verified signature interactions.
export default function Page() {
  return <Home />;
}
