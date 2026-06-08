// Shown while a (site) server component resolves during navigation.
// Must fill the viewport with the correct background so there is no
// black or white flash. The SiteShell header stays mounted above this
// (it lives in layout, not template), so only the content area below
// the 64px header needs covering.
export default function SiteLoading() {
  return (
    <div
      style={{
        background: "var(--background)",
        minHeight: "calc(100vh - 64px)",
      }}
    />
  );
}
