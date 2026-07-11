"use client";

import { useState } from "react";
import { AttachmentPreview, type PreviewTarget } from "../attachment-preview";
import type { AttachmentEvidence } from "@/lib/v-evidence";
import { CAPABILITY_LABEL, evidenceChipLabel, groupReportSources, evidenceForSource, type ReportAttachment, type Capability } from "@/lib/v-check-ui";

export type { ReportAttachment } from "@/lib/v-check-ui";

// ANALYSIS SOURCES + validated evidence viewer for the completed report. Shows what was ACTUALLY
// evaluated, using the persisted final capabilities (never a guess from MIME type), and surfaces only
// evidence that already passed lib/v-evidence.ts validation. Every preview fetches a fresh owner-checked
// signed URL at click time (see AttachmentPreview); no storage path or signed URL is ever in this props
// tree. Evidence chips are rendered under the exact source they reference, so a Version A citation can
// never appear under Version B, and Supporting context is always labeled as such.

export type ReportCapability = { attachment_id: string; capability: Capability };

const kicker = { fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" } as const;
const box = { border: "1px solid var(--line-1)", borderRadius: "var(--r-lg)", background: "var(--bg-1)" } as const;

export function AnalysisSources({ sources, capabilities, evidence }: {
  sources: ReportAttachment[]; capabilities: ReportCapability[]; evidence: AttachmentEvidence[];
}) {
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  if (!sources.length) return null;

  const capOf = new Map(capabilities.map((c) => [c.attachment_id, c.capability]));
  const hasFallback = capabilities.some((c) => c.capability === "text_only_fallback");
  const groups = groupReportSources(sources);

  const open = (s: ReportAttachment, groupTitle: string, shotNo: number, page?: number) =>
    setPreview({ id: s.id, filename: s.filename, kind: s.kind, page, sourceLabel: `${groupTitle === "Supporting context" ? "Context" : groupTitle}${s.kind === "image" ? ` · Screenshot ${shotNo}` : ""}` });

  return (
    <div style={{ ...box, padding: "clamp(16px, 2.4vw, 22px)", marginBottom: 18 }}>
      <div style={{ ...kicker, marginBottom: 4 }}>Analysis sources</div>
      <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 12px", lineHeight: 1.5 }}>What each version and reference was actually evaluated as. Open any file to see the exact source.</p>

      {hasFallback ? (
        <div role="note" style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--err)", background: "var(--bg-2)", marginBottom: 14 }}>
          <span aria-hidden style={{ color: "var(--err)", fontWeight: 700, flex: "none" }}>!</span>
          <p style={{ fontSize: 12.5, color: "var(--fg-2)", margin: 0, lineHeight: 1.5 }}>Visual document analysis was unavailable for a file. The result used extracted text only.</p>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 14 }}>
        {groups.map((g) => {
          let shot = 0;
          return (
            <div key={g.title}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13.5, color: "var(--fg-1)", marginBottom: 7 }}>{g.title}</div>
              <ul style={{ display: "grid", gap: 7, listStyle: "none", padding: 0, margin: 0 }}>
                {g.items.map((s) => {
                  const isImage = s.kind === "image";
                  const shotNo = isImage ? ++shot : 0;
                  const cap = capOf.get(s.id) ?? "failed";
                  const evs = evidenceForSource(evidence, s.id);
                  const name = isImage ? `Screenshot ${shotNo}` : s.filename;
                  return (
                    <li key={s.id} style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12.5, color: "var(--fg-1)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.filename}>
                          {isImage ? <><span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)", marginRight: 6 }}>{name}</span>{s.filename}</> : s.filename}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: cap === "failed" || cap === "text_only_fallback" ? "var(--err)" : "var(--acc-deep)" }}>— {CAPABILITY_LABEL[cap]}</span>
                        <button type="button" onClick={() => open(s, g.title, shotNo)} aria-label={`Preview ${name}`} style={{ ...miniBtn, marginLeft: "auto" }}>Preview</button>
                      </div>
                      {evs.length ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 2 }}>
                          {evs.map((e, i) => (
                            <button key={i} type="button" onClick={() => open(s, g.title, shotNo, e.page_start)} style={chip} aria-label={`Open evidence: ${evidenceChipLabel(e)}`}>
                              {evidenceChipLabel(e)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {preview ? <AttachmentPreview key={`${preview.id}:${preview.page ?? 0}`} target={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

const miniBtn = { border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-3)", borderRadius: 6, fontSize: 11.5, padding: "3px 9px", cursor: "pointer", fontFamily: "inherit", height: 26, flex: "none" } as const;
const chip = { border: "1px solid var(--acc-line)", background: "var(--acc-soft)", color: "var(--acc-deep)", borderRadius: 999, fontSize: 11, padding: "3px 10px", cursor: "pointer", fontFamily: "var(--font-mono)", letterSpacing: "0.02em" } as const;
