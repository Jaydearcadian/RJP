import { type EvidenceSummaryRequest, RjpClient } from "../services/rjpClient.js";

type ProviderRuntime = {
  getSetting?: (key: string) => string | undefined;
};

type ProviderState = Record<string, unknown>;

const ADDRESS_RE = /0x[a-fA-F0-9]{40}/g;
const DOMAIN_RE = /\bdomain_id=([a-zA-Z0-9._:-]+)/i;
const NETWORK_RE = /\bnetwork=([a-zA-Z0-9._:-]+)/i;
const START_BLOCK_RE = /\bstart_block=([0-9]+)/i;
const END_BLOCK_RE = /\bend_block=([0-9]+)/i;
const CASE_FILE_RE = /\bcase_file=([^\s]+)/i;

function extractAddressFromMessage(message: unknown): string | undefined {
  const text =
    typeof (message as { content?: { text?: string } })?.content?.text === "string"
      ? (message as { content?: { text?: string } }).content!.text
      : "";
  const match = text.match(ADDRESS_RE);
  return match?.[0];
}

type Provider = {
  name: string;
  description: string;
  get: (
    runtime: ProviderRuntime,
    message: unknown,
    state?: ProviderState,
  ) => Promise<{ text: string }>;
};

type DecisionGuidance = {
  evidence_decision_hint: "ALLOW" | "DENY" | "REFRESH";
  primary_reason_code: string;
  rules: string[];
};

function getStateString(state: ProviderState | undefined, key: string): string | undefined {
  const value = state?.[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function getStateNumber(state: ProviderState | undefined, key: string): number | undefined {
  const value = state?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function inferSubjectId(
  runtime: ProviderRuntime,
  message: unknown,
  state?: ProviderState,
): string | undefined {
  const fromState = getStateString(state, "counterpartyAddress") || getStateString(state, "subjectId");
  if (fromState) {
    return fromState;
  }
  const fromMessage = extractAddressFromMessage(message);
  if (fromMessage) {
    return fromMessage;
  }
  const fromRuntime = runtime.getSetting?.("RJP_DEFAULT_SUBJECT_ID");
  if (typeof fromRuntime === "string" && fromRuntime.trim()) {
    return fromRuntime.trim();
  }
  if (process.env.RJP_DEFAULT_SUBJECT_ID?.trim()) {
    return process.env.RJP_DEFAULT_SUBJECT_ID.trim();
  }
  return undefined;
}

function extractText(message: unknown): string {
  return typeof (message as { content?: { text?: string } })?.content?.text === "string"
    ? (message as { content?: { text?: string } }).content!.text!
    : "";
}

function buildEvidenceRequest(
  runtime: ProviderRuntime,
  message: unknown,
  state?: ProviderState,
): EvidenceSummaryRequest | undefined {
  const subject = inferSubjectId(runtime, message, state);
  if (!subject) {
    return undefined;
  }

  const messageText = extractText(message);
  const request: EvidenceSummaryRequest = {
    subject,
    case_file: messageText.match(CASE_FILE_RE)?.[1] || getStateString(state, "caseFile"),
    network:
      messageText.match(NETWORK_RE)?.[1] ||
      getStateString(state, "network") ||
      runtime.getSetting?.("RJP_EVIDENCE_NETWORK") ||
      process.env.RJP_EVIDENCE_NETWORK ||
      "base-sepolia",
    domain_id:
      messageText.match(DOMAIN_RE)?.[1] ||
      getStateString(state, "domainId") ||
      runtime.getSetting?.("RJP_EVIDENCE_DOMAIN_ID") ||
      process.env.RJP_EVIDENCE_DOMAIN_ID ||
      "counterparty_trust.base_trade_v1",
  };

  if (request.case_file) {
    return request;
  }

  const fromMessageStart = messageText.match(START_BLOCK_RE)?.[1];
  const fromMessageEnd = messageText.match(END_BLOCK_RE)?.[1];
  const parsedMessageStart = fromMessageStart ? Number(fromMessageStart) : undefined;
  const parsedMessageEnd = fromMessageEnd ? Number(fromMessageEnd) : undefined;
  const startBlock = getStateNumber(state, "startBlock");
  const endBlock = getStateNumber(state, "endBlock");
  if (
    (parsedMessageStart !== undefined && parsedMessageEnd !== undefined) ||
    (startBlock !== undefined && endBlock !== undefined)
  ) {
    request.window_mode = "custom";
    request.start_block = parsedMessageStart ?? startBlock;
    request.end_block = parsedMessageEnd ?? endBlock;
    return request;
  }

  request.window_mode = "relative";
  request.relative_size =
    getStateNumber(state, "relativeSize") ||
    Number(runtime.getSetting?.("RJP_EVIDENCE_RELATIVE_SIZE") || process.env.RJP_EVIDENCE_RELATIVE_SIZE || 1000);
  const currentBlock =
    getStateNumber(state, "currentBlock") ||
    Number(runtime.getSetting?.("RJP_EVIDENCE_CURRENT_BLOCK") || process.env.RJP_EVIDENCE_CURRENT_BLOCK || 0);
  if (currentBlock > 0) {
    request.current_block = currentBlock;
  }
  return request;
}

function buildDecisionGuidance(summary: {
  domain_id: string;
  feature_summary: Record<string, unknown>;
}): DecisionGuidance {
  const features = summary.feature_summary || {};
  const txCount = Number(features.tx_count || 0);
  const failedTxCount = Number(features.failed_tx_count || 0);
  const unboundedApprovals = Number(features.unbounded_approval_count || 0);
  const flaggedInteractions = Number(features.flagged_interaction_count || 0);

  if (summary.domain_id === "protocol_safety.base_erc20_permission_v1") {
    if (txCount <= 0) {
      return {
        evidence_decision_hint: "REFRESH",
        primary_reason_code: "SPARSE_ACTIVITY",
        rules: [
          "If tx_count is 0, answer REFRESH.",
          "If unbounded_approval_count is greater than 0, answer DENY.",
          "If failed_tx_count or flagged_interaction_count is greater than 0, answer REFRESH.",
          "Only answer ALLOW when tx_count is positive and the risky counts are all zero.",
        ],
      };
    }
    if (unboundedApprovals > 0) {
      return {
        evidence_decision_hint: "DENY",
        primary_reason_code: "UNBOUNDED_APPROVAL",
        rules: [
          "If unbounded_approval_count is greater than 0, answer DENY.",
          "If tx_count is 0, answer REFRESH.",
          "If failed_tx_count or flagged_interaction_count is greater than 0, answer REFRESH.",
          "Only answer ALLOW when tx_count is positive and the risky counts are all zero.",
        ],
      };
    }
    if (failedTxCount > 0 || flaggedInteractions > 0) {
      return {
        evidence_decision_hint: "REFRESH",
        primary_reason_code: failedTxCount > 0 ? "FAILED_TX" : "FLAGGED_INTERACTION",
        rules: [
          "If failed_tx_count or flagged_interaction_count is greater than 0, answer REFRESH.",
          "If unbounded_approval_count is greater than 0, answer DENY.",
          "If tx_count is 0, answer REFRESH.",
          "Only answer ALLOW when tx_count is positive and the risky counts are all zero.",
        ],
      };
    }
    return {
      evidence_decision_hint: "ALLOW",
      primary_reason_code: "SAFE_BASELINE",
      rules: [
        "Only answer ALLOW when tx_count is positive and the risky counts are all zero.",
        "If tx_count is 0, answer REFRESH.",
        "If unbounded_approval_count is greater than 0, answer DENY.",
        "If failed_tx_count or flagged_interaction_count is greater than 0, answer REFRESH.",
      ],
    };
  }

  if (txCount <= 0) {
    return {
      evidence_decision_hint: "REFRESH",
      primary_reason_code: "SPARSE_ACTIVITY",
      rules: [
        "If tx_count is 0, answer REFRESH.",
        "If unbounded_approval_count is greater than 0, answer DENY.",
        "If failed_tx_count or flagged_interaction_count is greater than 0, answer REFRESH.",
        "Only answer ALLOW when tx_count is positive and the risky counts are all zero.",
      ],
    };
  }
  if (unboundedApprovals > 0) {
    return {
      evidence_decision_hint: "DENY",
      primary_reason_code: "UNBOUNDED_APPROVAL",
      rules: [
        "If unbounded_approval_count is greater than 0, answer DENY.",
        "If tx_count is 0, answer REFRESH.",
        "If failed_tx_count or flagged_interaction_count is greater than 0, answer REFRESH.",
        "Only answer ALLOW when tx_count is positive and the risky counts are all zero.",
      ],
    };
  }
  if (failedTxCount > 0 || flaggedInteractions > 0) {
    return {
      evidence_decision_hint: "REFRESH",
      primary_reason_code: failedTxCount > 0 ? "FAILED_TX" : "FLAGGED_INTERACTION",
      rules: [
        "If failed_tx_count or flagged_interaction_count is greater than 0, answer REFRESH.",
        "If unbounded_approval_count is greater than 0, answer DENY.",
        "If tx_count is 0, answer REFRESH.",
        "Only answer ALLOW when tx_count is positive and the risky counts are all zero.",
      ],
    };
  }
  return {
    evidence_decision_hint: "ALLOW",
    primary_reason_code: "SAFE_BASELINE",
    rules: [
      "Only answer ALLOW when tx_count is positive and the risky counts are all zero.",
      "If tx_count is 0, answer REFRESH.",
      "If unbounded_approval_count is greater than 0, answer DENY.",
      "If failed_tx_count or flagged_interaction_count is greater than 0, answer REFRESH.",
    ],
  };
}

export const rjpEvidenceProvider: Provider = {
  name: "RJP_EVIDENCE_PROVIDER",
  description: "Injects a built RJP CaseObject evidence summary into Eliza context.",
  async get(runtime, message, state) {
    const request = buildEvidenceRequest(runtime, message, state);
    if (!request) {
      return {
        text: "RJP evidence unavailable: no subject or counterparty address was provided.",
      };
    }

    const client = new RjpClient(
      runtime.getSetting?.("RJP_API_URL") || process.env.RJP_API_URL,
      runtime.getSetting?.("RJP_DEFAULT_ACTION_TYPE") || process.env.RJP_DEFAULT_ACTION_TYPE,
    );

    try {
      const summary = await client.getEvidenceSummary(request);
      const features = summary.feature_summary || {};
      const guidance = buildDecisionGuidance(summary);

      return {
        text: [
          "AUTHORITATIVE_RJP_EVIDENCE_SUMMARY",
          "Treat this provider block as the current evidence summary for the wallet in the user prompt.",
          "Do not say you lack evidence if this block is present.",
          `subject_id: ${summary.subject_id}`,
          `domain_id: ${summary.domain_id}`,
          `case_id: ${summary.case_id}`,
          `claim_type: ${summary.claim_type}`,
          `verification_ok: ${summary.verification_ok}`,
          `observed_from_block: ${summary.observed_from_block}`,
          `observed_to_block: ${summary.observed_to_block}`,
          `evidence_manifest_item_count: ${summary.evidence_manifest_item_count}`,
          `tx_count: ${Number(features.tx_count || 0)}`,
          `failed_tx_count: ${Number(features.failed_tx_count || 0)}`,
          `unique_counterparties: ${Number(features.unique_counterparties || 0)}`,
          `unbounded_approval_count: ${Number(features.unbounded_approval_count || 0)}`,
          `flagged_interaction_count: ${Number(features.flagged_interaction_count || 0)}`,
          `evidence_decision_hint: ${guidance.evidence_decision_hint}`,
          `primary_reason_code: ${guidance.primary_reason_code}`,
          `notes: ${summary.notes}`,
          "decision_rule: infer ALLOW, DENY, or REFRESH only from this evidence summary and the declared domain.",
          ...guidance.rules.map((rule, index) => `rule_${index + 1}: ${rule}`),
          "binding_rule: if evidence_decision_hint is present, follow it unless the feature lines clearly contradict it.",
        ].join("\n"),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        text: `RJP evidence lookup failed for ${request.subject}: ${errorMessage}`,
      };
    }
  },
};
