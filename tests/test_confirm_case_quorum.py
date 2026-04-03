import copy
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from confirm_case_quorum import confirm_case_quorum
from test_verify_base_case import sample_case


def wrap_case(path: str, case_payload: dict):
    return (path, case_payload)


def test_confirm_case_quorum_accepts_exact_agreement():
    case_a = sample_case()
    case_b = copy.deepcopy(case_a)

    result = confirm_case_quorum(
        cases=[
            wrap_case("/tmp/case-a.json", case_a),
            wrap_case("/tmp/case-b.json", case_b),
        ],
        quorum=2,
        flagged_addresses=set(),
    )

    assert result["ok"] is True
    assert result["subject_consistent"] is True
    assert result["window_consistent"] is True
    assert result["valid_case_count"] == 2
    assert result["invalid_case_count"] == 0
    assert result["accepted_group"]["member_count"] == 2


def test_confirm_case_quorum_rejects_conflicting_valid_cases():
    case_a = sample_case()
    case_b = copy.deepcopy(case_a)
    case_b["features"]["tx_count"] = 2
    case_b["evidence_manifest"]["item_count"] = 2

    result = confirm_case_quorum(
        cases=[
            wrap_case("/tmp/case-a.json", case_a),
            wrap_case("/tmp/case-b.json", case_b),
        ],
        quorum=2,
        flagged_addresses=set(),
    )

    assert result["ok"] is False
    assert result["group_count"] == 1
    assert result["valid_case_count"] == 1
    assert result["invalid_case_count"] == 1
    assert result["accepted_group"]["member_count"] == 1


def test_confirm_case_quorum_allows_invalid_outlier_when_valid_quorum_exists():
    case_a = sample_case()
    case_b = copy.deepcopy(case_a)
    case_bad = copy.deepcopy(case_a)
    case_bad["features"]["tx_count"] = 99

    result = confirm_case_quorum(
        cases=[
            wrap_case("/tmp/case-a.json", case_a),
            wrap_case("/tmp/case-b.json", case_b),
            wrap_case("/tmp/case-bad.json", case_bad),
        ],
        quorum=2,
        flagged_addresses=set(),
    )

    assert result["ok"] is True
    assert result["valid_case_count"] == 2
    assert result["invalid_case_count"] == 1
    assert result["accepted_group"]["member_count"] == 2


def test_confirm_case_quorum_rejects_mixed_subjects():
    case_a = sample_case()
    case_b = copy.deepcopy(case_a)
    case_b["subject_id"] = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    case_b["evidence_manifest"]["subject_id"] = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

    result = confirm_case_quorum(
        cases=[
            wrap_case("/tmp/case-a.json", case_a),
            wrap_case("/tmp/case-b.json", case_b),
        ],
        quorum=2,
        flagged_addresses=set(),
    )

    assert result["ok"] is False
    assert result["subject_consistent"] is False
