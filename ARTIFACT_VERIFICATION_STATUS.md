# Artifact Verification Status

This note records the current verification status of the frozen proof and
benchmark artifacts against the live stack.

Date:

- 2026-04-01

Canonical live contracts:

- GenLayer RJP:
  [ReasonedJudgmentPass.current.json](https://github.com/Jaydearcadian/RJP/blob/main/deployments/studionet/ReasonedJudgmentPass.current.json)
  - address: `0x4a099B06141Ca3464318c28C4D2884B85d070D4f`
  - mode: `llm`
  - prompt profile: `isolated_minimal`
  - freshness window: `250000`
- Base mirror:
  [BaseJudgmentMirror.current.json](https://github.com/Jaydearcadian/RJP/blob/main/deployments/base-sepolia/BaseJudgmentMirror.current.json)
  - address: `0x34EBfd4FcC379b14Cdd602485417a5C088228606`
- Base judgment-aware agent:
  [BaseAgentActionDemo.current.json](https://github.com/Jaydearcadian/RJP/blob/main/deployments/base-sepolia/BaseAgentActionDemo.current.json)
  - address: `0x60381D4088B7B2C985B248CE8B64287c13b71434`

Frozen proof bundle:

- [proof-bundle-20260401-165310Z](https://github.com/Jaydearcadian/RJP/tree/main/proof_bundles/proof-bundle-20260401-165310Z)

## What Was Verified

### 1. Proof Bundle Contract Alignment

Verified:

- bundle manifest `contracts.rjp` matches live RJP
- bundle manifest `contracts.base_mirror` matches live Base mirror
- bundle manifest `contracts.base_agent_demo` matches live judgment-aware Base
  agent

Files:

- [manifest.json](https://github.com/Jaydearcadian/RJP/blob/main/proof_bundles/proof-bundle-20260401-165310Z/manifest.json)
- [ReasonedJudgmentPass.current.json](https://github.com/Jaydearcadian/RJP/blob/main/deployments/studionet/ReasonedJudgmentPass.current.json)
- [BaseJudgmentMirror.current.json](https://github.com/Jaydearcadian/RJP/blob/main/deployments/base-sepolia/BaseJudgmentMirror.current.json)
- [BaseAgentActionDemo.current.json](https://github.com/Jaydearcadian/RJP/blob/main/deployments/base-sepolia/BaseAgentActionDemo.current.json)

### 2. Live GenLayer Judgment Alignment

Verified against live direct reads:

- clean subject:
  - subject: `0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001`
  - domain: `counterparty_trust.base_trade_v1`
  - case id:
    `counterparty_trust.base_trade_v1:0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001:39502983-39503002`
  - outcome: `SAFE`
  - revision: `1`
  - reason code: `SAFE_BASELINE`
- risky subject:
  - subject: `0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c`
  - domain: `counterparty_trust.base_trade_v1`
  - case id:
    `counterparty_trust.base_trade_v1:0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c:39629295-39629295`
  - outcome: `UNSAFE`
  - revision: `1`
  - reason code: `UNBOUNDED_APPROVAL`

Bundle files match those live reads:

- [clean.judgment.json](https://github.com/Jaydearcadian/RJP/blob/main/proof_bundles/proof-bundle-20260401-165310Z/genlayer/clean.judgment.json)
- [risky.judgment.json](https://github.com/Jaydearcadian/RJP/blob/main/proof_bundles/proof-bundle-20260401-165310Z/genlayer/risky.judgment.json)

### 3. Live Base Mirror Alignment

Verified against live direct reads:

- clean mirror:
  - outcome: `SAFE`
  - case id:
    `counterparty_trust.base_trade_v1:0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001:39502983-39503002`
- risky mirror:
  - outcome: `UNSAFE`
  - case id:
    `counterparty_trust.base_trade_v1:0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c:39629295-39629295`

Bundle files match those live reads:

- [clean.mirror.json](https://github.com/Jaydearcadian/RJP/blob/main/proof_bundles/proof-bundle-20260401-165310Z/base/clean.mirror.json)
- [risky.mirror.json](https://github.com/Jaydearcadian/RJP/blob/main/proof_bundles/proof-bundle-20260401-165310Z/base/risky.mirror.json)

### 4. Benchmark Artifact Alignment

Current benchmark and coordination artifacts still align with the same live
Base mirror and judgment-aware agent addresses:

- [judgment_vs_direct.json](https://github.com/Jaydearcadian/RJP/blob/main/proof_bundles/proof-bundle-20260401-165310Z/comparisons/judgment_vs_direct.json)
- [coordinated_report.json](https://github.com/Jaydearcadian/RJP/blob/main/proof_bundles/proof-bundle-20260401-165310Z/coordination/coordinated_report.json)
- [policy_model.json](https://github.com/Jaydearcadian/RJP/blob/main/proof_bundles/proof-bundle-20260401-165310Z/base/policy_model.json)

Verified points:

- judgment-aware agent address matches live deployment
- direct agent address matches live deployment
- Base mirror address matches live deployment
- coordinated report still reflects the same clean `SAFE` and risky `UNSAFE`
  mirrored state
- canonical Eliza evidence-vs-judgment benchmark note:
  - [ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md](https://github.com/Jaydearcadian/RJP/blob/main/ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md)

### 5. Eliza Evidence Vs Judgment Alignment

Verified in the canonical final benchmark note:

- [ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md](https://github.com/Jaydearcadian/RJP/blob/main/ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md)

Verified points:

- evidence-mode matched the deterministic baseline on:
  - `counterparty-safe-trade`
  - `counterparty-risky-trade`
  - `permission-sparse-approve`
- judgment-mode matched the deterministic baseline on the same 3 cases
- all 6 model decisions completed without fallback on the final aligned run

## Current Two-Domain Status

### Live Main Domain

Live, mirrored, and benchmarked:

- `counterparty_trust.base_trade_v1`

This is the current end-to-end demo path.

### Second Domain

Now exists in three safe forms:

- `protocol_safety.base_erc20_permission_v1`

Current safe-path proof:

- sparse -> `INSUFFICIENT_DATA` -> `REFRESH`
- failed action -> `CAUTION` -> `REVIEW`
- bounded posture -> `SAFE` -> `ALLOW`
- unbounded approval -> `UNSAFE` -> `DENY`
- main live contract also now stores this domain for dedicated subject
  `0x0000000000000000000000000000000000000b0b` with:
  - case id:
    `protocol_safety.base_erc20_permission_v1:0x0000000000000000000000000000000000000b0b:39629295-39629305`
  - outcome:
    `INSUFFICIENT_DATA`
  - reason code:
    `SPARSE_ACTIVITY`
  - Base mirror publish tx:
    `0x101d8fcc4590c5018acc5c77d7890093fda2fbddf87dbdaa10bdd589cdeeada2`
  - Base `approve` action tx:
    `0x5a4bca063a039b57702bd422b48231b229f082a257ce9529dcbb0ff497c07911`

This second domain is real in the protocol model and local deterministic test
path, and now also exists on the main live contract and Base mirror, but it is
not the promoted main live benchmark path.

## Practical Conclusion

The frozen proof bundle remains valid for the current live stack.

The project now has:

- one live end-to-end domain:
  `counterparty_trust.base_trade_v1`
- one second domain that exists on the main live contract and is proven on the
  safe path:
  `protocol_safety.base_erc20_permission_v1`

That is the correct baseline to present until broader live promotion is worth
the risk.
