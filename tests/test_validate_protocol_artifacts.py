import json
import subprocess
from pathlib import Path


def test_validate_protocol_artifacts_script():
    repo_root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        ["node", "scripts/validate_protocol_artifacts.js"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    payload = json.loads(result.stdout)
    assert payload["ok"] is True
    assert payload["domain_ids"] == [
        "counterparty_trust.base_trade_v1",
        "protocol_safety.base_erc20_permission_v1",
    ]
    assert len(payload["domains"]) == 2
    assert payload["domains"][0]["hashes"]["domain_spec_hash"].startswith("0x")
