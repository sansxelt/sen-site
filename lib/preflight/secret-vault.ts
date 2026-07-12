// The integration-secret vault: AES-256-GCM sealing for the few credentials Vraelis is trusted with
// (today: per-application TEST ACCOUNT logins). Design rules, all fail-closed:
//
//   - The key comes ONLY from VRAELIS_SECRET_KEY (64 hex chars = 32 bytes). No key -> sealing REFUSES
//     (never a plaintext fallback, never a derived default key).
//   - Ciphertext lives in v_app_connections.encrypted_ref. It is never selected by list reads, never
//     returned to a client, never logged. The UI sees only maskSecretValue() output.
//   - openSecret exists for the WORKER (a flow signing in as the test user); nothing in the web app
//     calls it on a request path that could echo the value.
//   - GCM authenticates: a tampered blob throws rather than decrypting to garbage.
//
// Server-only. Never import from a client component.
import crypto from "node:crypto";

const ALG = "aes-256-gcm";

export class VaultUnconfiguredError extends Error {
  constructor() { super("VRAELIS_SECRET_KEY is not set (64 hex chars). Refusing to store or read secrets without it."); }
}

function key(): Buffer {
  const raw = (process.env.VRAELIS_SECRET_KEY || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) throw new VaultUnconfiguredError();
  return Buffer.from(raw, "hex");
}

export function vaultConfigured(): boolean {
  return /^[0-9a-fA-F]{64}$/.test((process.env.VRAELIS_SECRET_KEY || "").trim());
}

// Seal a small JSON-serializable payload. Fresh random IV per seal; format "v1:<iv>:<tag>:<ct>" (base64url).
export function sealSecret(payload: Record<string, string>): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ct.toString("base64url")}`;
}

// Open a sealed blob. Throws on a missing key, a malformed blob, or ANY tampering (GCM tag mismatch).
export function openSecret(sealed: string): Record<string, string> {
  const [v, ivB, tagB, ctB] = (sealed || "").split(":");
  if (v !== "v1" || !ivB || !tagB || !ctB) throw new Error("secret blob malformed");
  const decipher = crypto.createDecipheriv(ALG, key(), Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]);
  return JSON.parse(pt.toString("utf8")) as Record<string, string>;
}

// The ONLY representation of a secret value a client may ever see: at most the first 2 characters, then
// dots, never the length. "nisha@example.com" -> "ni••••".
export function maskSecretValue(value: string): string {
  const v = (value || "").trim();
  if (!v) return "••••";
  return `${v.slice(0, 2)}••••`;
}
