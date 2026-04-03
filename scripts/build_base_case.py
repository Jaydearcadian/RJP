#!/usr/bin/env python3
"""
Build a normalized Base evidence payload for the RJP MVP.

The script reads Base Mainnet or Base Sepolia activity for one subject over one
block window and emits the compact JSON shape expected by the GenLayer
ReasonedJudgmentPass contract.
"""

from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import os
import sys
import time
from datetime import datetime, timezone
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


NETWORK_DEFAULTS = {
    "base-mainnet": {
        "chain_id": 8453,
        "rpc_url": "https://mainnet.base.org",
        "source_label": "base-mainnet-public-rpc",
    },
    "base-sepolia": {
        "chain_id": 84532,
        "rpc_url": "https://sepolia.base.org",
        "source_label": "base-sepolia-public-rpc",
    },
}


def network_env_prefix(network: str) -> str:
    return network.upper().replace("-", "_")


def parse_rpc_url_list(value: str | list[str] | None) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [item.strip() for item in value if item and item.strip()]
    return [item.strip() for item in value.split(",") if item.strip()]


def dedupe_preserving_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def resolve_network_rpc_urls(
    network: str,
    *,
    override_rpc_url: str | None = None,
    override_fallback_urls: list[str] | None = None,
) -> list[str]:
    defaults = NETWORK_DEFAULTS[network]
    prefix = network_env_prefix(network)
    generic_primary = os.environ.get("BASE_RPC_URL", "").strip() if network == "base-sepolia" else ""
    generic_fallbacks = (
        parse_rpc_url_list(os.environ.get("BASE_RPC_FALLBACK_URLS", ""))
        if network == "base-sepolia"
        else []
    )
    primary = (
        (override_rpc_url or "").strip()
        or os.environ.get(f"{prefix}_RPC_URL", "").strip()
        or generic_primary
        or defaults["rpc_url"]
    )
    fallbacks = (
        override_fallback_urls
        or parse_rpc_url_list(os.environ.get(f"{prefix}_RPC_FALLBACK_URLS", ""))
        or generic_fallbacks
    )
    return dedupe_preserving_order([primary, *fallbacks])


def resolve_network_source_label(network: str, default_label: str) -> str:
    prefix = network_env_prefix(network)
    configured_label = os.environ.get(f"{prefix}_SOURCE_LABEL", "").strip()
    if configured_label:
        return configured_label
    configured_url = os.environ.get(f"{prefix}_RPC_URL", "").strip()
    if network == "base-sepolia" and os.environ.get("BASE_RPC_URL", "").strip() and not configured_url:
        return f"{network}-configured-rpc"
    if configured_url:
        return f"{network}-configured-rpc"
    return default_label


NETWORKS = {
    network: {
        **defaults,
        "rpc_url": resolve_network_rpc_urls(network)[0],
        "rpc_fallback_urls": resolve_network_rpc_urls(network)[1:],
        "source_label": resolve_network_source_label(network, defaults["source_label"]),
    }
    for network, defaults in NETWORK_DEFAULTS.items()
}

CASE_SCHEMA_VERSION = "rjp.base_case.v1"
CASE_OBJECT_SCHEMA_VERSION = "rjp.case_object.v1"
COMPACT_CASE_OBJECT_SCHEMA_VERSION = "rjp.case_object.compact_submission.v1"
EXTRACTOR_VERSION = "base_execution_integrity.v1"
DOMAIN_CONFIGS = {
    "counterparty_trust.base_trade_v1": {
        "extractor_version": "base_counterparty_trade_case.v1",
        "claim_type": "counterparty_trade_readiness",
        "target_contract": "0x4200000000000000000000000000000000000006",
        "target_protocol": "erc20",
        "target_context": {
            "action_type": "trade",
            "asset_symbol": "WETH",
            "spender": "0x4200000000000000000000000000000000000006",
        },
    },
    "protocol_safety.base_erc20_permission_v1": {
        "extractor_version": "base_erc20_permission_case.v1",
        "claim_type": "erc20_permission_safety",
        "target_contract": "0x4200000000000000000000000000000000000006",
        "target_protocol": "erc20",
        "target_context": {
            "action_type": "approve",
            "asset_symbol": "WETH",
            "spender": "0x1111111111111111111111111111111111111111",
        },
    },
}
CASE_OBJECT_EXTRACTOR_VERSION = DOMAIN_CONFIGS["counterparty_trust.base_trade_v1"]["extractor_version"]
MANIFEST_SCHEMA_VERSION = "rjp.base_manifest.v1"
SELECTION_RULE = "all_outgoing_subject_transactions_in_window"
DEFAULT_DOMAIN_ID = "counterparty_trust.base_trade_v1"
DEFAULT_CLAIM_TYPE = "counterparty_trade_readiness"
DEFAULT_TARGET_CONTRACT = "0x4200000000000000000000000000000000000006"
DEFAULT_TARGET_PROTOCOL = "erc20"

APPROVAL_TOPIC0 = (
    "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
)
APPROVE_SELECTOR = "0x095ea7b3"
MAX_UINT256 = 2**256 - 1
UNBOUNDED_APPROVAL_THRESHOLD = 2**255


@dataclass
class RpcClient:
    rpc_url: str
    rpc_urls: list[str] | None = None
    timeout: int = 20
    user_agent: str = "rjp-base-adapter/0.1"
    max_retries: int = 2
    retry_backoff_seconds: float = 0.5

    def call(self, method: str, params: list[Any]) -> Any:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }
        return self._post_json(payload)["result"]

    def batch(self, items: list[tuple[str, list[Any]]]) -> list[Any]:
        if not items:
            return []
        payload = [
            {
                "jsonrpc": "2.0",
                "id": idx + 1,
                "method": method,
                "params": params,
            }
            for idx, (method, params) in enumerate(items)
        ]
        response = self._post_json(payload)
        if not isinstance(response, list):
            raise RuntimeError("Batch RPC response was not a list")
        ordered = sorted(response, key=lambda item: int(item["id"]))
        results: list[Any] = []
        for item in ordered:
            if "error" in item:
                raise RuntimeError(f"RPC batch item error: {item['error']}")
            if "result" not in item:
                raise RuntimeError(f"RPC batch item missing result: {item}")
            results.append(item["result"])
        return results

    def _post_json(self, payload: Any) -> Any:
        body = json.dumps(payload).encode("utf-8")
        rpc_urls = self.rpc_urls or [self.rpc_url]
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            for rpc_url in rpc_urls:
                request = urllib.request.Request(
                    rpc_url,
                    data=body,
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": self.user_agent,
                    },
                    method="POST",
                )
                try:
                    ssl_context = ssl.create_default_context()
                    ssl_context.check_hostname = False
                    with urllib.request.urlopen(request, timeout=self.timeout, context=ssl_context) as response:
                        raw = response.read().decode("utf-8")
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict) and "error" in parsed:
                        last_error = RuntimeError(f"RPC error: {parsed['error']}")
                        continue
                    if isinstance(parsed, list):
                        batch_errors = [item.get("error") for item in parsed if isinstance(item, dict) and "error" in item]
                        if batch_errors:
                            last_error = RuntimeError(f"RPC batch error: {batch_errors[0]}")
                            continue
                    self.rpc_url = rpc_url
                    return parsed
                except urllib.error.HTTPError as exc:
                    detail = exc.read().decode("utf-8", errors="replace")
                    last_error = RuntimeError(f"RPC HTTP error {exc.code}: {detail}")
                    continue
                except (
                    urllib.error.URLError,
                    ssl.SSLError,
                    json.JSONDecodeError,
                    http.client.IncompleteRead,
                ) as exc:
                    last_error = exc
                    continue
            if attempt < self.max_retries:
                time.sleep(self.retry_backoff_seconds * (2**attempt))

        raise RuntimeError(f"RPC connection error: {last_error}") from last_error


def provider_batch_limit(rpc_url: str | None) -> int | None:
    if not rpc_url:
        return None
    lowered = rpc_url.lower()
    if "drpc.live" in lowered:
        return 3
    return None


def normalize_address(value: str | None) -> str:
    if value is None:
        return ""
    value = value.strip().lower()
    if not value:
        return ""
    if not value.startswith("0x"):
        value = f"0x{value}"
    return value


def normalize_hex_value(value: str | None) -> str:
    if value is None:
        return "0x"
    normalized = value.strip().lower()
    if not normalized:
        return "0x"
    if not normalized.startswith("0x"):
        normalized = f"0x{normalized}"
    return normalized


def parse_hex_int(value: str | None) -> int:
    if value in (None, "", "0x"):
        return 0
    return int(value, 16)


def address_from_topic(topic: str | None) -> str:
    if topic is None:
        return ""
    topic = topic.lower()
    if topic.startswith("0x"):
        topic = topic[2:]
    return f"0x{topic[-40:]}"


def parse_approve_input_value(data: str | None) -> int | None:
    if data is None:
        return None

    raw = data.strip().lower()
    if not raw.startswith(APPROVE_SELECTOR):
        return None

    hex_body = raw[2:]
    expected_length = 8 + (64 * 2)
    if len(hex_body) < expected_length:
        return None

    amount_hex = hex_body[8 + 64 : 8 + 128]
    try:
        return int(amount_hex, 16)
    except ValueError:
        return None


def receipt_has_unbounded_approval_log(receipt: dict[str, Any], subject: str) -> bool:
    for log in receipt.get("logs") or []:
        if receipt_has_unbounded_approval_log_entry(log, subject):
            return True
    return False


def receipt_has_unbounded_approval_log_entry(log: dict[str, Any], subject: str) -> bool:
    topics = log.get("topics") or []
    if not topics or str(topics[0]).lower() != APPROVAL_TOPIC0:
        return False
    owner = address_from_topic(topics[1] if len(topics) > 1 else None)
    if owner != subject:
        return False
    if parse_hex_int(log.get("data")) >= UNBOUNDED_APPROVAL_THRESHOLD:
        return True
    return False


def is_unbounded_approval_tx(
    tx: dict[str, Any],
    receipt: dict[str, Any],
    subject: str,
) -> bool:
    input_value = parse_approve_input_value(tx.get("input"))
    if input_value is not None and input_value >= UNBOUNDED_APPROVAL_THRESHOLD:
        return True

    return receipt_has_unbounded_approval_log(receipt, subject)


def chunked[T](values: list[T], size: int) -> list[list[T]]:
    return [values[i : i + size] for i in range(0, len(values), size)]


def iter_window_segments(start_block: int, end_block: int, size: int) -> list[tuple[int, int]]:
    chunk_size = max(size, 1)
    segments: list[tuple[int, int]] = []
    current = start_block
    while current <= end_block:
        segment_end = min(current + chunk_size - 1, end_block)
        segments.append((current, segment_end))
        current = segment_end + 1
    return segments


def load_progress_state(
    progress_path: Path,
    *,
    subject_id: str,
    network: str,
    start_block: int,
    end_block: int,
    window_chunk_size: int,
) -> dict[str, Any]:
    if not progress_path.exists():
        return {
            "schema_version": "rjp.base_case_progress.v1",
            "subject_id": subject_id,
            "network": network,
            "start_block": start_block,
            "end_block": end_block,
            "window_chunk_size": window_chunk_size,
            "completed_segments": [],
            "evidence_items": [],
            "start_block_hash": "",
            "end_block_hash": "",
        }

    state = json.loads(progress_path.read_text())
    expected = {
        "subject_id": subject_id,
        "network": network,
        "start_block": start_block,
        "end_block": end_block,
        "window_chunk_size": window_chunk_size,
    }
    for key, value in expected.items():
        if state.get(key) != value:
            raise ValueError(f"progress file does not match current build for {key}")
    state.setdefault("completed_segments", [])
    state.setdefault("evidence_items", [])
    state.setdefault("start_block_hash", "")
    state.setdefault("end_block_hash", "")
    return state


def save_progress_state(progress_path: Path, state: dict[str, Any]) -> None:
    progress_path.parent.mkdir(parents=True, exist_ok=True)
    progress_path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def sha256_hex(value: bytes | str) -> str:
    digest = hashlib.sha256()
    if isinstance(value, str):
        digest.update(value.encode("utf-8"))
    else:
        digest.update(value)
    return f"0x{digest.hexdigest()}"


def stable_json_hash(value: Any) -> str:
    return sha256_hex(json.dumps(value, sort_keys=True))


def iso_utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_compact_text(value: Any, limit: int, *, lower: bool = False) -> str:
    normalized = " ".join(str(value).strip().split())
    if lower:
        normalized = normalized.lower()
    return normalized[:limit]


def normalize_case_hash_payload(case_payload: dict[str, Any]) -> dict[str, Any]:
    schema_version = normalize_compact_text(case_payload.get("schema_version", ""), 64)
    is_case_object = schema_version in (
        CASE_OBJECT_SCHEMA_VERSION,
        COMPACT_CASE_OBJECT_SCHEMA_VERSION,
    )

    if is_case_object:
        subject_scope = case_payload.get("subject_scope") or {}
        target_scope = case_payload.get("target_scope") or {}
        observation_window = case_payload.get("observation_window") or {}
        features = case_payload.get("feature_summary") or {}
        evidence_manifest = case_payload.get("evidence_manifest") or {}
        source = {
            "network": observation_window.get("source_network", ""),
            "chain_id": observation_window.get("source_chain_id", 0),
            "source_label": (case_payload.get("source") or {}).get("source_label", ""),
        }
        window = {
            "start_block": observation_window.get("observed_from_block", 0),
            "end_block": observation_window.get("observed_to_block", 0),
            "start_block_hash": observation_window.get("observed_from_block_hash", ""),
            "end_block_hash": observation_window.get("observed_to_block_hash", ""),
        }
        payload_subject = normalize_compact_text(subject_scope.get("subject_id", ""), 80)
    else:
        source = case_payload.get("source") or {}
        window = case_payload.get("window") or {}
        features = case_payload.get("features") or {}
        evidence_manifest = case_payload.get("evidence_manifest") or {}
        payload_subject = normalize_compact_text(case_payload.get("subject_id", ""), 80)

    case_schema_version = schema_version
    extractor_version = normalize_compact_text(case_payload.get("extractor_version", ""), 64)
    manifest_schema_version = normalize_compact_text(
        evidence_manifest.get("schema_version", ""),
        64,
    )
    manifest_root = normalize_compact_text(
        evidence_manifest.get("merkle_root", ""),
        80,
        lower=True,
    )
    evidence_manifest_hash = normalize_compact_text(
        case_payload.get("evidence_manifest_hash", ""),
        80,
        lower=True,
    )
    if not evidence_manifest_hash:
        evidence_manifest_hash = stable_json_hash(evidence_manifest)

    source_network = normalize_compact_text(source.get("network", ""), 40, lower=True)
    try:
        source_chain_id = max(int(source.get("chain_id", 0)), 0)
    except Exception:
        source_chain_id = 0
    source_label = normalize_compact_text(source.get("source_label", ""), 80) or "unspecified-source"
    try:
        start_block = max(int(window.get("start_block", 0)), 0)
    except Exception:
        start_block = 0
    try:
        end_block = max(int(window.get("end_block", 0)), 0)
    except Exception:
        end_block = 0
    start_block_hash = normalize_compact_text(window.get("start_block_hash", ""), 80, lower=True) or "0x0"
    end_block_hash = normalize_compact_text(window.get("end_block_hash", ""), 80, lower=True) or "0x0"
    notes = normalize_compact_text(case_payload.get("notes", ""), 240)

    normalized_features = {
        "tx_count": max(int(features.get("tx_count", 0)), 0),
        "failed_tx_count": max(int(features.get("failed_tx_count", 0)), 0),
        "unique_counterparties": max(int(features.get("unique_counterparties", 0)), 0),
        "unbounded_approval_count": max(int(features.get("unbounded_approval_count", 0)), 0),
        "high_risk_flags": max(
            int(features.get("high_risk_flags", features.get("flagged_interaction_count", 0))),
            0,
        ),
    }

    domain_id = normalize_compact_text(case_payload.get("domain_id", DEFAULT_DOMAIN_ID), 96)
    case_id = normalize_compact_text(
        case_payload.get(
            "case_id",
            f"{domain_id}:{payload_subject}:{start_block}-{end_block}",
        ),
        180,
    )
    claim_type = normalize_compact_text(
        case_payload.get("claim_type", "execution_integrity_assessment"),
        96,
    ) or "execution_integrity_assessment"

    if is_case_object:
        subject_type = normalize_compact_text(
            (case_payload.get("subject_scope") or {}).get("subject_type", "wallet"),
            48,
            lower=True,
        ) or "wallet"
        target_type = normalize_compact_text(
            (case_payload.get("target_scope") or {}).get("target_type", "wallet_contract_pair"),
            48,
            lower=True,
        ) or "wallet"
        target_contract = normalize_compact_text(
            (case_payload.get("target_scope") or {}).get("target_contract", ""),
            80,
            lower=True,
        )
        target_protocol = normalize_compact_text(
            (case_payload.get("target_scope") or {}).get("target_protocol", ""),
            80,
            lower=True,
        )
        target_context_json = json.dumps(
            (case_payload.get("target_scope") or {}).get("target_context", {}),
            sort_keys=True,
        )
        source_reference = case_payload.get("source_reference") or {}
        domain_spec_hash = normalize_compact_text(
            source_reference.get("domain_spec_hash", ""),
            80,
            lower=True,
        )
        evidence_policy_hash = normalize_compact_text(
            source_reference.get("evidence_policy_hash", ""),
            80,
            lower=True,
        )
    else:
        subject_type = "wallet"
        target_type = "wallet"
        target_contract = ""
        target_protocol = "base_activity"
        target_context_json = "{}"
        domain_spec_hash = ""
        evidence_policy_hash = ""

    return {
        "subject_id": payload_subject,
        "domain_id": domain_id,
        "case_id": case_id,
        "claim_type": claim_type,
        "subject_type": subject_type,
        "target_type": target_type,
        "target_contract": target_contract,
        "target_protocol": target_protocol,
        "target_context_json": target_context_json,
        "domain_spec_hash": domain_spec_hash,
        "evidence_policy_hash": evidence_policy_hash,
        "case_schema_version": case_schema_version,
        "extractor_version": extractor_version,
        "manifest_schema_version": manifest_schema_version,
        "manifest_root": manifest_root,
        "evidence_manifest_hash": evidence_manifest_hash,
        "manifest_item_count": max(
            int(case_payload.get("evidence_manifest_item_count", evidence_manifest.get("item_count", 0))),
            0,
        ),
        "source_network": source_network,
        "source_chain_id": source_chain_id,
        "source_label": source_label,
        "start_block": start_block,
        "end_block": end_block,
        "start_block_hash": start_block_hash,
        "end_block_hash": end_block_hash,
        "features": normalized_features,
        "notes": notes,
    }


def compute_case_hash(case_payload: dict[str, Any]) -> str:
    return stable_json_hash(normalize_case_hash_payload(case_payload))


def load_domain_spec(domain_id: str = DEFAULT_DOMAIN_ID) -> dict[str, Any]:
    protocol_path = (
        Path(__file__).resolve().parents[1]
        / "protocol"
        / "domains"
        / f"{domain_id}.json"
    )
    if not protocol_path.exists():
        raise FileNotFoundError(f"domain spec not found for {domain_id}: {protocol_path}")
    domain_spec = json.loads(protocol_path.read_text())
    expected_hashes = {
        "evidence_policy_hash": sha256_hex(canonical_json(domain_spec["evidence_policy"])),
        "evaluation_spec_hash": sha256_hex(canonical_json(domain_spec["evaluation_spec"])),
        "model_policy_hash": sha256_hex(canonical_json(domain_spec["model_policy"])),
        "equivalence_profile_hash": sha256_hex(canonical_json(domain_spec["equivalence_profile"])),
        "revision_policy_hash": sha256_hex(canonical_json(domain_spec["revision_policy"])),
    }
    expected_hashes["domain_spec_hash"] = sha256_hex(
        canonical_json({key: value for key, value in domain_spec.items() if key != "policy_hashes"})
    )
    for key, expected in expected_hashes.items():
        actual = domain_spec.get("policy_hashes", {}).get(key, "")
        if actual != expected:
            raise ValueError(f"domain spec {domain_id} has mismatched {key}")
    return domain_spec


def validate_case_object_against_domain(
    *,
    domain_spec: dict[str, Any],
    network: str,
    claim_type: str,
    subject_type: str,
    target_type: str,
    target_contract: str,
    target_protocol: str,
    target_context: dict[str, Any],
) -> None:
    if claim_type != domain_spec["evaluation_spec"]["claim_type"]:
        raise ValueError("claim_type does not match domain evaluation spec")
    if subject_type != domain_spec["subject_scope"]["subject_type"]:
        raise ValueError("subject_type does not match domain")
    if network not in domain_spec["subject_scope"]["allowed_subject_networks"]:
        raise ValueError("network is not allowed by domain")
    if target_type != domain_spec["target_scope"]["target_type"]:
        raise ValueError("target_type does not match domain")
    if normalize_address(target_contract) not in {
        normalize_address(value) for value in domain_spec["target_scope"]["target_contracts"]
    }:
        raise ValueError("target_contract is not allowed by domain")
    if target_protocol not in domain_spec["target_scope"]["target_protocols"]:
        raise ValueError("target_protocol is not allowed by domain")
    for key in domain_spec["target_scope"]["target_context_keys"]:
        if key not in target_context:
            raise ValueError(f"target_context missing required key: {key}")


def merkle_root(leaf_hashes: list[str]) -> str:
    if not leaf_hashes:
        return sha256_hex(b"")

    level = [bytes.fromhex(leaf_hash[2:]) for leaf_hash in leaf_hashes]
    while len(level) > 1:
        next_level: list[bytes] = []
        for index in range(0, len(level), 2):
            left = level[index]
            right = level[index + 1] if index + 1 < len(level) else left
            next_level.append(hashlib.sha256(left + right).digest())
        level = next_level
    return f"0x{level[0].hex()}"


def fetch_blocks(
    rpc: RpcClient,
    block_numbers: list[int],
    block_batch_size: int,
) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for block_group in chunked(block_numbers, max(block_batch_size, 1)):
        block_requests = [
            ("eth_getBlockByNumber", [hex(block_number), True])
            for block_number in block_group
        ]
        batch_results = batch_with_retries(rpc, block_requests)
        blocks.extend(batch_results)
        if block_group:
            time.sleep(0.05)
    return blocks


def fetch_receipts(
    rpc: RpcClient,
    tx_hashes: list[str],
    receipt_batch_size: int,
) -> dict[str, dict[str, Any]]:
    receipts_by_hash: dict[str, dict[str, Any]] = {}
    for tx_group in chunked(tx_hashes, max(receipt_batch_size, 1)):
        batch_requests = [("eth_getTransactionReceipt", [tx_hash]) for tx_hash in tx_group]
        batch_results = batch_with_retries(rpc, batch_requests)
        for tx_hash, receipt in zip(tx_group, batch_results, strict=False):
            if receipt is not None:
                receipts_by_hash[tx_hash] = receipt
        if tx_group:
            time.sleep(0.05)
    return receipts_by_hash


def batch_with_retries(rpc: Any, items: list[tuple[str, list[Any]]]) -> list[Any]:
    max_retries = max(int(getattr(rpc, "max_retries", 0)), 0)
    retry_backoff_seconds = max(float(getattr(rpc, "retry_backoff_seconds", 0.5)), 0.0)
    last_error: Exception | None = None
    active_batch_limit = provider_batch_limit(getattr(rpc, "rpc_url", ""))
    if active_batch_limit is not None and len(items) > active_batch_limit:
        results: list[Any] = []
        for batch_items in chunked(items, active_batch_limit):
            results.extend(batch_with_retries(rpc, batch_items))
        return results
    for attempt in range(max_retries + 1):
        try:
            return rpc.batch(items)
        except (urllib.error.URLError, ssl.SSLError, RuntimeError) as exc:
            last_error = exc
            error_text = str(exc).lower()
            if (
                "batch of more than 3 requests" in error_text
                or "drpc" in error_text and "batch" in error_text
            ):
                results: list[Any] = []
                provider_limit = provider_batch_limit(getattr(rpc, "rpc_url", "")) or 3
                for batch_items in chunked(items, provider_limit):
                    results.extend(batch_with_retries(rpc, batch_items))
                return results
            if attempt >= max_retries:
                break
            time.sleep(retry_backoff_seconds * (2**attempt))
    assert last_error is not None
    raise last_error


def build_evidence_items(
    subject_id: str,
    blocks: list[dict[str, Any]],
    receipts_by_hash: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    subject = normalize_address(subject_id)
    items: list[dict[str, Any]] = []

    for block in blocks:
        block_hash = normalize_hex_value(block.get("hash"))
        block_number = parse_hex_int(block.get("number"))

        for tx in block.get("transactions") or []:
            if normalize_address(tx.get("from")) != subject:
                continue

            tx_hash = normalize_hex_value(tx.get("hash"))
            receipt = receipts_by_hash.get(tx_hash, {})
            normalized_logs = [
                {
                    "address": normalize_address(log.get("address")),
                    "topics": [normalize_hex_value(topic) for topic in (log.get("topics") or [])],
                    "data": normalize_hex_value(log.get("data")),
                }
                for log in (receipt.get("logs") or [])
            ]

            items.append(
                {
                    "kind": "tx_receipt",
                    "tx_hash": tx_hash,
                    "block_number": block_number,
                    "block_hash": block_hash,
                    "transaction_index": parse_hex_int(tx.get("transactionIndex")),
                    "from": normalize_address(tx.get("from")),
                    "to": normalize_address(tx.get("to")),
                    "input": normalize_hex_value(tx.get("input")),
                    "status": parse_hex_int(receipt.get("status")),
                    "logs": normalized_logs,
                }
            )

    return items


def item_has_unbounded_approval(item: dict[str, Any], subject: str) -> bool:
    input_value = parse_approve_input_value(item.get("input"))
    if input_value is not None and input_value >= UNBOUNDED_APPROVAL_THRESHOLD:
        return True

    for log in item.get("logs") or []:
        if receipt_has_unbounded_approval_log_entry(log, subject):
            return True
    return False


def extract_features_from_items(
    subject_id: str,
    items: list[dict[str, Any]],
    flagged_addresses: set[str],
) -> dict[str, int]:
    subject = normalize_address(subject_id)
    tx_count = 0
    failed_tx_count = 0
    unique_counterparties: set[str] = set()
    unbounded_approval_count = 0
    high_risk_flags = 0

    for item in items:
        if normalize_address(item.get("from")) != subject:
            continue
        tx_count += 1

        tx_to = normalize_address(item.get("to"))
        if tx_to:
            unique_counterparties.add(tx_to)
        if tx_to in flagged_addresses:
            high_risk_flags += 1
        if int(item.get("status", 0)) == 0:
            failed_tx_count += 1
        if item_has_unbounded_approval(item, subject):
            unbounded_approval_count += 1

    return {
        "tx_count": tx_count,
        "failed_tx_count": failed_tx_count,
        "unique_counterparties": len(unique_counterparties),
        "unbounded_approval_count": unbounded_approval_count,
        "high_risk_flags": high_risk_flags,
    }


def build_evidence_manifest(
    subject_id: str,
    network: str,
    chain_id: int,
    start_block: int,
    end_block: int,
    start_block_hash: str,
    end_block_hash: str,
    items: list[dict[str, Any]],
) -> dict[str, Any]:
    leaf_hashes = [sha256_hex(canonical_json(item)) for item in items]
    return {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "selection_rule": SELECTION_RULE,
        "subject_id": subject_id,
        "source": {
            "network": network,
            "chain_id": chain_id,
        },
        "window": {
            "start_block": start_block,
            "end_block": end_block,
            "start_block_hash": start_block_hash,
            "end_block_hash": end_block_hash,
        },
        "item_count": len(items),
        "leaf_hashes": leaf_hashes,
        "merkle_root": merkle_root(leaf_hashes),
        "items": items,
    }


def extract_features(
    subject_id: str,
    blocks: list[dict[str, Any]],
    receipts_by_hash: dict[str, dict[str, Any]],
    flagged_addresses: set[str],
) -> dict[str, int]:
    items = build_evidence_items(subject_id, blocks, receipts_by_hash)
    return extract_features_from_items(subject_id, items, flagged_addresses)


def build_notes(payload: dict[str, Any]) -> str:
    features = payload["features"]
    return (
        f"Normalized {payload['source']['network']} evidence for "
        f"{payload['subject_id']} over blocks {payload['window']['start_block']}-"
        f"{payload['window']['end_block']}: tx_count={features['tx_count']}, "
        f"failed_tx_count={features['failed_tx_count']}, "
        f"unbounded_approval_count={features['unbounded_approval_count']}, "
        f"high_risk_flags={features['high_risk_flags']}."
    )


def build_case(
    rpc: RpcClient,
    subject_id: str,
    network: str,
    source_label: str,
    start_block: int,
    end_block: int,
    flagged_addresses: set[str],
    block_batch_size: int,
    receipt_batch_size: int,
    window_chunk_size: int = 100,
    progress_path: Path | None = None,
) -> dict[str, Any]:
    if end_block < start_block:
        raise ValueError("end_block must be >= start_block")

    progress_state = (
        load_progress_state(
            progress_path,
            subject_id=subject_id,
            network=network,
            start_block=start_block,
            end_block=end_block,
            window_chunk_size=window_chunk_size,
        )
        if progress_path
        else None
    )
    completed_segments = {
        (int(segment["start_block"]), int(segment["end_block"]))
        for segment in (progress_state or {}).get("completed_segments", [])
    }
    evidence_items: list[dict[str, Any]] = list((progress_state or {}).get("evidence_items", []))
    start_block_hash = str((progress_state or {}).get("start_block_hash", ""))
    end_block_hash = str((progress_state or {}).get("end_block_hash", ""))

    for segment_start, segment_end in iter_window_segments(start_block, end_block, window_chunk_size):
        if (segment_start, segment_end) in completed_segments:
            continue
        block_numbers = list(range(segment_start, segment_end + 1))
        blocks = fetch_blocks(rpc, block_numbers, block_batch_size)
        if any(block is None for block in blocks):
            raise RuntimeError("One or more requested blocks were not returned by the RPC")

        if not start_block_hash:
            start_block_hash = blocks[0]["hash"]
        end_block_hash = blocks[-1]["hash"]

        tx_hashes: list[str] = []
        for block in blocks:
            for tx in block.get("transactions") or []:
                if normalize_address(tx.get("from")) == normalize_address(subject_id):
                    tx_hash = normalize_address(tx.get("hash"))
                    if tx_hash:
                        tx_hashes.append(tx_hash)

        receipts_by_hash = fetch_receipts(rpc, tx_hashes, receipt_batch_size)
        evidence_items.extend(build_evidence_items(subject_id, blocks, receipts_by_hash))

        if progress_state is not None:
            progress_state["start_block_hash"] = start_block_hash
            progress_state["end_block_hash"] = end_block_hash
            progress_state["evidence_items"] = evidence_items
            progress_state["completed_segments"].append(
                {
                    "start_block": segment_start,
                    "end_block": segment_end,
                }
            )
            save_progress_state(progress_path, progress_state)

    features = extract_features_from_items(
        subject_id=subject_id,
        items=evidence_items,
        flagged_addresses=flagged_addresses,
    )
    evidence_manifest = build_evidence_manifest(
        subject_id=subject_id,
        network=network,
        chain_id=NETWORKS[network]["chain_id"],
        start_block=start_block,
        end_block=end_block,
        start_block_hash=start_block_hash,
        end_block_hash=end_block_hash,
        items=evidence_items,
    )

    payload = {
        "schema_version": CASE_SCHEMA_VERSION,
        "extractor_version": EXTRACTOR_VERSION,
        "subject_id": subject_id,
        "domain_id": "EXECUTION_INTEGRITY_V1",
        "source": {
            "network": network,
            "chain_id": NETWORKS[network]["chain_id"],
            "source_label": source_label,
        },
        "window": {
            "start_block": start_block,
            "end_block": end_block,
            "start_block_hash": start_block_hash,
            "end_block_hash": end_block_hash,
        },
        "features": features,
        "evidence_manifest": evidence_manifest,
        "notes": "",
    }
    payload["notes"] = build_notes(payload)
    return payload


def build_case_object(
    rpc: RpcClient,
    subject_id: str,
    network: str,
    source_label: str,
    start_block: int,
    end_block: int,
    flagged_addresses: set[str],
    block_batch_size: int,
    receipt_batch_size: int,
    window_chunk_size: int = 100,
    progress_path: Path | None = None,
    domain_id: str = DEFAULT_DOMAIN_ID,
    claim_type: str | None = None,
    target_contract: str | None = None,
    target_protocol: str | None = None,
    target_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    domain_config = DOMAIN_CONFIGS.get(domain_id)
    if domain_config is None:
        raise ValueError(f"unsupported domain_id: {domain_id}")
    legacy = build_case(
        rpc=rpc,
        subject_id=subject_id,
        network=network,
        source_label=source_label,
        start_block=start_block,
        end_block=end_block,
        flagged_addresses=flagged_addresses,
        block_batch_size=block_batch_size,
        receipt_batch_size=receipt_batch_size,
        window_chunk_size=window_chunk_size,
        progress_path=progress_path,
    )
    domain_spec = load_domain_spec(domain_id)
    resolved_target_contract = normalize_address(target_contract or domain_config["target_contract"])
    resolved_target_protocol = target_protocol or domain_config["target_protocol"]
    resolved_claim_type = claim_type or domain_config["claim_type"]
    manifest = legacy["evidence_manifest"]
    target_context = target_context or {
        **domain_config["target_context"],
        "spender": domain_config["target_context"].get("spender", resolved_target_contract),
    }
    validate_case_object_against_domain(
        domain_spec=domain_spec,
        network=legacy["source"]["network"],
        claim_type=resolved_claim_type,
        subject_type="wallet",
        target_type="wallet_contract_pair",
        target_contract=resolved_target_contract,
        target_protocol=resolved_target_protocol,
        target_context=target_context,
    )
    evidence_manifest_hash = sha256_hex(canonical_json(manifest))
    case_payload = {
        "schema_version": CASE_OBJECT_SCHEMA_VERSION,
        "case_id": (
            f"{domain_id}:{subject_id}:"
            f"{legacy['window']['start_block']}-{legacy['window']['end_block']}"
        ),
        "domain_id": domain_id,
        "subject_scope": {
            "subject_type": "wallet",
            "subject_id": subject_id,
        },
        "target_scope": {
            "target_type": "wallet_contract_pair",
            "target_contract": resolved_target_contract,
            "target_protocol": resolved_target_protocol,
            "target_context": target_context,
        },
        "observation_window": {
            "source_network": legacy["source"]["network"],
            "source_chain_id": legacy["source"]["chain_id"],
            "observed_from_block": legacy["window"]["start_block"],
            "observed_to_block": legacy["window"]["end_block"],
            "observed_from_block_hash": legacy["window"]["start_block_hash"],
            "observed_to_block_hash": legacy["window"]["end_block_hash"],
            "selection_mode": "pinned_range",
        },
        # Preserve legacy-compatible source/window fields because the live contract
        # normalization path still reads them during evidence intake.
        "source": {
            "network": legacy["source"]["network"],
            "chain_id": legacy["source"]["chain_id"],
            "source_label": legacy["source"]["source_label"],
        },
        "window": {
            "start_block": legacy["window"]["start_block"],
            "end_block": legacy["window"]["end_block"],
            "start_block_hash": legacy["window"]["start_block_hash"],
            "end_block_hash": legacy["window"]["end_block_hash"],
        },
        "claim_type": resolved_claim_type,
        "extractor_version": domain_config["extractor_version"],
        "evidence_root": manifest["merkle_root"],
        "evidence_manifest_hash": evidence_manifest_hash,
        "evidence_manifest_item_count": manifest["item_count"],
        "evidence_anchor": (
            f"{legacy['source']['network']}:{legacy['source']['chain_id']}:"
            f"{legacy['window']['start_block']}-{legacy['window']['end_block']}:"
            f"{manifest['merkle_root'][:18]}"
        ),
        "feature_summary": {
            **legacy["features"],
            "flagged_interaction_count": legacy["features"]["high_risk_flags"],
        },
        "created_at": iso_utc_now(),
        "source_reference": {
            "domain_spec_hash": domain_spec["policy_hashes"]["domain_spec_hash"],
            "evidence_policy_hash": domain_spec["policy_hashes"]["evidence_policy_hash"],
        },
        "evidence_manifest": manifest,
        "notes": legacy["notes"],
    }
    case_payload["case_hash"] = compute_case_hash(case_payload)
    return case_payload


def build_compact_case_object(case_payload: dict[str, Any]) -> dict[str, Any]:
    compact = json.loads(json.dumps(case_payload))
    manifest = compact.get("evidence_manifest")
    if not isinstance(manifest, dict):
        raise ValueError("case payload missing evidence_manifest object")

    observation_window = compact.get("observation_window")
    if isinstance(observation_window, dict):
        compact.setdefault(
            "source",
            {
                "network": observation_window.get("source_network", ""),
                "chain_id": observation_window.get("source_chain_id", 0),
                "source_label": "unspecified-source",
            },
        )
        compact.setdefault(
            "window",
            {
                "start_block": observation_window.get("observed_from_block", 0),
                "end_block": observation_window.get("observed_to_block", 0),
                "start_block_hash": observation_window.get("observed_from_block_hash", ""),
                "end_block_hash": observation_window.get("observed_to_block_hash", ""),
            },
        )
    feature_summary = compact.get("feature_summary")
    if isinstance(feature_summary, dict):
        compact.setdefault(
            "features",
            {
                "tx_count": feature_summary.get("tx_count", 0),
                "failed_tx_count": feature_summary.get("failed_tx_count", 0),
                "unique_counterparties": feature_summary.get("unique_counterparties", 0),
                "unbounded_approval_count": feature_summary.get("unbounded_approval_count", 0),
                "high_risk_flags": feature_summary.get(
                    "high_risk_flags",
                    feature_summary.get("flagged_interaction_count", 0),
                ),
            },
        )

    manifest.pop("items", None)
    manifest.pop("leaf_hashes", None)
    compact["schema_version"] = COMPACT_CASE_OBJECT_SCHEMA_VERSION
    compact["submission_payload_kind"] = "compact_submission"
    compact["audit_schema_version"] = case_payload.get("schema_version", "")
    compact["audit_manifest_hash"] = case_payload.get("evidence_manifest_hash", "")
    compact["audit_case_hash"] = case_payload.get("case_hash", "")
    compact["case_hash"] = compute_case_hash(compact)
    return compact


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a normalized Base evidence payload for the RJP MVP."
    )
    parser.add_argument("--subject", required=True, help="Subject wallet or agent address")
    parser.add_argument(
        "--network",
        choices=sorted(NETWORKS.keys()),
        default="base-sepolia",
        help="Base network to query",
    )
    parser.add_argument("--start-block", type=int, required=True, help="Start block number")
    parser.add_argument("--end-block", type=int, required=True, help="End block number")
    parser.add_argument("--rpc-url", help="Override the default RPC URL")
    parser.add_argument(
        "--rpc-fallback-url",
        action="append",
        default=[],
        help="Fallback RPC URL; may be repeated",
    )
    parser.add_argument("--source-label", help="Override the source label")
    parser.add_argument(
        "--progress-file",
        help="Optional JSON progress file for resumable segmented pulls",
    )
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
    parser.add_argument(
        "--block-batch-size",
        type=int,
        default=50,
        help="Number of block RPC calls per batch",
    )
    parser.add_argument(
        "--receipt-batch-size",
        type=int,
        default=50,
        help="Number of receipt RPC calls per batch",
    )
    parser.add_argument(
        "--window-chunk-size",
        type=int,
        default=100,
        help="Number of blocks to process per range segment before moving to the next pull",
    )
    parser.add_argument("--timeout", type=int, default=20, help="RPC timeout in seconds")
    parser.add_argument(
        "--rpc-retries",
        type=int,
        default=2,
        help="Number of retry attempts for transient RPC and TLS failures",
    )
    parser.add_argument(
        "--rpc-retry-backoff",
        type=float,
        default=0.5,
        help="Initial backoff seconds for RPC retries",
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    parser.add_argument("--out", help="Write JSON output to a file")
    parser.add_argument(
        "--format",
        choices=("legacy", "case-object"),
        default="case-object",
        help="Output the legacy MVP case or the protocol CaseObject shape",
    )
    parser.add_argument(
        "--submission-mode",
        choices=("full", "compact"),
        default="full",
        help="Emit the full audit case object or a compact submission case object",
    )
    parser.add_argument(
        "--domain-id",
        default=DEFAULT_DOMAIN_ID,
        help="Domain identifier for case-object output",
    )
    parser.add_argument(
        "--claim-type",
        default=None,
        help="Claim type for case-object output",
    )
    parser.add_argument(
        "--target-contract",
        default=None,
        help="Target contract for case-object output",
    )
    parser.add_argument(
        "--target-protocol",
        default=None,
        help="Target protocol for case-object output",
    )
    return parser.parse_args()


def load_flagged_addresses(args: argparse.Namespace) -> set[str]:
    flagged = {normalize_address(value) for value in args.flagged_address if value}
    if args.flagged_addresses_file:
        file_path = Path(args.flagged_addresses_file)
        values = json.loads(file_path.read_text())
        if not isinstance(values, list):
            raise ValueError("flagged addresses file must contain a JSON array")
        flagged.update(normalize_address(value) for value in values if value)
    flagged.discard("")
    return flagged


def main() -> int:
    args = parse_args()
    subject_id = normalize_address(args.subject)
    if not subject_id:
        raise SystemExit("subject must be a non-empty address")

    network_info = NETWORKS[args.network]
    rpc_urls = resolve_network_rpc_urls(
        args.network,
        override_rpc_url=args.rpc_url,
        override_fallback_urls=args.rpc_fallback_url or None,
    )
    rpc = RpcClient(
        rpc_url=rpc_urls[0],
        rpc_urls=rpc_urls,
        timeout=args.timeout,
        max_retries=max(args.rpc_retries, 0),
        retry_backoff_seconds=max(args.rpc_retry_backoff, 0.0),
    )
    flagged_addresses = load_flagged_addresses(args)
    source_label = args.source_label or network_info["source_label"]
    progress_path = Path(args.progress_file) if args.progress_file else None

    if args.format == "case-object":
        payload = build_case_object(
            rpc=rpc,
            subject_id=subject_id,
            network=args.network,
            source_label=source_label,
            start_block=args.start_block,
            end_block=args.end_block,
            flagged_addresses=flagged_addresses,
            block_batch_size=max(args.block_batch_size, 1),
            receipt_batch_size=max(args.receipt_batch_size, 1),
            window_chunk_size=max(args.window_chunk_size, 1),
            progress_path=progress_path,
            domain_id=args.domain_id,
            claim_type=args.claim_type,
            target_contract=args.target_contract,
            target_protocol=args.target_protocol,
        )
        if args.submission_mode == "compact":
            payload = build_compact_case_object(payload)
    else:
        payload = build_case(
            rpc=rpc,
            subject_id=subject_id,
            network=args.network,
            source_label=source_label,
            start_block=args.start_block,
            end_block=args.end_block,
            flagged_addresses=flagged_addresses,
            block_batch_size=max(args.block_batch_size, 1),
            receipt_batch_size=max(args.receipt_batch_size, 1),
            window_chunk_size=max(args.window_chunk_size, 1),
            progress_path=progress_path,
        )

    output = json.dumps(payload, indent=2 if args.pretty else None, sort_keys=args.pretty)
    if args.out:
        Path(args.out).write_text(output + ("\n" if not output.endswith("\n") else ""))
    else:
        print(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
