import sys
from argparse import Namespace
from pathlib import Path
import subprocess


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import poll_base_subjects


class StubRpc:
    def __init__(self, latest_block: int):
        self.latest_block = latest_block

    def call(self, method, params):
        assert method == "eth_blockNumber"
        assert params == []
        return hex(self.latest_block)


def make_args(tmp_path: Path, **overrides) -> Namespace:
    values = {
        "subject": [],
        "subjects": None,
        "subjects_file": None,
        "subject_windows_file": None,
        "subject_windows": {},
        "subject_ids": [
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        "network": "base-sepolia",
        "window_size": 3,
        "start_block": None,
        "end_block": None,
        "poll_interval": 15.0,
        "min_new_blocks": 1,
        "rpc_url": None,
        "source_label": None,
        "flagged_address": [],
        "flagged_addresses_file": None,
        "block_batch_size": 10,
        "receipt_batch_size": 10,
        "timeout": 20,
        "out_dir": str(tmp_path / "cases"),
        "state_file": str(tmp_path / "state.json"),
        "submit_command": None,
        "publish_command": None,
        "once": True,
        "pretty": True,
        "output_format": "legacy",
    }
    values.update(overrides)
    return Namespace(**values)


def test_load_subjects_deduplicates_and_normalizes(tmp_path):
    subjects_file = tmp_path / "subjects.json"
    subjects_file.write_text(
        '["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"]'
    )
    args = Namespace(
        subject=["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        subjects="0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,0xcccccccccccccccccccccccccccccccccccccccc",
        subjects_file=str(subjects_file),
    )

    subject_ids = poll_base_subjects.load_subjects(args)

    assert subject_ids == [
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "0xcccccccccccccccccccccccccccccccccccccccc",
    ]


def test_load_subject_windows_normalizes_entries(tmp_path):
    windows_file = tmp_path / "windows.json"
    windows_file.write_text(
        '{"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA":{"start_block":10,"end_block":20},"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb":{"start_block":30,"end_block":40}}'
    )
    args = Namespace(subject_windows_file=str(windows_file))

    subject_windows = poll_base_subjects.load_subject_windows(args)

    assert subject_windows == {
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": (10, 20),
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb": (30, 40),
    }


def test_poll_once_writes_cases_and_bundle_index(tmp_path, monkeypatch):
    def fake_build_case(*, subject_id, **_):
        return {
            "subject_id": subject_id,
            "domain_id": "EXECUTION_INTEGRITY_V1",
            "window": {
                "start_block": 8,
                "end_block": 10,
                "start_block_hash": "0xstart",
                "end_block_hash": "0xend",
            },
            "source": {
                "network": "base-sepolia",
                "chain_id": 84532,
                "source_label": "base-sepolia-public-rpc",
            },
            "features": {
                "tx_count": 1,
                "failed_tx_count": 0,
                "unique_counterparties": 1,
                "unbounded_approval_count": 0,
                "high_risk_flags": 0,
            },
            "evidence_manifest": {
                "merkle_root": f"0x{subject_id[-8:]}",
            },
            "notes": f"baseline {subject_id}",
        }

    monkeypatch.setattr(poll_base_subjects, "build_case", fake_build_case)

    args = make_args(tmp_path)
    state_path = Path(args.state_file)
    result = poll_base_subjects.poll_once(args, StubRpc(latest_block=10), set(), state_path)

    assert result["changed"] is True
    assert result["changed_count"] == 2
    assert result["error_count"] == 0
    written_cases = sorted((tmp_path / "cases").glob("0x*.json"))
    assert len(written_cases) == 2

    bundle_latest = tmp_path / "cases" / "bundles" / "latest.json"
    assert bundle_latest.exists()
    bundle = poll_base_subjects.load_state(bundle_latest)
    assert bundle["subject_count"] == 2
    assert bundle["changed_count"] == 2
    assert bundle["error_count"] == 0
    assert {entry["subject_id"] for entry in bundle["subjects"]} == set(args.subject_ids)

    state = poll_base_subjects.load_state(state_path)
    assert state["end_block"] == 10
    assert set(state["subjects"].keys()) == set(args.subject_ids)


def test_poll_once_only_rewrites_changed_subjects(tmp_path, monkeypatch):
    payloads = {
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": {
            "subject_id": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "domain_id": "EXECUTION_INTEGRITY_V1",
            "window": {
                "start_block": 8,
                "end_block": 10,
                "start_block_hash": "0xstart",
                "end_block_hash": "0xend",
            },
            "source": {
                "network": "base-sepolia",
                "chain_id": 84532,
                "source_label": "base-sepolia-public-rpc",
            },
            "features": {
                "tx_count": 1,
                "failed_tx_count": 0,
                "unique_counterparties": 1,
                "unbounded_approval_count": 0,
                "high_risk_flags": 0,
            },
            "evidence_manifest": {"merkle_root": "0xaaaa"},
            "notes": "same",
        },
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb": {
            "subject_id": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "domain_id": "EXECUTION_INTEGRITY_V1",
            "window": {
                "start_block": 8,
                "end_block": 10,
                "start_block_hash": "0xstart",
                "end_block_hash": "0xend",
            },
            "source": {
                "network": "base-sepolia",
                "chain_id": 84532,
                "source_label": "base-sepolia-public-rpc",
            },
            "features": {
                "tx_count": 2,
                "failed_tx_count": 1,
                "unique_counterparties": 1,
                "unbounded_approval_count": 0,
                "high_risk_flags": 0,
            },
            "evidence_manifest": {"merkle_root": "0xbbbb"},
            "notes": "changed",
        },
    }

    monkeypatch.setattr(
        poll_base_subjects,
        "build_case",
        lambda *, subject_id, **_: payloads[subject_id],
    )

    args = make_args(tmp_path)
    state_path = Path(args.state_file)
    same_digest = poll_base_subjects.stable_case_hash(payloads[args.subject_ids[0]])
    previous_case_path = str(tmp_path / "cases" / "existing-a.json")
    poll_base_subjects.save_state(
        state_path,
        {
            "end_block": 7,
            "subjects": {
                args.subject_ids[0]: {
                    "case_digest": same_digest,
                    "case_path": previous_case_path,
                },
                args.subject_ids[1]: {
                    "case_digest": "0xold",
                    "case_path": str(tmp_path / "cases" / "existing-b.json"),
                },
            },
        },
    )

    result = poll_base_subjects.poll_once(args, StubRpc(latest_block=10), set(), state_path)

    assert result["changed"] is True
    assert result["changed_count"] == 1
    assert result["error_count"] == 0

    state = poll_base_subjects.load_state(state_path)
    assert state["subjects"][args.subject_ids[0]]["case_path"] == previous_case_path
    changed_case = state["subjects"][args.subject_ids[1]]["case_path"]
    assert changed_case.endswith("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-8-10.json")

    bundle = poll_base_subjects.load_state(tmp_path / "cases" / "bundles" / "latest.json")
    changed_flags = {entry["subject_id"]: entry["changed"] for entry in bundle["subjects"]}
    assert changed_flags == {
        args.subject_ids[0]: False,
        args.subject_ids[1]: True,
    }


def test_poll_once_supports_pinned_window(tmp_path, monkeypatch):
    observed = {}

    def fake_build_case(*, subject_id, start_block, end_block, **_):
        observed[subject_id] = (start_block, end_block)
        return {
            "subject_id": subject_id,
            "domain_id": "EXECUTION_INTEGRITY_V1",
            "window": {
                "start_block": start_block,
                "end_block": end_block,
                "start_block_hash": "0xstart",
                "end_block_hash": "0xend",
            },
            "source": {
                "network": "base-sepolia",
                "chain_id": 84532,
                "source_label": "base-sepolia-public-rpc",
            },
            "features": {
                "tx_count": 1,
                "failed_tx_count": 0,
                "unique_counterparties": 1,
                "unbounded_approval_count": 0,
                "high_risk_flags": 0,
            },
            "evidence_manifest": {"merkle_root": f"0x{subject_id[-8:]}"},
            "notes": "pinned",
        }

    monkeypatch.setattr(poll_base_subjects, "build_case", fake_build_case)

    args = make_args(tmp_path, start_block=100, end_block=110)
    result = poll_base_subjects.poll_once(args, StubRpc(latest_block=999), set(), Path(args.state_file))

    assert result["start_block"] == 100
    assert result["end_block"] == 110
    assert observed == {
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": (100, 110),
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb": (100, 110),
    }


def test_poll_once_supports_subject_specific_windows(tmp_path, monkeypatch):
    observed = {}

    def fake_build_case(*, subject_id, start_block, end_block, **_):
        observed[subject_id] = (start_block, end_block)
        return {
            "subject_id": subject_id,
            "domain_id": "EXECUTION_INTEGRITY_V1",
            "window": {
                "start_block": start_block,
                "end_block": end_block,
                "start_block_hash": "0xstart",
                "end_block_hash": "0xend",
            },
            "source": {
                "network": "base-sepolia",
                "chain_id": 84532,
                "source_label": "base-sepolia-public-rpc",
            },
            "features": {
                "tx_count": 1,
                "failed_tx_count": 0,
                "unique_counterparties": 1,
                "unbounded_approval_count": 0,
                "high_risk_flags": 0,
            },
            "evidence_manifest": {"merkle_root": f"0x{subject_id[-8:]}"},
            "notes": "subject-specific",
        }

    monkeypatch.setattr(poll_base_subjects, "build_case", fake_build_case)

    args = make_args(
        tmp_path,
        start_block=100,
        end_block=110,
        subject_windows={
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb": (200, 220),
        },
    )
    result = poll_base_subjects.poll_once(args, StubRpc(latest_block=999), set(), Path(args.state_file))

    assert result["start_block"] == 100
    assert result["end_block"] == 110
    assert observed == {
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": (100, 110),
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb": (200, 220),
    }


def test_poll_once_persists_partial_state_on_hook_failure(tmp_path, monkeypatch):
    def fake_build_case(*, subject_id, **_):
        return {
            "subject_id": subject_id,
            "domain_id": "EXECUTION_INTEGRITY_V1",
            "window": {
                "start_block": 8,
                "end_block": 10,
                "start_block_hash": "0xstart",
                "end_block_hash": "0xend",
            },
            "source": {
                "network": "base-sepolia",
                "chain_id": 84532,
                "source_label": "base-sepolia-public-rpc",
            },
            "features": {
                "tx_count": 1,
                "failed_tx_count": 0,
                "unique_counterparties": 1,
                "unbounded_approval_count": 0,
                "high_risk_flags": 0,
            },
            "evidence_manifest": {"merkle_root": f"0x{subject_id[-8:]}"},
            "notes": "hook-failure",
        }

    def fake_run_command(template, case_path, payload, bundle_path, label):
        if payload["subject_id"] == "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" and label == "Publish command":
            raise subprocess.CalledProcessError(1, "publish failed")

    monkeypatch.setattr(poll_base_subjects, "build_case", fake_build_case)
    monkeypatch.setattr(poll_base_subjects, "run_command", fake_run_command)

    args = make_args(tmp_path, publish_command="publish {subject_id}")
    state_path = Path(args.state_file)
    result = poll_base_subjects.poll_once(args, StubRpc(latest_block=10), set(), state_path)

    assert result["changed_count"] == 2
    assert result["error_count"] == 1

    state = poll_base_subjects.load_state(state_path)
    assert state["subjects"]["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]["status"] == "updated"
    assert state["subjects"]["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]["status"] == "hook_failed"
    assert "publish failed" in state["subjects"]["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]["error"]

    bundle = poll_base_subjects.load_state(tmp_path / "cases" / "bundles" / "latest.json")
    assert bundle["error_count"] == 1
    statuses = {entry["subject_id"]: entry["status"] for entry in bundle["subjects"]}
    assert statuses == {
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": "updated",
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb": "hook_failed",
    }


def test_poll_once_can_emit_case_objects(tmp_path, monkeypatch):
    def fake_build_case_object(*, subject_id, start_block, end_block, **_):
        return {
            "schema_version": "rjp.case_object.v1",
            "case_id": f"counterparty_trust.base_trade_v1:{subject_id}:{start_block}-{end_block}",
            "domain_id": "counterparty_trust.base_trade_v1",
            "subject_scope": {"subject_type": "wallet", "subject_id": subject_id},
            "target_scope": {
                "target_type": "wallet_contract_pair",
                "target_contract": "0x4200000000000000000000000000000000000006",
                "target_protocol": "erc20",
                "target_context": {"action_type": "trade"},
            },
            "observation_window": {
                "source_network": "base-sepolia",
                "source_chain_id": 84532,
                "observed_from_block": start_block,
                "observed_to_block": end_block,
                "observed_from_block_hash": "0xstart",
                "observed_to_block_hash": "0xend",
                "selection_mode": "pinned_range",
            },
            "claim_type": "counterparty_trade_readiness",
            "extractor_version": "base_counterparty_trade_case.v1",
            "evidence_root": "0xaaaa",
            "evidence_manifest_hash": "0xbbbb",
            "evidence_manifest_item_count": 1,
            "evidence_manifest": {"merkle_root": "0xaaaa"},
            "evidence_anchor": "base-sepolia:84532:8-10:0xaaaa",
            "feature_summary": {"tx_count": 1, "failed_tx_count": 0},
            "created_at": "2026-03-31T12:00:00Z",
            "source_reference": {"domain_spec_hash": "0x1", "evidence_policy_hash": "0x2"},
            "notes": "protocol case",
        }

    monkeypatch.setattr(poll_base_subjects, "build_case_object", fake_build_case_object)

    args = make_args(tmp_path, output_format="case-object")
    state_path = Path(args.state_file)
    result = poll_base_subjects.poll_once(args, StubRpc(latest_block=10), set(), state_path)

    assert result["changed"] is True
    state = poll_base_subjects.load_state(state_path)
    first_subject = args.subject_ids[0]
    assert state["subjects"][first_subject]["schema_version"] == "rjp.case_object.v1"
    assert state["subjects"][first_subject]["domain_id"] == "counterparty_trust.base_trade_v1"
    assert state["subjects"][first_subject]["case_id"].startswith("counterparty_trust.base_trade_v1:")
