#!/usr/bin/env python3
"""
Poll Base activity for many subjects, rebuild normalized evidence on change, and
optionally submit/publish updated cases as one coordinated cycle.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from build_base_case import (
    NETWORKS,
    RpcClient,
    build_case,
    build_case_object,
    load_flagged_addresses,
    normalize_address,
)
from poll_base_subject import build_window, stable_case_hash


def load_state(state_path: Path) -> dict[str, Any]:
    if not state_path.exists():
        return {}
    return json.loads(state_path.read_text())


def save_state(state_path: Path, state: dict[str, Any]) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")


def load_subjects(args: argparse.Namespace) -> list[str]:
    subjects: list[str] = []

    if args.subject:
        subjects.extend(value.strip() for value in args.subject if value and value.strip())

    if args.subjects:
        subjects.extend(value.strip() for value in args.subjects.split(",") if value.strip())

    if args.subjects_file:
        values = json.loads(Path(args.subjects_file).read_text())
        if not isinstance(values, list):
            raise ValueError("subjects file must contain a JSON array")
        subjects.extend(str(value).strip() for value in values if str(value).strip())

    normalized: list[str] = []
    seen: set[str] = set()
    for value in subjects:
        subject_id = normalize_address(value)
        if subject_id and subject_id not in seen:
            normalized.append(subject_id)
            seen.add(subject_id)

    if not normalized:
        raise ValueError("at least one subject must be provided")
    return normalized


def load_subject_windows(args: argparse.Namespace) -> dict[str, tuple[int, int]]:
    if not args.subject_windows_file:
        return {}

    values = json.loads(Path(args.subject_windows_file).read_text())
    if not isinstance(values, dict):
        raise ValueError("subject windows file must contain a JSON object")

    result: dict[str, tuple[int, int]] = {}
    for raw_subject, raw_window in values.items():
        subject_id = normalize_address(str(raw_subject))
        if not subject_id:
            continue
        if not isinstance(raw_window, dict):
            raise ValueError("each subject window entry must be an object")
        start_block = raw_window.get("start_block")
        end_block = raw_window.get("end_block")
        if not isinstance(start_block, int) or not isinstance(end_block, int):
            raise ValueError("subject window entries must contain integer start_block and end_block")
        if end_block < start_block:
            raise ValueError("subject window end_block must be >= start_block")
        result[subject_id] = (start_block, end_block)
    return result


def render_command(template: str, case_path: Path, payload: dict[str, Any], bundle_path: Path) -> str:
    return template.format(
        case_path=str(case_path),
        bundle_path=str(bundle_path),
        subject_id=payload["subject_id"],
        start_block=payload["window"]["start_block"],
        end_block=payload["window"]["end_block"],
        case_hash=payload.get("case_hash", ""),
        manifest_root=payload.get("evidence_manifest", {}).get("merkle_root", ""),
    )


def run_command(
    template: str | None,
    case_path: Path,
    payload: dict[str, Any],
    bundle_path: Path,
    label: str,
) -> None:
    if not template:
        return
    command = render_command(template, case_path, payload, bundle_path)
    print(f"{label}: {command}")
    subprocess.run(command, shell=True, check=True)


def write_bundle_index(bundle_path: Path, bundle: dict[str, Any], pretty: bool) -> None:
    bundle_path.parent.mkdir(parents=True, exist_ok=True)
    output = json.dumps(bundle, indent=2 if pretty else None, sort_keys=pretty)
    bundle_path.write_text(output + ("\n" if not output.endswith("\n") else ""))


def build_bundle_paths(out_dir: Path, start_block: int, end_block: int) -> tuple[Path, Path]:
    bundle_dir = out_dir / "bundles"
    timestamped = bundle_dir / f"bundle-{start_block}-{end_block}.json"
    latest = bundle_dir / "latest.json"
    return timestamped, latest


def resolve_window(args: argparse.Namespace, latest_block: int) -> tuple[int, int]:
    if args.start_block is not None or args.end_block is not None:
        if args.start_block is None or args.end_block is None:
            raise ValueError("start_block and end_block must be provided together")
        if args.end_block < args.start_block:
            raise ValueError("end_block must be >= start_block")
        return args.start_block, args.end_block
    return build_window(latest_block, args.window_size)


def persist_progress(
    state_path: Path,
    latest_bundle_path: Path,
    bundle_path: Path,
    bundle: dict[str, Any],
    next_subjects_state: dict[str, Any],
    network: str,
    latest_block: int,
    start_block: int,
    end_block: int,
    pretty: bool,
) -> None:
    write_bundle_index(bundle_path, bundle, pretty)
    write_bundle_index(latest_bundle_path, bundle, pretty)
    save_state(
        state_path,
        {
            "network": network,
            "latest_block": latest_block,
            "start_block": start_block,
            "end_block": end_block,
            "bundle_path": str(bundle_path),
            "subjects": next_subjects_state,
        },
    )


def poll_once(args: argparse.Namespace, rpc: RpcClient, flagged_addresses: set[str], state_path: Path) -> dict[str, Any]:
    latest_block = int(rpc.call("eth_blockNumber", []), 16)
    default_start_block, default_end_block = resolve_window(args, latest_block)

    current_state = load_state(state_path)
    previous_end_block = int(current_state.get("end_block", -1))
    if previous_end_block >= 0 and default_end_block - previous_end_block < args.min_new_blocks:
        print(
            f"Skipping rebuild: latest block {default_end_block}, previous end block {previous_end_block}"
        )
        return {
            "changed": False,
            "latest_block": latest_block,
            "start_block": default_start_block,
            "end_block": default_end_block,
            "subjects": [],
        }

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    bundle_path, latest_bundle_path = build_bundle_paths(
        out_dir, default_start_block, default_end_block
    )
    subjects_state = current_state.get("subjects", {})
    next_subjects_state: dict[str, Any] = {}
    bundle_subjects: list[dict[str, Any]] = []
    changed_count = 0
    error_count = 0
    network_info = NETWORKS[args.network]
    bundle = {
        "network": args.network,
        "latest_block": latest_block,
        "window": {
            "start_block": default_start_block,
            "end_block": default_end_block,
        },
        "subject_count": len(args.subject_ids),
        "changed_count": changed_count,
        "error_count": error_count,
        "subjects": bundle_subjects,
    }

    for subject_id in args.subject_ids:
        previous_subject_state = subjects_state.get(subject_id, {})
        subject_start_block, subject_end_block = args.subject_windows.get(
            subject_id,
            (default_start_block, default_end_block),
        )
        case_path = out_dir / f"{subject_id}-{subject_start_block}-{subject_end_block}.json"
        subject_entry: dict[str, Any] = {
            "subject_id": subject_id,
            "case_path": str(case_path),
            "changed": False,
            "status": "pending",
            "window": {
                "start_block": subject_start_block,
                "end_block": subject_end_block,
            },
        }

        try:
            builder = build_case_object if args.output_format == "case-object" else build_case
            payload = builder(
                rpc=rpc,
                subject_id=subject_id,
                network=args.network,
                source_label=args.source_label or network_info["source_label"],
                start_block=subject_start_block,
                end_block=subject_end_block,
                flagged_addresses=flagged_addresses,
                block_batch_size=max(args.block_batch_size, 1),
                receipt_batch_size=max(args.receipt_batch_size, 1),
            )
            case_digest = stable_case_hash(payload)
            subject_entry["case_digest"] = case_digest
            subject_entry["schema_version"] = payload.get("schema_version")
            subject_entry["domain_id"] = payload.get("domain_id")
            subject_entry["case_id"] = payload.get("case_id")
            subject_entry["manifest_root"] = payload.get("evidence_manifest", {}).get("merkle_root")
            subject_entry["changed"] = case_digest != previous_subject_state.get("case_digest")

            if subject_entry["changed"]:
                output = json.dumps(payload, indent=2 if args.pretty else None, sort_keys=args.pretty)
                case_path.write_text(output + ("\n" if not output.endswith("\n") else ""))
                print(f"Wrote case: {case_path}")
                try:
                    run_command(args.submit_command, case_path, payload, bundle_path, "Submit command")
                    run_command(args.publish_command, case_path, payload, bundle_path, "Publish command")
                    subject_entry["status"] = "updated"
                except subprocess.CalledProcessError as exc:
                    subject_entry["status"] = "hook_failed"
                    subject_entry["error"] = str(exc)
                    error_count += 1
                changed_count += 1
            else:
                prior_case_path = previous_subject_state.get("case_path")
                if prior_case_path:
                    subject_entry["case_path"] = prior_case_path
                subject_entry["manifest_root"] = previous_subject_state.get(
                    "manifest_root",
                    subject_entry.get("manifest_root"),
                )
                subject_entry["status"] = "unchanged"
                print(
                    f"No case change for {subject_id} over blocks "
                    f"{subject_start_block}-{subject_end_block}"
                )

            next_subjects_state[subject_id] = {
                "case_digest": case_digest,
                "case_path": subject_entry["case_path"],
                "manifest_root": subject_entry.get("manifest_root"),
                "schema_version": subject_entry.get("schema_version"),
                "domain_id": subject_entry.get("domain_id"),
                "case_id": subject_entry.get("case_id"),
                "start_block": subject_start_block,
                "end_block": subject_end_block,
                "status": subject_entry["status"],
                "error": subject_entry.get("error"),
            }
        except Exception as exc:
            subject_entry["status"] = "build_failed"
            subject_entry["error"] = str(exc)
            error_count += 1
            next_subjects_state[subject_id] = {
                "case_digest": previous_subject_state.get("case_digest"),
                "case_path": previous_subject_state.get("case_path", subject_entry["case_path"]),
                "manifest_root": previous_subject_state.get("manifest_root"),
                "schema_version": previous_subject_state.get("schema_version"),
                "domain_id": previous_subject_state.get("domain_id"),
                "case_id": previous_subject_state.get("case_id"),
                "start_block": previous_subject_state.get("start_block", subject_start_block),
                "end_block": previous_subject_state.get("end_block", subject_end_block),
                "status": subject_entry["status"],
                "error": subject_entry["error"],
            }

        bundle["changed_count"] = changed_count
        bundle["error_count"] = error_count
        bundle_subjects.append(subject_entry)
        persist_progress(
            state_path=state_path,
            latest_bundle_path=latest_bundle_path,
            bundle_path=bundle_path,
            bundle=bundle,
            next_subjects_state=next_subjects_state,
            network=args.network,
            latest_block=latest_block,
            start_block=default_start_block,
            end_block=default_end_block,
            pretty=args.pretty,
        )

    return {
        "changed": changed_count > 0,
        "latest_block": latest_block,
        "start_block": default_start_block,
        "end_block": default_end_block,
        "subjects": bundle_subjects,
        "bundle_path": str(bundle_path),
        "changed_count": changed_count,
        "error_count": error_count,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Poll Base blocks for many subjects and rebuild evidence bundles when activity changes."
    )
    parser.add_argument(
        "--subject",
        action="append",
        default=[],
        help="Subject wallet or agent address; may be repeated",
    )
    parser.add_argument(
        "--subjects",
        help="Comma-separated subject addresses",
    )
    parser.add_argument(
        "--subjects-file",
        help="Path to a JSON file containing an array of subject addresses",
    )
    parser.add_argument(
        "--subject-windows-file",
        help="Path to a JSON object mapping subject addresses to {start_block, end_block}",
    )
    parser.add_argument(
        "--network",
        choices=sorted(NETWORKS.keys()),
        default="base-sepolia",
        help="Base network to query",
    )
    parser.add_argument(
        "--window-size",
        type=int,
        default=20,
        help="Number of latest blocks to include in each polling window",
    )
    parser.add_argument(
        "--start-block",
        type=int,
        help="Optional pinned start block for coordinated runs",
    )
    parser.add_argument(
        "--end-block",
        type=int,
        help="Optional pinned end block for coordinated runs",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=15.0,
        help="Polling interval in seconds",
    )
    parser.add_argument(
        "--min-new-blocks",
        type=int,
        default=1,
        help="Minimum new blocks before rebuilding evidence",
    )
    parser.add_argument("--rpc-url", help="Override the default RPC URL")
    parser.add_argument("--source-label", help="Override the source label")
    parser.add_argument(
        "--flagged-address",
        action="append",
        default=[],
        help="Address to treat as high risk; may be repeated",
    )
    parser.add_argument(
        "--flagged-addresses-file",
        help="Path to a JSON file containing an array of flagged addresses",
    )
    parser.add_argument("--block-batch-size", type=int, default=50)
    parser.add_argument("--receipt-batch-size", type=int, default=50)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument(
        "--output-format",
        choices=("legacy", "case-object"),
        default="case-object",
        help="Case artifact format to emit during polling",
    )
    parser.add_argument(
        "--out-dir",
        default="artifacts/polled-subjects",
        help="Directory where rebuilt case files and bundle indexes are written",
    )
    parser.add_argument(
        "--state-file",
        default="artifacts/poll-state/base_subjects_state.json",
        help="Path to the multi-subject poller state file",
    )
    parser.add_argument(
        "--submit-command",
        help="Shell command to run after writing a changed case. Supports {case_path}, {bundle_path}, {subject_id}, {start_block}, {end_block}, {manifest_root}.",
    )
    parser.add_argument(
        "--publish-command",
        help="Shell command to run after writing a changed case. Supports the same placeholders as submit-command.",
    )
    parser.add_argument("--once", action="store_true", help="Run a single poll cycle and exit")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print written case files")
    args = parser.parse_args()
    args.subject_ids = load_subjects(args)
    args.subject_windows = load_subject_windows(args)
    return args


def main() -> int:
    args = parse_args()
    network_info = NETWORKS[args.network]
    rpc = RpcClient(rpc_url=args.rpc_url or network_info["rpc_url"], timeout=args.timeout)
    flagged_addresses = load_flagged_addresses(args)
    state_path = Path(args.state_file)

    while True:
        try:
            poll_once(args, rpc, flagged_addresses, state_path)
        except Exception as exc:
            print(f"Poll error: {exc}", file=sys.stderr)
            if args.once:
                raise

        if args.once:
            return 0

        time.sleep(max(args.poll_interval, 1.0))


if __name__ == "__main__":
    sys.exit(main())
