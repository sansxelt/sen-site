// Typed error for non-2xx Vraelis API responses. Parses the standard error
// envelope: { "error": { "code", "message", "request_id" } }.

export class VraelisAPIError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  /**
   * The full parsed response body, or null when it was not JSON. Some refusals carry more than the
   * envelope: `plan_requires_human` includes `approve_url`, and `claim_not_provable` includes
   * `requirements`, `remaining_obligations` and `repair_prompt`.
   */
  readonly body: unknown;

  constructor(status: number, code: string, message: string, requestId?: string, body: unknown = null) {
    super(message);
    this.name = "VraelisAPIError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.body = body;
    // Restore prototype chain for instanceof across transpile targets.
    Object.setPrototypeOf(this, VraelisAPIError.prototype);
  }

  static fromResponse(status: number, json: unknown, raw?: string): VraelisAPIError {
    const err = (json as { error?: { code?: string; message?: string; request_id?: string } } | null)?.error;
    if (err && typeof err === "object") {
      return new VraelisAPIError(status, err.code ?? "error", err.message ?? raw ?? "Request failed", err.request_id, json);
    }
    const msg = (raw && raw.slice(0, 200)) || `Request failed with status ${status}`;
    return new VraelisAPIError(status, "error", msg, undefined, json);
  }
}
