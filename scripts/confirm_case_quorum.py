#!/usr/bin/env python3
"""
Confirm multi-source agreement across one or more Base case artifacts.

This is a Phase 4-style hardening helper: it verifies each artifact
individually, groups valid artifacts by an exact equivalence fingerprint, and
reports whether any group reaches the required quorum.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

from build_base_case import canonical_json, normalize_address
from verify_base_case import verify_case


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify multiple Base case artifacts and report whether any exact-equivalence group reaches quorum."
    )
    parser.add_argument("case_files", nargs="+", help="One or more case JSON artifacts")
    parser.add_argument(
        "--quorum",
        type=int,
        default=2,
        help="Minimum number of agreeing valid artifacts required",
    )
    parser.add_argument(
        "--flagged-address",
        action="append",
        default=[],
        help="Flagged address to use during per-case verification; may be repeated",
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print the result")
    return parser.parse_args()


def build_case_equivalence_view(case_payload: dict[str, Any]) -> dict[str, Any]:
    manifest = case_payload.get("evidence_manifest", {})
    source = case_payload.get("source", {})
    window = case_payload.get("window", {})
    return {
        "schema_version": case_payload.get("schema_version"),
        "extractor_version": case_payload.get("extractor_version"),
        "subject_id": normalize_address(str(case_payload.get("subject_id", ""))),
        "domain_id": case_payload.get("domain_id"),
        "source": {
            "network": source.get("network"),
            "chain_id": source.get("chain_id"),
        },
        "window": {
            "start_block": window.get("start_block"),
            "end_block": window.get("end_block"),
            "start_block_hash": window.get("start_block_hash"),
            "end_block_hash": window.get("end_block_hash"),
        },
        "features": case_payload.get("features", {}),
        "manifest": {
            "schema_version": manifest.get("schema_version"),
            "selection_rule": manifest.get("selection_rule"),
            "item_count": manifest.get("item_count"),
            "leaf_hashes": manifest.get("leaf_hashes", []),
            "merkle_root": manifest.get("merkle_root"),
        },
    }


def equivalence_fingerprint(case_payload: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    view = build_case_equivalence_view(case_payload)
    canonical = canonical_json(view)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"0x{digest}", view


def confirm_case_quorum(
    cases: list[tuple[str, dict[str, Any]]],
    quorum: int,
    flagged_addresses: set[str],
) -> dict[str, Any]:
    if quorum <= 0:
        raise ValueError("quorum must be a positive integer")

    groups: dict[str, dict[str, Any]] = {}
    invalid_cases: list[dict[str, Any]] = []
    subject_ids: set[str] = set()
    windows: set[str] = set()

    for case_path, case_payload in cases:
        subject_id = normalize_address(str(case_payload.get("subject_id", "")))
        subject_ids.add(subject_id)
        window = case_payload.get("window", {})
        windows.add(
            canonical_json(
                {
                    "start_block": window.get("start_block"),
                    "end_block": window.get("end_block"),
                    "start_block_hash": window.get("start_block_hash"),
                    "end_block_hash": window.get("end_block_hash"),
                }
            )
        )

        verification = verify_case(case_payload, flagged_addresses)
        if not verification["ok"]:
            invalid_cases.append(
                {
                    "case_file": case_path,
                    "subject_id": subject_id,
                    "verification": verification,
                }
            )
            continue

        fingerprint, equivalence_view = equivalence_fingerprint(case_payload)
        group = groups.setdefault(
            fingerprint,
            {
                "fingerprint": fingerprint,
                "equivalence_view": equivalence_view,
                "case_files": [],
                "member_count": 0,
            },
        )
        group["case_files"].append(case_path)
        group["member_count"] += 1

    ordered_groups = sorted(groups.values(), key=lambda group: (-group["member_count"], group["fingerprint"]))
    accepted_group = ordered_groups[0] if ordered_groups else None
    subject_consistent = len({value for value in subject_ids if value}) <= 1
    window_consistent = len(windows) <= 1
    quorum_reached = accepted_group is not None and accepted_group["member_count"] >= quorum

    return {
        "ok": subject_consistent and window_consistent and quorum_reached,
        "quorum": quorum,
        "subject_consistent": subject_consistent,
        "window_consistent": window_consistent,
        "valid_case_count": sum(group["member_count"] for group in ordered_groups),
        "invalid_case_count": len(invalid_cases),
        "group_count": len(ordered_groups),
        "accepted_group": accepted_group,
        "groups": ordered_groups,
        "invalid_cases": invalid_cases,
    }


def main() -> int:
    args = parse_args()
    flagged_addresses = {normalize_address(value) for value in args.flagged_address if value}
    cases = [
        (str(Path(case_file).resolve()), json.loads(Path(case_file).read_text()))
        for case_file in args.case_files
    ]
    result = confirm_case_quorum(cases=cases, quorum=args.quorum, flagged_addresses=flagged_addresses)
    output = json.dumps(result, indent=2 if args.pretty else None, sort_keys=args.pretty)
    print(output)
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
