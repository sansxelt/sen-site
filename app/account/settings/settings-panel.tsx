"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import type { ReleaseChannel, SessionState, SummaryStyle } from "../../../lib/account-session";
import { getAuthErrorMessage } from "../../../lib/auth-ui";

type Tone = "error" | "success";

function statusClass(tone: Tone) {
  return tone === "success"
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
    : "border-rose-400/20 bg-rose-400/10 text-rose-200";
}

export function SettingsPanel({
  initialSessionState,
}: {
  initialSessionState: SessionState | null;
}) {
  const [sessionState, setSessionState] = useState(initialSessionState);
  const [displayName, setDisplayName] = useState(initialSessionState?.displayName ?? "");
  const [workStyle, setWorkStyle] = useState(initialSessionState?.workStyle ?? "");
  const [focusArea, setFocusArea] = useState(initialSessionState?.focusArea ?? "");
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>(initialSessionState?.summaryStyle ?? "balanced");
  const [releaseChannel, setReleaseChannel] = useState<ReleaseChannel>(initialSessionState?.releaseChannel ?? "stable");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ tone: Tone; text: string } | null>(null);

  // Password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ tone: Tone; text: string } | null>(null);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ tone: Tone; text: string } | null>(null);

  async function saveProfile() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, focusArea, releaseChannel, summaryStyle, workStyle }),
      });
      const json = (await res.json()) as { error?: string; sessionState?: SessionState };
      if (!res.ok || !json.sessionState) throw new Error(json.error ?? "Save failed.");
      setSessionState(json.sessionState);
      setSaveMsg({ tone: "success", text: "Saved." });
    } catch (e) {
      setSaveMsg({ tone: "error", text: getAuthErrorMessage(e, "profile") });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setChangingPw(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Password change failed.");
      setCurrentPw(""); setNewPw("");
      setPwMsg({ tone: "success", text: "Password updated." });
    } catch (e) {
      setPwMsg({ tone: "error", text: e instanceof Error ? e.message : "Failed." });
    } finally {
      setChangingPw(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setDeleting(false);
      setDeleteMsg({ tone: "error", text: e instanceof Error ? e.message : "Failed." });
    }
  }

  if (!sessionState) return null;

  return (
    <div className="space-y-0 divide-y divide-white/[0.07]">

      {/* ── Profile ──────────────────────────────────────────────── */}
      <Section title="Profile" description="How Vraelis identifies and addresses you.">
        <Field label="Display name">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            disabled={saving}
            className={input}
          />
        </Field>
        <Field label="Primary workflow">
          <input
            type="text"
            value={workStyle}
            onChange={(e) => setWorkStyle(e.target.value)}
            placeholder="Coding, design, writing, research..."
            disabled={saving}
            className={input}
          />
        </Field>
        <Field label="What to remember" hint="Context Vraelis should prioritise when recalling your work.">
          <textarea
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            rows={3}
            placeholder="Interrupted tasks, active projects, recent decisions..."
            disabled={saving}
            className={input + " resize-none"}
          />
        </Field>
        <Field label="Email">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-400">
            {sessionState.email}
          </div>
        </Field>
        {saveMsg && <Alert tone={saveMsg.tone} text={saveMsg.text} />}
        <div>
          <button onClick={() => void saveProfile()} disabled={saving} className={primaryBtn}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </Section>

      {/* ── Preferences ──────────────────────────────────────────── */}
      <Section title="Preferences" description="Tune how Vraelis surfaces and delivers context.">
        <Field label="Summary style">
          <div className="flex gap-2">
            {(["concise", "balanced", "detailed"] as SummaryStyle[]).map((v) => (
              <button
                key={v}
                onClick={() => setSummaryStyle(v)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  summaryStyle === v
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200"
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">
            {summaryStyle === "concise" && "Short recaps, signal only."}
            {summaryStyle === "balanced" && "Middle ground for daily use."}
            {summaryStyle === "detailed" && "More context for deeper recall."}
          </p>
        </Field>
        <Field label="Release channel">
          <div className="flex gap-2">
            {(["stable", "preview"] as ReleaseChannel[]).map((v) => (
              <button
                key={v}
                onClick={() => setReleaseChannel(v)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  releaseChannel === v
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200"
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">
            {releaseChannel === "stable" ? "Stable builds, predictable updates." : "New releases sooner as access expands."}
          </p>
        </Field>
      </Section>

      {/* ── Security ─────────────────────────────────────────────── */}
      <Section title="Security" description="Sign-in method and credential management.">
        <Field label="Sign-in method">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-neutral-300">
              {sessionState.signInMethod}
            </span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
              Active
            </span>
          </div>
        </Field>

        {sessionState.signInMethod === "Email" && (
          <>
            <Field label="Current password">
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                disabled={changingPw}
                className={input}
              />
            </Field>
            <Field label="New password">
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                disabled={changingPw}
                className={input}
              />
            </Field>
            {pwMsg && <Alert tone={pwMsg.tone} text={pwMsg.text} />}
            <div>
              <button
                onClick={() => void changePassword()}
                disabled={changingPw || !currentPw || !newPw}
                className={primaryBtn}
              >
                {changingPw ? "Updating…" : "Update password"}
              </button>
            </div>
          </>
        )}
      </Section>

      {/* ── Danger Zone ──────────────────────────────────────────── */}
      <section id="danger" className="py-8">
        <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.04] p-5">
          <div className="text-xs font-medium uppercase tracking-widest text-rose-400">
            Danger Zone
          </div>
          <h3 className="mt-2 text-sm font-semibold text-white">Delete account</h3>
          <p className="mt-1 text-xs text-neutral-400">
            Permanently removes your profile, API keys, and all preferences. Cannot be undone.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs text-neutral-400">
                Type <span className="font-mono text-rose-400">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                disabled={deleting}
                className="w-full rounded-lg border border-rose-400/20 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-rose-400/40"
              />
            </div>
            {deleteMsg && <Alert tone={deleteMsg.tone} text={deleteMsg.text} />}
            <button
              onClick={() => void deleteAccount()}
              disabled={deleting || deleteConfirm !== "DELETE"}
              className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

const input =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-white/20";

const primaryBtn =
  "VRAELIS-white-button rounded-lg border border-white/10 bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 py-8 lg:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-sm font-medium text-white">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-neutral-300">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

function Alert({ tone, text }: { tone: Tone; text: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${statusClass(tone)}`}>
      {text}
    </div>
  );
}
