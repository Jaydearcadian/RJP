import sys
from argparse import Namespace
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import poll_base_subject
from poll_base_subject import build_window, poll_once, stable_case_hash


def test_build_window_tracks_latest_block():
    assert build_window(100, 5) == (96, 100)
    assert build_window(3, 10) == (0, 3)


def test_stable_case_hash_is_order_independent():
    a = {"b": 2, "a": 1}
    b = {"a": 1, "b": 2}

    assert stable_case_hash(a) == stable_case_hash(b)


class StubRpc:
    def __init__(self, latest_block: int):
        self.latest_block = latest_block

    def call(self, method, params):
        assert method == "eth_blockNumber"
        assert params == []
        return hex(self.latest_block)


def make_args(tmp_path: Path, **overrides) -> Namespace:
    values = {
        "subject": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "network": "base-sepolia",
        "window_size": 3,
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
    }
    values.update(overrides)
    return Namespace(**values)


def test_poll_once_writes_case_and_state(tmp_path, monkeypatch):
    payload = {
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
        "notes": "baseline",
    }

    monkeypatch.setattr(poll_base_subject, "build_case", lambda **_: payload)

    args = make_args(tmp_path)
    state_path = Path(args.state_file)
    changed = poll_once(args, StubRpc(latest_block=10), set(), state_path)

    assert changed is True
    written_cases = list((tmp_path / "cases").glob("*.json"))
    assert len(written_cases) == 1
    assert "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-8-10.json" in written_cases[0].name
    state = poll_base_subject.load_state(state_path)
    assert state["end_block"] == 10
    assert state["case_path"] == str(written_cases[0])


def test_poll_once_skips_when_case_digest_is_unchanged(tmp_path, monkeypatch):
    payload = {
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
        "notes": "baseline",
    }

    monkeypatch.setattr(poll_base_subject, "build_case", lambda **_: payload)

    args = make_args(tmp_path)
    state_path = Path(args.state_file)
    poll_base_subject.save_state(
        state_path,
        {
            "end_block": 7,
            "case_digest": stable_case_hash(payload),
        },
    )

    changed = poll_once(args, StubRpc(latest_block=10), set(), state_path)

    assert changed is False
    assert not list((tmp_path / "cases").glob("*.json"))
    state = poll_base_subject.load_state(state_path)
    assert state["end_block"] == 10
