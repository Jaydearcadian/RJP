export type MirrorJudgment = {
  subject_id: string;
  domain_id: string;
  revision: number;
  outcome: string;
  confidence_ppm: number;
  freshness_window_blocks: number;
  valid_until_source_block: number;
  assessment_hash: string;
  case_hash: string;
  evidence_anchor_hash: string;
  source_network: string;
  source_chain_id: number;
  risk_flags: string[] | string;
  summary: string;
  published_at: number;
};

export type HandshakePreview = {
  subject_id: string;
  action_type: string;
  state: string;
  recommended_action: string;
  reason_code: string;
  reason: string;
  allowed: boolean;
  outcome: string;
  revision: number;
  valid_until_source_block: number;
  freshness_window_blocks: number;
  summary: string;
};

export type EvidenceSummaryRequest = {
  subject: string;
  case_file?: string;
  network?: string;
  window_mode?: "relative" | "custom";
  relative_size?: number;
  current_block?: number;
  start_block?: number;
  end_block?: number;
  domain_id?: string;
  claim_type?: string;
  target_contract?: string;
  target_protocol?: string;
};

export type EvidenceSummary = {
  subject_id: string;
  domain_id: string;
  case_id: string;
  claim_type: string;
  source_network: string;
  source_chain_id: number;
  observed_from_block: number;
  observed_to_block: number;
  target_type: string;
  target_contract: string;
  target_protocol: string;
  target_context: Record<string, unknown>;
  feature_summary: Record<string, number>;
  evidence_root: string;
  evidence_manifest_hash: string;
  evidence_manifest_item_count: number;
  evidence_anchor: string;
  verification_ok: boolean;
  verification: Record<string, unknown>;
  notes: string;
};

export class RjpClient {
  constructor(
    private readonly apiUrl = process.env.RJP_API_URL || "http://127.0.0.1:4174",
    private readonly defaultActionType = process.env.RJP_DEFAULT_ACTION_TYPE || "trade",
  ) {}

  async getMirrorJudgment(subjectId: string): Promise<MirrorJudgment> {
    const url = new URL("/mirror-judgment", this.apiUrl);
    url.searchParams.set("subject", subjectId);
    if (process.env.RJP_BASE_MIRROR_ADDRESS) {
      url.searchParams.set("mirror_address", process.env.RJP_BASE_MIRROR_ADDRESS);
    }
    return this.fetchJson<MirrorJudgment>(url);
  }

  async getHandshakePreview(
    subjectId: string,
    actionType = this.defaultActionType,
  ): Promise<HandshakePreview> {
    const url = new URL("/handshake-preview", this.apiUrl);
    url.searchParams.set("subject", subjectId);
    url.searchParams.set("action_type", actionType);
    if (process.env.RJP_BASE_AGENT_DEMO_ADDRESS) {
      url.searchParams.set("demo_address", process.env.RJP_BASE_AGENT_DEMO_ADDRESS);
    }
    return this.fetchJson<HandshakePreview>(url);
  }

  async getEvidenceSummary(request: EvidenceSummaryRequest): Promise<EvidenceSummary> {
    const url = new URL("/evidence-summary", this.apiUrl);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`RJP API ${response.status}: ${body}`);
    }
    const payload = (await response.json()) as { summary: EvidenceSummary };
    return payload.summary;
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`RJP API ${response.status}: ${body}`);
    }
    return (await response.json()) as T;
  }
}
