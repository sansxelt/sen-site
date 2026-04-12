"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiKeyRecord } from "../../../lib/api-keys";

type KeyWithRaw = ApiKeyRecord & { rawKey?: string };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function KeysPanel({ initialKeys }: { initialKeys: ApiKeyRecord[] }) {
  const [keys, setKeys] = useState<KeyWithRaw[]>(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newlyCreated, setNewlyCreated] = useState<KeyWithRaw | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the name input when the create form mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setCreateError(null);

      const name = newKeyName.trim();
      if (!name) {
        setCreateError("Enter a name for this key.");
        return;
      }

      setCreating(true);

      try {
        const res = await fetch("/api/account/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });

        const json = (await res.json()) as {
          key?: ApiKeyRecord;
          rawKey?: string;
          error?: string;
        };

        if (!res.ok || !json.key) {
          setCreateError(json.error ?? "Failed to create key.");
          return;
        }

        const created: KeyWithRaw = { ...json.key, rawKey: json.rawKey };
        setKeys((prev) => [created, ...prev]);
        setNewlyCreated(created);
        setNewKeyName("");
      } catch {
        setCreateError("Something went wrong. Please try again.");
      } finally {
        setCreating(false);
      }
    },
    [newKeyName],
  );

  const handleRevoke = useCallback(async (id: string) => {
    setRevoking(id);
    try {
      const res = await fetch(`/api/account/keys/${id}`, { method: "DELETE" });

      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        if (newlyCreated?.id === id) setNewlyCreated(null);
      }
    } catch {
      // Silently ignore — user can retry
    } finally {
      setRevoking(null);
    }
  }, [newlyCreated]);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      // Clipboard not available
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Newly created key banner */}
      {newlyCreated?.rawKey && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-300">
            Save this key — it won&apos;t be shown again.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-xs text-neutral-100">
              {newlyCreated.rawKey}
            </code>
            <button
              onClick={() => handleCopy(newlyCreated.rawKey!)}
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-200 transition hover:bg-white/10"
            >
              {copyDone ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setNewlyCreated(null)}
            className="mt-3 text-xs text-amber-400 underline-offset-2 hover:underline"
          >
            I&apos;ve saved it, dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex items-start gap-3">
        <div className="flex-1">
          <input
            ref={inputRef}
            type="text"
            value={newKeyName}
            onChange={(e) => {
              setNewKeyName(e.target.value);
              setCreateError(null);
            }}
            placeholder="Key name (e.g. Desktop, CI)"
            maxLength={64}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-white/20 focus:ring-0"
          />
          {createError && (
            <p className="mt-1.5 text-xs text-red-400">{createError}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-xl border border-white/10 bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create key"}
        </button>
      </form>

      {/* Keys table */}
      {keys.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No API keys yet. Create one above to get started.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-left text-xs text-neutral-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Created</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {keys.map((key) => (
                <tr key={key.id} className="bg-white/[0.01] transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-neutral-100">
                    {key.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-400">
                    {key.key_prefix}
                  </td>
                  <td className="hidden px-4 py-3 text-neutral-400 sm:table-cell">
                    {formatDate(key.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRevoke(key.id)}
                      disabled={revoking === key.id}
                      className="text-xs text-red-400 transition hover:text-red-300 disabled:opacity-50"
                    >
                      {revoking === key.id ? "Revoking…" : "Revoke"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
