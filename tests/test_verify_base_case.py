import json
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from build_base_case import build_evidence_manifest
from verify_base_case import verify_case


def sample_case():
    subject_id = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    items = [
        {
            "kind": "tx_receipt",
            "tx_hash": "0x1",
            "block_number": 10,
            "block_hash": "0xblock",
            "transaction_index": 0,
            "from": subject_id,
            "to": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "input": "0x",
            "status": 1,
            "logs": [],
        }
    ]
    manifest = build_evidence_manifest(
        subject_id=subject_id,
        network="base-sepolia",
        chain_id=84532,
        start_block=10,
        end_block=10,
        start_block_hash="0xblock",
        end_block_hash="0xblock",
        items=items,
    )
    return {
        "schema_version": "rjp.base_case.v1",
        "extractor_version": "base_execution_integrity.v1",
        "subject_id": subject_id,
        "domain_id": "EXECUTION_INTEGRITY_V1",
        "source": {
            "network": "base-sepolia",
            "chain_id": 84532,
            "source_label": "base-sepolia-public-rpc",
        },
        "window": {
            "start_block": 10,
            "end_block": 10,
            "start_block_hash": "0xblock",
            "end_block_hash": "0xblock",
        },
        "features": {
            "tx_count": 1,
            "failed_tx_count": 0,
            "unique_counterparties": 1,
            "unbounded_approval_count": 0,
            "high_risk_flags": 0,
        },
        "evidence_manifest": manifest,
        "notes": "sample",
    }


def sample_case_object():
    case = sample_case()
    manifest = case["evidence_manifest"]
    return {
        "schema_version": "rjp.case_object.v1",
        "case_id": "counterparty_trust.base_trade_v1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:10-10",
        "domain_id": "counterparty_trust.base_trade_v1",
        "subject_scope": {
            "subject_type": "wallet",
            "subject_id": case["subject_id"],
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
            "source_network": "base-sepolia",
            "source_chain_id": 84532,
            "observed_from_block": 10,
            "observed_to_block": 10,
            "observed_from_block_hash": "0xblock",
            "observed_to_block_hash": "0xblock",
            "selection_mode": "pinned_range",
        },
        "claim_type": "counterparty_trade_readiness",
        "extractor_version": "base_counterparty_trade_case.v1",
        "evidence_root": manifest["merkle_root"],
        "evidence_manifest_hash": "0x5f3eb1803a84522820c7bb548c6c408a331e44695a63dca4724705e0a611c275",
        "evidence_manifest_item_count": 1,
        "evidence_manifest": manifest,
        "evidence_anchor": "base-sepolia:84532:10-10:0xabc",
        "feature_summary": {
            **case["features"],
            "flagged_interaction_count": 0,
        },
        "created_at": "2026-03-31T12:00:00Z",
        "source_reference": {
            "domain_spec_hash": "0x35f3f3b605d54f91ad87e327787208214eda4dc1e585b10b2dc0cff253de6dea",
            "evidence_policy_hash": "0xd0be88441e4411f1029dca72a9b3082736b09656bedc9246e07ca7d6e7a0935a",
        },
        "notes": "sample",
    }


def sample_permission_case_object():
    case = sample_case()
    manifest = case["evidence_manifest"]
    return {
        "schema_version": "rjp.case_object.v1",
        "case_id": "protocol_safety.base_erc20_permission_v1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:10-10",
        "domain_id": "protocol_safety.base_erc20_permission_v1",
        "subject_scope": {
            "subject_type": "wallet",
            "subject_id": case["subject_id"],
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
            "source_network": "base-sepolia",
            "source_chain_id": 84532,
            "observed_from_block": 10,
            "observed_to_block": 10,
            "observed_from_block_hash": "0xblock",
            "observed_to_block_hash": "0xblock",
            "selection_mode": "pinned_range",
        },
        "claim_type": "erc20_permission_safety",
        "extractor_version": "base_erc20_permission_case.v1",
        "evidence_root": manifest["merkle_root"],
        "evidence_manifest_hash": "0x5f3eb1803a84522820c7bb548c6c408a331e44695a63dca4724705e0a611c275",
        "evidence_manifest_item_count": 1,
        "evidence_manifest": manifest,
        "evidence_anchor": "base-sepolia:84532:10-10:0xabc",
        "feature_summary": {
            **case["features"],
            "flagged_interaction_count": 0,
        },
        "created_at": "2026-04-01T13:00:00Z",
        "source_reference": {
            "domain_spec_hash": "0xca76e3a0393e72a94c2485f6290fc9c2f940b8abfd4ab9719aae3a0b81f20f99",
            "evidence_policy_hash": "0x798fd545b9af478b90c837c14c7323b289f9cd8718c476b8d8ee6fd151d7081a",
        },
        "notes": "sample",
    }


def test_verify_case_accepts_reproducible_case():
    result = verify_case(sample_case(), set())

    assert result["ok"] is True
    assert all(result["checks"].values())


def test_verify_case_rejects_tampered_features():
    case = sample_case()
    case["features"]["tx_count"] = 2

    result = verify_case(case, set())

    assert result["ok"] is False
    assert result["checks"]["features"] is False


def test_verify_case_accepts_reproducible_case_object():
    result = verify_case(sample_case_object(), set())

    assert result["ok"] is True
    assert all(result["checks"].values())


def test_verify_case_rejects_case_object_with_bad_claim_type():
    payload = sample_case_object()
    payload["claim_type"] = "wrong_claim"

    result = verify_case(payload, set())

    assert result["ok"] is False
    assert result["checks"]["domain_validation"] is False


def test_verify_case_accepts_permission_case_object():
    result = verify_case(sample_permission_case_object(), set())

    assert result["ok"] is True
    assert all(result["checks"].values())


def test_verify_benchmark_caution_fixture():
    case_path = Path(__file__).resolve().parents[1] / "demo_cases" / "benchmark_caution_case.json"
    case_payload = json.loads(case_path.read_text())

    result = verify_case(case_payload, set())

    assert result["ok"] is True
    assert all(result["checks"].values())
