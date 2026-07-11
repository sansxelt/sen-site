// Vraelis Preflight run artifacts: a DEDICATED PRIVATE Supabase Storage bucket for browser-run evidence
// (screenshots, traces). This is the ONE authoritative bucket for preflight artifacts — it is never the AI
// Check attachment bucket, and there is NO fallback to it. Objects are private: no public URL is ever
// produced; reads go through a short-lived signed URL minted only after the route owner-checks the run + the
// artifact. Unlike the check bucket, this bucket is NOT auto-created: a missing bucket raises an explicit
// operator setup error, so evidence can never silently land in the wrong place. Service-role only (server).
import { randomBytes } from "node:crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";

export const PREFLIGHT_ARTIFACT_BUCKET = "vraelis-preflight-artifacts";

// Allowed evidence content types + a hard size cap. Anything else is rejected before upload.
const ARTIFACT_MIME = new Set(["image/png", "image/jpeg", "image/webp", "application/zip", "application/json", "text/plain"]);
const ARTIFACT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export class ArtifactBucketMissingError extends Error {
  constructor() {
    super(`preflight artifact bucket "${PREFLIGHT_ARTIFACT_BUCKET}" does not exist. Create it as a PRIVATE bucket before running preflight (see docs/preflight-activation.md). Evidence is never written to any other bucket.`);
    this.name = "ArtifactBucketMissingError";
  }
}

// A random, unguessable object path under the run. kind/ext are sanitized to a safe charset so a caller can
// never traverse or inject. Screenshots use kind "screenshot", ext "png".
export function artifactObjectPath(runId: string, kind: string, ext: string): string {
  const safeRun = String(runId).replace(/[^a-z0-9-]/gi, "").slice(0, 64) || "run";
  const safeKind = (kind || "artifact").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "artifact";
  const safeExt = (ext || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  return `runs/${safeRun}/${safeKind}-${randomBytes(16).toString("hex")}.${safeExt}`;
}

// Does the dedicated bucket exist? No auto-create — absence is an operator setup error, not a silent fallback.
export async function preflightArtifactBucketExists(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const { data, error } = await getSupabaseAdminClient().storage.getBucket(PREFLIGHT_ARTIFACT_BUCKET);
    return !error && !!data;
  } catch { return false; }
}

// Upload one artifact to the dedicated PRIVATE bucket. Validates MIME + size, refuses if the bucket is
// missing (ArtifactBucketMissingError), and never upserts (paths are random, so collisions are a bug worth
// surfacing). Returns the stored path (private; read via signedArtifactUrl only). Never returns a public URL.
export async function uploadPreflightArtifact(path: string, body: Buffer, contentType: string): Promise<string> {
  if (!ARTIFACT_MIME.has(contentType)) throw new Error(`unsupported_artifact_type: ${contentType}`);
  if (!body || body.length === 0) throw new Error("empty_artifact");
  if (body.length > ARTIFACT_MAX_BYTES) throw new Error(`artifact_too_large: ${body.length} > ${ARTIFACT_MAX_BYTES}`);
  if (!isDatabaseConfigured()) throw new Error("database_not_configured");
  if (!(await preflightArtifactBucketExists())) throw new ArtifactBucketMissingError();
  const { error } = await getSupabaseAdminClient().storage.from(PREFLIGHT_ARTIFACT_BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(`artifact_upload_failed: ${error.message}`);
  return path;
}

// Short-lived signed URL for reading a private artifact (default 120s). Signs from the DEDICATED bucket ONLY.
// Null on failure so a caller returns a 503 rather than exposing anything.
export async function signedArtifactUrl(path: string, ttlSeconds = 120): Promise<string | null> {
  if (!path || !isDatabaseConfigured()) return null;
  try {
    const { data, error } = await getSupabaseAdminClient().storage.from(PREFLIGHT_ARTIFACT_BUCKET).createSignedUrl(path, ttlSeconds);
    if (error) { console.error("signedArtifactUrl:", error.message); return null; }
    return data?.signedUrl ?? null;
  } catch { return null; }
}

// Remove artifact objects (used by run/app cleanup so no screenshots are left in storage). Best-effort.
export async function deletePreflightArtifacts(paths: string[]): Promise<void> {
  const clean = paths.filter(Boolean);
  if (!clean.length || !isDatabaseConfigured()) return;
  try { await getSupabaseAdminClient().storage.from(PREFLIGHT_ARTIFACT_BUCKET).remove(clean); } catch { /* best-effort */ }
}
