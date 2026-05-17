"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Mirror of the FLIGHT_KEY in web-chat.tsx. Read-only here.
const FLIGHT_KEY = "Vraelis.inflight.threads";
type FlightEntry = { startedAt: number };

function readFlight(): Record<string, FlightEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FLIGHT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FlightEntry>;
    const now = Date.now();
    const live: Record<string, FlightEntry> = {};
    for (const [id, v] of Object.entries(parsed)) {
      if (v && typeof v.startedAt === "number" && now - v.startedAt < 5 * 60_000) {
        live[id] = v;
      }
    }
    return live;
  } catch {
    return {};
  }
}

/**
 * Floating "Back to chat, generating..." pill, mounted at the root
 * layout level so it shows up on every page including marketing.
 * Only visible when:
 *   1. There's at least one in-flight thread in localStorage, AND
 *   2. We're NOT already on the /app workspace (where streaming
 *      progress is visible directly).
 *
 * Updates live via the 'Vraelis:flight:changed' event WebChat fires
 * on send start + send finally, plus on tab focus + storage events
 * (so a stream started in another tab also surfaces here).
 */
export function InflightBackToChat() {
  const pathname = usePathname();
  const [flightId, setFlightId] = useState<string | null>(null);

  useEffect(() => {
    const recompute = () => {
      const flight = readFlight();
      const ids = Object.keys(flight);
      if (ids.length === 0) {
        setFlightId(null);
        return;
      }
      // Pick the most recently started one, that's what the user
      // most likely wants to jump back to.
      let mostRecent: { id: string; startedAt: number } | null = null;
      for (const [id, v] of Object.entries(flight)) {
        if (!mostRecent || v.startedAt > mostRecent.startedAt) {
          mostRecent = { id, startedAt: v.startedAt };
        }
      }
      setFlightId(mostRecent ? mostRecent.id : null);
    };
    recompute();
    if (typeof window === "undefined") return;
    const onChanged = () => recompute();
    const onStorage = (e: StorageEvent) => {
      if (e.key === FLIGHT_KEY) recompute();
    };
    window.addEventListener("Vraelis:flight:changed", onChanged);
    window.addEventListener("focus", onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("Vraelis:flight:changed", onChanged);
      window.removeEventListener("focus", onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Server-side verification: when localStorage says a thread is
  // generating, double-check against the thread's updated_at. The
  // server bumps updated_at every ~900ms during streaming (each
  // throttled save in lib/chat-history:updateMessageContent), so
  // anything older than 10s means generation has actually ended,
  // even if the WebChat unmount nuked the cleanup that should have
  // cleared the local flight flag.
  useEffect(() => {
    if (!flightId) return;
    let cancelled = false;

    const verify = async () => {
      try {
        const res = await fetch(`/api/threads/${flightId}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          thread?: { updated_at?: string };
        };
        const updatedAt = data?.thread?.updated_at;
        if (!updatedAt) return;
        const age = Date.now() - new Date(updatedAt).getTime();
        if (age > 10_000 && !cancelled) {
          // Stream is done (or died). Clear the stale flag so the
          // pill stops claiming it's still generating.
          if (typeof window !== "undefined") {
            const flight = readFlight();
            delete flight[flightId];
            window.localStorage.setItem(FLIGHT_KEY, JSON.stringify(flight));
            window.dispatchEvent(new CustomEvent("Vraelis:flight:changed"));
          }
          setFlightId(null);
        }
      } catch {
        // Verification is best-effort; pill stays until TTL if we
        // can't reach the server.
      }
    };

    // Immediate check on flight-id change, then poll while the pill
    // is visible so a stream that finishes off-page hides quickly.
    void verify();
    const id = setInterval(verify, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [flightId]);

  if (!flightId) return null;
  // On /app the user is already in the workspace and can see the
  // active generation directly, no need for the floating pill.
  if (pathname === "/app" || pathname.startsWith("/app/")) return null;

  return (
    <Link
      href={`/app?thread=${flightId}`}
      className="inflight-back-pill"
      title="Jump back to the chat that's generating"
    >
      <span className="inflight-back-dot" aria-hidden />
      <span className="inflight-back-text">Generating, back to chat</span>
    </Link>
  );
}
