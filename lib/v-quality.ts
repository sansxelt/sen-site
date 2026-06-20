// Vraelis Rank — voter quality / anti-abuse. Computes a per-vote verdict
// (valid | rejected + reason) from behavioural signals. Rejected votes are still
// recorded (they hold the one-vote-per-test slot) but don't count toward the
// target and earn no reward. This is the gate now that the embed exposes voting
// outside the app. Heuristics are intentionally conservative to limit false
// positives on real voters; an admin can override (see /app/admin).

import crypto from "crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export const MIN_TIME_MS = 1500;          // faster than this = not a real look
export const IP_WINDOW_MIN = 60;          // velocity window
export const IP_MAX_PER_WINDOW = 60;      // votes/IP/hour before we flag stuffing
export const REP_MIN_VOTES = 12;          // votes before reputation can gate
export const REP_REJECT_RATIO = 0.6;      // >60% rejected = gated bad actor
export const ANON_MAX_PER_DAY = 20;       // embed: votes per device/day

export type Verdict = { status: "valid" | "rejected"; reason?: string };

export function hashToken(v: string): string {
  return crypto.createHash("sha256").update(String(v)).digest("hex").slice(0, 40);
}

export function ipFromHeaders(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0] : "") || h.get("x-real-ip") || h.get("cf-connecting-ip") || "";
  return ip.trim() || null;
}

function isGibberish(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 3) return false;               // too short to judge — allow
  if (/^(.)\1{4,}$/.test(t)) return true;       // "aaaaa"
  if (/(.)\1{6,}/.test(t)) return true;         // long char run
  if (t.length >= 8 && !/[aeiou]/.test(t)) return true; // no vowels in a long string
  return false;
}

// Decide whether a vote should count. `deviceHash` (embed/anon) adds a per-device
// daily limit; `ipHash` adds cross-test velocity.
export async function assessVote(args: {
  voterId: string; timeSpentMs?: number; reason?: string;
  ipHash?: string | null; deviceHash?: string | null; isAnon?: boolean;
}): Promise<Verdict> {
  // 1) Too fast to be a real consideration.
  if (typeof args.timeSpentMs === "number" && args.timeSpentMs >= 0 && args.timeSpentMs < MIN_TIME_MS) {
    return { status: "rejected", reason: "too_fast" };
  }
  // 2) Obvious spam in the comment.
  if (args.reason && isGibberish(args.reason)) return { status: "rejected", reason: "spam_comment" };

  if (!isDatabaseConfigured()) return { status: "valid" };
  const s = getSupabaseAdminClient();
  const voter = args.voterId.trim().toLowerCase();

  // 3) IP velocity (vote stuffing across tests).
  if (args.ipHash) {
    const since = new Date(Date.now() - IP_WINDOW_MIN * 60_000).toISOString();
    const { count } = await s.from("v_judgments" as never).select("*", { count: "exact", head: true }).eq("ip_hash", args.ipHash).gte("created_at", since);
    if ((count ?? 0) >= IP_MAX_PER_WINDOW) return { status: "rejected", reason: "ip_velocity" };
  }

  // 4) Anon/embed: per-device daily cap (device id == the anon id by default).
  if (args.isAnon && args.deviceHash) {
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count } = await s.from("v_judgments" as never).select("*", { count: "exact", head: true }).eq("device_hash", args.deviceHash).gte("created_at", since.toISOString());
    if ((count ?? 0) >= ANON_MAX_PER_DAY) return { status: "rejected", reason: "device_daily_limit" };
  }

  // 5) Reputation: a voter who's mostly been rejected (after enough votes) is gated.
  const { data: rep } = await s.from("v_voter_rep" as never).select("valid,rejected").eq("voter_id", voter).maybeSingle();
  const r = rep as unknown as { valid: number; rejected: number } | null;
  if (r) {
    const total = r.valid + r.rejected;
    if (total >= REP_MIN_VOTES && r.rejected / total >= REP_REJECT_RATIO) {
      return { status: "rejected", reason: "low_reputation" };
    }
  }

  return { status: "valid" };
}
