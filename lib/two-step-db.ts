// Two-step verification: storage, rate limits and email delivery. The pure crypto is in lib/two-step.ts.
//
// WHERE IT LIVES, AND WHY THERE. No migration can be run from here, so the settings ride in a table that
// already exists: ONE row in v_account_connections per account, provider = "two_step" (TWO_STEP_PROVIDER),
// user_id = the lowercased email, the same tenancy key and the same (user_id, provider) uniqueness every
// integration row has. The split mirrors how that table treats OAuth tokens:
//   - encrypted_ref holds the SECRETS, sealed by the vault (lib/preflight/secret-vault.ts, AES-256-GCM): the
//     authenticator secret and the keyed hashes of the recovery codes. Never selected by a status read.
//   - meta holds the non-secret STATE: which methods are on, when they were set up, how many recovery codes
//     are left, and `rev`, a write counter used for compare-and-set (below). meta.oauth is false, so
//     openAccountToken (which requires meta.oauth === true) can never hand this row out as a token, and
//     account-connections-db.ts excludes the provider from every list, revoke and open besides.
//
// CONCURRENCY. Every update is conditional on the `rev` it read (`.eq("meta->>rev", ...)`) and retried a few
// times, so two writers never interleave into a lost update. That matters most for recovery codes: two
// different codes used at once must not each write back a list that still contains the other one.
//
// FAILURE POSTURE. A status read that fails is reported as a failure, never as "off": the sign-in gate
// (lib/two-step-session.ts) holds a sign-in at the second step rather than letting a database blip waive it.
// Every code check spends an attempt from a fail-closed Postgres bucket (allowStrict) BEFORE any comparison,
// so parallel guesses cannot all slip in under a counter that has not been written yet.
//
// Server-only. Never import from a client component.
import crypto from "node:crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { sealSecret, openSecret, vaultConfigured } from "./preflight/secret-vault";
import { allowStrict } from "./vraelis-ratelimit";
import { sendTwoStepCodeEmail } from "./email";
import { logEvent } from "./v-events";
import {
  TWO_STEP_PROVIDER, EMAIL_CODE_TTL_S, TOTP_STEP_S, TOTP_WINDOW,
  generateTotpSecret, formatSecretForDisplay, otpauthUri, verifyTotp,
  emailCode, checkEmailCode, generateRecoveryCodes, hashRecoveryCode, findRecoveryCode, maskEmail,
  type TwoStepMethod, type ProofMethod, type EmailPurpose,
} from "./two-step";
import { qrSvgPath } from "./qr";

const TABLE = "v_account_connections";
const norm = (e: string) => String(e ?? "").trim().toLowerCase();
const nowS = () => Math.floor(Date.now() / 1000);
function db() { return getSupabaseAdminClient(); }

function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "42P01" || /relation .*v_account_connections.* does not exist/i.test(err.message ?? "");
}

// ── Keys ────────────────────────────────────────────────────────────────────────────────────────────────
// Derived from the vault key, the one secret this feature already cannot work without (the authenticator
// secret is sealed with it). One root, separate labels, so an email-code key can never be used as a
// recovery-hash key or the reverse. null when the vault is unconfigured: every caller then fails closed.
function derivedKey(label: "email-code" | "recovery-hash"): Buffer | null {
  const raw = (process.env.VRAELIS_SECRET_KEY || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) return null;
  return crypto.createHmac("sha256", Buffer.from(raw, "hex")).update(`vraelis-two-step|${label}`).digest();
}

// ── Shapes ──────────────────────────────────────────────────────────────────────────────────────────────
type Meta = {
  two_step: true;
  oauth: false;
  rev: number;
  totp: boolean;
  email: boolean;
  enrolled_at: string;
  totp_enrolled_at: string | null;
  email_enrolled_at: string | null;
  recovery_remaining: number;
  recovery_generated_at: string | null;
};
type Secrets = { totpSecret: string | null; recovery: string[] };
type Row = { id: string; meta: Meta; secrets: Secrets };

export type TwoStepStatus = {
  enabled: boolean;
  totp: boolean;
  email: boolean;
  enrolledAt: string | null;
  totpEnrolledAt: string | null;
  emailEnrolledAt: string | null;
  recoveryRemaining: number;
  recoveryGeneratedAt: string | null;
};

export const TWO_STEP_OFF: TwoStepStatus = {
  enabled: false, totp: false, email: false, enrolledAt: null, totpEnrolledAt: null, emailEnrolledAt: null,
  recoveryRemaining: 0, recoveryGeneratedAt: null,
};

export type Failure = "invalid" | "expired" | "rate_limited" | "unavailable" | "not_enabled";
export type Proof = { method: ProofMethod; code: string; issuedAt?: number | null };

function parseMeta(raw: unknown): Meta {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    two_step: true, oauth: false,
    rev: Number.isFinite(Number(m.rev)) ? Number(m.rev) : 0,
    totp: m.totp === true,
    email: m.email === true,
    enrolled_at: s(m.enrolled_at) ?? new Date(0).toISOString(),
    totp_enrolled_at: s(m.totp_enrolled_at),
    email_enrolled_at: s(m.email_enrolled_at),
    recovery_remaining: Number.isFinite(Number(m.recovery_remaining)) ? Number(m.recovery_remaining) : 0,
    recovery_generated_at: s(m.recovery_generated_at),
  };
}

function statusFrom(meta: Meta | null): TwoStepStatus {
  if (!meta || !(meta.totp || meta.email)) return TWO_STEP_OFF;
  return {
    enabled: true, totp: meta.totp, email: meta.email,
    enrolledAt: meta.enrolled_at, totpEnrolledAt: meta.totp_enrolled_at, emailEnrolledAt: meta.email_enrolled_at,
    recoveryRemaining: meta.recovery_remaining, recoveryGeneratedAt: meta.recovery_generated_at,
  };
}

export function methodsOf(status: TwoStepStatus): TwoStepMethod[] {
  return [...(status.totp ? ["totp" as const] : []), ...(status.email ? ["email" as const] : [])];
}

// ── Reads ───────────────────────────────────────────────────────────────────────────────────────────────

// Status only: meta, never encrypted_ref. This is what the sign-in gate and the console read.
// { ok: false } means "could not tell", which callers must treat differently from "off".
export async function readTwoStepStatus(email: string): Promise<{ ok: true; status: TwoStepStatus } | { ok: false }> {
  if (!isDatabaseConfigured()) return { ok: true, status: TWO_STEP_OFF };
  try {
    const { data, error } = await db().from(TABLE).select("meta")
      .eq("user_id", norm(email)).eq("provider", TWO_STEP_PROVIDER).maybeSingle();
    if (error) return isMissingTable(error) ? { ok: true, status: TWO_STEP_OFF } : { ok: false };
    return { ok: true, status: statusFrom(data ? parseMeta((data as { meta?: unknown }).meta) : null) };
  } catch {
    return { ok: false };
  }
}

// The full row with the secrets opened. A row that exists but cannot be opened (vault key missing or
// changed) is a FAILURE, not an absent row: treating it as "off" would waive the second step.
async function loadRow(email: string): Promise<{ ok: true; row: Row | null } | { ok: false }> {
  if (!isDatabaseConfigured()) return { ok: true, row: null };
  try {
    const { data, error } = await db().from(TABLE).select("id, meta, encrypted_ref")
      .eq("user_id", norm(email)).eq("provider", TWO_STEP_PROVIDER).maybeSingle();
    if (error) return isMissingTable(error) ? { ok: true, row: null } : { ok: false };
    if (!data) return { ok: true, row: null };
    const r = data as { id: string; meta?: unknown; encrypted_ref?: string | null };
    const opened = openSecret(String(r.encrypted_ref ?? ""));
    const recovery = JSON.parse(opened.recovery || "[]");
    return {
      ok: true,
      row: {
        id: String(r.id),
        meta: parseMeta(r.meta),
        secrets: {
          totpSecret: opened.totp_secret ? String(opened.totp_secret) : null,
          recovery: Array.isArray(recovery) ? recovery.map(String) : [],
        },
      },
    };
  } catch {
    return { ok: false };
  }
}

// ── Writes ──────────────────────────────────────────────────────────────────────────────────────────────

// Insert the first row, or update the one read, conditional on its rev. false means "someone else wrote in
// between" (or the write failed): the caller re-reads and tries again.
async function writeRow(email: string, prev: Row | null, meta: Omit<Meta, "rev" | "two_step" | "oauth">, secrets: Secrets): Promise<boolean> {
  if (!vaultConfigured()) return false;
  const sealed = sealSecret({ totp_secret: secrets.totpSecret ?? "", recovery: JSON.stringify(secrets.recovery) });
  const full: Meta = { ...meta, two_step: true, oauth: false, rev: (prev?.meta.rev ?? 0) + 1 };
  if (!prev) {
    const { error } = await db().from(TABLE).insert({
      user_id: norm(email), provider: TWO_STEP_PROVIDER, status: "enabled", encrypted_ref: sealed, meta: full,
      last_verified_at: new Date().toISOString(),
    } as never);
    return !error;
  }
  const { data, error } = await db().from(TABLE)
    .update({ status: "enabled", encrypted_ref: sealed, meta: full, last_verified_at: new Date().toISOString() } as never)
    .eq("user_id", norm(email)).eq("provider", TWO_STEP_PROVIDER).eq("id", prev.id)
    .eq("meta->>rev", String(prev.meta.rev))
    .select("id");
  return !error && Array.isArray(data) && data.length === 1;
}

async function deleteRow(email: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { error } = await db().from(TABLE).delete().eq("user_id", norm(email)).eq("provider", TWO_STEP_PROVIDER);
  return !error;
}

// ── Rate limits ─────────────────────────────────────────────────────────────────────────────────────────
// Per account, because the thing being guessed is the account's code. Five tries per ten minutes and thirty
// per day: at three accepted authenticator codes per try that bounds a guesser who already has the password
// to about one chance in eleven thousand per day. The ten-minute bucket is checked first so a burst does not
// also drain the day. allowStrict fails closed: no limiter, no attempt.
async function spendAttempt(email: string): Promise<boolean> {
  const e = norm(email);
  if (!(await allowStrict(`two-step-verify:${e}`, 5, 600))) return false;
  return allowStrict(`two-step-verify-day:${e}`, 30, 86400);
}

// ── Code checks ─────────────────────────────────────────────────────────────────────────────────────────

async function checkTotp(email: string, secret: string, code: string): Promise<true | Failure> {
  const counter = verifyTotp(secret, code, nowS());
  if (counter === null) return "invalid";
  // Consume the matched step so the same code cannot be used twice. The key must outlive the whole time the
  // step is accepted, which is (2 * window + 1) steps; one extra step of margin.
  const ttl = (2 * TOTP_WINDOW + 2) * TOTP_STEP_S;
  return (await allowStrict(`two-step-totp-used:${norm(email)}:${counter}`, 1, ttl)) ? true : "invalid";
}

async function checkEmail(email: string, purpose: EmailPurpose, issuedAt: number | null | undefined, code: string): Promise<true | Failure> {
  const key = derivedKey("email-code");
  if (!key) return "unavailable";
  const at = Number(issuedAt);
  const r = checkEmailCode(key, norm(email), purpose, at, code, nowS());
  if (r !== "ok") return r;
  // Single use: the first submission of this (account, purpose, issue second) consumes the key. Held for
  // twice the code's life so it cannot expire while the code is still accepted.
  return (await allowStrict(`two-step-email-used:${norm(email)}:${purpose}:${Math.floor(at)}`, 1, EMAIL_CODE_TTL_S * 2)) ? true : "invalid";
}

// Remove one recovery code, compare-and-set against concurrent writers. The limiter key is taken first so two
// simultaneous submissions of the SAME code cannot both pass the list check before either write lands.
async function consumeRecovery(email: string, code: string): Promise<{ ok: true; remaining: number } | { ok: false; reason: Failure }> {
  const key = derivedKey("recovery-hash");
  if (!key) return { ok: false, reason: "unavailable" };
  const e = norm(email);
  const hash = hashRecoveryCode(key, e, code);
  let claimed = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const loaded = await loadRow(e);
    if (!loaded.ok) return { ok: false, reason: "unavailable" };
    const row = loaded.row;
    if (!row) return { ok: false, reason: "not_enabled" };
    const idx = findRecoveryCode(key, e, code, row.secrets.recovery);
    if (idx < 0) return { ok: false, reason: "invalid" };
    if (!claimed) {
      if (!(await allowStrict(`two-step-recovery-used:${e}:${hash.slice(0, 24)}`, 1, 86400))) return { ok: false, reason: "invalid" };
      claimed = true;
    }
    const recovery = row.secrets.recovery.filter((_, i) => i !== idx);
    const { two_step: _t, oauth: _o, rev: _r, ...rest } = row.meta;
    if (await writeRow(e, row, { ...rest, recovery_remaining: recovery.length }, { ...row.secrets, recovery })) {
      void logEvent({ userId: e, eventType: "two_step_recovery_used", actorType: "owner", source: "two_step", metadata: { remaining: recovery.length } });
      return { ok: true, remaining: recovery.length };
    }
  }
  return { ok: false, reason: "unavailable" };
}

// Check a code from ANY enabled method (or a recovery code). Used to finish signing in (purpose "sign_in") and
// to confirm a settings change from the console (purpose "confirm"). One attempt is spent up front.
export async function verifyProof(
  email: string, proof: Proof, purpose: "sign_in" | "confirm",
): Promise<{ ok: true; method: ProofMethod; recoveryRemaining?: number } | { ok: false; reason: Failure }> {
  const code = String(proof?.code ?? "").slice(0, 64);
  const method = proof?.method;
  if (!code.trim() || (method !== "totp" && method !== "email" && method !== "recovery")) return { ok: false, reason: "invalid" };
  if (!(await spendAttempt(email))) return { ok: false, reason: "rate_limited" };

  if (method === "recovery") {
    const r = await consumeRecovery(email, code);
    return r.ok ? { ok: true, method, recoveryRemaining: r.remaining } : r;
  }
  const loaded = await loadRow(email);
  if (!loaded.ok) return { ok: false, reason: "unavailable" };
  const row = loaded.row;
  if (!row || !(row.meta.totp || row.meta.email)) return { ok: false, reason: "not_enabled" };
  if (method === "totp") {
    if (!row.meta.totp || !row.secrets.totpSecret) return { ok: false, reason: "invalid" };
    const r = await checkTotp(email, row.secrets.totpSecret, code);
    return r === true ? { ok: true, method } : { ok: false, reason: r };
  }
  if (!row.meta.email) return { ok: false, reason: "invalid" };
  const r = await checkEmail(email, purpose, proof.issuedAt, code);
  return r === true ? { ok: true, method } : { ok: false, reason: r };
}

// ── Email delivery ──────────────────────────────────────────────────────────────────────────────────────
// Five sends per ten minutes per account: enough for "send another" a few times, not enough to use the
// account's inbox as a target. Returns the issue second, which the caller carries (in the sign-in token, or
// back from the console inside a sealed ticket) to have the code checked later.
export async function sendEmailCode(email: string, purpose: EmailPurpose): Promise<{ ok: true; issuedAt: number } | { ok: false; reason: Failure }> {
  const key = derivedKey("email-code");
  if (!key) return { ok: false, reason: "unavailable" };
  const e = norm(email);
  if (!(await allowStrict(`two-step-email-send:${e}`, 5, 600))) return { ok: false, reason: "rate_limited" };
  const issuedAt = nowS();
  const sent = await sendTwoStepCodeEmail(e, emailCode(key, e, purpose, issuedAt), purpose);
  return sent ? { ok: true, issuedAt } : { ok: false, reason: "unavailable" };
}

// ── Tickets ─────────────────────────────────────────────────────────────────────────────────────────────
// A setup started in the console is finished by a second request. What the first request decided (the new
// authenticator secret, the second an enable code was mailed, that the person proved it was them) travels
// back to the browser sealed by the vault, so it cannot be read or altered, and is bound to the account and
// to a 30 minute life. Nothing is written until the new method is confirmed with a working code.
const TICKET_TTL_S = 30 * 60;
type Ticket = { kind: "totp_setup" | "email_setup"; email: string; at: number; secret?: string; issuedAt?: number };

function sealTicket(t: Ticket): string {
  return sealSecret({
    k: t.kind, e: t.email, t: String(t.at),
    ...(t.secret ? { s: t.secret } : {}),
    ...(t.issuedAt ? { i: String(t.issuedAt) } : {}),
  });
}

function openTicket(sealed: unknown, kind: Ticket["kind"], email: string): Ticket | null {
  try {
    const o = openSecret(String(sealed ?? ""));
    const at = Number(o.t);
    if (o.k !== kind || o.e !== norm(email) || !Number.isFinite(at) || nowS() - at > TICKET_TTL_S || at > nowS() + 5) return null;
    return { kind, email: o.e, at, secret: o.s || undefined, issuedAt: o.i ? Number(o.i) : undefined };
  } catch {
    return null;
  }
}

// ── Console operations ──────────────────────────────────────────────────────────────────────────────────
// Once two-step verification is on, every change to it (adding a method, removing one, turning it off,
// new recovery codes) needs a current code. Otherwise a session taken over for a moment could plant its own
// authenticator and keep getting back in after the owner changed the password.

type Change<T> = { ok: true } & T | { ok: false; reason: Failure };

async function requireProofIfOn(email: string, proof: Proof | null | undefined): Promise<{ ok: true } | { ok: false; reason: Failure }> {
  const st = await readTwoStepStatus(email);
  if (!st.ok) return { ok: false, reason: "unavailable" };
  if (!st.status.enabled) return { ok: true };
  if (!proof) return { ok: false, reason: "invalid" };
  const r = await verifyProof(email, proof, "confirm");
  return r.ok ? { ok: true } : r;
}

export type TotpSetup = { ticket: string; secret: string; displaySecret: string; uri: string; qr: { size: number; path: string } };

export async function beginTotpSetup(email: string, proof?: Proof | null): Promise<Change<{ setup: TotpSetup }>> {
  if (!vaultConfigured() || !isDatabaseConfigured()) return { ok: false, reason: "unavailable" };
  const gate = await requireProofIfOn(email, proof);
  if (!gate.ok) return gate;
  const e = norm(email);
  const secret = generateTotpSecret();
  const uri = otpauthUri(secret, e);
  return {
    ok: true,
    setup: { ticket: sealTicket({ kind: "totp_setup", email: e, at: nowS(), secret }), secret, displaySecret: formatSecretForDisplay(secret), uri, qr: qrSvgPath(uri) },
  };
}

export async function confirmTotpSetup(email: string, ticket: unknown, code: string): Promise<Change<{ status: TwoStepStatus; recoveryCodes: string[] | null }>> {
  const t = openTicket(ticket, "totp_setup", email);
  if (!t?.secret) return { ok: false, reason: "expired" };
  if (!(await spendAttempt(email))) return { ok: false, reason: "rate_limited" };
  const r = await checkTotp(email, t.secret, code);
  if (r !== true) return { ok: false, reason: r };
  return enableMethod(email, "totp", t.secret);
}

export async function beginEmailSetup(email: string, proof?: Proof | null): Promise<Change<{ ticket: string; emailHint: string }>> {
  if (!vaultConfigured() || !isDatabaseConfigured()) return { ok: false, reason: "unavailable" };
  const gate = await requireProofIfOn(email, proof);
  if (!gate.ok) return gate;
  const sent = await sendEmailCode(email, "enable_email");
  if (!sent.ok) return sent;
  return { ok: true, ticket: sealTicket({ kind: "email_setup", email: norm(email), at: nowS(), issuedAt: sent.issuedAt }), emailHint: maskEmail(email) };
}

// "Send a new code" during email setup. The ticket from beginEmailSetup already records that the setup was
// started (with a proof, if one was needed) within the last 30 minutes, so it stands in for asking again.
export async function resendEmailSetup(email: string, ticket: unknown): Promise<Change<{ ticket: string; emailHint: string }>> {
  const t = openTicket(ticket, "email_setup", email);
  if (!t) return { ok: false, reason: "expired" };
  const sent = await sendEmailCode(email, "enable_email");
  if (!sent.ok) return sent;
  // The new ticket keeps the ORIGINAL start time, so resending cannot stretch one proof past 30 minutes.
  return { ok: true, ticket: sealTicket({ kind: "email_setup", email: norm(email), at: t.at, issuedAt: sent.issuedAt }), emailHint: maskEmail(email) };
}

export async function confirmEmailSetup(email: string, ticket: unknown, code: string): Promise<Change<{ status: TwoStepStatus; recoveryCodes: string[] | null }>> {
  const t = openTicket(ticket, "email_setup", email);
  if (!t?.issuedAt) return { ok: false, reason: "expired" };
  if (!(await spendAttempt(email))) return { ok: false, reason: "rate_limited" };
  const r = await checkEmail(email, "enable_email", t.issuedAt, code);
  if (r !== true) return { ok: false, reason: r };
  return enableMethod(email, "email");
}

// Turn a method on. Recovery codes are generated when the FIRST method goes on (two-step verification goes
// from off to on) and returned so they can be shown exactly once; adding a second method keeps the codes the
// person already saved.
async function enableMethod(email: string, method: TwoStepMethod, totpSecret?: string): Promise<Change<{ status: TwoStepStatus; recoveryCodes: string[] | null }>> {
  const key = derivedKey("recovery-hash");
  if (!key) return { ok: false, reason: "unavailable" };
  const e = norm(email);
  for (let attempt = 0; attempt < 4; attempt++) {
    const loaded = await loadRow(e);
    if (!loaded.ok) return { ok: false, reason: "unavailable" };
    const row = loaded.row;
    const wasOn = Boolean(row && (row.meta.totp || row.meta.email));
    const now = new Date().toISOString();
    const codes = wasOn ? null : generateRecoveryCodes();
    const recovery = codes ? codes.map((c) => hashRecoveryCode(key, e, c)) : row!.secrets.recovery;
    const meta = {
      totp: method === "totp" ? true : Boolean(row?.meta.totp),
      email: method === "email" ? true : Boolean(row?.meta.email),
      enrolled_at: wasOn ? row!.meta.enrolled_at : now,
      totp_enrolled_at: method === "totp" ? now : (row?.meta.totp_enrolled_at ?? null),
      email_enrolled_at: method === "email" ? now : (row?.meta.email_enrolled_at ?? null),
      recovery_remaining: recovery.length,
      recovery_generated_at: codes ? now : (row?.meta.recovery_generated_at ?? null),
    };
    const secrets: Secrets = { totpSecret: method === "totp" ? totpSecret ?? null : (row?.secrets.totpSecret ?? null), recovery };
    if (await writeRow(e, row, meta, secrets)) {
      void logEvent({ userId: e, eventType: "two_step_enabled", actorType: "owner", source: "two_step", metadata: { method } });
      return { ok: true, status: statusFrom({ ...meta, two_step: true, oauth: false, rev: 0 }), recoveryCodes: codes };
    }
  }
  return { ok: false, reason: "unavailable" };
}

// Turn one method off. Removing the last one turns two-step verification off entirely (the row, with its
// secrets and recovery hashes, is deleted rather than left behind half-empty).
export async function removeMethod(email: string, method: TwoStepMethod, proof: Proof): Promise<Change<{ status: TwoStepStatus }>> {
  const r = await verifyProof(email, proof, "confirm");
  if (!r.ok) return r;
  const e = norm(email);
  for (let attempt = 0; attempt < 4; attempt++) {
    const loaded = await loadRow(e);
    if (!loaded.ok) return { ok: false, reason: "unavailable" };
    const row = loaded.row;
    if (!row) return { ok: true, status: TWO_STEP_OFF };
    const other = method === "totp" ? row.meta.email : row.meta.totp;
    if (!other) {
      if (!(await deleteRow(e))) return { ok: false, reason: "unavailable" };
      void logEvent({ userId: e, eventType: "two_step_disabled", actorType: "owner", source: "two_step", metadata: { method } });
      return { ok: true, status: TWO_STEP_OFF };
    }
    const { two_step: _t, oauth: _o, rev: _r, ...rest } = row.meta;
    const meta = { ...rest, [method]: false, [`${method}_enrolled_at`]: null } as Omit<Meta, "rev" | "two_step" | "oauth">;
    const secrets: Secrets = { ...row.secrets, totpSecret: method === "totp" ? null : row.secrets.totpSecret };
    if (await writeRow(e, row, meta, secrets)) {
      void logEvent({ userId: e, eventType: "two_step_method_removed", actorType: "owner", source: "two_step", metadata: { method } });
      return { ok: true, status: statusFrom({ ...meta, two_step: true, oauth: false, rev: 0 }) };
    }
  }
  return { ok: false, reason: "unavailable" };
}

export async function turnOff(email: string, proof: Proof): Promise<Change<{ status: TwoStepStatus }>> {
  const r = await verifyProof(email, proof, "confirm");
  if (!r.ok) return r;
  if (!(await deleteRow(email))) return { ok: false, reason: "unavailable" };
  void logEvent({ userId: norm(email), eventType: "two_step_disabled", actorType: "owner", source: "two_step", metadata: { method: "all" } });
  return { ok: true, status: TWO_STEP_OFF };
}

export async function regenerateRecoveryCodes(email: string, proof: Proof): Promise<Change<{ status: TwoStepStatus; recoveryCodes: string[] }>> {
  const r = await verifyProof(email, proof, "confirm");
  if (!r.ok) return r;
  const key = derivedKey("recovery-hash");
  if (!key) return { ok: false, reason: "unavailable" };
  const e = norm(email);
  for (let attempt = 0; attempt < 4; attempt++) {
    const loaded = await loadRow(e);
    if (!loaded.ok) return { ok: false, reason: "unavailable" };
    const row = loaded.row;
    if (!row || !(row.meta.totp || row.meta.email)) return { ok: false, reason: "not_enabled" };
    const codes = generateRecoveryCodes();
    const recovery = codes.map((c) => hashRecoveryCode(key, e, c));
    const { two_step: _t, oauth: _o, rev: _r, ...rest } = row.meta;
    const meta = { ...rest, recovery_remaining: recovery.length, recovery_generated_at: new Date().toISOString() };
    if (await writeRow(e, row, meta, { ...row.secrets, recovery })) {
      void logEvent({ userId: e, eventType: "two_step_recovery_regenerated", actorType: "owner", source: "two_step" });
      return { ok: true, status: statusFrom({ ...meta, two_step: true, oauth: false, rev: 0 }), recoveryCodes: codes };
    }
  }
  return { ok: false, reason: "unavailable" };
}
