#!/usr/bin/env python3
"""
Generate a self-contained proof bundle for the current RJP live stack.

The bundle captures:
- pinned Base case artifacts
- offline verification results
- current GenLayer and Base mirror reads
- Base policy model
- landed Base agent-action proofs
- judgment-vs-no-judgment comparison output
- signed coordinated-agent report and attestation verification
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RJP = "0x4a099B06141Ca3464318c28C4D2884B85d070D4f"
DEFAULT_BASE_MIRROR = "0x34EBfd4FcC379b14Cdd602485417a5C088228606"
DEFAULT_BASE_AGENT_DEMO = "0x60381D4088B7B2C985B248CE8B64287c13b71434"
DEFAULT_BASE_AGENT_DIRECT = "0x90db5f049c98f3fd510d866cb3386e50287b8ade"
DEFAULT_GENLAYER_RPC = "https://studio.genlayer.com/api"
DEFAULT_BASE_RPC = "https://sepolia.base.org"
DEFAULT_WINDOWS_FILE = ROOT / "demo_cases" / "coordinated_subject_windows.json"
DEFAULT_DEPLOYMENT_FILES = [
    ROOT / "deployments" / "studionet" / "ReasonedJudgmentPass.current.json",
    ROOT / "deployments" / "base-sepolia" / "BaseJudgmentMirror.current.json",
    ROOT / "deployments" / "base-sepolia" / "BaseAgentActionDemo.current.json",
    ROOT / "deployments" / "base-sepolia" / "BaseAgentDirectDemo.current.json",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a proof bundle for the current RJP stack.")
    parser.add_argument(
        "--bundle-dir",
        help="Output directory. Defaults to proof_bundles/proof-bundle-<timestamp>",
    )
    parser.add_argument(
        "--subject-windows-file",
        default=str(DEFAULT_WINDOWS_FILE),
        help="JSON mapping of subject -> {start_block, end_block}",
    )
    parser.add_argument(
        "--skip-actions",
        action="store_true",
        help="Skip live Base action writes and only collect read-side proofs",
    )
    parser.add_argument(
        "--skip-comparison",
        action="store_true",
        help="Skip the judgment-vs-no-judgment comparison write benchmark",
    )
    parser.add_argument(
        "--build-timeout",
        type=int,
        default=60,
        help="Timeout in seconds for Base evidence rebuild RPC calls",
    )
    parser.add_argument(
        "--build-block-batch-size",
        type=int,
        default=10,
        help="Block batch size to use when rebuilding Base evidence cases",
    )
    parser.add_argument(
        "--build-receipt-batch-size",
        type=int,
        default=10,
        help="Receipt batch size to use when rebuilding Base evidence cases",
    )
    return parser.parse_args()


def run_json(
    command: list[str],
    *,
    env: dict[str, str],
    cwd: Path = ROOT,
) -> tuple[dict[str, Any], str]:
    completed = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    stdout = completed.stdout.strip()
    try:
        return parse_json_document(stdout), stdout
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Command did not emit parseable JSON: {' '.join(command)}\n{stdout}") from exc


def run_capture(
    command: list[str],
    *,
    env: dict[str, str],
    cwd: Path = ROOT,
) -> str:
    completed = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    return completed.stdout


def run_checked(
    command: list[str],
    *,
    env: dict[str, str],
    cwd: Path = ROOT,
) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            command,
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip()
        stdout = exc.stdout.strip()
        details = stderr or stdout or "<no output>"
        raise RuntimeError(f"Command failed: {' '.join(command)}\n{details}") from exc


def parse_json_document(stdout: str) -> Any:
    decoder = json.JSONDecoder()
    for index, char in enumerate(stdout):
        if char not in "[{":
            continue
        try:
            value, end = decoder.raw_decode(stdout[index:])
        except json.JSONDecodeError:
            continue
        if stdout[index + end :].strip():
            continue
        return value
    raise json.JSONDecodeError("No JSON document found", stdout, 0)


def ensure_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def subject_label(subject_id: str) -> str:
    mapping = {
        "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001": "clean",
        "0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c": "risky",
    }
    return mapping.get(subject_id.lower(), subject_id.lower())


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def main() -> int:
    args = parse_args()

    private_key = ensure_env("PRIVATE_KEY")
    base_private_key = ensure_env("BASE_PRIVATE_KEY")
    coordinator_private_key = os.environ.get("COORDINATOR_PRIVATE_KEY", private_key)

    genlayer_rpc = os.environ.get("GENLAYER_RPC_URL", DEFAULT_GENLAYER_RPC)
    base_rpc = os.environ.get("BASE_RPC_URL", DEFAULT_BASE_RPC)
    rjp_address = os.environ.get("RJP_CONTRACT_ADDRESS", DEFAULT_RJP)
    base_mirror_address = os.environ.get("BASE_MIRROR_ADDRESS", DEFAULT_BASE_MIRROR)
    base_agent_demo_address = os.environ.get("BASE_AGENT_DEMO_ADDRESS", DEFAULT_BASE_AGENT_DEMO)
    base_agent_direct_address = os.environ.get("BASE_AGENT_DIRECT_ADDRESS", DEFAULT_BASE_AGENT_DIRECT)

    windows_path = Path(args.subject_windows_file).resolve()
    subject_windows = json.loads(windows_path.read_text())
    if not isinstance(subject_windows, dict) or not subject_windows:
        raise SystemExit("subject windows file must be a non-empty JSON object")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%SZ")
    bundle_dir = Path(args.bundle_dir) if args.bundle_dir else ROOT / "proof_bundles" / f"proof-bundle-{timestamp}"
    bundle_dir.mkdir(parents=True, exist_ok=True)

    sections = {
        "inputs": bundle_dir / "inputs",
        "cases": bundle_dir / "cases",
        "verifications": bundle_dir / "verifications",
        "genlayer": bundle_dir / "genlayer",
        "base": bundle_dir / "base",
        "actions": bundle_dir / "actions",
        "coordination": bundle_dir / "coordination",
        "comparisons": bundle_dir / "comparisons",
    }
    for section in sections.values():
        section.mkdir(parents=True, exist_ok=True)

    shutil.copy2(windows_path, sections["inputs"] / "subject_windows.json")
    for deployment_file in DEFAULT_DEPLOYMENT_FILES:
        if deployment_file.exists():
            shutil.copy2(deployment_file, sections["inputs"] / deployment_file.name)

    manifest: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "root": str(bundle_dir),
        "networks": {
            "genlayer_rpc": genlayer_rpc,
            "base_rpc": base_rpc,
        },
        "contracts": {
            "rjp": rjp_address,
            "base_mirror": base_mirror_address,
            "base_agent_demo": base_agent_demo_address,
            "base_agent_direct": base_agent_direct_address,
        },
        "subjects": {},
    }

    common_env = {
        **os.environ,
        "PRIVATE_KEY": private_key,
        "BASE_PRIVATE_KEY": base_private_key,
        "COORDINATOR_PRIVATE_KEY": coordinator_private_key,
        "GENLAYER_RPC_URL": genlayer_rpc,
        "BASE_RPC_URL": base_rpc,
        "RJP_CONTRACT_ADDRESS": rjp_address,
        "BASE_MIRROR_ADDRESS": base_mirror_address,
        "BASE_AGENT_DEMO_ADDRESS": base_agent_demo_address,
        "BASE_AGENT_DIRECT_ADDRESS": base_agent_direct_address,
    }

    subject_ids = list(subject_windows.keys())
    for subject_id, window in subject_windows.items():
        label = subject_label(subject_id)
        case_file = sections["cases"] / f"{label}.case.json"
        verify_file = sections["verifications"] / f"{label}.verify.json"
        judgment_file = sections["genlayer"] / f"{label}.judgment.json"
        mirror_file = sections["base"] / f"{label}.mirror.json"

        build_command = [
            "python3",
            "scripts/build_base_case.py",
            "--subject",
            subject_id,
            "--network",
            "base-sepolia",
            "--start-block",
            str(window["start_block"]),
            "--end-block",
            str(window["end_block"]),
            "--block-batch-size",
            str(max(args.build_block_batch_size, 1)),
            "--receipt-batch-size",
            str(max(args.build_receipt_batch_size, 1)),
            "--timeout",
            str(max(args.build_timeout, 1)),
            "--pretty",
            "--out",
            str(case_file),
        ]
        run_checked(build_command, cwd=ROOT, env=common_env)

        verify_json, _ = run_json(
            ["python3", "scripts/verify_base_case.py", str(case_file), "--pretty"],
            env=common_env,
        )
        write_json(verify_file, verify_json)

        judgment_json, _ = run_json(
            ["npx", "tsx", "scripts/get_latest_judgment_json.ts"],
            env={**common_env, "SUBJECT_ID": subject_id},
        )
        write_json(judgment_file, judgment_json)

        mirror_json, _ = run_json(
            ["npx", "tsx", "scripts/get_published_judgment_from_base.ts"],
            env={**common_env, "SUBJECT_ID": subject_id},
        )
        write_json(mirror_file, mirror_json)

        manifest["subjects"][label] = {
            "subject_id": subject_id,
            "window": window,
            "case_file": str(case_file.relative_to(bundle_dir)),
            "verify_file": str(verify_file.relative_to(bundle_dir)),
            "judgment_file": str(judgment_file.relative_to(bundle_dir)),
            "mirror_file": str(mirror_file.relative_to(bundle_dir)),
        }

    policy_model_json, _ = run_json(
        ["npx", "tsx", "scripts/get_base_policy_model.ts"],
        env=common_env,
    )
    write_json(sections["base"] / "policy_model.json", policy_model_json)

    if not args.skip_actions:
        for subject_id in subject_ids:
            label = subject_label(subject_id)
            action_json, _ = run_json(
                ["npx", "tsx", "scripts/stimulate_agent_on_base.ts"],
                env={**common_env, "SUBJECT_ID": subject_id, "ACTION_TYPE": "trade"},
            )
            write_json(sections["actions"] / f"{label}.judgment_agent_action.json", action_json)

    if not args.skip_comparison:
        comparison_json, _ = run_json(
            ["npx", "tsx", "scripts/benchmark_onchain_agents.ts"],
            env={
                **common_env,
                "SUBJECT_IDS": ",".join(subject_ids),
                "ROUNDS": "1",
                "ACTION_TYPE": "trade",
            },
        )
        write_json(sections["comparisons"] / "judgment_vs_direct.json", comparison_json)

    coordinated_report_path = sections["coordination"] / "coordinated_report.json"
    report_stdout = run_capture(
        ["npx", "tsx", "scripts/benchmark_coordinated_agents.ts"],
        env={
            **common_env,
            "SUBJECTS": ",".join(subject_ids),
            "ROUNDS": "1",
            "ACTION_TYPE": "trade",
        },
    )
    coordinated_report_path.write_text(report_stdout)

    attestation_verify_json, _ = run_json(
        ["npx", "tsx", "scripts/verify_coordinated_attestation.ts"],
        env={**common_env, "REPORT_FILE": str(coordinated_report_path)},
    )
    write_json(sections["coordination"] / "attestation_verification.json", attestation_verify_json)

    write_json(
        bundle_dir / "manifest.json",
        {
            **manifest,
            "files": {
                "policy_model": str((sections["base"] / "policy_model.json").relative_to(bundle_dir)),
                "coordinated_report": str(coordinated_report_path.relative_to(bundle_dir)),
                "attestation_verification": str(
                    (sections["coordination"] / "attestation_verification.json").relative_to(bundle_dir)
                ),
                "comparison": None
                if args.skip_comparison
                else str((sections["comparisons"] / "judgment_vs_direct.json").relative_to(bundle_dir)),
            },
            "claims": {
                "reproducible_evidence": True,
                "genlayer_revisioned_judgments": True,
                "base_mirrored_consumption": True,
                "judgment_aware_vs_direct_agent_comparison": not args.skip_comparison,
                "signed_offchain_coordination": True,
            },
        },
    )

    print(json.dumps({"bundle_dir": str(bundle_dir)}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
