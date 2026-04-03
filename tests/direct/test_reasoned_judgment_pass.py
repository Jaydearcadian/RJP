import json


def deploy_contract(direct_deploy):
    return direct_deploy("contracts/reasoned_judgment_pass.py")


def manifest_stub(subject_id: str, tx_count: int):
    return {
        "schema_version": "rjp.base_manifest.v1",
        "selection_rule": "all_outgoing_subject_transactions_in_window",
        "subject_id": subject_id,
        "source": {
            "network": "base-sepolia",
            "chain_id": 84532,
        },
        "window": {
            "start_block": 1200,
            "end_block": 1250,
            "start_block_hash": "0xstart",
            "end_block_hash": "0xend",
        },
        "item_count": tx_count,
        "leaf_hashes": [],
        "merkle_root": "0x" + ("1" * 64),
        "items": [],
    }


def base_case(
    subject_id: str,
    *,
    network: str = "base-sepolia",
    chain_id: int = 84532,
    source_label: str = "base-sepolia-demo",
    start_block: int = 1200,
    end_block: int = 1250,
    start_block_hash: str = "0xstart",
    end_block_hash: str = "0xend",
    tx_count: int = 14,
    failed_tx_count: int = 0,
    unique_counterparties: int = 4,
    unbounded_approval_count: int = 0,
    high_risk_flags: int = 0,
    notes: str = "Demo Base evidence payload.",
):
    manifest = manifest_stub(subject_id, tx_count)
    manifest["source"]["network"] = network
    manifest["source"]["chain_id"] = chain_id
    manifest["window"]["start_block"] = start_block
    manifest["window"]["end_block"] = end_block
    manifest["window"]["start_block_hash"] = start_block_hash
    manifest["window"]["end_block_hash"] = end_block_hash

    return {
        "schema_version": "rjp.base_case.v1",
        "extractor_version": "base_execution_integrity.v1",
        "subject_id": subject_id,
        "domain_id": "EXECUTION_INTEGRITY_V1",
        "source": {
            "network": network,
            "chain_id": chain_id,
            "source_label": source_label,
        },
        "window": {
            "start_block": start_block,
            "end_block": end_block,
            "start_block_hash": start_block_hash,
            "end_block_hash": end_block_hash,
        },
        "features": {
            "tx_count": tx_count,
            "failed_tx_count": failed_tx_count,
            "unique_counterparties": unique_counterparties,
            "unbounded_approval_count": unbounded_approval_count,
            "high_risk_flags": high_risk_flags,
        },
        "evidence_manifest": manifest,
        "notes": notes,
    }


def case_object(
    subject_id: str,
    *,
    network: str = "base-sepolia",
    chain_id: int = 84532,
    source_label: str = "base-sepolia-demo",
    start_block: int = 1200,
    end_block: int = 1250,
    start_block_hash: str = "0xstart",
    end_block_hash: str = "0xend",
    tx_count: int = 14,
    failed_tx_count: int = 0,
    unique_counterparties: int = 4,
    unbounded_approval_count: int = 0,
    high_risk_flags: int = 0,
    notes: str = "Demo Base evidence payload.",
):
    legacy = base_case(
        subject_id,
        network=network,
        chain_id=chain_id,
        source_label=source_label,
        start_block=start_block,
        end_block=end_block,
        start_block_hash=start_block_hash,
        end_block_hash=end_block_hash,
        tx_count=tx_count,
        failed_tx_count=failed_tx_count,
        unique_counterparties=unique_counterparties,
        unbounded_approval_count=unbounded_approval_count,
        high_risk_flags=high_risk_flags,
        notes=notes,
    )
    return {
        "schema_version": "rjp.case_object.v1",
        "case_id": f"counterparty_trust.base_trade_v1:{subject_id}:{start_block}-{end_block}",
        "domain_id": "counterparty_trust.base_trade_v1",
        "subject_scope": {
            "subject_type": "wallet",
            "subject_id": subject_id,
        },
        "target_scope": {
            "target_type": "wallet_contract_pair",
            "target_contract": "0x4200000000000000000000000000000000000006",
            "target_protocol": "erc20",
            "target_context": {
                "action_type": "trade",
                "asset_symbol": "WETH",
                "spender": "0x4200000000000000000000000000000000000006",
            },
        },
        "observation_window": {
            "source_network": network,
            "source_chain_id": chain_id,
            "observed_from_block": start_block,
            "observed_to_block": end_block,
            "observed_from_block_hash": start_block_hash,
            "observed_to_block_hash": end_block_hash,
            "selection_mode": "pinned_range",
        },
        "claim_type": "counterparty_trade_readiness",
        "extractor_version": "base_counterparty_trade_case.v1",
        "evidence_root": legacy["evidence_manifest"]["merkle_root"],
        "evidence_manifest_hash": "0x0f53618e47d24f8f4f68b9820bc6b0193561526f28ce9f59531517f19f99e4a5",
        "evidence_manifest_item_count": tx_count,
        "evidence_manifest": legacy["evidence_manifest"],
        "evidence_anchor": f"{network}:{chain_id}:{start_block}-{end_block}:0x1111111111111111",
        "feature_summary": {
            **legacy["features"],
            "flagged_interaction_count": high_risk_flags,
        },
        "created_at": "2026-03-31T12:00:00Z",
        "source_reference": {
            "domain_spec_hash": "0x35f3f3b605d54f91ad87e327787208214eda4dc1e585b10b2dc0cff253de6dea",
            "evidence_policy_hash": "0xd0be88441e4411f1029dca72a9b3082736b09656bedc9246e07ca7d6e7a0935a",
        },
        "notes": notes,
    }


def compact_case_object(subject_id: str, **kwargs):
    payload = case_object(subject_id, **kwargs)
    payload["schema_version"] = "rjp.case_object.compact_submission.v1"
    payload["submission_payload_kind"] = "compact_submission"
    payload["audit_schema_version"] = "rjp.case_object.v1"
    payload["audit_manifest_hash"] = payload["evidence_manifest_hash"]
    payload["evidence_manifest"].pop("items", None)
    payload["evidence_manifest"].pop("leaf_hashes", None)
    return payload


def permission_case_object(
    subject_id: str,
    *,
    network: str = "base-sepolia",
    chain_id: int = 84532,
    source_label: str = "base-sepolia-demo",
    start_block: int = 1200,
    end_block: int = 1250,
    start_block_hash: str = "0xstart",
    end_block_hash: str = "0xend",
    tx_count: int = 1,
    failed_tx_count: int = 0,
    unique_counterparties: int = 1,
    unbounded_approval_count: int = 1,
    high_risk_flags: int = 0,
    notes: str = "Demo ERC-20 permission case.",
):
    legacy = base_case(
        subject_id,
        network=network,
        chain_id=chain_id,
        source_label=source_label,
        start_block=start_block,
        end_block=end_block,
        start_block_hash=start_block_hash,
        end_block_hash=end_block_hash,
        tx_count=tx_count,
        failed_tx_count=failed_tx_count,
        unique_counterparties=unique_counterparties,
        unbounded_approval_count=unbounded_approval_count,
        high_risk_flags=high_risk_flags,
        notes=notes,
    )
    return {
        "schema_version": "rjp.case_object.v1",
        "case_id": f"protocol_safety.base_erc20_permission_v1:{subject_id}:{start_block}-{end_block}",
        "domain_id": "protocol_safety.base_erc20_permission_v1",
        "subject_scope": {
            "subject_type": "wallet",
            "subject_id": subject_id,
        },
        "target_scope": {
            "target_type": "wallet_contract_pair",
            "target_contract": "0x4200000000000000000000000000000000000006",
            "target_protocol": "erc20",
            "target_context": {
                "action_type": "approve",
                "asset_symbol": "WETH",
                "spender": "0x1111111111111111111111111111111111111111",
            },
        },
        "observation_window": {
            "source_network": network,
            "source_chain_id": chain_id,
            "observed_from_block": start_block,
            "observed_to_block": end_block,
            "observed_from_block_hash": start_block_hash,
            "observed_to_block_hash": end_block_hash,
            "selection_mode": "pinned_range",
        },
        "claim_type": "erc20_permission_safety",
        "extractor_version": "base_erc20_permission_case.v1",
        "evidence_root": legacy["evidence_manifest"]["merkle_root"],
        "evidence_manifest_hash": "0x0f53618e47d24f8f4f68b9820bc6b0193561526f28ce9f59531517f19f99e4a5",
        "evidence_manifest_item_count": tx_count,
        "evidence_manifest": legacy["evidence_manifest"],
        "evidence_anchor": f"{network}:{chain_id}:{start_block}-{end_block}:0x1111111111111111",
        "feature_summary": {
            **legacy["features"],
            "flagged_interaction_count": high_risk_flags,
        },
        "created_at": "2026-04-01T13:00:00Z",
        "source_reference": {
            "domain_spec_hash": "0xca76e3a0393e72a94c2485f6290fc9c2f940b8abfd4ab9719aae3a0b81f20f99",
            "evidence_policy_hash": "0x798fd545b9af478b90c837c14c7323b289f9cd8718c476b8d8ee6fd151d7081a",
        },
        "notes": notes,
    }


def abi_encode_string(value: str) -> bytes:
    payload = value.encode("utf-8")
    padding = (32 - (len(payload) % 32)) % 32
    return (
        (32).to_bytes(32, "big")
        + len(payload).to_bytes(32, "big")
        + payload
        + (b"\x00" * padding)
    )


def test_initial_state_denies_execution(direct_deploy):
    contract = deploy_contract(direct_deploy)

    latest_evidence = contract.get_latest_evidence("agent-1")
    latest_judgment = contract.get_latest_judgment("agent-1")
    decision = contract.can_execute("agent-1", "TREASURY_MESSAGE_SEND")
    agent_decision = contract.get_agent_decision("agent-1", "TREASURY_MESSAGE_SEND")
    handshake = contract.get_handshake_state("agent-1", "TREASURY_MESSAGE_SEND")

    assert latest_evidence["exists"] is False
    assert latest_judgment["exists"] is False
    assert contract.get_evidence_count("agent-1") == 0
    assert contract.get_revision_count("agent-1") == 0
    assert contract.get_evaluation_mode() == "deterministic"
    assert contract.get_default_freshness_window_blocks() == 50000
    assert decision["allowed"] is False
    assert decision["reason"] == "no judgment"
    assert decision["state"] == "NO_JUDGMENT"
    assert decision["recommended_action"] == "REFRESH"
    assert decision["recommended_action_is_hint"] is True
    assert decision["state_is_primary"] is True
    assert decision["enforcement_mode"] == "ENFORCED_GATE"
    assert agent_decision["exists"] is False
    assert agent_decision["allowed"] is False
    assert agent_decision["reason"] == "no judgment"
    assert agent_decision["handshake"]["state"] == "NO_JUDGMENT"
    assert handshake["state"] == "NO_JUDGMENT"
    assert handshake["reason_code"] == "NO_JUDGMENT"
    assert handshake["recommended_action"] == "REFRESH"
    assert handshake["recommended_action_is_hint"] is True
    assert handshake["state_is_primary"] is True
    assert handshake["enforcement_mode"] == "ENFORCED_GATE"


def test_owner_can_switch_evaluation_mode(direct_deploy):
    contract = deploy_contract(direct_deploy)

    contract.set_evaluation_mode("llm")
    assert contract.get_evaluation_mode() == "llm"

    contract.set_evaluation_mode("something-else")
    assert contract.get_evaluation_mode() == "deterministic"


def test_prompt_profile_defaults_and_can_be_updated(direct_deploy):
    contract = deploy_contract(direct_deploy)

    assert contract.get_prompt_profile() == "standard"

    contract.set_prompt_profile("isolated_minimal")
    assert contract.get_prompt_profile() == "isolated_minimal"

    contract.set_prompt_profile("unknown-profile")
    assert contract.get_prompt_profile() == "standard"


def test_owner_can_set_default_freshness_window_blocks(direct_deploy):
    contract = deploy_contract(direct_deploy)

    contract.set_default_freshness_window_blocks(1234)
    assert contract.get_default_freshness_window_blocks() == 1234


def test_submit_evidence_then_evaluate_allows_action(direct_vm, direct_deploy, direct_alice):
    contract = deploy_contract(direct_deploy)
    direct_vm.sender = direct_alice

    evidence = contract.submit_evidence(
        "agent-1",
        evidence_text=json.dumps(base_case("agent-1")),
    )
    result = contract.evaluate_latest_evidence("agent-1")

    decision = contract.can_execute("agent-1", "TREASURY_MESSAGE_SEND")
    agent_decision = contract.get_agent_decision("agent-1", "TREASURY_MESSAGE_SEND")
    handshake = contract.get_handshake_state("agent-1", "TREASURY_MESSAGE_SEND")
    allowed = contract.attempt_guarded_action("agent-1", "TREASURY_MESSAGE_SEND")

    assert evidence["sequence"] == 1
    assert evidence["case_schema_version"] == "rjp.base_case.v1"
    assert evidence["extractor_version"] == "base_execution_integrity.v1"
    assert evidence["manifest_schema_version"] == "rjp.base_manifest.v1"
    assert evidence["manifest_item_count"] == 14
    assert evidence["ingress_kind"] == "manual"
    assert evidence["features"]["tx_count"] == 14
    assert evidence["source_network"] == "base-sepolia"
    assert evidence["source_chain_id"] == 84532
    assert evidence["manifest_root"] == "0x" + ("1" * 64)
    assert evidence["evidence_anchor"].startswith("base-sepolia:84532:1200-1250:")
    assert result["revision"] == 1
    assert result["evidence_sequence"] == 1
    assert result["case_schema_version"] == "rjp.base_case.v1"
    assert result["manifest_root"] == "0x" + ("1" * 64)
    assert result["outcome"] == "SAFE"
    assert result["confidence_ppm"] == 900000
    assert result["risk_flags"] == []
    assert result["freshness_window_blocks"] == 50000
    assert result["valid_until_source_block"] == 51250
    assert decision["allowed"] is True
    assert decision["state"] == "SAFE"
    assert decision["recommended_action"] == "ALLOW"
    assert decision["recommended_action_is_hint"] is True
    assert decision["state_is_primary"] is True
    assert decision["enforcement_mode"] == "ENFORCED_GATE"
    assert agent_decision["exists"] is True
    assert agent_decision["allowed"] is True
    assert agent_decision["judgment"]["revision"] == 1
    assert agent_decision["judgment"]["outcome"] == "SAFE"
    assert agent_decision["handshake"]["state"] == "SAFE"
    assert handshake["state"] == "SAFE"
    assert handshake["reason_code"] == "SAFE_NO_FRESHNESS_CHECK"
    assert handshake["recommended_action_is_hint"] is True
    assert handshake["state_is_primary"] is True
    assert handshake["enforcement_mode"] == "ENFORCED_GATE"
    assert allowed is True
    assert contract.get_action_count() == 1
    action = contract.get_action(0)
    assert action["allowed"] is True
    assert action["subject_id"] == "agent-1"
    assert action["source_network"] == "base-sepolia"
    assert action["source_chain_id"] == 84532
    assert action["evidence_anchor"] == result["evidence_anchor"]
    assert action["judgment_revision"] == 1


def test_case_object_payload_exposes_protocol_views(direct_deploy):
    contract = deploy_contract(direct_deploy)

    contract.submit_evidence(
        "agent-protocol",
        evidence_text=json.dumps(
            case_object(
                "agent-protocol",
                tx_count=3,
                unbounded_approval_count=1,
                high_risk_flags=0,
            )
        ),
    )
    judgment = contract.evaluate_latest_evidence("agent-protocol")
    latest_case = contract.get_latest_case_object("agent-protocol")
    latest_assessment = contract.get_latest_assessment_artifact("agent-protocol")
    latest_judgment_object = contract.get_latest_judgment_object("agent-protocol")
    domain_spec = contract.get_domain_spec("counterparty_trust.base_trade_v1")

    assert latest_case["exists"] is True
    assert latest_case["schema_version"] == "rjp.case_object.v1"
    assert latest_case["domain_id"] == "counterparty_trust.base_trade_v1"
    assert latest_case["claim_type"] == "counterparty_trade_readiness"
    assert latest_case["subject_scope"]["subject_type"] == "wallet"
    assert latest_case["target_scope"]["target_protocol"] == "erc20"
    assert latest_case["feature_summary"]["unbounded_approval_count"] == 1

    assert judgment["domain_id"] == "counterparty_trust.base_trade_v1"
    assert judgment["case_id"] == latest_case["case_id"]
    assert judgment["evaluation_spec_hash"] == "0x6196f5f0e30698d8453e1f5cafa00e4ff1fa34b897e2a1cf4d2758980acd30a4"
    assert judgment["model_policy_hash"] == "0x4605471b6114d47a31b7c91bd7faffd32e14bbef97be2f7119b29a93d9fc48b4"
    assert judgment["outcome"] == "UNSAFE"

    assert latest_assessment["exists"] is True
    assert latest_assessment["schema_version"] == "rjp.assessment_artifact.v1"
    assert latest_assessment["case_id"] == latest_case["case_id"]
    assert latest_assessment["domain_id"] == "counterparty_trust.base_trade_v1"
    assert latest_assessment["outcome_enum"] == "UNSAFE"
    assert latest_assessment["outcome_payload"]["unbounded_approval_count"] == 1
    assert latest_assessment["assessment_hash"] == judgment["assessment_hash"]
    assert latest_assessment["outcome_payload_hash"].startswith("0x")
    assert latest_assessment["evaluated_at"] == "1970-01-01T00:00:00Z"

    assert latest_judgment_object["exists"] is True
    assert latest_judgment_object["schema_version"] == "rjp.judgment_object.v1"
    assert latest_judgment_object["assessment_hash"] == latest_assessment["assessment_hash"]
    assert latest_judgment_object["outcome_enum"] == "UNSAFE"
    assert latest_judgment_object["valid_until"]["basis"] == "source_block"
    assert latest_judgment_object["valid_until"]["source_chain_id"] == 84532

    assert domain_spec["exists"] is True
    assert domain_spec["domain_id"] == "counterparty_trust.base_trade_v1"
    assert "SAFE" in domain_spec["judgment_outcomes"]
    assert contract.get_supported_domains() == [
        "counterparty_trust.base_trade_v1",
        "protocol_safety.base_erc20_permission_v1",
    ]


def test_compact_case_object_payload_exposes_protocol_views(direct_deploy):
    contract = deploy_contract(direct_deploy)

    contract.submit_evidence(
        "agent-compact",
        evidence_text=json.dumps(
            compact_case_object(
                "agent-compact",
                tx_count=3,
                unbounded_approval_count=1,
                high_risk_flags=0,
            )
        ),
    )
    judgment = contract.evaluate_latest_evidence("agent-compact")
    latest_case = contract.get_latest_case_object("agent-compact")

    assert latest_case["exists"] is True
    assert latest_case["schema_version"] == "rjp.case_object.compact_submission.v1"
    assert latest_case["domain_id"] == "counterparty_trust.base_trade_v1"
    assert latest_case["feature_summary"]["unbounded_approval_count"] == 1
    assert judgment["outcome"] == "UNSAFE"


def test_permission_domain_exposes_protocol_views(direct_deploy):
    contract = deploy_contract(direct_deploy)

    contract.submit_evidence(
        "agent-permission",
        evidence_text=json.dumps(permission_case_object("agent-permission")),
    )
    judgment = contract.evaluate_latest_evidence("agent-permission")
    latest_case = contract.get_latest_case_object("agent-permission")
    latest_assessment = contract.get_latest_assessment_artifact("agent-permission")
    latest_judgment_object = contract.get_latest_judgment_object("agent-permission")
    domain_spec = contract.get_domain_spec("protocol_safety.base_erc20_permission_v1")

    assert latest_case["exists"] is True
    assert latest_case["domain_id"] == "protocol_safety.base_erc20_permission_v1"
    assert latest_case["claim_type"] == "erc20_permission_safety"
    assert latest_case["target_scope"]["target_context"]["action_type"] == "approve"

    assert judgment["domain_id"] == "protocol_safety.base_erc20_permission_v1"
    assert judgment["evaluation_spec_hash"] == "0xa7a091d2b6134a9c5e7ad6a1758ce0fcfc130cc03f2beaacb69c52f586590580"
    assert judgment["model_policy_hash"] == "0xf75148e39ed8c9975ccfdb82a53796f597073c03cf83aba19863c5e2e7d5d986"
    assert judgment["outcome"] == "UNSAFE"

    assert latest_assessment["exists"] is True
    assert latest_assessment["domain_id"] == "protocol_safety.base_erc20_permission_v1"
    assert latest_assessment["outcome_enum"] == "UNSAFE"
    assert latest_assessment["outcome_payload"]["unbounded_approval_count"] == 1

    assert latest_judgment_object["exists"] is True
    assert latest_judgment_object["domain_id"] == "protocol_safety.base_erc20_permission_v1"
    assert latest_judgment_object["assessment_hash"] == latest_assessment["assessment_hash"]
    assert latest_judgment_object["outcome_enum"] == "UNSAFE"

    assert domain_spec["exists"] is True
    assert domain_spec["domain_id"] == "protocol_safety.base_erc20_permission_v1"
    assert "UNSAFE" in domain_spec["judgment_outcomes"]


def test_permission_domain_deterministic_matrix_maps_to_hot_path_states(direct_deploy):
    contract = deploy_contract(direct_deploy)

    cases = [
        (
            "agent-permission-sparse",
            permission_case_object(
                "agent-permission-sparse",
                tx_count=0,
                failed_tx_count=0,
                unique_counterparties=0,
                unbounded_approval_count=0,
                high_risk_flags=0,
                notes="Sparse permission evidence should remain insufficient.",
            ),
            {
                "outcome": "INSUFFICIENT_DATA",
                "reason_code": "SPARSE_ACTIVITY",
                "recommended_action": "REFRESH",
                "state": "INSUFFICIENT_DATA",
            },
        ),
        (
            "agent-permission-caution",
            permission_case_object(
                "agent-permission-caution",
                tx_count=2,
                failed_tx_count=1,
                unique_counterparties=1,
                unbounded_approval_count=0,
                high_risk_flags=0,
                notes="One failed approval-related action should trigger review.",
            ),
            {
                "outcome": "CAUTION",
                "reason_code": "FAILED_TX",
                "recommended_action": "REVIEW",
                "state": "CAUTION",
            },
        ),
        (
            "agent-permission-safe",
            permission_case_object(
                "agent-permission-safe",
                tx_count=3,
                failed_tx_count=0,
                unique_counterparties=1,
                unbounded_approval_count=0,
                high_risk_flags=0,
                notes="Bounded approval posture should remain safe.",
            ),
            {
                "outcome": "SAFE",
                "reason_code": "SAFE_BASELINE",
                "recommended_action": "ALLOW",
                "state": "SAFE",
            },
        ),
        (
            "agent-permission-unsafe",
            permission_case_object(
                "agent-permission-unsafe",
                tx_count=1,
                failed_tx_count=0,
                unique_counterparties=1,
                unbounded_approval_count=1,
                high_risk_flags=0,
                notes="Unbounded approval posture should be deny-grade.",
            ),
            {
                "outcome": "UNSAFE",
                "reason_code": "UNBOUNDED_APPROVAL",
                "recommended_action": "DENY",
                "state": "UNSAFE",
            },
        ),
    ]

    for subject_id, payload, expected in cases:
        contract.submit_evidence(subject_id, evidence_text=json.dumps(payload))
        judgment = contract.evaluate_latest_evidence(subject_id)
        latest_judgment_object = contract.get_latest_judgment_object(subject_id)
        handshake = contract.get_handshake_state(subject_id, "approve")

        assert judgment["domain_id"] == "protocol_safety.base_erc20_permission_v1"
        assert judgment["claim_type"] == "erc20_permission_safety"
        assert judgment["outcome"] == expected["outcome"]
        assert judgment["reason_code"] == expected["reason_code"]
        assert latest_judgment_object["exists"] is True
        assert latest_judgment_object["domain_id"] == "protocol_safety.base_erc20_permission_v1"
        assert latest_judgment_object["outcome_enum"] == expected["outcome"]
        assert handshake["state"] == expected["state"]
        assert handshake["recommended_action"] == expected["recommended_action"]
        assert handshake["recommended_action_is_hint"] is True
        assert handshake["state_is_primary"] is True
        assert handshake["enforcement_mode"] == "ENFORCED_GATE"


def test_protocol_case_rejects_domain_mismatch(direct_deploy):
    contract = deploy_contract(direct_deploy)
    payload = case_object("agent-mismatch")
    payload["claim_type"] = "wrong_claim"

    try:
        contract.submit_evidence("agent-mismatch", evidence_text=json.dumps(payload))
        assert False, "expected domain validation to reject mismatched claim_type"
    except Exception as exc:
        assert "claim_type does not match domain" in str(exc)


def test_freshness_aware_execution_checks_source_block(direct_deploy):
    contract = deploy_contract(direct_deploy)
    contract.set_default_freshness_window_blocks(25)

    contract.submit_evidence(
        "agent-fresh",
        evidence_text=json.dumps(
            base_case(
                "agent-fresh",
                start_block=2000,
                end_block=2050,
            )
        ),
    )
    result = contract.evaluate_latest_evidence("agent-fresh")

    fresh_gate = contract.can_execute_with_source_block("agent-fresh", "trade", 2060)
    stale_gate = contract.can_execute_with_source_block("agent-fresh", "trade", 2076)
    fresh_agent = contract.get_agent_decision_with_source_block("agent-fresh", "trade", 2060)
    stale_agent = contract.get_agent_decision_with_source_block("agent-fresh", "trade", 2076)
    fresh_handshake = contract.get_handshake_state_with_source_block("agent-fresh", "trade", 2060)
    stale_handshake = contract.get_handshake_state_with_source_block("agent-fresh", "trade", 2076)
    fresh_attempt = contract.attempt_guarded_action_with_source_block("agent-fresh", "trade", 2060)
    stale_attempt = contract.attempt_guarded_action_with_source_block("agent-fresh", "trade", 2076)

    assert result["freshness_window_blocks"] == 25
    assert result["valid_until_source_block"] == 2075

    assert fresh_gate["allowed"] is True
    assert fresh_gate["freshness_checked"] is True
    assert fresh_gate["valid_until_source_block"] == 2075
    assert fresh_gate["state"] == "SAFE"

    assert stale_gate["allowed"] is False
    assert stale_gate["reason"] == "judgment is stale"
    assert stale_gate["freshness_checked"] is True
    assert stale_gate["current_source_block"] == 2076
    assert stale_gate["valid_until_source_block"] == 2075
    assert stale_gate["state"] == "STALE"
    assert stale_gate["recommended_action"] == "REFRESH"
    assert stale_gate["recommended_action_is_hint"] is True
    assert stale_gate["state_is_primary"] is True
    assert stale_gate["enforcement_mode"] == "ENFORCED_GATE"

    assert fresh_agent["exists"] is True
    assert fresh_agent["allowed"] is True
    assert fresh_agent["reason"] == "latest outcome is SAFE and judgment is fresh"
    assert fresh_agent["freshness_checked"] is True
    assert fresh_agent["judgment"]["valid_until_source_block"] == 2075
    assert fresh_agent["handshake"]["reason_code"] == "SAFE_FRESH"

    assert stale_agent["exists"] is True
    assert stale_agent["allowed"] is False
    assert stale_agent["reason"] == "judgment is stale"
    assert stale_agent["freshness_checked"] is True
    assert stale_agent["judgment"]["valid_until_source_block"] == 2075
    assert stale_agent["handshake"]["state"] == "STALE"
    assert stale_agent["handshake"]["recommended_action"] == "REFRESH"

    assert fresh_handshake["state"] == "SAFE"
    assert fresh_handshake["recommended_action"] == "ALLOW"
    assert stale_handshake["state"] == "STALE"
    assert stale_handshake["reason_code"] == "JUDGMENT_STALE"
    assert fresh_handshake["recommended_action_is_hint"] is True
    assert fresh_handshake["state_is_primary"] is True
    assert fresh_handshake["enforcement_mode"] == "ENFORCED_GATE"
    assert stale_handshake["recommended_action_is_hint"] is True
    assert stale_handshake["state_is_primary"] is True
    assert stale_handshake["enforcement_mode"] == "ENFORCED_GATE"

    assert fresh_attempt is True
    assert stale_attempt is False

    assert contract.get_action_count() == 2
    latest_action = contract.get_action(1)
    assert latest_action["allowed"] is False
    assert latest_action["reason"] == "judgment is stale"


def test_llm_mode_uses_prompt_result(direct_vm, direct_deploy):
    contract = deploy_contract(direct_deploy)
    contract.set_evaluation_mode("llm")
    contract.set_prompt_profile("domain_compact")

    direct_vm.mock_llm(
        r".*Prompt profile: domain_compact.*",
        json.dumps(
            {
                "outcome": "CAUTION",
                "confidence_ppm": 610000,
                "risk_flags": ["FAILED_TX"],
            }
        ),
    )

    contract.submit_evidence(
        "agent-llm",
        evidence_text=json.dumps(base_case("agent-llm", tx_count=2, high_risk_flags=0)),
    )
    result = contract.evaluate_latest_evidence("agent-llm")

    assert result["outcome"] == "CAUTION"
    assert result["confidence_ppm"] == 650000
    assert result["risk_flags"] == ["FAILED_TX"]
    assert result["reason_code"] == "FAILED_TX"
    assert result["summary"] == ""


def test_llm_isolated_minimal_profile_uses_minimal_prompt(direct_vm, direct_deploy):
    contract = deploy_contract(direct_deploy)
    contract.set_evaluation_mode("llm")
    contract.set_prompt_profile("isolated_minimal")

    direct_vm.mock_llm(
        r".*Prompt profile: isolated_minimal.*",
        json.dumps(
            {
                "outcome": "INSUFFICIENT_DATA",
                "confidence_ppm": 120000,
                "risk_flags": ["SPARSE_ACTIVITY"],
            }
        ),
    )

    contract.submit_evidence(
        "agent-llm-minimal",
        evidence_text=json.dumps(base_case("agent-llm-minimal", tx_count=0)),
    )
    result = contract.evaluate_latest_evidence("agent-llm-minimal")

    assert result["outcome"] == "INSUFFICIENT_DATA"
    assert result["confidence_ppm"] == 150000
    assert result["risk_flags"] == ["SPARSE_ACTIVITY"]
    assert result["reason_code"] == "SPARSE_ACTIVITY"
    assert result["summary"] == "No outgoing Base activity was found in the submitted evidence window."


def test_llm_obvious_sparse_case_uses_guardrail_without_model(direct_deploy):
    contract = deploy_contract(direct_deploy)
    contract.set_evaluation_mode("llm")
    contract.set_prompt_profile("isolated_minimal")

    contract.submit_evidence(
        "agent-llm-guardrail-sparse",
        evidence_text=json.dumps(base_case("agent-llm-guardrail-sparse", tx_count=0)),
    )
    result = contract.evaluate_latest_evidence("agent-llm-guardrail-sparse")

    assert result["outcome"] == "INSUFFICIENT_DATA"
    assert result["confidence_ppm"] == 150000
    assert result["risk_flags"] == ["SPARSE_ACTIVITY"]
    assert result["reason_code"] == "SPARSE_ACTIVITY"


def test_llm_domain_compact_profile_uses_compact_prompt(direct_vm, direct_deploy):
    contract = deploy_contract(direct_deploy)
    contract.set_evaluation_mode("llm")
    contract.set_prompt_profile("domain_compact")

    direct_vm.mock_llm(
        r".*Prompt profile: domain_compact.*",
        json.dumps(
            {
                "outcome": "UNSAFE",
                "confidence_ppm": 999999,
                "risk_flags": ["UNBOUNDED_APPROVAL"],
            }
        ),
    )

    contract.submit_evidence(
        "agent-llm-compact",
        evidence_text=json.dumps(base_case("agent-llm-compact", unbounded_approval_count=1)),
    )
    result = contract.evaluate_latest_evidence("agent-llm-compact")

    assert result["outcome"] == "UNSAFE"
    assert result["confidence_ppm"] == 940000
    assert result["risk_flags"] == ["UNBOUNDED_APPROVAL"]
    assert result["reason_code"] == "UNBOUNDED_APPROVAL"
    assert result["summary"] == "Unbounded ERC-20 approvals detected: 1 approval transaction(s)."


def test_permission_domain_llm_isolated_minimal_uses_prompt_for_ambiguous_case(
    direct_vm, direct_deploy
):
    contract = deploy_contract(direct_deploy)
    contract.set_evaluation_mode("llm")
    contract.set_prompt_profile("isolated_minimal")

    direct_vm.mock_llm(
        r".*Prompt profile: isolated_minimal.*",
        json.dumps(
            {
                "outcome": "CAUTION",
                "confidence_ppm": 610000,
                "risk_flags": ["FAILED_TX"],
            }
        ),
    )

    contract.submit_evidence(
        "agent-permission-llm-ambiguous",
        evidence_text=json.dumps(
            permission_case_object(
                "agent-permission-llm-ambiguous",
                tx_count=2,
                failed_tx_count=1,
                unique_counterparties=1,
                unbounded_approval_count=0,
                high_risk_flags=0,
                notes="Ambiguous approval posture should use the isolated minimal prompt path.",
            )
        ),
    )
    result = contract.evaluate_latest_evidence("agent-permission-llm-ambiguous")
    latest_judgment_object = contract.get_latest_judgment_object("agent-permission-llm-ambiguous")

    assert result["domain_id"] == "protocol_safety.base_erc20_permission_v1"
    assert result["claim_type"] == "erc20_permission_safety"
    assert result["outcome"] == "CAUTION"
    assert result["confidence_ppm"] == 650000
    assert result["risk_flags"] == ["FAILED_TX"]
    assert result["reason_code"] == "FAILED_TX"
    assert result["summary"] == ""
    assert latest_judgment_object["exists"] is True
    assert latest_judgment_object["domain_id"] == "protocol_safety.base_erc20_permission_v1"
    assert latest_judgment_object["outcome_enum"] == "CAUTION"


def test_permission_domain_llm_obvious_unbounded_approval_uses_guardrail_without_model(
    direct_deploy,
):
    contract = deploy_contract(direct_deploy)
    contract.set_evaluation_mode("llm")
    contract.set_prompt_profile("isolated_minimal")

    contract.submit_evidence(
        "agent-permission-llm-guardrail-risky",
        evidence_text=json.dumps(
            permission_case_object(
                "agent-permission-llm-guardrail-risky",
                tx_count=1,
                failed_tx_count=0,
                unique_counterparties=1,
                unbounded_approval_count=1,
                high_risk_flags=0,
                notes="Obvious unsafe permission posture should be short-circuited before LLM prompt execution.",
            )
        ),
    )
    result = contract.evaluate_latest_evidence("agent-permission-llm-guardrail-risky")
    handshake = contract.get_handshake_state("agent-permission-llm-guardrail-risky", "approve")

    assert result["domain_id"] == "protocol_safety.base_erc20_permission_v1"
    assert result["outcome"] == "UNSAFE"
    assert result["confidence_ppm"] == 940000
    assert result["risk_flags"] == ["UNBOUNDED_APPROVAL"]
    assert result["reason_code"] == "UNBOUNDED_APPROVAL"
    assert handshake["state"] == "UNSAFE"
    assert handshake["recommended_action"] == "DENY"


def test_llm_obvious_risky_case_uses_guardrail_without_model(direct_deploy):
    contract = deploy_contract(direct_deploy)
    contract.set_evaluation_mode("llm")
    contract.set_prompt_profile("domain_compact")

    contract.submit_evidence(
        "agent-llm-guardrail-risky",
        evidence_text=json.dumps(
            base_case("agent-llm-guardrail-risky", unbounded_approval_count=1)
        ),
    )
    result = contract.evaluate_latest_evidence("agent-llm-guardrail-risky")

    assert result["outcome"] == "UNSAFE"
    assert result["confidence_ppm"] == 940000
    assert result["risk_flags"] == ["UNBOUNDED_APPROVAL"]
    assert result["reason_code"] == "UNBOUNDED_APPROVAL"


def test_llm_obvious_clean_case_uses_guardrail_without_model(direct_deploy):
    contract = deploy_contract(direct_deploy)
    contract.set_evaluation_mode("llm")
    contract.set_prompt_profile("isolated_minimal")

    contract.submit_evidence(
        "agent-llm-guardrail-clean",
        evidence_text=json.dumps(
                base_case(
                    "agent-llm-guardrail-clean",
                    tx_count=12,
                    failed_tx_count=0,
                    unique_counterparties=1,
                    unbounded_approval_count=0,
                    high_risk_flags=0,
            )
        ),
    )
    result = contract.evaluate_latest_evidence("agent-llm-guardrail-clean")

    assert result["outcome"] == "SAFE"
    assert result["confidence_ppm"] == 900000
    assert result["risk_flags"] == []
    assert result["reason_code"] == "SAFE_BASELINE"


def test_second_evidence_updates_latest_but_preserves_history(direct_vm, direct_deploy):
    contract = deploy_contract(direct_deploy)

    first_evidence = contract.submit_evidence(
        "agent-1",
        evidence_text=json.dumps(base_case("agent-1", end_block_hash="0xgood")),
    )
    first_result = contract.evaluate_latest_evidence("agent-1")

    second_evidence = contract.submit_evidence(
        "agent-1",
        evidence_text=json.dumps(
            base_case(
                "agent-1",
                start_block=1251,
                end_block=1300,
                start_block_hash="0xnext-start",
                end_block_hash="0xnext-end",
                high_risk_flags=3,
                unbounded_approval_count=2,
                notes="Later Base window shows risky approvals.",
            )
        ),
    )
    second_result = contract.evaluate_latest_evidence("agent-1")
    latest_evidence = contract.get_latest_evidence("agent-1")
    latest_judgment = contract.get_latest_judgment("agent-1")
    evidence_one = contract.get_evidence("agent-1", 1)
    evidence_two = contract.get_evidence("agent-1", 2)
    judgment_one = contract.get_judgment("agent-1", 1)
    judgment_two = contract.get_judgment("agent-1", 2)
    decision = contract.can_execute("agent-1", "TREASURY_MESSAGE_SEND")

    assert first_evidence["sequence"] == 1
    assert first_result["revision"] == 1
    assert second_evidence["sequence"] == 2
    assert latest_evidence["sequence"] == 2
    assert latest_evidence["manifest_item_count"] == 14
    assert latest_evidence["features"]["high_risk_flags"] == 3
    assert evidence_one["end_block_hash"] == "0xgood"
    assert evidence_two["end_block_hash"] == "0xnext-end"
    assert second_result["revision"] == 2
    assert second_result["outcome"] == "UNSAFE"
    assert second_result["risk_flags"] == ["FLAGGED_INTERACTION"]
    assert latest_judgment["revision"] == 2
    assert latest_judgment["outcome"] == "UNSAFE"
    assert latest_judgment["risk_flags"] == ["FLAGGED_INTERACTION"]
    assert latest_judgment["manifest_root"] == "0x" + ("1" * 64)
    assert latest_judgment["evidence_sequence"] == 2
    assert judgment_one["exists"] is True
    assert judgment_one["revision"] == 1
    assert judgment_one["outcome"] == "SAFE"
    assert judgment_two["revision"] == 2
    assert judgment_two["evidence_sequence"] == 2
    assert contract.get_evidence_count("agent-1") == 2
    assert contract.get_revision_count("agent-1") == 2
    assert decision["allowed"] is False
    assert decision["reason"] == "latest outcome is UNSAFE"


def test_bridge_message_path_stores_evidence_before_evaluation(
    direct_vm, direct_deploy, direct_alice
):
    direct_vm.sender = direct_alice
    contract = deploy_contract(direct_deploy)

    stored = contract.process_bridge_message(
        "msg-1",
        84532,
        "0x1234567890abcdef1234567890abcdef12345678",
        abi_encode_string(
            json.dumps(
                base_case(
                    "agent-bridge",
                    source_label="base-sepolia-bridge",
                    start_block=2000,
                    end_block=2020,
                    end_block_hash="0xbridge-end",
                    tx_count=5,
                    failed_tx_count=1,
                    high_risk_flags=1,
                )
            )
        ),
    )
    result = contract.evaluate_latest_evidence("agent-bridge")
    latest_evidence = contract.get_latest_evidence("agent-bridge")
    decision = contract.can_execute("agent-bridge", "TREASURY_MESSAGE_SEND")

    assert stored["sequence"] == 1
    assert stored["ingress_kind"] == "bridge"
    assert stored["bridge_message_id"] == "msg-1"
    assert stored["bridge_source_chain_id"] == 84532
    assert stored["bridge_source_sender"] == "0x1234567890abcdef1234567890abcdef12345678"
    assert stored["manifest_schema_version"] == "rjp.base_manifest.v1"
    assert latest_evidence["bridge_message_id"] == "msg-1"
    assert latest_evidence["source_label"] == "base-sepolia-bridge"
    assert result["revision"] == 1
    assert result["evidence_sequence"] == 1
    assert result["outcome"] == "UNSAFE"
    assert result["risk_flags"] == ["FLAGGED_INTERACTION"]
    assert decision["allowed"] is False
    assert decision["reason"] == "latest outcome is UNSAFE"


def test_unbounded_approval_produces_unsafe_revision(direct_deploy):
    contract = deploy_contract(direct_deploy)

    contract.submit_evidence(
        "agent-risky",
        evidence_text=json.dumps(
            base_case(
                "agent-risky",
                tx_count=3,
                unbounded_approval_count=1,
                notes="A later Base window includes an unlimited token approval.",
            )
        ),
    )
    result = contract.evaluate_latest_evidence("agent-risky")
    handshake = contract.get_handshake_state("agent-risky", "trade")

    assert result["outcome"] == "UNSAFE"
    assert result["confidence_ppm"] == 940000
    assert result["risk_flags"] == ["UNBOUNDED_APPROVAL"]
    assert handshake["state"] == "UNSAFE"
    assert handshake["recommended_action"] == "DENY"
    assert handshake["reason_code"] == "OUTCOME_UNSAFE"
    assert handshake["recommended_action_is_hint"] is True
    assert handshake["state_is_primary"] is True
    assert handshake["enforcement_mode"] == "ENFORCED_GATE"


def test_caution_outcome_maps_to_review_handshake(direct_deploy):
    contract = deploy_contract(direct_deploy)

    contract.submit_evidence(
        "agent-caution",
        evidence_text=json.dumps(
            base_case(
                "agent-caution",
                failed_tx_count=1,
            )
        ),
    )
    result = contract.evaluate_latest_evidence("agent-caution")
    handshake = contract.get_handshake_state("agent-caution", "trade")

    assert result["outcome"] == "CAUTION"
    assert handshake["state"] == "CAUTION"
    assert handshake["recommended_action"] == "REVIEW"
    assert handshake["reason_code"] == "OUTCOME_CAUTION"
    assert handshake["recommended_action_is_hint"] is True
    assert handshake["state_is_primary"] is True
    assert handshake["enforcement_mode"] == "ENFORCED_GATE"


def test_case_uri_path_uses_deterministic_risk_rubric(direct_vm, direct_deploy):
    contract = deploy_contract(direct_deploy)
    direct_vm.mock_web(
        r".*example\.com/case-1.*",
        {
            "status": 200,
            "body": json.dumps(
                base_case(
                    "agent-web",
                    source_label="base-mainnet-rpc",
                    network="base-mainnet",
                    chain_id=8453,
                    start_block=20000000,
                    end_block=20000050,
                    start_block_hash="0xmain-start",
                    end_block_hash="0xmain-end",
                    tx_count=5,
                    failed_tx_count=1,
                    high_risk_flags=1,
                )
            ),
        },
    )

    stored = contract.submit_evidence("agent-web", evidence_uri="https://example.com/case-1")
    result = contract.evaluate_latest_evidence("agent-web")

    assert stored["source_network"] == "base-mainnet"
    assert stored["source_chain_id"] == 8453
    assert stored["source_label"] == "base-mainnet-rpc"
    assert stored["end_block"] == 20000050
    assert result["outcome"] == "UNSAFE"
    assert result["confidence_ppm"] == 970000
    assert result["risk_flags"] == ["FLAGGED_INTERACTION"]
    assert "High-risk Base interactions detected" in result["summary"]


def test_manifest_item_count_must_match_tx_count(direct_deploy):
    contract = deploy_contract(direct_deploy)
    case = base_case("agent-bad-manifest", tx_count=5)
    case["evidence_manifest"]["item_count"] = 3

    try:
        contract.submit_evidence("agent-bad-manifest", evidence_text=json.dumps(case))
        assert False, "expected submit_evidence to reject mismatched manifest count"
    except Exception as exc:
        assert "manifest item_count must match tx_count" in str(exc)


def test_llm_mode_invalid_json_falls_back_to_insufficient_data(direct_vm, direct_deploy):
    contract = deploy_contract(direct_deploy)
    contract.set_evaluation_mode("llm")
    direct_vm.mock_llm(r".*Return valid JSON only in this exact shape:.*", "not valid json")

    contract.submit_evidence(
        "agent-bad-llm",
        evidence_text=json.dumps(base_case("agent-bad-llm", tx_count=5)),
    )
    result = contract.evaluate_latest_evidence("agent-bad-llm")

    assert result["outcome"] == "INSUFFICIENT_DATA"
    assert result["confidence_ppm"] == 0
    assert result["risk_flags"] == ["MALFORMED_MODEL_OUTPUT"]
    assert result["reason_code"] == "MALFORMED_MODEL_OUTPUT"
    assert result["summary"] == "Model output was not valid JSON."


def test_llm_mode_recovers_json_wrapped_in_extra_text(direct_vm, direct_deploy):
    contract = deploy_contract(direct_deploy)
    contract.set_evaluation_mode("llm")
    direct_vm.mock_llm(
        r".*Return valid JSON only in this exact shape:.*",
        'Here is the judgment: {"outcome":"UNSAFE","confidence_ppm":910000,"risk_flags":["UNBOUNDED_APPROVAL"],"reason_code":"UNBOUNDED_APPROVAL","summary":"Unbounded approval indicates immediate risk."} Thanks.',
    )

    contract.submit_evidence(
        "agent-wrapped-llm",
        evidence_text=json.dumps(base_case("agent-wrapped-llm", unbounded_approval_count=1)),
    )
    result = contract.evaluate_latest_evidence("agent-wrapped-llm")

    assert result["outcome"] == "UNSAFE"
    assert result["confidence_ppm"] == 940000
    assert result["risk_flags"] == ["UNBOUNDED_APPROVAL"]
    assert result["reason_code"] == "UNBOUNDED_APPROVAL"
    assert result["summary"] == "Unbounded ERC-20 approvals detected: 1 approval transaction(s)."
