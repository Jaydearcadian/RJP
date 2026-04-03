# Current State

This is the current reality of the repo and live demo stack.

Operational Studionet issues are tracked in
[STUDIONET_ISSUES.md](https://github.com/Jaydearcadian/RJP/blob/main/STUDIONET_ISSUES.md).

Current proof and benchmark alignment against the live stack is tracked in
[ARTIFACT_VERIFICATION_STATUS.md](https://github.com/Jaydearcadian/RJP/blob/main/ARTIFACT_VERIFICATION_STATUS.md).

Current safe-path promotion note for the second domain is tracked in
[PROTOCOL_SAFETY_SAFE_PATH.md](https://github.com/Jaydearcadian/RJP/blob/main/PROTOCOL_SAFETY_SAFE_PATH.md).

It separates:

- the product idea
- the actual stack that exists
- what is verified working
- what is partial or unstable
- what is no longer in the main path
- what should happen next

## Product Idea

RJP is a judgment layer for onchain behavior.

The intended loop is:

1. observe wallet behavior on Base
2. build reproducible evidence for one subject over one window
3. evaluate that evidence into a bounded judgment on GenLayer
4. mirror the latest compact judgment to Base
5. let agents, wallets, contracts, and humans consume that judgment cheaply
6. use the result to allow, deny, refresh, review, or coordinate

The product is not just a score.

It is:

- reproducible evidence
- revisioned judgment
- compact consumption
- behavior change downstream

## Stack Map

### 1. Evidence Layer

Purpose:

- turn Base activity into reproducible case artifacts

Main files:

- [build_base_case.py](https://github.com/Jaydearcadian/RJP/blob/main/scripts/build_base_case.py)
- [verify_base_case.py](https://github.com/Jaydearcadian/RJP/blob/main/scripts/verify_base_case.py)
- [poll_base_subject.py](https://github.com/Jaydearcadian/RJP/blob/main/scripts/poll_base_subject.py)
- [poll_base_subjects.py](https://github.com/Jaydearcadian/RJP/blob/main/scripts/poll_base_subjects.py)
- [confirm_case_quorum.py](https://github.com/Jaydearcadian/RJP/blob/main/scripts/confirm_case_quorum.py)

Current role:

- builds one case per wallet
- supports multi-subject orchestration
- supports pinned windows
- verifies manifest and Merkle-root consistency
- can now emit both the legacy MVP payload and a protocol-style `CaseObject`

### 1A. Protocol Rebuild Artifacts

Purpose:

- freeze the stronger RJP object model before code refactors

Main files:

- [protocol/README.md](https://github.com/Jaydearcadian/RJP/blob/main/protocol/README.md)
- [protocol/schemas/domain_spec.schema.json](https://github.com/Jaydearcadian/RJP/blob/main/protocol/schemas/domain_spec.schema.json)
- [protocol/schemas/case_object.schema.json](https://github.com/Jaydearcadian/RJP/blob/main/protocol/schemas/case_object.schema.json)
- [protocol/schemas/assessment_artifact.schema.json](https://github.com/Jaydearcadian/RJP/blob/main/protocol/schemas/assessment_artifact.schema.json)
- [protocol/schemas/judgment_object.schema.json](https://github.com/Jaydearcadian/RJP/blob/main/protocol/schemas/judgment_object.schema.json)
- [protocol/domains/counterparty_trust.base_trade_v1.json](https://github.com/Jaydearcadian/RJP/blob/main/protocol/domains/counterparty_trust.base_trade_v1.json)
- [protocol/domains/protocol_safety.base_erc20_permission_v1.json](https://github.com/Jaydearcadian/RJP/blob/main/protocol/domains/protocol_safety.base_erc20_permission_v1.json)
- [protocol/DOMAIN_CONSUMPTION.md](https://github.com/Jaydearcadian/RJP/blob/main/protocol/DOMAIN_CONSUMPTION.md)

Current role:

- freezes the target protocol objects as durable schemas
- defines the current concrete domain drafts
- provides example objects that can be validated immediately
- now matches a real local code path:
  - builder defaults to `CaseObject`
  - verifier validates domain-scoped protocol semantics
  - contract stores explicit `AssessmentArtifact` records
  - contract exposes compact `JudgmentObject` getters
  - contract supports both local-first domains:
    - `counterparty_trust.base_trade_v1`
    - `protocol_safety.base_erc20_permission_v1`
  - Base/reader scripts now emit domain-aware interpretation blocks

### 2. Judgment Layer

Purpose:

- store evidence and form bounded judgments on GenLayer

Main files:

- [reasoned_judgment_pass.py](https://github.com/Jaydearcadian/RJP/blob/main/contracts/reasoned_judgment_pass.py)
- [LLM_EVALUATOR_DESIGN.md](https://github.com/Jaydearcadian/RJP/blob/main/LLM_EVALUATOR_DESIGN.md)

Current role:

- stores evidence history
- stores revisioned judgments
- supports `deterministic` and `llm` modes
- supports freshness and handshake-state logic
- now exposes protocol-style domain, case, assessment, and judgment-object views
  over stored records

### 3. Base Consumption Layer

Purpose:

- keep judgment consumption fast and Base-native

Main files:

- [BaseJudgmentMirror.sol](https://github.com/Jaydearcadian/RJP/blob/main/evm/BaseJudgmentMirror.sol)
- [BaseAgentActionDemo.sol](https://github.com/Jaydearcadian/RJP/blob/main/evm/BaseAgentActionDemo.sol)
- [BaseAgentDirectDemo.sol](https://github.com/Jaydearcadian/RJP/blob/main/evm/BaseAgentDirectDemo.sol)
- [publish_judgment_to_base.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/publish_judgment_to_base.ts)
- [get_published_judgment_from_base.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/get_published_judgment_from_base.ts)
- [preview_base_handshake.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/preview_base_handshake.ts)

Current role:

- mirrors latest GenLayer judgment
- exposes handshake preview for a proposed action
- records onchain action outcomes
- provides a no-judgment comparison path

### 4. Agent Layer

Purpose:

- prove that agents can consume the judgment layer and act differently

Main files:

- [benchmark_multi_agent_handshakes.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/benchmark_multi_agent_handshakes.ts)
- [benchmark_onchain_agents.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/benchmark_onchain_agents.ts)
- [benchmark_coordinated_agents.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/benchmark_coordinated_agents.ts)
- [integrations/elizaos](https://github.com/Jaydearcadian/RJP/tree/main/integrations/elizaos)

Current role:

- measures judgment-aware agents vs no-judgment agents
- simulates cross-agent reactions
- provides an ElizaOS integration path
- now has a domain-aware interpretation path in the main read/preview scripts
- now has an explicit agent vs non-agent consumption guide:
  - [AGENT_AND_NON_AGENT_DOMAIN_USAGE.md](https://github.com/Jaydearcadian/RJP/blob/main/AGENT_AND_NON_AGENT_DOMAIN_USAGE.md)
- now has a canonical Eliza evidence-vs-judgment benchmark report:
  - [ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md](https://github.com/Jaydearcadian/RJP/blob/main/ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md)
- now has a current live Base judgment-vs-direct benchmark note:
  - [ONCHAIN_JUDGMENT_VS_DIRECT_BENCHMARK.md](https://github.com/Jaydearcadian/RJP/blob/main/ONCHAIN_JUDGMENT_VS_DIRECT_BENCHMARK.md)

### 5. Showcase Layer

Purpose:

- keep the system legible enough to demo and submit through docs, scripts, and proof bundles

Main files:

- [showcase_api.py](https://github.com/Jaydearcadian/RJP/blob/main/scripts/showcase_api.py)
- [DEMO_RUNBOOK.md](https://github.com/Jaydearcadian/RJP/blob/main/DEMO_RUNBOOK.md)
- [proof_bundles](https://github.com/Jaydearcadian/RJP/tree/main/proof_bundles)

Current role:

- local thin API adapter for integrations
- proof bundle generation
- hackathon demo path

### 6. Secondary / Legacy Bridge Layer

Purpose:

- preserve the original cross-chain bridge path without making it the main demo

Main files:

- [send_base_case_via_bridge.js](https://github.com/Jaydearcadian/RJP/blob/main/scripts/send_base_case_via_bridge.js)
- [authorize_bridge_relayer.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/authorize_bridge_relayer.ts)
- [set_bridge_receiver.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/set_bridge_receiver.ts)

Current role:

- preserved for future work
- not the main product path
- not the recommended demo path

## Verified Working

These are the parts that are actually working and already verified in the repo or on live networks.

### Evidence

- Base evidence can be built reproducibly for one wallet and one pinned window.
- Case artifacts include schema version, extractor version, manifest leaf hashes,
  and Merkle root.
- Offline verification works.
- Multi-subject orchestration exists and supports pinned windows.
- Protocol rebuild schemas and the current domain drafts now exist and validate.
- `protocol_safety.base_erc20_permission_v1` now has a deterministic local
  outcome matrix proving:
  - sparse -> `INSUFFICIENT_DATA`
  - cautionary failed action -> `CAUTION`
  - bounded posture -> `SAFE`
  - unbounded approval -> `UNSAFE`
- the live Base onchain benchmark still proves the behavioral gap between
  judgment-aware and no-judgment consumers:
  - safe subject:
    - judgment-aware -> `ALLOW`
    - direct no-judgment -> `ALLOW`
  - risky subject:
    - judgment-aware -> `DENY`
    - direct no-judgment -> `ALLOW`
- the Eliza judgment-aware path has been revalidated against the current live
  mirror and handshake state for the same safe and risky subjects
- `protocol_safety.base_erc20_permission_v1` also now has a successful live
  isolated Studionet unsafe-case proof on a separate debug contract, while the
  main live contract remains frozen
- `protocol_safety.base_erc20_permission_v1` now also exists on the main live
  contract for dedicated subject `0x0000000000000000000000000000000000000b0b`
  with `INSUFFICIENT_DATA` / `SPARSE_ACTIVITY`, without disturbing the clean
  and risky demo subjects
- `protocol_safety.base_erc20_permission_v1` is now also promoted on the live
  Base mirror for the same dedicated subject, again without disturbing the
  clean and risky counterparty-trust demo subjects

### GenLayer Judgment

- Evidence can be submitted to GenLayer.
- Judgments are revisioned and queryable.
- Freshness and anti-replay are implemented.
- The contract supports both `deterministic` and `llm` modes.

### Base Consumption

- Judgments can be mirrored to Base.
- Base preview reads work.
- Base judgment-aware action writes work.
- Base no-judgment comparison writes work.
- Freshness-aware stale denial works.
- The second domain is now also promoted on Base for dedicated subject
  `0x0000000000000000000000000000000000000b0b`:
  - mirror outcome: `INSUFFICIENT_DATA`
  - handshake for `approve`: `REFRESH`
  - Base action tx:
    `0x5a4bca063a039b57702bd422b48231b229f082a257ce9529dcbb0ff497c07911`
- The current protocol-native final demo path is live end to end:
  - clean subject `0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001`
    - Base preview: `SAFE -> ALLOW`
    - Base action tx: `0xeac394a4113b24108b1890429775a2057bac6790779176301ebf21e59dfafc5d`
  - risky subject `0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c`
    - Base preview: `UNSAFE -> DENY`
    - Base action tx: `0x878cf843d427f1108cf09443ce0830bc6818fe668561db9171ecc8417e0728d8`

### Benchmarks

- Judgment-aware vs direct-agent comparison is live.
- Coordinated multi-agent reaction harness exists.
- Deterministic 6-agent settlement benchmark is now working.

Latest deterministic 6-agent benchmark result:

- six logical agents
- twelve runs
- clean subject -> `ALLOW`
- current risky subject -> `REFRESH` because the mirrored risky judgment is stale
- average read/receive latency: about `344 ms`
- average Base settlement latency: about `1479 ms`

### Local Thin API

- local API adapter works
- proof bundle generation works

## Partial Or Unstable

These parts exist, but are not strong enough to be presented as production-grade.

### LLM Evaluator

- The LLM path is meaningful and demoable.
- It is not stable enough to present as production-grade autonomous trust
  computation.
- The bounded output shape is good.
- The runtime behavior is still sensitive to model and environment quality.
- The current stable isolated debug baseline is:
  - `prompt_profile = isolated_minimal`
  - `summary` optional
  - `reason_code` derived after parsing from `outcome + risk_flags`
  - deterministic pre-LLM guardrails for obvious branches:
    - `SPARSE_ACTIVITY`
    - `UNBOUNDED_APPROVAL`
    - `FLAGGED_INTERACTION`
    - clearly benign high-volume clean windows
- Under that isolated baseline, all three diagnostic branches have now been
  observed to materialize on Studionet:
  - sparse -> `INSUFFICIENT_DATA`
  - risky -> `UNSAFE`
  - clean -> `SAFE`
- The current unstable experimental profile is:
  - `prompt_profile = domain_compact`
  - on the sparse `protocol_safety.base_erc20_permission_v1` fixture, evidence
    materializes but judgment still does not
- The current likely failure surface is prompt breadth or comparative-surface
  complexity inside Studionet's LLM path, not the protocol object model or the
  deterministic write path.

### ElizaOS Runtime

- The Eliza integration exists.
- The provider path is now correctly wired.
- Two-agent runs can work.
- The six-agent OpenRouter-backed runtime is not stable enough for clean
  throughput claims.
- Current instability comes from:
  - model output drift
  - step parsing failures
  - provider retries under load

Conclusion:

- Eliza is currently a showcase integration, not the benchmark ground truth.

### Multi-Source Confirmation

- offchain quorum comparison exists
- live multi-watcher operation does not

### Always-On Operation

- the polling, submit, evaluate, and mirror flow is scriptable
- it is not yet a hardened always-on service path

## Not Built Yet

- real multi-watcher live network
- challenge/dispute protocol
- compact Base handshake transport
- one-read or zero-read hot-path consumer format
- wallet middleware that intercepts signing in a real end-user flow
- trust/reputation aggregation across many judgments
- cross-domain trust graph

## Demo Placeholders And Fixed Subjects

The current clean demo subject is:

- `0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001`

That is not the main contract.

It is a fixed demo subject used for the reproducible clean SAFE case.

The current risky subject is:

- `0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c`

These should be treated as pinned benchmark/demo identities.

They can be replaced with real wallet addresses if we rebuild and republish the
cases around those wallets.

## Live Addresses

GenLayer:

- RJP: `0x4a099B06141Ca3464318c28C4D2884B85d070D4f`

Base Sepolia:

- Mirror: `0x34EBfd4FcC379b14Cdd602485417a5C088228606`
- Judgment-aware agent: `0x60381D4088B7B2C985B248CE8B64287c13b71434`
- Direct no-judgment agent: `0x90db5f049c98f3fd510d866cb3386e50287b8ade`

Important current limitation:

- the Base contracts now store `caseId` and `claimType`
- the live GenLayer contract has been redeployed and reseeded with protocol-native
  judgment objects
- the current Studionet main deployment now uses:
  - `evaluation_mode = llm`
  - `prompt_profile = isolated_minimal`
  - `default_freshness_window_blocks = 250000`
- the Base mirror has been refreshed from the current Studionet deployment and
  the Base preview/action path is back to fresh `SAFE -> ALLOW` and
  `UNSAFE -> DENY`
- the final clean/risky Base demo now works end to end
- but the clean branch still depends on the pinned historical demo subject,
  while the fresh real-wallet clean case remains blocked by Studionet receipt
  instability
- the risky branch is now backed by a fresh current-window case, not only the
  historical pinned case

## What This Means Conceptually

The idea is:

- trust signals for agents, humans, and contracts

The current implementation already proves:

- evidence can be normalized into a reproducible artifact
- judgment can be stored as a revisioned trust primitive
- downstream behavior can change because of that judgment

So the concept is already reflected in the stack.

What is not yet proven is the full long-term trust story:

- decentralized watcher diversity
- disputes
- full production wallet integration
- broader trust and reputation computation

## Immediate Decisions

These are the next practical moves.

### For Submission

Do:

- keep the deterministic Base-consumption benchmark as the performance proof
- keep Eliza as an integration showcase, not the throughput proof
- keep the bridge path secondary
- keep the proof bundle and showcase UI in sync

Do not:

- make new protocol claims that the current stack does not support
- use the unstable six-agent OpenRouter runtime as a main benchmark

### For The Product Direction

Prioritize next:

1. replace or supplement the demo subjects with real user-provided wallets in the UI
2. expose multi-wallet evidence building in the app
3. keep one case per wallet and bundle them in one run
4. replace the pinned clean placeholder with a fresh real-wallet clean case once
   Studionet evaluation is stable enough
5. keep improving the consumption hot path on Base

### For The Security Direction

After submission, prioritize:

1. multi-watcher live operation
2. challenge/dispute flow
3. compact authenticated handshake format
4. wallet middleware
