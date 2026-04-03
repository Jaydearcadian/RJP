// API client for RJP Python API and GenLayer integration

const getApiBase = (): string => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("rjp_api_base") || "/api";
  }
  return process.env.RJP_API_BASE || "http://127.0.0.1:4174";
};

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getApiBase();
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // ignore
  }

  if (!response.ok) {
    const errorData = data as { error?: string } | undefined;
    throw new ApiError(
      response.status,
      errorData?.error || `${response.status} ${response.statusText}`,
      data
    );
  }

  return data as T;
}

// ============ Health ============

export interface HealthResponse {
  ok: boolean;
  submit_enabled: boolean;
  default_network: string;
}

export async function getHealth(): Promise<HealthResponse> {
  return fetchApi("/health");
}

// ============ Current Block ============

export interface CurrentBlockResponse {
  network: string;
  current_block: number;
}

export async function getCurrentBlock(
  network: string = "base-sepolia"
): Promise<CurrentBlockResponse> {
  return fetchApi(`/current-block?network=${encodeURIComponent(network)}`);
}

// ============ Build Case ============

export interface BuildCaseRequest {
  subject: string;
  network?: string;
  domain_id?: string;
  window_mode?: "relative" | "custom";
  current_block?: number;
  start_block?: number;
  end_block?: number;
  relative_size?: number;
  rpc_url?: string;
  timeout?: number;
  block_batch_size?: number;
  receipt_batch_size?: number;
}

export interface BuildCaseResponse {
  subject_id: string;
  network: string;
  current_block: number;
  window: {
    start_block: number;
    end_block: number;
  };
  case: Record<string, unknown>;
  case_payload: Record<string, unknown>;
  submission_case: Record<string, unknown>;
  verification: {
    ok?: boolean;
    checks?: Record<string, boolean>;
    recomputed?: Record<string, unknown>;
  };
}

export async function buildCase(
  request: BuildCaseRequest
): Promise<BuildCaseResponse> {
  return fetchApi("/build-case", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============ Evidence Summary ============

export interface EvidenceSummaryRequest {
  subject: string;
  network?: string;
  domain_id?: string;
  window_mode?: "relative" | "custom";
  current_block?: number;
  start_block?: number;
  end_block?: number;
  relative_size?: number;
  block_batch_size?: number;
  receipt_batch_size?: number;
  timeout?: number;
}

export interface EvidenceSummaryResponse {
  case: Record<string, unknown>;
  case_payload: Record<string, unknown>;
  submission_case: Record<string, unknown>;
  verification: {
    ok?: boolean;
    checks?: Record<string, boolean>;
    recomputed?: Record<string, unknown>;
  };
  summary: Record<string, unknown>;
}

export async function getEvidenceSummary(
  request: EvidenceSummaryRequest
): Promise<EvidenceSummaryResponse> {
  return fetchApi("/evidence-summary", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============ Build and Evaluate ============

export interface BuildAndEvaluateRequest {
  subject: string;
  network?: string;
  domain_id?: string;
  window_mode?: "relative" | "custom";
  current_block?: number;
  start_block?: number;
  end_block?: number;
  relative_size?: number;
  block_batch_size?: number;
  receipt_batch_size?: number;
  timeout?: number;
}

export interface BuildAndEvaluateResponse {
  case: Record<string, unknown>;
  case_payload: Record<string, unknown>;
  submission_case: Record<string, unknown>;
  verification: {
    ok?: boolean;
    checks?: Record<string, boolean>;
    recomputed?: Record<string, unknown>;
  };
  evaluation: {
    submission_case?: Record<string, unknown>;
    submission_case_file?: string;
    result?: {
      subject_id: string;
      domain_id: string | null;
      case_id: string | null;
      submit_tx: string;
      evaluate_tx: string | null;
      judgment: Record<string, unknown> | null;
    };
  };
}

export async function buildAndEvaluate(
  request: BuildAndEvaluateRequest
): Promise<BuildAndEvaluateResponse> {
  return fetchApi("/build-and-evaluate", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============ Mirror Judgment ============

export interface MirrorJudgmentResponse {
  subject_id: string;
  domain_id: string;
  case_id: string;
  claim_type: string;
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
  risk_flags: string[];
  summary: string;
  published_at: number;
  domain_interpretation?: Record<string, unknown>;
}

export async function getMirrorJudgment(
  subject: string,
  mirrorAddress?: string
): Promise<MirrorJudgmentResponse> {
  const params = new URLSearchParams({ subject });
  if (mirrorAddress) {
    params.set("mirror_address", mirrorAddress);
  }
  return fetchApi(`/mirror-judgment?${params}`);
}

// ============ Latest Judgment (GenLayer) ============

export interface LatestJudgmentResponse {
  subject_id: string;
  domain_id: string;
  case_id: string;
  claim_type: string;
  outcome: string;
  outcome_enum: string;
  confidence_ppm: number;
  revision: number;
  freshness_window_blocks: number;
  valid_until_source_block: number;
  assessment_hash: string;
  case_hash: string;
  risk_flags: string[];
  summary: string;
  source_network: string;
  source_chain_id: number;
  start_block: number;
  end_block: number;
  domain_interpretation: Record<string, unknown>;
}

export async function getLatestJudgment(
  subject: string
): Promise<LatestJudgmentResponse> {
  return fetchApi(`/latest-judgment?subject=${encodeURIComponent(subject)}`);
}

// ============ Handshake Preview ============

export interface HandshakePreviewResponse {
  subject_id: string;
  action_type: string;
  state: string;
  recommended_action: string;
  reason_code: string;
  reason: string;
  allowed: boolean;
  case_id: string;
  claim_type: string;
  outcome: string;
  revision: number;
  valid_until_source_block: number;
  freshness_window_blocks: number;
  summary: string;
  domain_interpretation?: Record<string, unknown>;
}

export async function getHandshakePreview(
  subject: string,
  actionType: string = "trade",
  demoAddress?: string
): Promise<HandshakePreviewResponse> {
  const params = new URLSearchParams({ subject, action_type: actionType });
  if (demoAddress) {
    params.set("demo_address", demoAddress);
  }
  return fetchApi(`/handshake-preview?${params}`);
}

// ============ Publish to Base Mirror ============

export interface PublishMirrorRequest {
  case_payload: Record<string, unknown>;
  judgment: Record<string, unknown>;
}

export interface PublishMirrorResponse {
  ok: boolean;
  result?: {
    tx_hash?: string;
    subject_id?: string;
    mirror_address?: string;
  };
  error?: string;
}

export async function publishToBaseMirror(
  request: PublishMirrorRequest
): Promise<PublishMirrorResponse> {
  return fetchApi("/publish-mirror", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============ Set API Base ============

export function setApiBase(base: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("rjp_api_base", base);
  }
}

export { ApiError };
