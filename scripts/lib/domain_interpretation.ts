type JudgmentLike = {
  domain_id?: string;
  claim_type?: string;
  outcome?: string;
  outcome_enum?: string;
  risk_flags?: unknown;
  summary?: string;
  case_id?: string;
};

type HandshakeLike = {
  domain_id?: string;
  claim_type?: string;
  outcome?: string;
  state?: string;
  recommended_action?: string;
  reason_code?: string;
  summary?: string;
  case_id?: string;
};

function normalizeRiskFlags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function normalizeOutcome(value: string | undefined, fallback: string | undefined): string {
  return String(value || fallback || "").trim().toUpperCase();
}

function baseInterpretation(
  domainId: string,
  claimType: string,
  summary: string | undefined,
  caseId: string | undefined,
) {
  return {
    domain_id: domainId,
    claim_type: claimType,
    case_id: caseId || "",
    summary: summary || "",
  };
}

export function interpretJudgmentDomain(record: JudgmentLike) {
  const domainId = String(record.domain_id || "").trim();
  const claimType = String(record.claim_type || "").trim();
  const outcome = normalizeOutcome(record.outcome, record.outcome_enum);
  const riskFlags = normalizeRiskFlags(record.risk_flags);

  if (domainId === "counterparty_trust.base_trade_v1") {
    return {
      ...baseInterpretation(domainId, claimType, record.summary, record.case_id),
      domain_family: "counterparty_trust",
      consumer_question: "Should this wallet be trusted as a trading counterparty in this window?",
      subject_kind: "wallet",
      target_kind: "wallet_contract_pair",
      interpretation_kind: "counterparty trade readiness",
      domain_outcome_meaning: {
        SAFE: "Counterparty behavior in this window is acceptable for trade flows.",
        CAUTION: "Counterparty behavior is mixed and should be reviewed before trade.",
        UNSAFE: "Counterparty behavior in this window should block trade or require denial.",
        INSUFFICIENT_DATA: "There is not enough admissible evidence to form a reliable trade judgment.",
      },
      consumer_focus: [
        "trade readiness",
        "counterparty behavior over the observed window",
        "freshness before allowing execution",
      ],
      risk_signal_interpretation:
        riskFlags.length > 0
          ? "Risk flags explain why the counterparty is unsafe or needs caution."
          : "No explicit risk flags were carried in this judgment.",
      hot_path_read: {
        primary_field: "outcome",
        allow_when: "SAFE and fresh",
        review_when: "CAUTION or INSUFFICIENT_DATA",
        deny_when: "UNSAFE",
      },
    };
  }

  if (domainId === "protocol_safety.base_erc20_permission_v1") {
    return {
      ...baseInterpretation(domainId, claimType, record.summary, record.case_id),
      domain_family: "protocol_safety",
      consumer_question:
        "Is this ERC-20 approval posture safe for this wallet and spender in this window?",
      subject_kind: "wallet",
      target_kind: "wallet_contract_pair",
      interpretation_kind: "ERC-20 permission safety",
      domain_outcome_meaning: {
        SAFE: "Observed permission posture is bounded enough for normal consumption.",
        CAUTION: "Permission posture is mixed and needs additional review.",
        UNSAFE: "Observed approvals are too broad or unsafe for normal use.",
        INSUFFICIENT_DATA: "There is not enough admissible evidence to judge permission safety.",
      },
      consumer_focus: [
        "approval breadth",
        "spender-specific permission risk",
        "whether an agent or wallet should continue with approval-sensitive flows",
      ],
      risk_signal_interpretation:
        riskFlags.includes("UNBOUNDED_APPROVAL")
          ? "Unbounded approval is a primary unsafe signal in this domain."
          : riskFlags.length > 0
            ? "Risk flags describe unsafe or cautionary permission behavior."
            : "No explicit permission risk flags were carried in this judgment.",
      hot_path_read: {
        primary_field: "outcome",
        allow_when: "SAFE and fresh",
        review_when: "CAUTION or INSUFFICIENT_DATA",
        deny_when: "UNSAFE",
      },
    };
  }

  return {
    ...baseInterpretation(domainId, claimType, record.summary, record.case_id),
    domain_family: "unknown",
    consumer_question: "How should this judgment be interpreted for the current domain?",
    subject_kind: "unknown",
    target_kind: "unknown",
    interpretation_kind: "generic judgment",
    domain_outcome_meaning: {
      SAFE: "Safe in the declared domain.",
      CAUTION: "Needs review in the declared domain.",
      UNSAFE: "Unsafe in the declared domain.",
      INSUFFICIENT_DATA: "Insufficient evidence in the declared domain.",
    },
    consumer_focus: ["domain_id", "claim_type", "case_id", "freshness", "risk_flags"],
    risk_signal_interpretation:
      riskFlags.length > 0 ? "Use risk_flags to interpret the unsafe or cautionary reasons." : "",
    hot_path_read: {
      primary_field: "outcome",
      allow_when: "SAFE and fresh",
      review_when: "CAUTION or INSUFFICIENT_DATA",
      deny_when: "UNSAFE",
    },
  };
}

export function interpretHandshakeDomain(record: HandshakeLike) {
  const judgmentInterpretation = interpretJudgmentDomain(record);
  const state = String(record.state || "").trim().toUpperCase();
  const recommendedAction = String(record.recommended_action || "").trim().toUpperCase();

  return {
    ...judgmentInterpretation,
    handshake_state_meaning: {
      state,
      recommended_action: recommendedAction,
      reason_code: String(record.reason_code || "").trim(),
      consumer_rule:
        state === "STALE"
          ? "Refresh or republish before treating the judgment as execution-grade."
          : state === "NO_JUDGMENT"
            ? "Collect or submit a case before allowing automated execution."
            : state === "UNSAFE"
              ? "Treat the underlying domain judgment as deny-grade."
              : state === "SAFE"
                ? "Treat the underlying domain judgment as allow-grade if fresh."
                : "Use the state, outcome, and freshness together to decide.",
    },
  };
}
