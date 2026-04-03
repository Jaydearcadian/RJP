# Reasoned Judgment Protocol

Reasoned Judgment Protocol, or RJP, is a judgment layer for onchain behavior.

It exists to close the gap between raw onchain activity and actionable trust.
Wallets, agents, and contracts can all read transactions, approvals, balances,
and interaction history. That is not the same as knowing whether a counterparty
is safe, whether a permission target is risky, or whether a transaction should
go through.

RJP turns observed behavior into:

- reproducible evidence
- a domain-scoped case object
- a revisioned judgment on GenLayer
- compact mirrored consumption state on Base

The point is not to create another reputation score. The point is to create a
bounded, inspectable judgment that downstream systems can actually use.

## What RJP Does

The intended loop is:

1. observe wallet or contract behavior on Base
2. build reproducible evidence for one subject over one block window
3. evaluate that evidence into a bounded judgment on GenLayer
4. mirror the latest compact judgment back to Base
5. let agents, wallets, contracts, and humans consume that judgment cheaply
6. use the result to allow, deny, refresh, review, or coordinate

This means RJP is not just a data pipeline and not just an LLM wrapper. It is a
judgment system with explicit artifacts and explicit downstream behavior.

## What Exists Right Now

The current stack is real and working:

- an evidence builder that turns Base activity into reproducible case artifacts
- protocol objects for `DomainSpec`, `CaseObject`, `AssessmentArtifact`, and
  `JudgmentObject`
- a GenLayer intelligent contract that stores evidence and revisioned judgments
- a Base mirror contract for cheap read-side consumption
- Base consumer contracts that react to mirrored trust state
- benchmark harnesses for judgment-aware and non-judgment-aware agents
- a local API adapter for building evidence, building cases, and submitting live
  judgments
- a Next.js frontend under [`web/`](/home/jay/codex/genlayer/rjp/web)

## Current Domains

Two domains currently exist in the rebuilt protocol model:

- `counterparty_trust.base_trade_v1`
- `protocol_safety.base_erc20_permission_v1`

Current live benchmark domain:

- `counterparty_trust.base_trade_v1`

Current promoted second domain:

- `protocol_safety.base_erc20_permission_v1`
  - protocol-defined
  - locally tested
  - proven in isolated live flows
  - promoted on the main live contract and Base mirror for a dedicated subject

## Architecture

RJP is split into clear layers.

### 1. Evidence Layer

The evidence layer watches Base activity and produces normalized case artifacts.
It records:

- source network
- source chain id
- observation window
- derived features
- evidence manifest commitments
- Merkle root

Main files:

- [build_base_case.py](/home/jay/codex/genlayer/rjp/scripts/build_base_case.py)
- [verify_base_case.py](/home/jay/codex/genlayer/rjp/scripts/verify_base_case.py)
- [poll_base_subject.py](/home/jay/codex/genlayer/rjp/scripts/poll_base_subject.py)
- [poll_base_subjects.py](/home/jay/codex/genlayer/rjp/scripts/poll_base_subjects.py)
- [confirm_case_quorum.py](/home/jay/codex/genlayer/rjp/scripts/confirm_case_quorum.py)

### 2. Protocol Layer

The protocol layer defines the durable object model:

- `DomainSpec`
- `CaseObject`
- `AssessmentArtifact`
- `JudgmentObject`

Main files:

- [protocol/README.md](/home/jay/codex/genlayer/rjp/protocol/README.md)
- [protocol/DOMAIN_CONSUMPTION.md](/home/jay/codex/genlayer/rjp/protocol/DOMAIN_CONSUMPTION.md)
- [protocol/domains](/home/jay/codex/genlayer/rjp/protocol/domains)
- [protocol/schemas](/home/jay/codex/genlayer/rjp/protocol/schemas)

### 3. Judgment Layer

The judgment layer lives on GenLayer. It stores evidence, forms bounded
judgments, and keeps revision history.

Main files:

- [reasoned_judgment_pass.py](/home/jay/codex/genlayer/rjp/contracts/reasoned_judgment_pass.py)
- [LLM_EVALUATOR_DESIGN.md](/home/jay/codex/genlayer/rjp/LLM_EVALUATOR_DESIGN.md)

It supports:

- `deterministic` mode
- `llm` mode
- freshness windows
- revisioned judgment history
- protocol-style case, assessment, and judgment-object views

### 4. Base Consumption Layer

The Base side exists so consumers do not need to read GenLayer directly on the
hot path.

Main files:

- [BaseJudgmentMirror.sol](/home/jay/codex/genlayer/rjp/evm/BaseJudgmentMirror.sol)
- [BaseAgentActionDemo.sol](/home/jay/codex/genlayer/rjp/evm/BaseAgentActionDemo.sol)
- [BaseAgentDirectDemo.sol](/home/jay/codex/genlayer/rjp/evm/BaseAgentDirectDemo.sol)
- [publish_judgment_to_base.ts](/home/jay/codex/genlayer/rjp/scripts/publish_judgment_to_base.ts)
- [preview_base_handshake.ts](/home/jay/codex/genlayer/rjp/scripts/preview_base_handshake.ts)

### 5. Agent And Integration Layer

This layer proves that judgments actually change downstream behavior.

Main files:

- [benchmark_multi_agent_handshakes.ts](/home/jay/codex/genlayer/rjp/scripts/benchmark_multi_agent_handshakes.ts)
- [benchmark_onchain_agents.ts](/home/jay/codex/genlayer/rjp/scripts/benchmark_onchain_agents.ts)
- [benchmark_coordinated_agents.ts](/home/jay/codex/genlayer/rjp/scripts/benchmark_coordinated_agents.ts)
- [integrations/elizaos](/home/jay/codex/genlayer/rjp/integrations/elizaos)
- [ONCHAIN_JUDGMENT_VS_DIRECT_BENCHMARK.md](/home/jay/codex/genlayer/rjp/ONCHAIN_JUDGMENT_VS_DIRECT_BENCHMARK.md)
- [ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md](/home/jay/codex/genlayer/rjp/ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md)

## What Is Verified Working

The following are already verified in the repo and live stack:

- reproducible Base evidence builds
- offline case verification
- compact submission case generation
- live GenLayer evidence submission and judgment materialization
- mirrored Base judgment reads
- Base handshake preview reads
- judgment-aware and non-judgment-aware agent benchmarks
- evidence-vs-judgment Eliza benchmark alignment

The current live stack proves:

- `SAFE -> ALLOW`
- `UNSAFE -> DENY`
- `INSUFFICIENT_DATA -> REFRESH`

depending on domain, subject, and block window.

## Live Contracts

Current GenLayer RJP contract:

- `0x4a099B06141Ca3464318c28C4D2884B85d070D4f`

Current Base mirror:

- `0x34EBfd4FcC379b14Cdd602485417a5C088228606`

Current Base judgment-aware agent:

- `0x60381D4088B7B2C985B248CE8B64287c13b71434`

Current Base direct comparison agent:

- `0x90db5f049c98f3fd510d866cb3386e50287b8ade`

## Local API

The local API adapter is:

- [showcase_api.py](/home/jay/codex/genlayer/rjp/scripts/showcase_api.py)

Its job is to make integrations and the frontend simpler. It can:

- return health and current block
- build evidence summaries
- build full audit `CaseObject`s
- build compact submission cases
- submit and evaluate live judgments
- read mirrored judgments
- preview handshake state

## Frontend

The web frontend lives in:

- [web/](/home/jay/codex/genlayer/rjp/web)

It is a Next.js app that talks to the Python API through Next route handlers.
In production, the browser should use same-origin `/api` routes, while the
server-side route handlers talk to the hosted Python API.

## Build Evidence

Build a protocol `CaseObject`:

```bash
python3 scripts/build_base_case.py \
  --subject 0xabc... \
  --network base-sepolia \
  --start-block 1200 \
  --end-block 1250 \
  --format case-object \
  --pretty
```

Build a compact submission case:

```bash
python3 scripts/build_base_case.py \
  --subject 0xabc... \
  --network base-sepolia \
  --start-block 1200 \
  --end-block 1250 \
  --format case-object \
  --submission-mode compact \
  --pretty
```

Verify a case offline:

```bash
python3 scripts/verify_base_case.py /tmp/case.json --pretty
```

## RPC Handling

The evidence builder now supports:

- primary and fallback RPC URLs
- segmented block-window pulls
- retries with backoff
- resumable progress files
- dRPC-safe batch downgrading when fallback is used

This is there to make wider windows more reliable without changing the evidence
model itself.

## Deployment Direction

The current intended hackathon deployment split is:

- `web/` on Vercel
- `scripts/showcase_api.py` on Render

Browser requests should hit the Next app. The Next app should proxy to the
Python API. Secrets stay on the API host, not in the browser.

Deployment support files now in repo:

- [render.yaml](/home/jay/codex/genlayer/rjp/render.yaml)
- [.env.example](/home/jay/codex/genlayer/rjp/.env.example)
- [requirements.txt](/home/jay/codex/genlayer/rjp/requirements.txt)
- [DEPLOYMENT.md](/home/jay/codex/genlayer/rjp/DEPLOYMENT.md)

Recommended deploy flow:

1. Deploy the Python API on Render from repo root.
2. Set Render env vars from `.env.example` with real secrets.
3. Verify Render health at `/health`.
4. Deploy `web/` on Vercel with:
   - `RJP_API_BASE=https://your-render-service.onrender.com`
5. Verify the hosted web app can:
   - fetch health
   - fetch current block
   - build evidence summary
   - build case
   - submit and evaluate judgment
   - publish to Base mirror
   - read mirror judgment and handshake preview

## Canonical Docs

For the fuller current-state and roadmap view:

- [PROJECT_DOCUMENTATION.md](/home/jay/codex/genlayer/rjp/PROJECT_DOCUMENTATION.md)
- [CURRENT_STATE.md](/home/jay/codex/genlayer/rjp/CURRENT_STATE.md)
- [ARTIFACT_VERIFICATION_STATUS.md](/home/jay/codex/genlayer/rjp/ARTIFACT_VERIFICATION_STATUS.md)
- [PROTOCOL_SAFETY_SAFE_PATH.md](/home/jay/codex/genlayer/rjp/PROTOCOL_SAFETY_SAFE_PATH.md)
- [ONCHAIN_JUDGMENT_VS_DIRECT_BENCHMARK.md](/home/jay/codex/genlayer/rjp/ONCHAIN_JUDGMENT_VS_DIRECT_BENCHMARK.md)
- [ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md](/home/jay/codex/genlayer/rjp/ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md)
- [RJP_PROTOCOL_REBUILD_PLAN.md](/home/jay/codex/genlayer/rjp/RJP_PROTOCOL_REBUILD_PLAN.md)
- [NEXT_STEPS.md](/home/jay/codex/genlayer/rjp/NEXT_STEPS.md)
- [SECURITY_AND_PRODUCT_ROADMAP.md](/home/jay/codex/genlayer/rjp/SECURITY_AND_PRODUCT_ROADMAP.md)
