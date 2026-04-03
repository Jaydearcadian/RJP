import json
import sys
import http.client
from pathlib import Path
import ssl
import urllib.error
import urllib.request


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from build_base_case import (
    CASE_SCHEMA_VERSION,
    CASE_OBJECT_SCHEMA_VERSION,
    COMPACT_CASE_OBJECT_SCHEMA_VERSION,
    CASE_OBJECT_EXTRACTOR_VERSION,
    EXTRACTOR_VERSION,
    MANIFEST_SCHEMA_VERSION,
    APPROVAL_TOPIC0,
    MAX_UINT256,
    DEFAULT_DOMAIN_ID,
    DEFAULT_CLAIM_TYPE,
    DOMAIN_CONFIGS,
    build_evidence_manifest,
    build_case,
    build_case_object,
    build_compact_case_object,
    compute_case_hash,
    extract_features,
    extract_features_from_items,
    fetch_blocks,
    fetch_receipts,
    normalize_case_hash_payload,
    normalize_address,
    parse_approve_input_value,
    load_domain_spec,
    validate_case_object_against_domain,
    build_evidence_items,
    RpcClient,
    resolve_network_rpc_urls,
    batch_with_retries,
)


def make_approval_log(owner: str, value: int) -> dict:
    owner_clean = normalize_address(owner)[2:]
    owner_topic = "0x" + ("0" * 24) + owner_clean
    return {
        "topics": [
            APPROVAL_TOPIC0,
            owner_topic,
            "0x" + ("0" * 24) + ("12" * 20),
        ],
        "data": hex(value),
    }


def test_extract_features_counts_subject_activity():
    subject = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    flagged = {"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}

    blocks = [
        {
            "transactions": [
                {
                    "hash": "0x1",
                    "from": subject,
                    "to": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    "input": "0x",
                },
                {
                    "hash": "0x2",
                    "from": subject,
                    "to": "0xcccccccccccccccccccccccccccccccccccccccc",
                    "input": "0x",
                },
                {
                    "hash": "0x3",
                    "from": "0xdddddddddddddddddddddddddddddddddddddddd",
                    "to": subject,
                    "input": "0x",
                },
            ]
        }
    ]

    receipts = {
        "0x1": {
            "status": "0x1",
            "logs": [make_approval_log(subject, MAX_UINT256)],
        },
        "0x2": {
            "status": "0x0",
            "logs": [],
        },
    }

    features = extract_features(subject, blocks, receipts, flagged)

    assert features == {
        "tx_count": 2,
        "failed_tx_count": 1,
        "unique_counterparties": 2,
        "unbounded_approval_count": 1,
        "high_risk_flags": 1,
    }


def test_normalize_address_handles_prefix_and_case():
    assert normalize_address("0xABCDEF") == "0xabcdef"
    assert normalize_address("ABCDEF") == "0xabcdef"


def test_extract_features_counts_unbounded_approval_from_input_once():
    subject = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    spender = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    approval_input = "0x095ea7b3" + ("0" * 24) + spender + f"{MAX_UINT256:064x}"

    blocks = [
        {
            "transactions": [
                {
                    "hash": "0x1",
                    "from": subject,
                    "to": "0xcccccccccccccccccccccccccccccccccccccccc",
                    "input": approval_input,
                }
            ]
        }
    ]

    receipts = {
        "0x1": {
            "status": "0x1",
            "logs": [make_approval_log(subject, MAX_UINT256)],
        }
    }

    features = extract_features(subject, blocks, receipts, set())

    assert features["tx_count"] == 1
    assert features["unbounded_approval_count"] == 1


def test_parse_approve_input_value_reads_amount():
    spender = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    raw = "0x095ea7b3" + ("0" * 24) + spender + f"{MAX_UINT256:064x}"

    assert parse_approve_input_value(raw) == MAX_UINT256


class StubRpc:
    def __init__(self):
        self.calls = []

    def batch(self, items):
        self.calls.append(items)
        results = []
        for method, params in items:
            if method == "eth_getBlockByNumber":
                results.append({"hash": params[0], "transactions": []})
            elif method == "eth_getTransactionReceipt":
                results.append({"status": "0x1", "logs": []})
            else:
                raise AssertionError(f"unexpected method {method}")
        return results


class DrpcLimitedRpc:
    def __init__(self):
        self.rpc_url = "https://lb.drpc.live/base-sepolia/demo"
        self.max_retries = 0
        self.retry_backoff_seconds = 0.0
        self.calls = []

    def batch(self, items):
        self.calls.append(items)
        return [{"ok": True, "size": len(items)} for _ in items]


class DrpcErrorThenSplitRpc:
    def __init__(self):
        self.rpc_url = "https://base-sepolia.g.alchemy.com/v2/demo"
        self.max_retries = 0
        self.retry_backoff_seconds = 0.0
        self.calls = []
        self.failed_once = False

    def batch(self, items):
        self.calls.append(items)
        if not self.failed_once:
            self.failed_once = True
            self.rpc_url = "https://lb.drpc.live/base-sepolia/demo"
            raise RuntimeError(
                'RPC HTTP error 500: [{"message":"Batch of more than 3 requests are not allowed on free tier","code":31}]'
            )
        return [{"ok": True, "size": len(items)} for _ in items]


def test_fetch_blocks_chunks_requests():
    rpc = StubRpc()

    blocks = fetch_blocks(rpc, [1, 2, 3, 4, 5], block_batch_size=2)

    assert len(blocks) == 5
    assert len(rpc.calls) == 3
    assert [len(batch) for batch in rpc.calls] == [2, 2, 1]


def test_fetch_receipts_chunks_requests():
    rpc = StubRpc()

    receipts = fetch_receipts(rpc, ["0x1", "0x2", "0x3"], receipt_batch_size=2)

    assert set(receipts.keys()) == {"0x1", "0x2", "0x3"}
    assert len(rpc.calls) == 2
    assert [len(batch) for batch in rpc.calls] == [2, 1]


def test_batch_with_retries_auto_limits_drpc_batches():
    rpc = DrpcLimitedRpc()

    results = batch_with_retries(
        rpc,
        [("eth_getBlockByNumber", [hex(block_number), True]) for block_number in range(7)],
    )

    assert len(results) == 7
    assert [len(batch) for batch in rpc.calls] == [3, 3, 1]


def test_batch_with_retries_splits_after_drpc_batch_error():
    rpc = DrpcErrorThenSplitRpc()

    results = batch_with_retries(
        rpc,
        [("eth_getTransactionReceipt", [f"0x{index:x}"]) for index in range(8)],
    )

    assert len(results) == 8
    assert len(rpc.calls[0]) == 8
    assert [len(batch) for batch in rpc.calls[1:]] == [3, 3, 2]


def test_build_evidence_items_and_manifest_are_reproducible():
    subject = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    blocks = [
        {
            "hash": "0xblock1",
            "number": "0x10",
            "transactions": [
                {
                    "hash": "0x1",
                    "transactionIndex": "0x0",
                    "from": subject,
                    "to": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    "input": "0x",
                }
            ],
        }
    ]
    receipts = {"0x1": {"status": "0x1", "logs": []}}

    items = build_evidence_items(subject, blocks, receipts)
    manifest = build_evidence_manifest(
        subject_id=subject,
        network="base-sepolia",
        chain_id=84532,
        start_block=16,
        end_block=16,
        start_block_hash="0xblock1",
        end_block_hash="0xblock1",
        items=items,
    )

    assert manifest["schema_version"] == MANIFEST_SCHEMA_VERSION
    assert manifest["item_count"] == 1
    assert len(manifest["leaf_hashes"]) == 1
    assert manifest["merkle_root"].startswith("0x")

    recomputed_features = extract_features_from_items(subject, items, set())
    assert recomputed_features["tx_count"] == 1
    assert recomputed_features["failed_tx_count"] == 0


def test_case_metadata_versions_are_expected():
    assert CASE_SCHEMA_VERSION == "rjp.base_case.v1"
    assert EXTRACTOR_VERSION == "base_execution_integrity.v1"


class EmptyRpc:
    def batch(self, items):
        results = []
        for method, params in items:
            if method == "eth_getBlockByNumber":
                block_number = int(params[0], 16)
                results.append(
                    {
                        "hash": f"0x{block_number:064x}",
                        "number": params[0],
                        "transactions": [],
                    }
                )
            elif method == "eth_getTransactionReceipt":
                results.append({"status": "0x1", "logs": []})
            else:
                raise AssertionError(f"unexpected method {method}")
        return results


class SegmentTrackingRpc:
    def __init__(self):
        self.block_group_sizes = []
        self.receipt_group_sizes = []

    def batch(self, items):
        if not items:
            return []
        method = items[0][0]
        if method == "eth_getBlockByNumber":
            self.block_group_sizes.append(len(items))
            return [
                {
                    "hash": f"0x{int(params[0], 16):064x}",
                    "number": params[0],
                    "transactions": [],
                }
                for _, params in items
            ]
        if method == "eth_getTransactionReceipt":
            self.receipt_group_sizes.append(len(items))
            return [{"status": "0x1", "logs": []} for _ in items]
        raise AssertionError(f"unexpected method {method}")


class FlakyOnceRpc:
    def __init__(self):
        self.calls = 0
        self.max_retries = 2
        self.retry_backoff_seconds = 0

    def batch(self, items):
        self.calls += 1
        if self.calls == 1:
            raise urllib.error.URLError("temporary tls issue")
        return [
            {
                "hash": f"0x{int(params[0], 16):064x}",
                "number": params[0],
                "transactions": [],
            }
            for _, params in items
        ]


class ResumeTrackingRpc:
    def __init__(self):
        self.segment_starts = []

    def batch(self, items):
        if not items:
            return []
        method = items[0][0]
        if method == "eth_getBlockByNumber":
            first_block = int(items[0][1][0], 16)
            self.segment_starts.append(first_block)
            return [
                {
                    "hash": f"0x{int(params[0], 16):064x}",
                    "number": params[0],
                    "transactions": [],
                }
                for _, params in items
            ]
        if method == "eth_getTransactionReceipt":
            return [{"status": "0x1", "logs": []} for _ in items]
        raise AssertionError(f"unexpected method {method}")


def test_build_case_object_emits_protocol_shape():
    payload = build_case_object(
        rpc=EmptyRpc(),
        subject_id="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        network="base-sepolia",
        source_label="base-sepolia-public-rpc",
        start_block=10,
        end_block=12,
        flagged_addresses=set(),
        block_batch_size=2,
        receipt_batch_size=2,
    )

    assert payload["schema_version"] == CASE_OBJECT_SCHEMA_VERSION
    assert payload["extractor_version"] == CASE_OBJECT_EXTRACTOR_VERSION
    assert payload["domain_id"] == DEFAULT_DOMAIN_ID
    assert payload["subject_scope"]["subject_type"] == "wallet"
    assert payload["observation_window"]["observed_from_block"] == 10
    assert payload["observation_window"]["observed_to_block"] == 12
    assert payload["feature_summary"]["tx_count"] == 0
    assert payload["evidence_root"] == payload["evidence_manifest"]["merkle_root"]
    assert payload["evidence_manifest_hash"].startswith("0x")
    assert payload["case_hash"].startswith("0x")


def test_build_case_object_matches_domain_policy():
    payload = build_case_object(
        rpc=EmptyRpc(),
        subject_id="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        network="base-sepolia",
        source_label="base-sepolia-public-rpc",
        start_block=10,
        end_block=12,
        flagged_addresses=set(),
        block_batch_size=2,
        receipt_batch_size=2,
    )
    domain_spec = load_domain_spec(DEFAULT_DOMAIN_ID)

    validate_case_object_against_domain(
        domain_spec=domain_spec,
        network=payload["observation_window"]["source_network"],
        claim_type=payload["claim_type"],
        subject_type=payload["subject_scope"]["subject_type"],
        target_type=payload["target_scope"]["target_type"],
        target_contract=payload["target_scope"]["target_contract"],
        target_protocol=payload["target_scope"]["target_protocol"],
        target_context=payload["target_scope"]["target_context"],
    )

    assert payload["claim_type"] == DEFAULT_CLAIM_TYPE
    assert (
        payload["source_reference"]["domain_spec_hash"]
        == domain_spec["policy_hashes"]["domain_spec_hash"]
    )


def test_build_case_object_supports_permission_safety_domain():
    domain_id = "protocol_safety.base_erc20_permission_v1"
    payload = build_case_object(
        rpc=EmptyRpc(),
        subject_id="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        network="base-sepolia",
        source_label="base-sepolia-public-rpc",
        start_block=10,
        end_block=12,
        flagged_addresses=set(),
        block_batch_size=2,
        receipt_batch_size=2,
        domain_id=domain_id,
    )
    domain_spec = load_domain_spec(domain_id)

    validate_case_object_against_domain(
        domain_spec=domain_spec,
        network=payload["observation_window"]["source_network"],
        claim_type=payload["claim_type"],
        subject_type=payload["subject_scope"]["subject_type"],
        target_type=payload["target_scope"]["target_type"],
        target_contract=payload["target_scope"]["target_contract"],
        target_protocol=payload["target_scope"]["target_protocol"],
        target_context=payload["target_scope"]["target_context"],
    )

    assert payload["domain_id"] == domain_id
    assert payload["claim_type"] == DOMAIN_CONFIGS[domain_id]["claim_type"]
    assert payload["extractor_version"] == DOMAIN_CONFIGS[domain_id]["extractor_version"]
    assert payload["target_scope"]["target_context"]["action_type"] == "approve"
    assert (
        payload["source_reference"]["domain_spec_hash"]
        == domain_spec["policy_hashes"]["domain_spec_hash"]
    )


def test_build_compact_case_object_omits_heavy_manifest_fields():
    full_payload = build_case_object(
        rpc=EmptyRpc(),
        subject_id="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        network="base-sepolia",
        source_label="base-sepolia-public-rpc",
        start_block=10,
        end_block=12,
        flagged_addresses=set(),
        block_batch_size=2,
        receipt_batch_size=2,
    )

    compact_payload = build_compact_case_object(full_payload)

    assert compact_payload["schema_version"] == COMPACT_CASE_OBJECT_SCHEMA_VERSION
    assert compact_payload["submission_payload_kind"] == "compact_submission"
    assert compact_payload["audit_schema_version"] == CASE_OBJECT_SCHEMA_VERSION
    assert compact_payload["audit_manifest_hash"] == full_payload["evidence_manifest_hash"]
    assert "items" not in compact_payload["evidence_manifest"]
    assert "leaf_hashes" not in compact_payload["evidence_manifest"]
    assert compact_payload["evidence_manifest"]["item_count"] == full_payload["evidence_manifest_item_count"]
    assert compact_payload["source"]["network"] == "base-sepolia"
    assert compact_payload["window"]["start_block"] == 10
    assert compact_payload["audit_case_hash"] == full_payload["case_hash"]
    assert compact_payload["case_hash"] == compute_case_hash(compact_payload)


def test_build_compact_case_object_backfills_legacy_source_window():
    full_payload = build_case_object(
        rpc=EmptyRpc(),
        subject_id="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        network="base-sepolia",
        source_label="base-sepolia-public-rpc",
        start_block=10,
        end_block=12,
        flagged_addresses=set(),
        block_batch_size=2,
        receipt_batch_size=2,
    )
    full_payload.pop("source", None)
    full_payload.pop("window", None)

    compact_payload = build_compact_case_object(full_payload)

    assert compact_payload["source"]["network"] == "base-sepolia"
    assert compact_payload["window"]["end_block"] == 12
    assert compact_payload["features"]["tx_count"] == full_payload["feature_summary"]["tx_count"]
    assert compact_payload["audit_case_hash"] == full_payload["case_hash"]
    assert compact_payload["case_hash"] == compute_case_hash(compact_payload)


def test_compute_case_hash_matches_normalized_payload_shape():
    payload = build_case_object(
        rpc=EmptyRpc(),
        subject_id="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        network="base-sepolia",
        source_label="base-sepolia-public-rpc",
        start_block=10,
        end_block=12,
        flagged_addresses=set(),
        block_batch_size=2,
        receipt_batch_size=2,
    )

    normalized = normalize_case_hash_payload(payload)

    assert payload["case_hash"] == compute_case_hash(payload)
    compact_payload = build_compact_case_object(payload)
    assert compact_payload["case_hash"] == compute_case_hash(compact_payload)
    assert compact_payload["audit_case_hash"] == payload["case_hash"]
    assert normalized["case_id"] == payload["case_id"]
    assert normalized["subject_id"] == payload["subject_scope"]["subject_id"]
    assert normalized["manifest_root"] == payload["evidence_manifest"]["merkle_root"]


def test_build_case_splits_large_window_into_smaller_range_pulls():
    rpc = SegmentTrackingRpc()

    payload = build_case(
        rpc=rpc,
        subject_id="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        network="base-sepolia",
        source_label="base-sepolia-public-rpc",
        start_block=10,
        end_block=14,
        flagged_addresses=set(),
        block_batch_size=50,
        receipt_batch_size=50,
        window_chunk_size=2,
    )

    assert payload["window"]["start_block"] == 10
    assert payload["window"]["end_block"] == 14
    assert rpc.block_group_sizes == [2, 2, 1]
    assert rpc.receipt_group_sizes == []


def test_build_case_retries_transient_rpc_failure():
    rpc = FlakyOnceRpc()

    payload = build_case(
        rpc=rpc,
        subject_id="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        network="base-sepolia",
        source_label="base-sepolia-public-rpc",
        start_block=10,
        end_block=11,
        flagged_addresses=set(),
        block_batch_size=2,
        receipt_batch_size=2,
        window_chunk_size=2,
    )

    assert payload["window"]["start_block"] == 10
    assert rpc.calls == 2


def test_build_case_resumes_from_progress_file(tmp_path: Path):
    progress_path = tmp_path / "resume-progress.json"
    progress_path.write_text(
        json.dumps(
            {
                "schema_version": "rjp.base_case_progress.v1",
                "subject_id": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "network": "base-sepolia",
                "start_block": 10,
                "end_block": 14,
                "window_chunk_size": 2,
                "completed_segments": [{"start_block": 10, "end_block": 11}],
                "evidence_items": [],
                "start_block_hash": "0x000000000000000000000000000000000000000000000000000000000000000a",
                "end_block_hash": "0x000000000000000000000000000000000000000000000000000000000000000b",
            }
        )
    )
    rpc = ResumeTrackingRpc()

    payload = build_case(
        rpc=rpc,
        subject_id="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        network="base-sepolia",
        source_label="base-sepolia-public-rpc",
        start_block=10,
        end_block=14,
        flagged_addresses=set(),
        block_batch_size=50,
        receipt_batch_size=50,
        window_chunk_size=2,
        progress_path=progress_path,
    )

    assert payload["window"]["start_block"] == 10
    assert payload["window"]["end_block"] == 14
    assert rpc.segment_starts == [12, 14]


def test_resolve_network_rpc_urls_prefers_env_and_fallbacks(monkeypatch):
    monkeypatch.setenv(
        "BASE_SEPOLIA_RPC_URL",
        "https://lb.drpc.live/base-sepolia/example",
    )
    monkeypatch.setenv(
        "BASE_SEPOLIA_RPC_FALLBACK_URLS",
        "https://base-sepolia.g.alchemy.com/v2/example,https://sepolia.base.org",
    )

    urls = resolve_network_rpc_urls("base-sepolia")

    assert urls == [
        "https://lb.drpc.live/base-sepolia/example",
        "https://base-sepolia.g.alchemy.com/v2/example",
        "https://sepolia.base.org",
    ]


class DummyResponse:
    def __init__(self, body: str):
        self._body = body.encode("utf-8")

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def test_rpc_client_tries_fallback_urls_after_tls_failure(monkeypatch):
    attempted_urls: list[str] = []

    def fake_urlopen(request, timeout=None, context=None):
        attempted_urls.append(request.full_url)
        if request.full_url == "https://primary.example":
            raise urllib.error.URLError(ssl.SSLError("bad record mac"))
        return DummyResponse('{"jsonrpc":"2.0","id":1,"result":"0x2a"}')

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    rpc = RpcClient(
        rpc_url="https://primary.example",
        rpc_urls=["https://primary.example", "https://fallback.example"],
        max_retries=0,
        retry_backoff_seconds=0,
    )

    assert rpc.call("eth_blockNumber", []) == "0x2a"
    assert attempted_urls == [
        "https://primary.example",
        "https://fallback.example",
    ]


def test_rpc_client_retries_incomplete_read(monkeypatch):
    attempts = {"count": 0}

    class IncompleteOnceResponse:
        def read(self) -> bytes:
            attempts["count"] += 1
            if attempts["count"] == 1:
                raise http.client.IncompleteRead(b'{"jsonrpc":"2.0"', 20)
            return b'{"jsonrpc":"2.0","id":1,"result":"0x2a"}'

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(urllib.request, "urlopen", lambda *args, **kwargs: IncompleteOnceResponse())

    rpc = RpcClient(
        rpc_url="https://primary.example",
        max_retries=1,
        retry_backoff_seconds=0,
    )

    assert rpc.call("eth_blockNumber", []) == "0x2a"
    assert attempts["count"] == 2
