import { fetch } from "@tauri-apps/plugin-http";
import { LazyStore } from "@tauri-apps/plugin-store";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { openUrl } from "@tauri-apps/plugin-opener";

// Always hits the live website. We don't run the website locally
// just to develop the desktop, so there's no localhost fallback.
export const API_BASE = "https://vraelis.ai";

const STORE_FILE = "auth.json";
const TOKEN_KEY = "session_token";
const EMAIL_KEY = "session_email";

const store = new LazyStore(STORE_FILE);

export type DesktopSession = {
  token: string;
  email: string;
  displayName: string | null;
};

// ── Backend calls ───────────────────────────────────────────────────

type StartResponse = {
  request_id: string;
  approval_url: string;
  expires_at: string;
};

export async function startSignIn(): Promise<StartResponse> {
  const res = await fetch(`${API_BASE}/api/auth/desktop/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_label: "Windows desktop" }),
  });
  if (!res.ok) {
    throw new Error(`start failed (${res.status})`);
  }
  return (await res.json()) as StartResponse;
}

type RedeemResponse = { token: string; email: string };

export async function redeemRequest(requestId: string): Promise<RedeemResponse> {
  const res = await fetch(`${API_BASE}/api/auth/desktop/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: requestId }),
  });
  if (!res.ok) {
    throw new Error(`redeem failed (${res.status})`);
  }
  return (await res.json()) as RedeemResponse;
}

type ValidateResponse = {
  email: string;
  display_name: string | null;
  device_label: string | null;
};

export async function validateToken(token: string): Promise<ValidateResponse | null> {
  const res = await fetch(`${API_BASE}/api/auth/desktop/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`validate failed (${res.status})`);
  }
  return (await res.json()) as ValidateResponse;
}

// ── Local storage (tauri-plugin-store) ──────────────────────────────

export async function saveSession(token: string, email: string): Promise<void> {
  await store.set(TOKEN_KEY, token);
  await store.set(EMAIL_KEY, email);
  await store.save();
}

export async function loadStoredToken(): Promise<string | null> {
  const value = await store.get<string>(TOKEN_KEY);
  return typeof value === "string" ? value : null;
}

export async function clearSession(): Promise<void> {
  await store.delete(TOKEN_KEY);
  await store.delete(EMAIL_KEY);
  await store.save();
}

// ── Sign-in flow orchestration ──────────────────────────────────────

// Kicks off the browser-side approval. Returns the request_id we'll
// match against when the deep-link callback fires.
export async function beginSignInFlow(): Promise<string> {
  const { request_id, approval_url } = await startSignIn();
  await openUrl(approval_url);
  return request_id;
}

// Pulls request_id out of a Vraelis://auth?request_id=xxx URL.
export function extractRequestId(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("request_id");
  } catch {
    return null;
  }
}

// Subscribes to deep-link callbacks. The callback runs every time the
// OS hands Vraelis:// back to us (one-time per sign-in).
export async function onVraelisDeepLink(
  handler: (requestId: string) => void,
): Promise<() => void> {
  const unlisten = await onOpenUrl((urls) => {
    for (const url of urls) {
      const requestId = extractRequestId(url);
      if (requestId) handler(requestId);
    }
  });
  return unlisten;
}

// Restores the user's session on app launch. Returns null if no
// stored token, or if the token is no longer valid (server-side
// revoked, expired, etc.).
export async function restoreSession(): Promise<DesktopSession | null> {
  const token = await loadStoredToken();
  if (!token) return null;

  try {
    const result = await validateToken(token);
    if (!result) {
      await clearSession();
      return null;
    }
    return {
      token,
      email: result.email,
      displayName: result.display_name,
    };
  } catch {
    return null;
  }
}
