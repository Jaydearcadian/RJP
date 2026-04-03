// Protocol Object Types for RJP

export type Address = `0x${string}`;

// ============ Domain Types ============

export interface DomainSpec {
  schema_version: "rjp.domain_spec.v1";
  domain_id: string;
  version: string;
  status: "draft" | "active" | "deprecated";
  name: string;
  summary: string;
  subject_scope: {
    subject_type: string;
    allowed_subject_networks: string[];
  };
  target_scope: {
    target_type: string;
    target_network: string;
    target_contracts: string[];
    target_protocols: string[];
    target_context_keys: string[];
  };
  window_policy: {
    mode: "rolling" | "fixed";
    default_window_blocks: number;
    max_window_blocks: number;
    freshness_window_blocks: number;
  };
  judgment_outcomes: string[];
  evidence_policy: {
    policy_id: string;
    admissible_item_kinds: string[];
    selection_rule: string;
    ordering_rule: string;
    canonicalization_rule: string;
  };
  evaluation_spec: {
    evaluation_spec_id: string;
    claim_type: string;
    rubric_summary: string;
    required_features: string[];
    output_payload_fields: string[];
  };
  model_policy: {
    mode: "llm" | "deterministic";
    model_family?: string;
    output_schema_version?: string;
    confidence_tolerance_ppm?: number;
  };
  equivalence_profile: {
    profile_id: string;
    outcome_match_required: boolean;
    confidence_tolerance_ppm: number;
    payload_hash_required: boolean;
  };
  revision_policy: {
    revision_policy_id: string;
    parent_link_required: boolean;
    supersedes_prior: boolean;
    recency_basis: string;
  };
  policy_hashes: Record<string, string>;
}

// ============ Case Object Types ============

export interface CaseObject {
  schema_version: "rjp.case_object.v1";
  case_id: string;
  domain_id: string;
  subject_scope: {
    subject_type: "wallet";
    subject_id: Address;
    subject_network: string;
    subject_chain_id: number;
  };
  target_scope: {
    target_type: string;
    target_contract: Address;
    target_protocol: string;
    target_context: Record<string, string>;
    target_network: string;
    target_chain_id: number;
  };
  claim_scope: {
    claim_type: string;
    claim_version: string;
  };
  window_spec: {
    window_mode: "rolling" | "fixed";
    start_block: number;
    end_block: number;
    source_network: string;
    source_chain_id: number;
    source_label: string;
    start_block_hash: string;
    end_block_hash: string;
  };
  evidence_manifest: {
    manifest_version: string;
    manifest_root: string;
    item_count: number;
    item_kind: string;
  };
  extractor_metadata: {
    extractor_version: string;
    extractor_hash: string;
  };
  case_hash: string;
  evidence_anchor: string;
}

// ============ Assessment Artifact Types ============

export interface AssessmentArtifact {
  schema_version: "rjp.assessment_artifact.v1";
  assessment_hash: string;
  revision: number;
  domain_id: string;
  case_id: string;
  subject_id: Address;
  evidence_sequence: number;
  domain_spec_hash: string;
  evaluation_spec_hash: string;
  model_policy_hash: string;
  parent_revision_hash: string | null;
  evidence_root: string;
  outcome_enum: "SAFE" | "CAUTION" | "UNSAFE" | "INSUFFICIENT_DATA";
  confidence_ppm: number;
  outcome_payload: Record<string, unknown>;
  outcome_payload_hash: string;
  evaluated_at: string; // ISO timestamp
}

// ============ Judgment Object Types ============

export interface JudgmentObject {
  schema_version: "rjp.judgment_object.v1";
  subject_id: Address;
  domain_id: string;
  case_id: string;
  assessment_hash: string;
  outcome_enum: "SAFE" | "CAUTION" | "UNSAFE" | "INSUFFICIENT_DATA";
  confidence_ppm: number;
  revision: number;
  finalized_at: string; // ISO timestamp
  valid_until: {
    basis: "source_block" | "timestamp";
    source_network: string;
    source_chain_id: number;
    source_block: number;
  };
}

// ============ API Response Types ============

export interface BuildCaseResponse {
  subject_id: Address;
  network: string;
  current_block: number;
  window: {
    start_block: number;
    end_block: number;
  };
  case: CaseObject;
  case_payload: CaseObject;
  submission_case: CaseObject;
  verification: {
    ok?: boolean;
    checks?: Record<string, boolean>;
    recomputed?: Record<string, unknown>;
  };
}

export interface EvidenceSummaryResponse {
  case: CaseObject;
  case_payload: CaseObject;
  submission_case: CaseObject;
  verification: {
    ok?: boolean;
    checks?: Record<string, boolean>;
    recomputed?: Record<string, unknown>;
  };
  summary: Record<string, unknown>;
}

export interface JudgmentResponse {
  subject_id: Address;
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
  domain_interpretation: DomainInterpretation;
}

export interface DomainInterpretation {
  domain_id: string;
  claim_type: string;
  case_id: string;
  summary: string;
  domain_family: string;
  consumer_question: string;
  subject_kind: string;
  target_kind: string;
  interpretation_kind: string;
  domain_outcome_meaning: Record<string, string>;
  consumer_focus: string[];
  risk_signal_interpretation: string;
  hot_path_read: {
    primary_field: string;
    allow_when: string;
    review_when: string;
    deny_when: string;
  };
}

export interface HandshakePreviewResponse {
  subject_id: Address;
  action_type: string;
  handshake: {
    state: "SAFE" | "CAUTION" | "UNSAFE" | "STALE" | "NO_JUDGMENT" | "INSUFFICIENT_DATA";
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
  };
  domain_interpretation: DomainInterpretation;
}

export interface MirrorJudgmentResponse {
  subjectId: string;
  domainId: string;
  caseId: string;
  claimType: string;
  revision: string;
  outcome: string;
  confidencePpm: string;
  freshnessWindowBlocks: string;
  validUntilSourceBlock: string;
  assessmentHash: string;
  caseHash: string;
  evidenceAnchorHash: string;
  sourceNetwork: string;
  sourceChainId: string;
  riskFlagsJson: string;
  summary: string;
  publishedAt: string;
}

// ============ Current Block Response ============

export interface CurrentBlockResponse {
  network: string;
  current_block: number;
}

// ============ Domain Config ============

export interface DomainConfig {
  id: string;
  label: string;
  tagline: string;
  actionType: string;
  defaultRelativeSize: number;
  recommendedWindowLabel: string;
}

export const DOMAIN_OPTIONS: Record<string, DomainConfig> = {
  "counterparty_trust.base_trade_v1": {
    id: "counterparty_trust.base_trade_v1",
    label: "Counterparty Trust",
    tagline: "Judge whether a wallet is safe to trade with.",
    actionType: "trade",
    defaultRelativeSize: 1000,
    recommendedWindowLabel: "Previous 1,000 blocks to current",
  },
  "protocol_safety.base_erc20_permission_v1": {
    id: "protocol_safety.base_erc20_permission_v1",
    label: "Protocol Safety",
    tagline: "Judge whether ERC-20 approval posture is safe.",
    actionType: "approve",
    defaultRelativeSize: 100,
    recommendedWindowLabel: "Previous 100 blocks to current",
  },
};

// ============ Demo Subjects ============

export interface DemoSubject {
  label: string;
  subject: Address;
  domainId: string;
  actionType: string;
  note: string;
}

export const DEMO_SUBJECTS: DemoSubject[] = [
  {
    label: "Clean Trade Subject",
    subject: "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001",
    domainId: "counterparty_trust.base_trade_v1",
    actionType: "trade",
    note: "Primary clean counterparty benchmark path.",
  },
  {
    label: "Risky Trade Subject",
    subject: "0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c",
    domainId: "counterparty_trust.base_trade_v1",
    actionType: "trade",
    note: "Primary risky counterparty benchmark path.",
  },
  {
    label: "Permission Safety Subject",
    subject: "0x0000000000000000000000000000000000000b0b",
    domainId: "protocol_safety.base_erc20_permission_v1",
    actionType: "approve",
    note: "Dedicated live second-domain subject.",
  },
];

// ============ Live Contract Addresses ============

export const LIVE_CONTRACTS = {
  genlayer: {
    rjp: "0x4a099B06141Ca3464318c28C4D2884B85d070D4f" as Address,
  },
  baseSepolia: {
    mirror: "0x34EBfd4FcC379b14Cdd602485417a5C088228606" as Address,
    agentDemo: "0x60381D4088B7B2C985B248CE8B64287c13b71434" as Address,
    directDemo: "0x90db5f049c98f3fd510d866cb3386e50287b8ade" as Address,
  },
};
