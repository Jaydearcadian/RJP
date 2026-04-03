# Reasoned Judgment Pass

Reasoned Judgment Pass is the current RJP implementation: a domain-scoped,
evidence-anchored judgment layer that turns wallet or contract activity into
protocol objects and compact live consumption state.

## Start Here

Start with the canonical docs and the protocol objects:

- [PROJECT_DOCUMENTATION.md](/home/jay/codex/genlayer/rjp/PROJECT_DOCUMENTATION.md)
- [CURRENT_STATE.md](/home/jay/codex/genlayer/rjp/CURRENT_STATE.md)
- [protocol/README.md](/home/jay/codex/genlayer/rjp/protocol/README.md)

## Canonical Docs

- [PROJECT_DOCUMENTATION.md](/home/jay/codex/genlayer/rjp/PROJECT_DOCUMENTATION.md): shortest full project explanation
- [CURRENT_STATE.md](/home/jay/codex/genlayer/rjp/CURRENT_STATE.md): what is live, partial, or intentionally deferred
- [ARTIFACT_VERIFICATION_STATUS.md](/home/jay/codex/genlayer/rjp/ARTIFACT_VERIFICATION_STATUS.md): proof and benchmark alignment against the live stack
- [PROTOCOL_SAFETY_SAFE_PATH.md](/home/jay/codex/genlayer/rjp/PROTOCOL_SAFETY_SAFE_PATH.md): second-domain promotion status
- [ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md](/home/jay/codex/genlayer/rjp/ELIZA_EVIDENCE_VS_JUDGMENT_BENCHMARK.md): canonical evidence-vs-judgment benchmark
- [protocol/README.md](/home/jay/codex/genlayer/rjp/protocol/README.md): protocol objects and schemas
- [RJP_PROTOCOL_REBUILD_PLAN.md](/home/jay/codex/genlayer/rjp/RJP_PROTOCOL_REBUILD_PLAN.md): rebuild direction

## Repo Map

- `scripts/showcase_api.py`: local thin API adapter used by integrations and local tooling
- `protocol/`: `DomainSpec`, `CaseObject`, `AssessmentArtifact`, `JudgmentObject`
- `contracts/`: GenLayer judgment contract
- `evm/`: Base mirror and consumer contracts
- `integrations/elizaos/`: headless and runtime-style agent integration
- `proof_bundles/`: frozen proof packages aligned to live state

## Active Studionet Contract

Current switchable deployment:

- `0x4a099B06141Ca3464318c28C4D2884B85d070D4f`

This is the current recommended live contract because it supports both:

- `deterministic` evaluation mode
- `llm` evaluation mode
- `prompt_profile = isolated_minimal` as the current stable LLM baseline

## What It Does

`ReasonedJudgmentPass` stores normalized Base evidence, forms a bounded judgment
for a subject under one domain, keeps both evidence and revisioned judgment
history, and uses the latest judgment to allow or deny one guarded action.

The contract now supports two judgment modes:

- `deterministic`
- `llm`

It also exposes protocol-style views over the stored records:

- `get_latest_case_object(subject_id)`
- `get_case_object(subject_id, sequence)`
- `get_latest_assessment_artifact(subject_id)`
- `get_assessment_artifact(subject_id, revision)`

Current domain:

- `counterparty_trust.base_trade_v1`
- `protocol_safety.base_erc20_permission_v1`

Current live end-to-end domain:

- `counterparty_trust.base_trade_v1`

Current second-domain safe path:

- `protocol_safety.base_erc20_permission_v1`
  - protocol-defined
  - locally deterministic-tested
  - promoted on the main live contract and Base mirror for dedicated subject
    `0x0000000000000000000000000000000000000b0b`
  - not the main live mirrored benchmark path

Current evidence source shape:

- Base Mainnet (`8453`) or Base Sepolia (`84532`)
- normalized source metadata
- normalized block window
- normalized risk features
- canonical evidence manifest with leaf hashes and Merkle root

Current outcomes:

- `SAFE`
- `CAUTION`
- `UNSAFE`
- `INSUFFICIENT_DATA`

## Layout

```text
contracts/reasoned_judgment_pass.py
deploy/deploy_rjp.ts
scripts/build_base_case.py
scripts/verify_base_case.py
scripts/confirm_case_quorum.py
scripts/poll_base_subject.py
scripts/poll_base_subjects.py
scripts/submit_base_case_to_rjp.ts
scripts/set_evaluation_mode.ts
scripts/get_evaluation_mode.ts
scripts/get_latest_evidence_json.ts
scripts/get_latest_judgment_json.ts
scripts/agent_use_judgment.ts
scripts/get_handshake_state_json.ts
scripts/get_base_policy_model.ts
scripts/preview_base_handshake.ts
scripts/benchmark_multi_agent_handshakes.ts
scripts/benchmark_onchain_agents.ts
scripts/benchmark_coordinated_agents.ts
scripts/verify_coordinated_attestation.ts
scripts/generate_proof_bundle.py
scripts/publish_judgment_to_base.ts
scripts/get_published_judgment_from_base.ts
scripts/set_base_mirror_publisher.ts
scripts/deploy_base_mirror.ts
evm/BaseJudgmentMirror.sol
evm/BaseAgentDirectDemo.sol
scripts/deploy_base_agent_direct.ts
scripts/send_base_case_via_bridge.js
scripts/authorize_bridge_relayer.ts
scripts/set_bridge_receiver.ts
scripts/check_bridge_receiver.ts
tests/direct/test_reasoned_judgment_pass.py
HACKATHON_MVP_SPEC.md
LLM_EVALUATOR_DESIGN.md
```

## Local Validation

```bash
genvm-lint check contracts/reasoned_judgment_pass.py
pytest tests/direct/test_reasoned_judgment_pass.py -v
```

## Direct Deploy

```bash
genlayer deploy --contract contracts/reasoned_judgment_pass.py
```

## Build Base Evidence

```bash
python3 scripts/build_base_case.py \
  --subject 0xabc... \
  --network base-sepolia \
  --start-block 1200 \
  --end-block 1250 \
  --pretty
```

The default output is now the stronger protocol `CaseObject` shape. To request
the old MVP payload explicitly:

```bash
python3 scripts/build_base_case.py \
  --subject 0xabc... \
  --network base-sepolia \
  --start-block 1200 \
  --end-block 1250 \
  --format legacy \
  --pretty
```

To emit the protocol `CaseObject` shape explicitly:

```bash
python3 scripts/build_base_case.py \
  --subject 0xabc... \
  --network base-sepolia \
  --start-block 1200 \
  --end-block 1250 \
  --format case-object \
  --pretty
```

To emit a compact submission `CaseObject` that preserves commitments and
derived features but omits the heavy embedded evidence items:

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

The script uses network-aware RPC resolution in this order:

1. `--rpc-url`
2. `BASE_SEPOLIA_RPC_URL` / `BASE_MAINNET_RPC_URL`
3. `BASE_RPC_URL` for Base Sepolia convenience
4. the official public Base RPC default

Optional fallback URLs can be supplied with repeated `--rpc-fallback-url` flags
or comma-separated env vars such as `BASE_SEPOLIA_RPC_FALLBACK_URLS`.

The built-in public defaults remain:

- Base Mainnet: `https://mainnet.base.org`
- Base Sepolia: `https://sepolia.base.org`

For wider block windows, the watcher now chunks both block and receipt RPC
batch calls. The default range segment size is now `100` blocks:

- `--block-batch-size`
- `--receipt-batch-size`
- `--window-chunk-size`
- `--rpc-retries`
- `--rpc-retry-backoff`
- `--rpc-fallback-url`
- `--progress-file`

This keeps the adapter usable across larger windows without immediately hitting
public RPC batch ceilings.

Each built case now also carries:

- `schema_version`
- `extractor_version`
- `evidence_manifest.schema_version`
- `evidence_manifest.item_count`
- `evidence_manifest.leaf_hashes`
- `evidence_manifest.merkle_root`

That makes the case artifact reproducible: anyone can recompute the normalized
features and the commitment root from the embedded manifest.

Verify a case artifact offline:

```bash
cd /home/jay/codex/genlayer/rjp
python3 scripts/verify_base_case.py /tmp/agent-1-case.json --pretty
```

Confirm exact multi-source agreement across several case artifacts:

```bash
python3 scripts/confirm_case_quorum.py \
  /tmp/watcher-a-case.json \
  /tmp/watcher-b-case.json \
  --quorum 2 \
  --pretty
```

This verifies each artifact individually, groups valid artifacts by exact
equivalence, and reports whether any group reaches the required quorum.
It is the first concrete Phase 4 hardening step: independent watcher agreement
before treating a case as high-trust.

## Validate Protocol Rebuild Artifacts

The repo now carries first-class protocol artifacts for the rebuild target:

- `DomainSpec`
- `CaseObject`
- `AssessmentArtifact`
- `JudgmentObject`

Validate the schemas, the current concrete domain drafts, and the example objects:

```bash
npm run validate-protocol-artifacts
```

Current domain drafts:

- [counterparty_trust.base_trade_v1.json](/home/jay/codex/genlayer/rjp/protocol/domains/counterparty_trust.base_trade_v1.json)
- [protocol_safety.base_erc20_permission_v1.json](/home/jay/codex/genlayer/rjp/protocol/domains/protocol_safety.base_erc20_permission_v1.json)
- [DOMAIN_CONSUMPTION.md](/home/jay/codex/genlayer/rjp/protocol/DOMAIN_CONSUMPTION.md)
- [AGENT_AND_NON_AGENT_DOMAIN_USAGE.md](/home/jay/codex/genlayer/rjp/AGENT_AND_NON_AGENT_DOMAIN_USAGE.md)

## Generate A Proof Bundle

Build a submission-grade bundle that packages the whole current stack:

```bash
PRIVATE_KEY=0x... \
BASE_PRIVATE_KEY=0x... \
COORDINATOR_PRIVATE_KEY=0x... \
python3 scripts/generate_proof_bundle.py
```

Current complete bundle:

- [proof-bundle-20260401-165310Z](/home/jay/codex/genlayer/rjp/proof_bundles/proof-bundle-20260401-165310Z)

The bundle contains:

- pinned clean and risky Base case artifacts
- offline verifier outputs
- latest GenLayer judgments
- mirrored Base judgments
- Base policy-model readout
- landed Base judgment-aware action proofs
- judgment-aware vs direct-agent comparison output
- coordinated offchain reaction report
- signed coordination attestation verification
- deployment artifacts and pinned subject windows

## ElizaOS Test Integration

There is now a starter ElizaOS integration at:

- [integrations/elizaos/README.md](/home/jay/codex/genlayer/rjp/integrations/elizaos/README.md)
- [integrations/elizaos/src/plugin.ts](/home/jay/codex/genlayer/rjp/integrations/elizaos/src/plugin.ts)

The integration uses the Base mirror as the fast trust-consumption layer and
the local thin API as an adapter. The current recommended test path is:

1. keep `npm run showcase:api` running
2. point Eliza at `RJP_API_URL=http://127.0.0.1:4174`
3. use the provided provider/action scaffold so an Eliza agent can:
   - read the latest mirrored judgment
   - read the current handshake preview
   - change its behavior for `SAFE` vs `UNSAFE` counterparties

The local API now also exposes:

- `GET /mirror-judgment?subject=0x...`
- `GET /handshake-preview?subject=0x...&action_type=trade`

There is also a local multi-agent Eliza testbed at:

- [integrations/elizaos/testbed/package.json](/home/jay/codex/genlayer/rjp/integrations/elizaos/testbed/package.json)
- [integrations/elizaos/testbed/src/test_judgments.ts](/home/jay/codex/genlayer/rjp/integrations/elizaos/testbed/src/test_judgments.ts)

Run it with:

```bash
cd integrations/elizaos/testbed
npm install
RJP_API_URL=http://127.0.0.1:4174 \
RJP_DEFAULT_ACTION_TYPE=trade \
RJP_DEFAULT_SUBJECT_ID=0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001 \
npm run test:judgments
```

## Poll Base Sepolia Automatically

`scripts/poll_base_subject.py` watches the latest Base blocks for a subject,
rebuilds a normalized evidence file when the window changes, and can call
follow-on submit/publish commands.

Single-cycle example:

```bash
python3 scripts/poll_base_subject.py \
  --subject 0xabc... \
  --network base-sepolia \
  --window-size 20 \
  --once \
  --pretty
```

Auto-submit example:

```bash
python3 scripts/poll_base_subject.py \
  --subject 0xabc... \
  --network base-sepolia \
  --window-size 20 \
  --submit-command 'PRIVATE_KEY=0x... GENLAYER_RPC_URL=https://studio.genlayer.com/api RJP_CONTRACT_ADDRESS=0x4a099B06141Ca3464318c28C4D2884B85d070D4f CASE_FILE={case_path} npx tsx scripts/submit_base_case_to_rjp.ts'
```

For coordinated multi-subject refresh, use `scripts/poll_base_subjects.py`.
It shares one latest-block window across many subjects, writes one case per
subject, and writes a bundle index for the full cycle.

Single-cycle example:

```bash
python3 scripts/poll_base_subjects.py \
  --subjects 0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001,0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c \
  --network base-sepolia \
  --window-size 20 \
  --once \
  --pretty
```

Pinned coordinated window example:

```bash
python3 scripts/poll_base_subjects.py \
  --subjects 0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001,0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c \
  --network base-sepolia \
  --start-block 39454640 \
  --end-block 39454680 \
  --once \
  --pretty
```

Per-subject pinned windows example:

```json
{
  "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001": {
    "start_block": 39502983,
    "end_block": 39503002
  },
  "0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c": {
    "start_block": 39454640,
    "end_block": 39454680
  }
}
```

```bash
python3 scripts/poll_base_subjects.py \
  --subjects 0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001,0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c \
  --subject-windows-file subject_windows.json \
  --network base-sepolia \
  --once \
  --pretty
```

With coordinated submit/publish hooks:

```bash
python3 scripts/poll_base_subjects.py \
  --subjects-file subjects.json \
  --network base-sepolia \
  --window-size 20 \
  --submit-command 'PRIVATE_KEY=0x... GENLAYER_RPC_URL=https://studio.genlayer.com/api RJP_CONTRACT_ADDRESS=0x4a099B06141Ca3464318c28C4D2884B85d070D4f CASE_FILE={case_path} npx tsx scripts/submit_base_case_to_rjp.ts' \
  --publish-command 'BASE_PRIVATE_KEY=0x... BASE_MIRROR_ADDRESS=0x34EBfd4FcC379b14Cdd602485417a5C088228606 RJP_CONTRACT_ADDRESS=0x4a099B06141Ca3464318c28C4D2884B85d070D4f SUBJECT_ID={subject_id} npx tsx scripts/publish_judgment_to_base.ts'
```

The multi-subject poller writes:

- one case file per changed subject
- one bundle index under `artifacts/polled-subjects/bundles/`
- one state file tracking the latest case per subject

If a submit or publish hook fails for one subject, the orchestrator now keeps
the rest of the cycle, writes the partial bundle and state, and records the
per-subject status as `updated`, `unchanged`, `hook_failed`, or `build_failed`.

## Benchmark Multiple Wallets

The comparison benchmark can now take one subject or many.

Single subject:

```bash
BASE_PRIVATE_KEY=0x... \
BASE_AGENT_DEMO_ADDRESS=0x60381D4088B7B2C985B248CE8B64287c13b71434 \
BASE_AGENT_DIRECT_ADDRESS=0x90db5f049c98f3fd510d866cb3386e50287b8ade \
SUBJECT_ID=0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001 \
ROUNDS=1 \
npx tsx scripts/benchmark_onchain_agents.ts
```

Multiple subjects:

```bash
BASE_PRIVATE_KEY=0x... \
BASE_AGENT_DEMO_ADDRESS=0x60381D4088B7B2C985B248CE8B64287c13b71434 \
BASE_AGENT_DIRECT_ADDRESS=0x90db5f049c98f3fd510d866cb3386e50287b8ade \
SUBJECT_IDS=0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001,0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c,0x0000000000000000000000000000000000000d0d \
ROUNDS=1 \
npx tsx scripts/benchmark_onchain_agents.ts
```

Accepted env vars for the subject list are:

- `SUBJECT_ID`
- `SUBJECT_IDS`
- `SUBJECTS`

## Coordinated Agent Reactions

To benchmark agents reacting to each other’s mirrored judgments on Base:

```bash
BASE_RPC_URL=https://sepolia.base.org \
BASE_MIRROR_ADDRESS=0x34EBfd4FcC379b14Cdd602485417a5C088228606 \
SUBJECTS=0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001,0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c \
ROUNDS=1 \
npx tsx scripts/benchmark_coordinated_agents.ts
```

This reads the latest mirrored judgments for all listed subjects, derives
freshness-aware states, carries forward each subject's domain interpretation,
and outputs pairwise interaction decisions such as:

- `INTERACT`
- `REVIEW`
- `REFRESH`
- `DENY`

To make the offchain coordination output attestable, provide a coordinator key:

```bash
BASE_RPC_URL=https://sepolia.base.org \
BASE_MIRROR_ADDRESS=0x34EBfd4FcC379b14Cdd602485417a5C088228606 \
SUBJECTS=0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001,0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c \
ROUNDS=1 \
COORDINATOR_PRIVATE_KEY=0x... \
npx tsx scripts/benchmark_coordinated_agents.ts > /tmp/coordinated-report.json
```

Then verify the attestation:

```bash
REPORT_FILE=/tmp/coordinated-report.json \
npx tsx scripts/verify_coordinated_attestation.ts
```

This keeps the trust model explicit:

- judgments stay authoritative on GenLayer and Base
- coordination stays offchain for flexibility
- agents can still verify who signed the coordination output
- the coordinated report now also carries domain-aware meaning for each subject,
  so consumers can distinguish counterparty-trust coordination from other
  future domain families

## Primary Flow

The recommended hackathon flow is now:

1. Base watcher / evidence builder creates a compact JSON case
2. submit that case directly to RJP on GenLayer
3. evaluate the latest evidence on RJP
4. agents read RJP state and act

Direct submit helper:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=0x... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
RJP_CONTRACT_ADDRESS=0x4a099B06141Ca3464318c28C4D2884B85d070D4f \
CASE_FILE=/tmp/agent-1-case.json \
npx tsx scripts/submit_base_case_to_rjp.ts
```

That script:

- calls `submit_evidence`
- then calls `evaluate_latest_evidence`
- keeps the whole MVP flow on Base + GenLayer only

This is the preferred path for the MVP because it removes the zkSync / LayerZero
transport dependency from the main demo loop.

## Evaluation Mode

Check the current mode:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=0x... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
RJP_CONTRACT_ADDRESS=0x4a099B06141Ca3464318c28C4D2884B85d070D4f \
npx tsx scripts/get_evaluation_mode.ts
```

Set the mode:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=0x... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
RJP_CONTRACT_ADDRESS=0x4a099B06141Ca3464318c28C4D2884B85d070D4f \
EVALUATION_MODE=llm \
npx tsx scripts/set_evaluation_mode.ts
```

Recommended usage:

- `deterministic` for the reliable demo baseline
- `llm` for the more interesting GenLayer-native judgment showcase

For the `llm` path, the contract now binds the judgment to evidence commitment
metadata in storage and prompt material:

- case schema version
- extractor version
- manifest schema version
- manifest root
- manifest item count

So the model is interpreting normalized features tied to a committed evidence
artifact, not loose free-form JSON.

## Trust Boundary

The system has 3 distinct roles:

1. Evidence layer:
   Base activity plus the reproducible case artifact built by
   [build_base_case.py](/home/jay/codex/genlayer/rjp/scripts/build_base_case.py)
   and checked by
   [verify_base_case.py](/home/jay/codex/genlayer/rjp/scripts/verify_base_case.py).
2. Judgment layer:
   GenLayer, where
   [reasoned_judgment_pass.py](/home/jay/codex/genlayer/rjp/contracts/reasoned_judgment_pass.py)
   stores the revisioned judgment.
3. Consumption layer:
   Base mirror and Base-native agents, which use the latest published judgment
   for fast reads and enforcement.

Important implication:

- the Base mirror is not the root of truth
- it is a fast consumption layer
- mirroring does not create trust by itself

Important handshake implication:

- `state` and `reason_code` are the primary semantics
- `recommended_action` is a policy hint, not the root meaning
- the enforced path is still the contract gate, not whether an agent chooses to
  follow the hint

Trust only becomes strong if the upstream pipeline is strong:

- evidence extraction must be reproducible
- freshness must be enforced
- mirrored state must be authenticated and revision-aware
- eventually, multi-watcher confirmation and disputes must exist

So “compute once on GenLayer, mirror to Base, consume on Base” is a performance
architecture, not a complete correctness guarantee by itself.

## Multi-Agent Handshake Benchmark

Use the benchmark harness to compare how different agent policies consume the
same handshake state on GenLayer and on Base Sepolia:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=0x... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
BASE_RPC_URL=https://sepolia.base.org \
RJP_CONTRACT_ADDRESS=0x4a099B06141Ca3464318c28C4D2884B85d070D4f \
BASE_AGENT_DEMO_ADDRESS=0x60381D4088B7B2C985B248CE8B64287c13b71434 \
CURRENT_SOURCE_BLOCK=39466613 \
ROUNDS=2 \
npx tsx scripts/benchmark_multi_agent_handshakes.ts
```

The live default benchmark subject set covers the deployed states that are known
to exist right now:

- `SAFE`: `0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001`
- `UNSAFE`: `0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c`
- `NO_JUDGMENT`: `0x0000000000000000000000000000000000000d0d`

An optional `CAUTION` benchmark subject is available from
[benchmark_caution_case.json](/home/jay/codex/genlayer/rjp/demo_cases/benchmark_caution_case.json),
not a live Base-watcher artifact. Add it explicitly with `SUBJECTS=...` after
you seed it on the target contract.

The benchmark also includes a `hint_ignorer` profile so advisory-versus-enforced
behavior is visible during tests.

## Onchain Agent Comparison

To compare Base onchain agents that use mirrored judgments against Base onchain
agents that do not use judgments at all:

1. judgment-aware agent:
   [BaseAgentActionDemo.sol](/home/jay/codex/genlayer/rjp/evm/BaseAgentActionDemo.sol)
2. direct no-judgment agent:
   [BaseAgentDirectDemo.sol](/home/jay/codex/genlayer/rjp/evm/BaseAgentDirectDemo.sol)

Deploy the direct comparison contract:

```bash
cd /home/jay/codex/genlayer/rjp
BASE_PRIVATE_KEY=0x... \
BASE_RPC_URL=https://sepolia.base.org \
npx tsx scripts/deploy_base_agent_direct.ts
```

Benchmark the two onchain agent modes against the same subject:

```bash
cd /home/jay/codex/genlayer/rjp
BASE_PRIVATE_KEY=0x... \
BASE_RPC_URL=https://sepolia.base.org \
BASE_AGENT_DEMO_ADDRESS=0x60381D4088B7B2C985B248CE8B64287c13b71434 \
BASE_AGENT_DIRECT_ADDRESS=0x90db5f049c98f3fd510d866cb3386e50287b8ade \
SUBJECT_ID=0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001 \
ACTION_TYPE=trade \
ROUNDS=1 \
npx tsx scripts/benchmark_onchain_agents.ts
```

This measures both:

- preview/read latency
- landed Base transaction latency

for:

- an agent that enforces mirrored judgment state
- an agent that blindly allows without any judgment check

Freshness and anti-replay are now carried directly in the live judgment shape:

- `freshness_window_blocks`
- `valid_until_source_block`

Freshness-aware consumers on GenLayer and Base can now reject stale judgments.

## Optional Bridge Path

The bridge code is still kept in the repo, but it is no longer the primary flow.

`scripts/send_base_case_via_bridge.js` reads a normalized Base evidence JSON,
ABI-encodes it as a single `string`, quotes the LayerZero fee through
`BridgeSender.sol`, and optionally sends it to the GenLayer target contract.

This script is meant to run in a Node environment that already has the bridge
boilerplate dependencies installed, especially:

- `ethers`
- `dotenv`
- `@layerzerolabs/lz-v2-utilities`

Typical flow:

```bash
python3 scripts/build_base_case.py \
  --subject 0xabc... \
  --network base-sepolia \
  --start-block 1200 \
  --end-block 1250 \
  --out /tmp/agent-1-case.json

cd /path/to/genlayer-studio-bridge-boilerplate/smart-contracts

BRIDGE_SENDER_ADDRESS=0x... \
TARGET_CONTRACT=0x... \
RPC_URL=https://sepolia.base.org \
node /home/jay/codex/genlayer/rjp/scripts/send_base_case_via_bridge.js \
  --input /tmp/agent-1-case.json \
  --quote-only
```

If you omit `--quote-only`, the script sends the transaction and prints the
bridge `messageId` from the `MessageSentToGenLayer` event. A live send requires
`PRIVATE_KEY`; a quote-only run does not.

## Set The GenLayer Bridge Receiver On RJP

The GenLayer CLI currently hits a Linux keychain dependency on some systems.
These small `genlayer-js` scripts bypass that by using `PRIVATE_KEY` directly.

Install dependencies in this repo first:

```bash
cd /home/jay/codex/genlayer/rjp
npm install
```

Set the bridge receiver:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=0x... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
RJP_CONTRACT_ADDRESS=0xd6096567332d41f06B5D55D392823EA6484b4119 \
BRIDGE_RECEIVER_IC_ADDRESS=0x3Ec69a1a6342839ef8298b0A001D155A350bf56f \
npx tsx scripts/set_bridge_receiver.ts
```

Read it back:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=0x... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
RJP_CONTRACT_ADDRESS=0xd6096567332d41f06B5D55D392823EA6484b4119 \
npx tsx scripts/check_bridge_receiver.ts
```

Print the latest judgment as clean JSON:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=0x... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
RJP_CONTRACT_ADDRESS=0xd6096567332d41f06B5D55D392823EA6484b4119 \
SUBJECT_ID=0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001 \
npx tsx scripts/get_latest_judgment_json.ts
```

Print the latest evidence as clean JSON:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=0x... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
RJP_CONTRACT_ADDRESS=0xd6096567332d41f06B5D55D392823EA6484b4119 \
SUBJECT_ID=0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001 \
npx tsx scripts/get_latest_evidence_json.ts
```

## Agent Consumption

Agents should use the stored judgment record, not re-run evidence evaluation.
The current helper uses a single decision read and can optionally enforce
freshness with `CURRENT_SOURCE_BLOCK`.

Agent-style read path:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=0x... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
RJP_CONTRACT_ADDRESS=0xd6096567332d41f06B5D55D392823EA6484b4119 \
SUBJECT_ID=0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c \
ACTION_TYPE=trade \
CURRENT_SOURCE_BLOCK=39458528 \
npx tsx scripts/agent_use_judgment.ts
```

## Publish The Latest Judgment Back To Base

The Base mirror path is now:

1. deploy [BaseJudgmentMirror.sol](/home/jay/codex/genlayer/rjp/evm/BaseJudgmentMirror.sol) on Base Sepolia
2. authorize the publishing wallet if it is not the deployer
3. publish the latest GenLayer judgment to Base
4. read that compact judgment back from Base

Current live Base Sepolia mirror deployment:

- `0x34EBfd4FcC379b14Cdd602485417a5C088228606`

Current live Base Sepolia agent consumer deployment:

- `0x83e5f29e2269bba751e7ed1ac84acab47b8ea05d`

The mirror contract now restricts writes to authorized publishers. At deploy
time, the deployer is authorized automatically, and an optional initial
publisher can be authorized in the constructor.

Deploy the mirror directly from this repo:

```bash
cd /home/jay/codex/genlayer/rjp
BASE_RPC_URL=https://sepolia.base.org \
BASE_PRIVATE_KEY=0x... \
INITIAL_PUBLISHER=0x... \
npx tsx scripts/deploy_base_mirror.ts
```

The Base contracts are now verified on BaseScan. The working path was the raw
Etherscan v2 API with `chainid` in the URL.

Reusable helper:

```bash
cd /home/jay/codex/genlayer/rjp
ETHERSCAN_API_KEY=... \
npx tsx scripts/verify_base_contract_etherscan_v2.ts mirror 0x34EBfd4FcC379b14Cdd602485417a5C088228606

ETHERSCAN_API_KEY=... \
npx tsx scripts/verify_base_contract_etherscan_v2.ts agent-demo 0x83e5f29e2269bba751e7ed1ac84acab47b8ea05d
```

Lower-level curl shape that worked:

```bash
cd /home/jay/codex/genlayer/rjp
curl -X POST "https://api.etherscan.io/v2/api?chainid=84532" ...
```

Preferred fallback: Hardhat + BaseScan verification.
This requires `ETHERSCAN_API_KEY` in the environment.

```bash
cd /home/jay/codex/genlayer/rjp
ETHERSCAN_API_KEY=... \
npx tsx scripts/verify_base_contract_hardhat.ts mirror 0x34EBfd4FcC379b14Cdd602485417a5C088228606

ETHERSCAN_API_KEY=... \
BASE_MIRROR_ADDRESS=0x34EBfd4FcC379b14Cdd602485417a5C088228606 \
npx tsx scripts/verify_base_contract_hardhat.ts agent-demo 0x83e5f29e2269bba751e7ed1ac84acab47b8ea05d
```

This path syncs the local `evm/` contracts into the bridge boilerplate Hardhat
workspace and runs `hardhat verify` against Base Sepolia, but the raw v2 path
is the one that actually succeeded for the current live contracts.

Authorize a publisher:

```bash
cd /home/jay/codex/genlayer/rjp
BASE_RPC_URL=https://sepolia.base.org \
BASE_MIRROR_ADDRESS=0x... \
BASE_PRIVATE_KEY=0x... \
PUBLISHER_ADDRESS=0x... \
npx tsx scripts/set_base_mirror_publisher.ts
```

Publish the latest GenLayer judgment:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=0x... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
RJP_CONTRACT_ADDRESS=0xd6096567332d41f06B5D55D392823EA6484b4119 \
SUBJECT_ID=0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c \
BASE_MIRROR_ADDRESS=0x... \
BASE_PRIVATE_KEY=0x... \
npx tsx scripts/publish_judgment_to_base.ts
```

Read the mirrored judgment from Base:

```bash
cd /home/jay/codex/genlayer/rjp
BASE_RPC_URL=https://sepolia.base.org \
BASE_MIRROR_ADDRESS=0x... \
SUBJECT_ID=0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c \
npx tsx scripts/get_published_judgment_from_base.ts
```

That script:

- reads `get_agent_decision`
- prints the judgment, decision, and timing data

Optional write path:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=0x... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
RJP_CONTRACT_ADDRESS=0xd6096567332d41f06B5D55D392823EA6484b4119 \
SUBJECT_ID=0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c \
ACTION_TYPE=trade \
ATTEMPT_ACTION=true \
npx tsx scripts/agent_use_judgment.ts
```

This is the fast agent path for the MVP:

- heavy Base evidence normalization happens earlier
- judgment is already stored on GenLayer
- the agent only reads the judgment record and gate decision

Authorize the bridge service wallet on the GenLayer bridge receiver:

```bash
cd /home/jay/codex/genlayer/rjp
PRIVATE_KEY=0x... \
GENLAYER_RPC_URL=https://studio.genlayer.com/api \
BRIDGE_RECEIVER_IC_ADDRESS=0x3Ec69a1a6342839ef8298b0A001D155A350bf56f \
RELAYER_ADDRESS=0xYOUR_SERVICE_WALLET \
npx tsx scripts/authorize_bridge_relayer.ts
```

## Base Evidence Adapter Schema

```json
{
  "subject_id": "agent-1",
  "domain_id": "EXECUTION_INTEGRITY_V1",
  "source": {
    "network": "base-sepolia",
    "chain_id": 84532,
    "source_label": "base-sepolia-demo"
  },
  "window": {
    "start_block": 1200,
    "end_block": 1250,
    "start_block_hash": "0xstart",
    "end_block_hash": "0xend"
  },
  "features": {
    "tx_count": 14,
    "failed_tx_count": 0,
    "unique_counterparties": 4,
    "unbounded_approval_count": 0,
    "high_risk_flags": 0
  },
  "notes": "Normalized Base evidence for judgment."
}
```

## Demo Path

1. Set `EVALUATION_MODE=deterministic`.
2. Submit a clean Base Sepolia evidence window for the subject.
3. Show judgment revision `1` as `SAFE`.
4. Show `can_execute(...)` allowing the action.
5. Send a real Base Sepolia `approve(...)` transaction with max allowance.
6. Build a new evidence window containing that approval.
7. Submit it and evaluate again.
8. Show judgment revision `2` as `UNSAFE`.
9. Show `can_execute(...)` now denying the action.
10. Optionally switch to `EVALUATION_MODE=llm` and repeat the same evidence flow.

## Notes

This scaffold keeps the hackathon scope narrow on purpose:

- one contract
- one domain
- one guarded action
- direct tests first
- Base evidence in, GenLayer judgment out

It does not attempt the full RJP graph, forecast, or governance vision.

The bridge path is intentionally kept in the repo, but it is not in the main
demo loop anymore.
