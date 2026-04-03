# Project Documentation

This is the shortest complete documentation path for the project.

It answers:

- what we are building
- why it exists
- how the stack maps to the idea
- what is working
- what is not working or not stable
- what is still missing
- what the next steps are
- where to stop for a feasible production version

## What We Are Building

We are building a judgment layer for onchain behavior.

The intended product loop is:

1. observe wallet activity on Base
2. build reproducible evidence for a subject over an explicit block window
3. evaluate that evidence into a bounded judgment on GenLayer
4. mirror the latest compact judgment to Base
5. let agents, wallets, contracts, and humans consume that judgment cheaply
6. change downstream behavior because of that judgment

This is not meant to be just a score.

It is meant to be:

- reproducible evidence
- revisioned judgment
- cheap downstream reads
- enforceable or at least behavior-changing trust signals

## Why It Exists

The core problem is that trust evaluation is expensive and repetitive.

Without a judgment layer:

- every agent or app has to inspect raw wallet behavior itself
- different consumers can reach different conclusions
- trust checks are slow, duplicated, and often not enforceable

With a judgment layer:

- expensive evidence interpretation happens once
- the result is stored as a compact trust primitive
- downstream consumers reuse that result cheaply

That is the product ambition:

- trust signals for agents
- trust signals for humans
- trust signals for contracts and wallets

## Stack Mapped To The Idea

### 1. Evidence Layer

Idea:

- turn Base behavior into reproducible evidence

Actual stack:

- [build_base_case.py](https://github.com/Jaydearcadian/RJP/blob/main/scripts/build_base_case.py)
- [verify_base_case.py](https://github.com/Jaydearcadian/RJP/blob/main/scripts/verify_base_case.py)
- [poll_base_subject.py](https://github.com/Jaydearcadian/RJP/blob/main/scripts/poll_base_subject.py)
- [poll_base_subjects.py](https://github.com/Jaydearcadian/RJP/blob/main/scripts/poll_base_subjects.py)
- [confirm_case_quorum.py](https://github.com/Jaydearcadian/RJP/blob/main/scripts/confirm_case_quorum.py)

Meaning:

- one case per wallet
- one explicit block window per case
- canonical manifest and Merkle root
- optional multi-subject bundling around per-wallet cases

### 2. Judgment Layer

Idea:

- convert evidence into a bounded trust result

Actual stack:

- [reasoned_judgment_pass.py](https://github.com/Jaydearcadian/RJP/blob/main/contracts/reasoned_judgment_pass.py)
- [LLM_EVALUATOR_DESIGN.md](https://github.com/Jaydearcadian/RJP/blob/main/LLM_EVALUATOR_DESIGN.md)

Meaning:

- GenLayer stores evidence and judgment history
- judgments are revisioned
- freshness is enforced
- both deterministic and LLM paths exist

### 3. Consumption Layer

Idea:

- make trust cheap to consume where behavior actually happens

Actual stack:

- [BaseJudgmentMirror.sol](https://github.com/Jaydearcadian/RJP/blob/main/evm/BaseJudgmentMirror.sol)
- [BaseAgentActionDemo.sol](https://github.com/Jaydearcadian/RJP/blob/main/evm/BaseAgentActionDemo.sol)
- [BaseAgentDirectDemo.sol](https://github.com/Jaydearcadian/RJP/blob/main/evm/BaseAgentDirectDemo.sol)
- [publish_judgment_to_base.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/publish_judgment_to_base.ts)
- [preview_base_handshake.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/preview_base_handshake.ts)

Meaning:

- Base mirror exposes latest trust state
- Base consumer contract previews and enforces action outcomes
- direct no-judgment path exists for comparison
- domain-aware consumption now matters explicitly:
  - `counterparty_trust.base_trade_v1` answers whether a wallet should be
    trusted as a trading counterparty in the observed window
  - `protocol_safety.base_erc20_permission_v1` answers whether a wallet's
    ERC-20 approval posture is safe for the tracked permission context

Reference:

- [protocol/DOMAIN_CONSUMPTION.md](https://github.com/Jaydearcadian/RJP/blob/main/protocol/DOMAIN_CONSUMPTION.md)
- [AGENT_AND_NON_AGENT_DOMAIN_USAGE.md](https://github.com/Jaydearcadian/RJP/blob/main/AGENT_AND_NON_AGENT_DOMAIN_USAGE.md)
- [ARTIFACT_VERIFICATION_STATUS.md](https://github.com/Jaydearcadian/RJP/blob/main/ARTIFACT_VERIFICATION_STATUS.md)
- [PROTOCOL_SAFETY_SAFE_PATH.md](https://github.com/Jaydearcadian/RJP/blob/main/PROTOCOL_SAFETY_SAFE_PATH.md)

### 4. Agent Layer

Idea:

- prove that machine consumers change behavior because of the trust signal

Actual stack:

- [benchmark_multi_agent_handshakes.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/benchmark_multi_agent_handshakes.ts)
- [benchmark_onchain_agents.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/benchmark_onchain_agents.ts)
- [benchmark_coordinated_agents.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/benchmark_coordinated_agents.ts)
- [benchmark_six_agent_settlement.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/benchmark_six_agent_settlement.ts)
- [integrations/elizaos](https://github.com/Jaydearcadian/RJP/tree/main/integrations/elizaos)

Meaning:

- deterministic agents can reliably consume the trust signal
- coordinated offchain reactions exist
- Eliza exists as a showcase integration, not the stable benchmark path
- the canonical Eliza evidence-vs-judgment benchmark now exists:
  - [ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md](https://github.com/Jaydearcadian/RJP/blob/main/ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md)

### 5. Showcase And Proof Layer

Idea:

- make the system legible enough to submit, explain, and replay

Actual stack:

- [proof_bundles](https://github.com/Jaydearcadian/RJP/tree/main/proof_bundles)
- [DEMO_RUNBOOK.md](https://github.com/Jaydearcadian/RJP/blob/main/DEMO_RUNBOOK.md)
- [SUBMISSION_FINISH_PLAN.md](https://github.com/Jaydearcadian/RJP/blob/main/SUBMISSION_FINISH_PLAN.md)
- [CURRENT_STATE.md](https://github.com/Jaydearcadian/RJP/blob/main/CURRENT_STATE.md)

Meaning:

- proof packaging
- demo operator instructions
- current-state map

## What Is Working

These are the parts we can claim with evidence.

### Verified Working

- reproducible Base evidence artifacts
- manifest and Merkle-root verification
- GenLayer evidence submission
- revisioned judgments on GenLayer
- freshness and anti-replay enforcement
- Base mirror publication
- Base handshake preview
- Base judgment-aware onchain action settlement
- Base direct no-judgment settlement
- stale denial path
- coordinated offchain reaction report
- deterministic six-agent settlement benchmark
- proof-bundle generation
- proof bundle and benchmark artifacts currently verified against the live
  GenLayer contract and Base mirror:
  - [ARTIFACT_VERIFICATION_STATUS.md](https://github.com/Jaydearcadian/RJP/blob/main/ARTIFACT_VERIFICATION_STATUS.md)

## Current Two-Domain Model

The current protocol model has 2 real domains:

- `counterparty_trust.base_trade_v1`
- `protocol_safety.base_erc20_permission_v1`

Current status split:

- `counterparty_trust.base_trade_v1`
  - live on GenLayer
  - mirrored on Base
  - included in the frozen proof bundle
  - benchmarked against the direct no-judgment path
- `protocol_safety.base_erc20_permission_v1`
  - fully defined in the protocol model
  - locally verified through deterministic contract tests
  - locally verified through isolated LLM prompt tests
  - now materialized on the main live contract for a dedicated subject
  - not yet promoted as the main live mirrored benchmark path

This is intentional. It lets the protocol advance safely without risking the
stable live baseline.

### Current Reliable Performance Proof

The reliable benchmark path is:

- deterministic Base handshake read
- deterministic interpretation
- live Base settlement

Latest deterministic six-agent result:

- 6 logical agents
- 12 runs
- average receive/read latency: about `344 ms`
- average Base settlement latency: about `1479 ms`

Current behavior:

- clean subject -> `ALLOW`
- current risky subject -> `REFRESH` because the mirrored risky judgment is stale

### Current Showcase Integration

Eliza/OpenRouter currently proves:

- agents can be wired to the judgment layer
- the provider path can feed live Base-mirrored judgment state into Eliza
- evidence-mode and judgment-mode provider paths can be benchmarked side by
  side against the deterministic baseline

It does **not** currently prove:

- stable multi-agent throughput
- stable autonomous LLM decision quality under benchmark conditions

Canonical benchmark result:

- [ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md](https://github.com/Jaydearcadian/RJP/blob/main/ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md)

## What Is Partial Or Unstable

### LLM Evaluator

Status:

- meaningful
- bounded
- demoable
- not production-grade

Main weakness:

- reliability still depends too much on model/runtime behavior
- `isolated_minimal` is the current working isolated LLM debug baseline
  when combined with deterministic pre-LLM guardrails for obvious sparse,
  risky, and clearly benign clean branches
- `domain_compact` remains experimental and currently fails to materialize the
  sparse protocol-safety judgment on Studionet even after the `reason_code`
  rollback

### Eliza Runtime

Status:

- good showcase integration
- not stable enough for throughput claims

Main weakness:

- model drift
- parsing instability
- provider retries under load

### Multi-Source Confirmation

Status:

- offchain quorum confirmation exists
- live multi-watcher network does not

### Always-On Operation

Status:

- scriptable
- not yet a hardened service path

## What Is Not Built Yet

- real multi-watcher live network
- challenge/dispute flow
- compact Base handshake transport
- wallet middleware that intercepts signing
- trust/reputation aggregation across many judgments
- cross-domain trust graph

## Demo Subjects

Current clean pinned subject:

- `0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001`

Current risky pinned subject:

- `0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c`

These are benchmark/demo identities, not the main contracts.

They can be replaced with real wallets if we rebuild and republish the cases.

## Live Addresses

GenLayer:

- RJP: `0x4a099B06141Ca3464318c28C4D2884B85d070D4f`

Base:

- Mirror: `0xdc57b5802e11047bbe732a4a4cf4d71101b969a7`
- Judgment-aware consumer: `0x44d06a11c90e088ea18576f35123ac3c5ffdd2f6`
- Direct no-judgment consumer: `0x90db5f049c98f3fd510d866cb3386e50287b8ade`

## Roadmap

### Phase 0: Hackathon MVP

Status:

- done

### Phase 1: Reproducible Evidence

Status:

- materially done

### Phase 2: Verifiable Raw Evidence Anchors

Status:

- partially done

### Phase 3: Freshness And Anti-Replay

Status:

- materially done

### Phase 4: Multi-Source Confirmation

Status:

- started offchain
- not yet live-network complete

### Phase 5: Disputes And Challenges

Status:

- not started

### Phase 6: Production-Grade Wallet And Agent Consumption

Status:

- partially done

### Phase 7: Comparative Agent Benchmarking

Status:

- underway

## Feasible Production Stop-Line

We do **not** need to finish the full theoretical roadmap before we stop and call
it a feasible production candidate.

The practical stop-line is:

1. reproducible evidence artifacts
2. freshness and anti-replay
3. live multi-source confirmation
4. compact Base-side handshake consumption
5. wallet/agent middleware
6. multi-wallet support in the app

At that point:

- the system is still not fully adversarially complete
- but it is plausibly deployable for low-to-medium trust workflows

What can come after that:

- disputes
- stronger challenge mechanisms
- broader trust/reputation aggregation

## Immediate Next Steps

1. refresh the risky subject so the benchmark shows fresh `UNSAFE -> DENY`
2. expose multi-wallet evidence building in the app
3. let users replace the demo subjects with real wallets
4. keep the deterministic Base path as the performance proof
5. keep Eliza as a showcase integration, not the main benchmark path

## Canonical Related Docs

- [CURRENT_STATE.md](https://github.com/Jaydearcadian/RJP/blob/main/CURRENT_STATE.md)
- [NEXT_STEPS.md](https://github.com/Jaydearcadian/RJP/blob/main/NEXT_STEPS.md)
- [SECURITY_AND_PRODUCT_ROADMAP.md](https://github.com/Jaydearcadian/RJP/blob/main/SECURITY_AND_PRODUCT_ROADMAP.md)
- [DEMO_RUNBOOK.md](https://github.com/Jaydearcadian/RJP/blob/main/DEMO_RUNBOOK.md)
