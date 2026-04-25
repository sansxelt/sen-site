"use client";

import { useState } from "react";
import type { LeiAttachment, LeiPanel } from "@/lib/lei";

export function LeiPanelStage({
  panel,
  attachments,
  onClose,
}: {
  panel: LeiPanel;
  attachments: LeiAttachment[];
  onClose: () => void;
}) {
  if (panel.kind === "none") return null;

  let title = "Panel";
  let body: React.ReactNode = null;

  if (panel.kind === "image") {
    const att = attachments.find((a) => a.id === panel.attachmentId);
    title = att ? `Image · ${att.name}` : "Image";
    body = att ? <ImagePanelBody attachment={att} /> : <PanelEmpty />;
  } else if (panel.kind === "video") {
    const att = attachments.find((a) => a.id === panel.attachmentId);
    title = att ? `Video · ${att.name}` : "Video";
    body = att ? <VideoPanelBody attachment={att} /> : <PanelEmpty />;
  } else if (panel.kind === "file") {
    const att = attachments.find((a) => a.id === panel.attachmentId);
    title = att ? `File · ${att.name}` : "File";
    body = att ? <FilePanelBody attachment={att} /> : <PanelEmpty />;
  } else if (panel.kind === "code") {
    title = panel.language ? `Code · ${panel.language}` : "Code";
    body = <CodePanelBody source={panel.source} language={panel.language} />;
  } else if (panel.kind === "timeline") {
    title = "Video timeline";
    body = <TimelinePanelBody topic={panel.topic} />;
  }

  return (
    <div className="lei-panel">
      <div className="lei-panel-head">
        <div className="lei-panel-title">{title}</div>
        <button
          type="button"
          onClick={onClose}
          className="lei-panel-x"
          aria-label="Close panel"
          title="Close"
        >
          ✕
        </button>
      </div>
      <div className="lei-panel-body">{body}</div>
    </div>
  );
}

function PanelEmpty() {
  return <div className="lei-panel-empty">Attachment removed.</div>;
}

function ImagePanelBody({ attachment }: { attachment: LeiAttachment }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const analyze = async () => {
    if (!attachment.previewUrl) return;
    setLoading(true);
    setErr(null);
    try {
      const blob = await fetch(attachment.previewUrl).then((r) => r.blob());
      const dataUrl = await blobToDataUrl(blob);
      const res = await fetch("/api/ai/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_data_url: dataUrl,
          mime: attachment.mime,
          prompt: "Describe what you see and call out anything notable.",
        }),
      });
      if (!res.ok) throw new Error(`vision ${res.status}`);
      const data = (await res.json()) as { text?: string };
      setAnalysis(data.text ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {attachment.previewUrl && (
        <div className="lei-image-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.previewUrl} alt={attachment.name} />
        </div>
      )}
      <div className="lei-meta">
        <span>{prettySize(attachment.size)}</span>
        <span>{attachment.mime}</span>
      </div>
      <div className="lei-actions">
        <button
          type="button"
          onClick={() => void analyze()}
          disabled={loading}
          className="lei-btn lei-btn--primary"
        >
          {loading ? "Analyzing…" : "Analyze image"}
        </button>
        <button
          type="button"
          onClick={() => void copyToClipboard(attachment.name)}
          className="lei-btn"
        >
          Copy filename
        </button>
      </div>
      {err && <div className="lei-error">{err}</div>}
      {analysis && (
        <div className="lei-analysis">
          <div className="lei-analysis-label">Analysis</div>
          <div className="lei-analysis-body">{analysis}</div>
        </div>
      )}
    </>
  );
}

function VideoPanelBody({ attachment }: { attachment: LeiAttachment }) {
  return (
    <>
      {attachment.previewUrl && (
        <div className="lei-video-frame">
          <video src={attachment.previewUrl} controls />
        </div>
      )}
      <div className="lei-meta">
        <span>{prettySize(attachment.size)}</span>
        <span>{attachment.mime}</span>
      </div>
      <div className="lei-timeline">
        <div className="lei-timeline-track">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="lei-timeline-tick" style={{ height: `${30 + Math.abs(Math.sin(i)) * 40}%` }} />
          ))}
        </div>
        <div className="lei-timeline-foot">
          Visual scrub preview · clip & re-render coming soon
        </div>
      </div>
      <div className="lei-actions">
        <button type="button" disabled className="lei-btn" title="Coming soon">
          Trim & export (soon)
        </button>
        <button type="button" disabled className="lei-btn" title="Coming soon">
          Generate captions (soon)
        </button>
      </div>
    </>
  );
}

function FilePanelBody({ attachment }: { attachment: LeiAttachment }) {
  const text = attachment.text ?? "";
  const lines = text ? text.split(/\r?\n/).length : 0;
  const words = text ? text.trim().split(/\s+/).length : 0;
  return (
    <>
      <div className="lei-file-stat">
        <div><strong>{lines.toLocaleString()}</strong> lines</div>
        <div><strong>{words.toLocaleString()}</strong> words</div>
        <div><strong>{prettySize(attachment.size)}</strong></div>
      </div>
      <div className="lei-actions">
        <button
          type="button"
          onClick={() => void copyToClipboard(text)}
          className="lei-btn"
          disabled={!text}
        >
          Copy contents
        </button>
      </div>
      <pre className="lei-file-preview">
        {text ? text.slice(0, 4000) : "No text content extracted."}
        {text.length > 4000 ? "\n\n…(truncated)" : ""}
      </pre>
    </>
  );
}

function CodePanelBody({ source, language }: { source: string; language?: string }) {
  return (
    <>
      <div className="lei-meta">
        <span>{language ?? "code"}</span>
        <span>{source.split(/\r?\n/).length} lines</span>
      </div>
      <pre className="lei-file-preview lei-file-preview--code">{source}</pre>
    </>
  );
}

function TimelinePanelBody({ topic }: { topic: string }) {
  return (
    <>
      <div className="lei-meta">
        <span>Detected: video intent</span>
      </div>
      <div className="lei-timeline">
        <div className="lei-timeline-track">
          {Array.from({ length: 32 }).map((_, i) => (
            <span key={i} className="lei-timeline-tick" style={{ height: `${20 + ((i * 37) % 80)}%` }} />
          ))}
        </div>
        <div className="lei-timeline-foot">Suggested edit timeline for: {topic}</div>
      </div>
      <div className="lei-actions">
        <button type="button" disabled className="lei-btn">Generate clip (soon)</button>
      </div>
    </>
  );
}

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

