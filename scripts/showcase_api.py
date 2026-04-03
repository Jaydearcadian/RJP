#!/usr/bin/env python3
"""
Local API for the showcase UI.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv

# Load .env file from project root
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from build_base_case import (
    build_compact_case_object,
    NETWORKS,
    RpcClient,
    build_case,
    build_case_object,
    normalize_address,
    resolve_network_rpc_urls,
)
from verify_base_case import verify_case


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PORT = 4174


def load_repo_env(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_repo_env(ROOT / ".env")


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


def submit_enabled() -> bool:
    required = ["PRIVATE_KEY", "GENLAYER_RPC_URL", "RJP_CONTRACT_ADDRESS"]
    return all(os.environ.get(name, "").strip() for name in required)


def base_publish_enabled() -> bool:
    required = ["BASE_PRIVATE_KEY", "BASE_MIRROR_ADDRESS"]
    return all(os.environ.get(name, "").strip() for name in required)


def compute_window(payload: dict[str, Any]) -> tuple[int, int, int]:
    mode = str(payload.get("window_mode", "relative"))
    current_block = int(payload.get("current_block", 0))
    if mode == "custom":
        start_block = int(payload["start_block"])
        end_block = int(payload["end_block"])
    else:
        relative_size = int(payload.get("relative_size", 1000))
        if current_block <= 0:
            raise ValueError("current_block must be positive for relative windows")
        end_block = current_block
        start_block = max(end_block - relative_size + 1, 0)
    if start_block > end_block:
        raise ValueError("start_block must be <= end_block")
    return start_block, end_block, current_block


def build_case_payload(payload: dict[str, Any]) -> dict[str, Any]:
    network = str(payload.get("network", "base-sepolia"))
    if network not in NETWORKS:
        raise ValueError(f"unsupported network: {network}")
    subject_id = normalize_address(str(payload.get("subject", "")))
    if not subject_id:
        raise ValueError("subject must be a non-empty address")

    start_block, end_block, current_block = compute_window(payload)
    rpc_urls = resolve_network_rpc_urls(
        network,
        override_rpc_url=str(payload.get("rpc_url") or ""),
        override_fallback_urls=payload.get("rpc_fallback_urls"),
    )
    rpc = RpcClient(
        rpc_url=rpc_urls[0],
        rpc_urls=rpc_urls,
        timeout=int(payload.get("timeout", 60)),
    )
    case_payload = build_case(
        rpc=rpc,
        subject_id=subject_id,
        network=network,
        source_label=str(payload.get("source_label") or NETWORKS[network]["source_label"]),
        start_block=start_block,
        end_block=end_block,
        flagged_addresses=set(),
        block_batch_size=max(int(payload.get("block_batch_size", 10)), 1),
        receipt_batch_size=max(int(payload.get("receipt_batch_size", 10)), 1),
    )
    verification = verify_case(case_payload, set())
    return {
        "subject_id": subject_id,
        "network": network,
        "current_block": current_block,
        "window": {
            "start_block": start_block,
            "end_block": end_block,
        },
        "case": case_payload,
        "verification": verification,
    }


def build_case_object_payload(payload: dict[str, Any]) -> dict[str, Any]:
    case_file = str(payload.get("case_file", "")).strip()
    if case_file:
        case_path = Path(case_file)
        if not case_path.exists():
            raise FileNotFoundError(f"case file not found: {case_path}")
        case_payload = json.loads(case_path.read_text())
        verification = verify_case(case_payload, set())
        observation_window = case_payload.get("observation_window") or {}
        return {
            "subject_id": (case_payload.get("subject_scope") or {}).get("subject_id", ""),
            "network": observation_window.get("source_network", ""),
            "current_block": observation_window.get("observed_to_block", 0),
            "window": {
                "start_block": observation_window.get("observed_from_block", 0),
                "end_block": observation_window.get("observed_to_block", 0),
            },
            "case": case_payload,
            "verification": verification,
        }

    network = str(payload.get("network", "base-sepolia"))
    if network not in NETWORKS:
        raise ValueError(f"unsupported network: {network}")
    subject_id = normalize_address(str(payload.get("subject", "")))
    if not subject_id:
        raise ValueError("subject must be a non-empty address")

    start_block, end_block, current_block = compute_window(payload)
    rpc_urls = resolve_network_rpc_urls(
        network,
        override_rpc_url=str(payload.get("rpc_url") or ""),
        override_fallback_urls=payload.get("rpc_fallback_urls"),
    )
    rpc = RpcClient(
        rpc_url=rpc_urls[0],
        rpc_urls=rpc_urls,
        timeout=int(payload.get("timeout", 60)),
    )
    case_payload = build_case_object(
        rpc=rpc,
        subject_id=subject_id,
        network=network,
        source_label=str(payload.get("source_label") or NETWORKS[network]["source_label"]),
        start_block=start_block,
        end_block=end_block,
        flagged_addresses=set(),
        block_batch_size=max(int(payload.get("block_batch_size", 10)), 1),
        receipt_batch_size=max(int(payload.get("receipt_batch_size", 10)), 1),
        domain_id=str(payload.get("domain_id", "counterparty_trust.base_trade_v1")),
        claim_type=(str(payload["claim_type"]) if payload.get("claim_type") else None),
        target_contract=(str(payload["target_contract"]) if payload.get("target_contract") else None),
        target_protocol=(str(payload["target_protocol"]) if payload.get("target_protocol") else None),
    )
    verification = verify_case(case_payload, set())
    return {
        "subject_id": subject_id,
        "network": network,
        "current_block": current_block,
        "window": {
            "start_block": start_block,
            "end_block": end_block,
        },
        "case": case_payload,
        "verification": verification,
    }


def summarize_case_object(case_payload: dict[str, Any], verification: dict[str, Any]) -> dict[str, Any]:
    subject_scope = case_payload.get("subject_scope") or {}
    target_scope = case_payload.get("target_scope") or {}
    observation_window = case_payload.get("observation_window") or {}
    feature_summary = case_payload.get("feature_summary") or {}
    return {
        "subject_id": subject_scope.get("subject_id", ""),
        "domain_id": case_payload.get("domain_id", ""),
        "case_id": case_payload.get("case_id", ""),
        "claim_type": case_payload.get("claim_type", ""),
        "source_network": observation_window.get("source_network", ""),
        "source_chain_id": observation_window.get("source_chain_id", 0),
        "observed_from_block": observation_window.get("observed_from_block", 0),
        "observed_to_block": observation_window.get("observed_to_block", 0),
        "target_type": target_scope.get("target_type", ""),
        "target_contract": target_scope.get("target_contract", ""),
        "target_protocol": target_scope.get("target_protocol", ""),
        "target_context": target_scope.get("target_context", {}),
        "feature_summary": feature_summary,
        "evidence_root": case_payload.get("evidence_root", ""),
        "evidence_manifest_hash": case_payload.get("evidence_manifest_hash", ""),
        "evidence_manifest_item_count": case_payload.get("evidence_manifest_item_count", 0),
        "evidence_anchor": case_payload.get("evidence_anchor", ""),
        "verification_ok": bool(verification.get("ok")),
        "verification": verification,
        "notes": case_payload.get("notes", ""),
    }


def verification_shortcuts(verification: dict[str, Any]) -> dict[str, Any]:
    checks = verification.get("checks") or {}
    return {
        "verification_ok": bool(verification.get("ok")),
        "manifest_valid": bool(checks.get("manifest_valid")),
        "root_valid": bool(checks.get("root_valid")),
        "hash_valid": bool(checks.get("hash_valid")),
    }


def with_submission_case(payload: dict[str, Any]) -> dict[str, Any]:
    case_payload = payload["case"]
    submission_case = build_compact_case_object(case_payload)
    return {
        **payload,
        "case_payload": case_payload,
        "submission_case": submission_case,
        **verification_shortcuts(payload.get("verification") or {}),
    }


def evaluate_case(case_payload: dict[str, Any]) -> dict[str, Any]:
    if not submit_enabled():
        raise RuntimeError("submit/evaluate unavailable: missing PRIVATE_KEY, GENLAYER_RPC_URL, or RJP_CONTRACT_ADDRESS")

    compact_case_payload = build_compact_case_object(case_payload)
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".case.json",
        prefix="rjp-compact-",
        delete=False,
        dir="/tmp",
    ) as handle:
        json.dump(compact_case_payload, handle)
        handle.write("\n")
        case_path = handle.name

    try:
        env = {
            **os.environ,
            "CASE_FILE": case_path,
        }
        command = ["npx", "tsx", "scripts/submit_base_case_to_rjp.ts"]
        completed = subprocess.run(
            command,
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )
        return {
            "submission_case": compact_case_payload,
            "submission_case_file": case_path,
            "result": parse_json_document(completed.stdout.strip()),
        }
    finally:
        try:
            Path(case_path).unlink(missing_ok=True)
        except OSError:
            pass


def publish_to_base_mirror(case_payload: dict[str, Any], judgment: dict[str, Any]) -> dict[str, Any]:
    """Publish judgment to Base mirror contract."""
    base_private_key = os.environ.get("BASE_PRIVATE_KEY", "").strip()
    base_mirror_address = os.environ.get("BASE_MIRROR_ADDRESS", "").strip()
    
    if not base_private_key:
        raise RuntimeError("publish to mirror unavailable: missing BASE_PRIVATE_KEY")
    if not base_mirror_address:
        raise RuntimeError("publish to mirror unavailable: missing BASE_MIRROR_ADDRESS")
    
    subject_id = (case_payload.get("subject_scope") or {}).get("subject_id", "")
    if not subject_id:
        raise ValueError("case_payload missing subject_id")
    
    env = {
        **os.environ,
        "SUBJECT_ID": subject_id,
        "BASE_MIRROR_ADDRESS": base_mirror_address,
        "BASE_PRIVATE_KEY": base_private_key,
    }
    
    completed = subprocess.run(
        ["npx", "tsx", "scripts/publish_judgment_to_base.ts"],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    return parse_json_document(completed.stdout.strip())


def run_json_script(command: list[str], extra_env: dict[str, str] | None = None) -> Any:
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    completed = subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    return parse_json_document(completed.stdout.strip())


class ShowcaseApiHandler(BaseHTTPRequestHandler):
    server_version = "RJPShowcaseAPI/0.1"

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json(
                {
                    "ok": True,
                    "submit_enabled": submit_enabled(),
                    "base_publish_enabled": base_publish_enabled(),
                    "default_network": "base-sepolia",
                }
            )
            return
        if parsed.path == "/current-block":
            query = parse_qs(parsed.query)
            network = query.get("network", ["base-sepolia"])[0]
            if network not in NETWORKS:
                self._send_error(HTTPStatus.BAD_REQUEST, f"unsupported network: {network}")
                return
            rpc_urls = resolve_network_rpc_urls(network)
            rpc = RpcClient(rpc_url=rpc_urls[0], rpc_urls=rpc_urls, timeout=30)
            block_number = int(rpc.call("eth_blockNumber", []), 16)
            self._send_json({"network": network, "current_block": block_number})
            return
        if parsed.path == "/mirror-judgment":
            query = parse_qs(parsed.query)
            subject = query.get("subject", [""])[0].strip()
            if not subject:
                self._send_error(HTTPStatus.BAD_REQUEST, "missing subject")
                return
            mirror_address = (
                query.get("mirror_address", [""])[0].strip()
                or os.environ.get("BASE_MIRROR_ADDRESS", "").strip()
                or "0x34EBfd4FcC379b14Cdd602485417a5C088228606"
            )
            self._send_json(
                run_json_script(
                    ["npx", "tsx", "scripts/get_published_judgment_from_base.ts"],
                    {
                        "BASE_MIRROR_ADDRESS": mirror_address,
                        "SUBJECT_ID": subject,
                    },
                )
            )
            return
        if parsed.path == "/latest-judgment":
            if not submit_enabled():
                self._send_error(HTTPStatus.BAD_REQUEST, "latest judgment unavailable: missing PRIVATE_KEY, GENLAYER_RPC_URL, or RJP_CONTRACT_ADDRESS")
                return
            query = parse_qs(parsed.query)
            subject = query.get("subject", [""])[0].strip()
            if not subject:
                self._send_error(HTTPStatus.BAD_REQUEST, "missing subject")
                return
            self._send_json(
                run_json_script(
                    ["npx", "tsx", "scripts/get_latest_judgment_json.ts"],
                    {
                        "RJP_CONTRACT_ADDRESS": os.environ.get("RJP_CONTRACT_ADDRESS", "").strip(),
                        "SUBJECT_ID": subject,
                    },
                )
            )
            return
        if parsed.path == "/handshake-preview":
            query = parse_qs(parsed.query)
            subject = query.get("subject", [""])[0].strip()
            if not subject:
                self._send_error(HTTPStatus.BAD_REQUEST, "missing subject")
                return
            action_type = query.get("action_type", ["trade"])[0].strip() or "trade"
            demo_address = (
                query.get("demo_address", [""])[0].strip()
                or os.environ.get("BASE_AGENT_DEMO_ADDRESS", "").strip()
                or "0x60381D4088B7B2C985B248CE8B64287c13b71434"
            )
            self._send_json(
                run_json_script(
                    ["npx", "tsx", "scripts/preview_base_handshake.ts"],
                    {
                        "BASE_AGENT_DEMO_ADDRESS": demo_address,
                        "SUBJECT_ID": subject,
                        "ACTION_TYPE": action_type,
                    },
                )
            )
            return
        self._send_error(HTTPStatus.NOT_FOUND, "not found")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            payload = self._read_json()
            if parsed.path == "/build-case":
                self._send_json(with_submission_case(build_case_object_payload(payload)))
                return
            if parsed.path == "/evidence-summary":
                built = with_submission_case(build_case_object_payload(payload))
                self._send_json(
                    {
                        **built,
                        "summary": summarize_case_object(
                            built["case"],
                            built["verification"],
                        ),
                    }
                )
                return
            if parsed.path == "/build-and-evaluate":
                built = with_submission_case(build_case_object_payload(payload))
                evaluation = evaluate_case(built["case"])
                self._send_json({**built, "evaluation": evaluation})
                return
            if parsed.path == "/publish-mirror":
                # Publish judgment to Base mirror
                case_payload = payload.get("case_payload")
                judgment = payload.get("judgment")
                if not case_payload or not judgment:
                    self._send_error(HTTPStatus.BAD_REQUEST, "missing case_payload or judgment")
                    return
                result = publish_to_base_mirror(case_payload, judgment)
                self._send_json({"ok": True, "result": result})
                return
            self._send_error(HTTPStatus.NOT_FOUND, "not found")
        except subprocess.CalledProcessError as exc:
            self._send_error(HTTPStatus.BAD_GATEWAY, exc.stderr.strip() or exc.stdout.strip() or str(exc))
        except Exception as exc:  # noqa: BLE001
            self._send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8")
        value = json.loads(body or "{}")
        if not isinstance(value, dict):
            raise ValueError("request body must be a JSON object")
        return value

    def _send_json(self, payload: Any, status: int = HTTPStatus.OK) -> None:
        encoded = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _send_error(self, status: int, message: str) -> None:
        self._send_json({"ok": False, "error": message}, status=status)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the local showcase API server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), ShowcaseApiHandler)
    print(f"Serving showcase API on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
