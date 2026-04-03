#!/usr/bin/env python3
"""
Verify that a case artifact's normalized features and evidence commitment can be
reproduced from the embedded manifest.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from build_base_case import (
    CASE_SCHEMA_VERSION,
    CASE_OBJECT_SCHEMA_VERSION,
    EXTRACTOR_VERSION,
    CASE_OBJECT_EXTRACTOR_VERSION,
    DOMAIN_CONFIGS,
    MANIFEST_SCHEMA_VERSION,
    build_evidence_manifest,
    canonical_json,
    extract_features_from_items,
    load_domain_spec,
    normalize_address,
    sha256_hex,
    validate_case_object_against_domain,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify a Base case artifact by recomputing its features and Merkle root."
    )
    parser.add_argument("case_file", help="Path to the case JSON artifact")
    parser.add_argument(
        "--flagged-address",
        action="append",
        default=[],
        help="Flagged address to use during feature recomputation; may be repeated",
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print the verification result")
    return parser.parse_args()


def verify_case(case_payload: dict[str, Any], flagged_addresses: set[str]) -> dict[str, Any]:
    manifest = case_payload.get("evidence_manifest")
    if not isinstance(manifest, dict):
        raise ValueError("case payload missing evidence_manifest object")

    items = manifest.get("items")
    if not isinstance(items, list):
        raise ValueError("evidence_manifest.items must be an array")

    schema_version = str(case_payload.get("schema_version", ""))
    is_case_object = schema_version == CASE_OBJECT_SCHEMA_VERSION
    expected_extractor_versions = {EXTRACTOR_VERSION, CASE_OBJECT_EXTRACTOR_VERSION}
    if is_case_object:
        subject_id = str(case_payload.get("subject_scope", {}).get("subject_id", ""))
        domain_id = str(case_payload.get("domain_id", ""))
        source = {
            "network": case_payload.get("observation_window", {}).get("source_network", ""),
            "chain_id": case_payload.get("observation_window", {}).get("source_chain_id", 0),
        }
        window = {
            "start_block": case_payload.get("observation_window", {}).get("observed_from_block", 0),
            "end_block": case_payload.get("observation_window", {}).get("observed_to_block", 0),
            "start_block_hash": case_payload.get("observation_window", {}).get("observed_from_block_hash", ""),
            "end_block_hash": case_payload.get("observation_window", {}).get("observed_to_block_hash", ""),
        }
        feature_summary = case_payload.get("feature_summary", {})
        claimed_features = {
            "tx_count": feature_summary.get("tx_count", 0),
            "failed_tx_count": feature_summary.get("failed_tx_count", 0),
            "unique_counterparties": feature_summary.get("unique_counterparties", 0),
            "unbounded_approval_count": feature_summary.get("unbounded_approval_count", 0),
            "high_risk_flags": feature_summary.get(
                "high_risk_flags",
                feature_summary.get("flagged_interaction_count", 0),
            ),
        }
        claimed_manifest_item_count = int(case_payload.get("evidence_manifest_item_count", -1))
        claimed_manifest_hash = str(case_payload.get("evidence_manifest_hash", ""))
        claimed_evidence_root = str(case_payload.get("evidence_root", ""))
        domain_spec = load_domain_spec(domain_id)
        domain_config = DOMAIN_CONFIGS.get(domain_id)
        if domain_config is not None:
            expected_extractor_versions.add(str(domain_config["extractor_version"]))
        target_scope = case_payload.get("target_scope", {})
        source_reference = case_payload.get("source_reference", {})
        domain_validation_ok = True
        try:
            validate_case_object_against_domain(
                domain_spec=domain_spec,
                network=str(source.get("network", "")),
                claim_type=str(case_payload.get("claim_type", "")),
                subject_type=str(case_payload.get("subject_scope", {}).get("subject_type", "")),
                target_type=str(target_scope.get("target_type", "")),
                target_contract=str(target_scope.get("target_contract", "")),
                target_protocol=str(target_scope.get("target_protocol", "")),
                target_context=target_scope.get("target_context", {}),
            )
        except ValueError:
            domain_validation_ok = False
    else:
        subject_id = str(case_payload.get("subject_id", ""))
        source = case_payload.get("source", {})
        window = case_payload.get("window", {})
        claimed_features = case_payload.get("features", {})
        claimed_manifest_item_count = int(manifest.get("item_count", -1))
        claimed_manifest_hash = ""
        claimed_evidence_root = str(manifest.get("merkle_root", ""))
        domain_validation_ok = True

    recomputed_manifest = build_evidence_manifest(
        subject_id=subject_id,
        network=str(source.get("network", "")),
        chain_id=int(source.get("chain_id", 0)),
        start_block=int(window.get("start_block", 0)),
        end_block=int(window.get("end_block", 0)),
        start_block_hash=str(window.get("start_block_hash", "")),
        end_block_hash=str(window.get("end_block_hash", "")),
        items=items,
    )
    recomputed_features = extract_features_from_items(
        subject_id=subject_id,
        items=items,
        flagged_addresses=flagged_addresses,
    )
    recomputed_manifest_hash = sha256_hex(canonical_json(recomputed_manifest))

    checks = {
        "case_schema_version": schema_version in (CASE_SCHEMA_VERSION, CASE_OBJECT_SCHEMA_VERSION),
        "extractor_version": str(case_payload.get("extractor_version", "")) in expected_extractor_versions,
        "manifest_schema_version": manifest.get("schema_version") == MANIFEST_SCHEMA_VERSION,
        "subject_id": normalize_address(subject_id)
        == normalize_address(str(manifest.get("subject_id", ""))),
        "source": canonical_json(
            {
                "network": source.get("network"),
                "chain_id": source.get("chain_id"),
            }
        )
        == canonical_json(recomputed_manifest["source"]),
        "window": canonical_json(window) == canonical_json(recomputed_manifest["window"]),
        "manifest_item_count": claimed_manifest_item_count == recomputed_manifest["item_count"],
        "manifest_leaf_hashes": canonical_json(manifest.get("leaf_hashes", []))
        == canonical_json(recomputed_manifest["leaf_hashes"]),
        "manifest_merkle_root": claimed_evidence_root == recomputed_manifest["merkle_root"],
        "features": canonical_json(claimed_features) == canonical_json(recomputed_features),
    }
    if is_case_object:
        checks["manifest_hash"] = claimed_manifest_hash == recomputed_manifest_hash
        checks["domain_validation"] = domain_validation_ok
        checks["domain_spec_hash"] = (
            str(source_reference.get("domain_spec_hash", ""))
            == domain_spec["policy_hashes"]["domain_spec_hash"]
        )
        checks["evidence_policy_hash"] = (
            str(source_reference.get("evidence_policy_hash", ""))
            == domain_spec["policy_hashes"]["evidence_policy_hash"]
        )

    return {
        "ok": all(checks.values()),
        "checks": checks,
        "recomputed": {
            "features": recomputed_features,
            "manifest_merkle_root": recomputed_manifest["merkle_root"],
            "manifest_item_count": recomputed_manifest["item_count"],
            "manifest_hash": recomputed_manifest_hash,
        },
    }


def main() -> int:
    args = parse_args()
    case_payload = json.loads(Path(args.case_file).read_text())
    flagged_addresses = {normalize_address(value) for value in args.flagged_address if value}
    result = verify_case(case_payload, flagged_addresses)
    output = json.dumps(result, indent=2 if args.pretty else None, sort_keys=args.pretty)
    print(output)
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
