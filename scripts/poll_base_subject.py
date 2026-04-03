#!/usr/bin/env python3
"""
Poll Base activity for a subject, rebuild normalized evidence on change, and
optionally submit/publish the updated case.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from build_base_case import NETWORKS, RpcClient, build_case, load_flagged_addresses, normalize_address


def stable_case_hash(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def load_state(state_path: Path) -> dict[str, Any]:
    if not state_path.exists():
        return {}
    return json.loads(state_path.read_text())


def save_state(state_path: Path, state: dict[str, Any]) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")


def render_command(template: str, case_path: Path, payload: dict[str, Any]) -> str:
    return template.format(
        case_path=str(case_path),
        subject_id=payload["subject_id"],
        start_block=payload["window"]["start_block"],
        end_block=payload["window"]["end_block"],
        case_hash=payload.get("case_hash", ""),
    )


def run_command(template: str | None, case_path: Path, payload: dict[str, Any], label: str) -> None:
    if not template:
        return
    command = render_command(template, case_path, payload)
    print(f"{label}: {command}")
    subprocess.run(command, shell=True, check=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Poll Base blocks for a subject and rebuild evidence when activity changes."
    )
    parser.add_argument("--subject", required=True, help="Subject wallet or agent address")
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
        "--out-dir",
        default="artifacts/polled-cases",
        help="Directory where rebuilt case files are written",
    )
    parser.add_argument(
        "--state-file",
        default="artifacts/poll-state/base_subject_state.json",
        help="Path to the poller state file",
    )
    parser.add_argument(
        "--submit-command",
        help="Shell command to run after writing a case file. Supports {case_path}, {subject_id}, {start_block}, {end_block}.",
    )
    parser.add_argument(
        "--publish-command",
        help="Shell command to run after writing a case file. Supports the same placeholders as submit-command.",
    )
    parser.add_argument("--once", action="store_true", help="Run a single poll cycle and exit")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print written case files")
    return parser.parse_args()


def build_window(latest_block: int, window_size: int) -> tuple[int, int]:
    end_block = latest_block
    start_block = max(0, latest_block - max(window_size - 1, 0))
    return start_block, end_block


def poll_once(args: argparse.Namespace, rpc: RpcClient, flagged_addresses: set[str], state_path: Path) -> bool:
    latest_block = int(rpc.call("eth_blockNumber", []), 16)
    start_block, end_block = build_window(latest_block, args.window_size)
    current_state = load_state(state_path)
    previous_end_block = int(current_state.get("end_block", -1))

    if previous_end_block >= 0 and end_block - previous_end_block < args.min_new_blocks:
        print(f"Skipping rebuild: latest block {end_block}, previous end block {previous_end_block}")
        return False

    network_info = NETWORKS[args.network]
    payload = build_case(
        rpc=rpc,
        subject_id=normalize_address(args.subject),
        network=args.network,
        source_label=args.source_label or network_info["source_label"],
        start_block=start_block,
        end_block=end_block,
        flagged_addresses=flagged_addresses,
        block_batch_size=max(args.block_batch_size, 1),
        receipt_batch_size=max(args.receipt_batch_size, 1),
    )

    case_digest = stable_case_hash(payload)
    if current_state.get("case_digest") == case_digest:
        print(f"No case change for blocks {start_block}-{end_block}")
        save_state(state_path, {"end_block": end_block, "case_digest": case_digest})
        return False

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    case_path = out_dir / f"{payload['subject_id']}-{start_block}-{end_block}.json"
    output = json.dumps(payload, indent=2 if args.pretty else None, sort_keys=args.pretty)
    case_path.write_text(output + ("\n" if not output.endswith("\n") else ""))

    print(f"Wrote case: {case_path}")
    run_command(args.submit_command, case_path, payload, "Submit command")
    run_command(args.publish_command, case_path, payload, "Publish command")

    save_state(
        state_path,
        {
            "subject_id": payload["subject_id"],
            "start_block": start_block,
            "end_block": end_block,
            "case_digest": case_digest,
            "case_path": str(case_path),
        },
    )
    return True


def main() -> int:
    args = parse_args()
    subject_id = normalize_address(args.subject)
    if not subject_id:
        raise SystemExit("subject must be a non-empty address")

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
