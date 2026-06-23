import { VraelisAPIError } from "./errors";
import { verifyWebhookSignature } from "./webhooks";
import type {
  CreateEvaluationInput,
  CreditsResult,
  EvaluationCreateResult,
  EvaluationExport,
  EvaluationResult,
  ExportTier,
} from "./types";

const DEFAULT_BASE_URL = "https://vraelis.com";

export interface VraelisOptions {
  /** Your API key (vr_live_…). Keep it server-side only. */
  apiKey: string;
  /** Override the API base URL (defaults to https://vraelis.com). */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to the global fetch; required on Node < 18). */
  fetch?: typeof fetch;
}

export class Vraelis {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly _fetch: typeof fetch;

  constructor(opts: VraelisOptions) {
    if (!opts || !opts.apiKey) throw new Error("Vraelis: `apiKey` is required.");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const f = opts.fetch ?? (globalThis as { fetch?: typeof fetch }).fetch;
    if (!f) throw new Error("Vraelis: no global fetch found. Pass `fetch` in options (Node < 18).");
    this._fetch = f;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { "X-Api-Key": this.apiKey, "Content-Type": "application/json" },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
    if (!res.ok) throw VraelisAPIError.fromResponse(res.status, json, text);
    return json as T;
  }

  private async requestText(method: string, path: string): Promise<string> {
    const res = await this._fetch(`${this.baseUrl}${path}`, { method, headers: { "X-Api-Key": this.apiKey } });
    const text = await res.text();
    if (!res.ok) {
      let json: unknown = null;
      try { json = JSON.parse(text); } catch { /* non-JSON */ }
      throw VraelisAPIError.fromResponse(res.status, json, text);
    }
    return text;
  }

  readonly evaluations = {
    /** Create + launch an evaluation. Pass `sandbox: true` to test without spending credits. */
    create: (input: CreateEvaluationInput): Promise<EvaluationCreateResult> => {
      const { options, ...rest } = input;
      const normalized = (options ?? []).map((o) => ({ image_url: o.image_url, text: o.text ?? o.label }));
      return this.request<EvaluationCreateResult>("POST", "/api/v1/tests", { ...rest, options: normalized });
    },
    /** Fetch an evaluation's status, results, and Decision Package v2. */
    get: (id: string): Promise<EvaluationResult> =>
      this.request<EvaluationResult>("GET", `/api/v1/tests/${encodeURIComponent(id)}`),
    /** Export the evaluation as JSON (with `decision_package`). Tiers: summary | standard | scale. */
    exportJson: (id: string, opts?: { tier?: ExportTier }): Promise<EvaluationExport> =>
      this.request<EvaluationExport>("GET", `/api/v1/tests/${encodeURIComponent(id)}/export?format=json${opts?.tier ? `&tier=${opts.tier}` : ""}`),
    /** Export the per-option breakdown as a CSV string. */
    exportCsv: (id: string): Promise<string> =>
      this.requestText("GET", `/api/v1/tests/${encodeURIComponent(id)}/export?format=csv`),
  };

  readonly credits = {
    /** Get the account's current credit balance. */
    get: (): Promise<CreditsResult> => this.request<CreditsResult>("GET", "/api/v1/credits"),
  };

  readonly webhooks = {
    /** Verify a webhook delivery's HMAC signature. See verifyWebhookSignature. */
    verifySignature: verifyWebhookSignature,
  };
}
