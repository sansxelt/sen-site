"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ATTACHMENT_TEXT_CAP,
  classifyFile,
  detectIntent,
  makeAttachmentId,
  type LeiAttachment,
  type LeiPanel,
  type VoiceModeStyle,
} from "@/lib/lei";
import { LeiPanelStage } from "./lei-panels";
import { ChatHistoryRail } from "./chat-history-rail";

type LeiCtx = {
  attachments: LeiAttachment[];
  addFiles: (files: FileList | File[]) => Promise<void>;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  panel: LeiPanel;
  setPanel: (p: LeiPanel) => void;
  voiceStyle: VoiceModeStyle;
  setVoiceStyle: (s: VoiceModeStyle) => void;
  creditBalance: number | null;
  refreshBalance: () => Promise<void>;
  noteIntentFromText: (text: string) => void;
};

const LeiContext = createContext<LeiCtx | null>(null);

export function useLei(): LeiCtx {
  const ctx = useContext(LeiContext);
  if (!ctx) throw new Error("useLei must be used inside <LeiShell>");
  return ctx;
}

export function LeiShell({ children }: { children: ReactNode }) {
  const [attachments, setAttachments] = useState<LeiAttachment[]>([]);
  const [panel, setPanelState] = useState<LeiPanel>({ kind: "none" });
  const [voiceStyle, setVoiceStyleState] = useState<VoiceModeStyle>("v2t");
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  // Restore voice style preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("vraelis.lei.voiceStyle");
    if (saved === "v2v" || saved === "v2t") setVoiceStyleState(saved);
  }, []);

  const setVoiceStyle = useCallback((s: VoiceModeStyle) => {
    setVoiceStyleState(s);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vraelis.lei.voiceStyle", s);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/credits/balance", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { balance?: number };
      if (typeof data.balance === "number") setCreditBalance(data.balance);
    } catch {
      // network jitter, leave previous value
    }
  }, []);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  const setPanel = useCallback((p: LeiPanel) => setPanelState(p), []);

  const noteIntentFromText = useCallback((text: string) => {
    const intent = detectIntent(text);
    if (intent) setPanelState(intent);
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    const built: LeiAttachment[] = [];
    for (const file of arr) {
      const kind = classifyFile(file);
      const att: LeiAttachment = {
        id: makeAttachmentId(),
        kind,
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
      };
      if (kind === "image" || kind === "video") {
        att.previewUrl = URL.createObjectURL(file);
      } else {
        try {
          const text = await file.text();
          att.text = text.slice(0, ATTACHMENT_TEXT_CAP);
        } catch {
          att.text = "";
        }
      }
      built.push(att);
    }
    setAttachments((prev) => [...prev, ...built]);
    // Morph to the most recent attachment's panel
    const last = built[built.length - 1];
    if (last) {
      if (last.kind === "image") setPanelState({ kind: "image", attachmentId: last.id });
      else if (last.kind === "video") setPanelState({ kind: "video", attachmentId: last.id });
      else if (last.kind === "code") setPanelState({ kind: "code", source: last.text ?? "", language: hintLang(last.name) });
      else setPanelState({ kind: "file", attachmentId: last.id });
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const dropped = prev.find((a) => a.id === id);
      if (dropped?.previewUrl) URL.revokeObjectURL(dropped.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
    setPanelState((p) =>
      "attachmentId" in p && p.attachmentId === id ? { kind: "none" } : p,
    );
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
      return [];
    });
    setPanelState({ kind: "none" });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Page-level drag overlay
  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current += 1;
    setDragging(true);
  }, []);
  const onDragLeave = useCallback(() => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (hasFiles(e)) e.preventDefault();
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      void addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const value = useMemo<LeiCtx>(
    () => ({
      attachments,
      addFiles,
      removeAttachment,
      clearAttachments,
      panel,
      setPanel,
      voiceStyle,
      setVoiceStyle,
      creditBalance,
      refreshBalance,
      noteIntentFromText,
    }),
    [
      attachments,
      addFiles,
      removeAttachment,
      clearAttachments,
      panel,
      setPanel,
      voiceStyle,
      setVoiceStyle,
      creditBalance,
      refreshBalance,
      noteIntentFromText,
    ],
  );

  return (
    <LeiContext.Provider value={value}>
      {/* lei-shell--split keeps the LEI panel slot reserved when an
          attachment panel is active. lei-shell--with-history keeps
          the chat history rail slot reserved otherwise. They share
          the same right-side column, never both at once visually,
          but BOTH stay mounted (toggled with hidden) so the inactive
          one's scroll position and in-flight state survive the swap.
          On mobile the unmounting was reading as "things disappear"
          when the user opened/closed an attachment panel. */}
      <div
        className={`lei-shell${panel.kind !== "none" ? " lei-shell--split" : " lei-shell--with-history"}`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div className="lei-shell-main">{children}</div>
        <aside className="lei-shell-panel" hidden={panel.kind === "none"}>
          {panel.kind !== "none" && (
            <LeiPanelStage panel={panel} attachments={attachments} onClose={() => setPanelState({ kind: "none" })} />
          )}
        </aside>
        <div hidden={panel.kind !== "none"}>
          <ChatHistoryRail panelOpen={false} />
        </div>

        {dragging && <DropOverlay />}
      </div>
    </LeiContext.Provider>
  );
}

function DropOverlay() {
  return (
    <div className="lei-drop-overlay" aria-hidden="true">
      <div className="lei-drop-card">
        <div className="lei-drop-mark">⤓</div>
        <div className="lei-drop-title">Drop to react</div>
        <div className="lei-drop-sub">
          Image · Video · File · Code, vraelis-1 morphs the UI to fit
        </div>
        <div className="lei-drop-row">
          <span className="lei-drop-chip">🖼 Image → analysis</span>
          <span className="lei-drop-chip">🎬 Video → timeline</span>
          <span className="lei-drop-chip">📄 File → breakdown</span>
        </div>
      </div>
    </div>
  );
}

function hasFiles(e: React.DragEvent): boolean {
  const dt = e.dataTransfer;
  if (!dt) return false;
  for (let i = 0; i < dt.types.length; i++) {
    if (dt.types[i] === "Files") return true;
  }
  return false;
}

function hintLang(name: string): string | undefined {
  const m = /\.(\w+)$/.exec(name);
  return m?.[1]?.toLowerCase();
}
