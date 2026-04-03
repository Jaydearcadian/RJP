# Protocol Safety Safe Path

This note captures the current safe way to advance
`protocol_safety.base_erc20_permission_v1` without changing the main live
contract path.

The current strategy is:

- keep the live mainline frozen on the working `counterparty_trust` domain
- prove `protocol_safety` locally in deterministic mode
- prove `protocol_safety` locally in isolated LLM mode
- promote only on a dedicated subject so the first domain remains untouched

## Domain

- `protocol_safety.base_erc20_permission_v1`

Question answered:

- is this ERC-20 approval posture safe for the wallet and spender in this
  observation window?

## Deterministic Safe Path

The deterministic local matrix is now proven in
[test_reasoned_judgment_pass.py](https://github.com/Jaydearcadian/RJP/blob/main/tests/direct/test_reasoned_judgment_pass.py).

Current matrix:

- sparse permission window -> `INSUFFICIENT_DATA` -> `REFRESH`
- one failed approval-related action -> `CAUTION` -> `REVIEW`
- bounded approval posture -> `SAFE` -> `ALLOW`
- unbounded approval posture -> `UNSAFE` -> `DENY`

Why this matters:

- it proves the domain semantics without live RPC dependence
- it proves the contract and handshake mapping for this domain
- it gives a stable baseline before any live promotion attempt

## Isolated LLM Safe Path

The isolated local LLM path is also now proven for this domain:

- ambiguous permission case under `prompt_profile = isolated_minimal`
  - mocked model output -> `CAUTION`
  - judgment materializes as `CAUTION` with `FAILED_TX`
- obvious unsafe permission posture under `prompt_profile = isolated_minimal`
  - deterministic pre-LLM guardrail short-circuits to `UNSAFE`
  - no open-ended prompt dependence for the deny-grade case

This is the correct safe surface because it separates:

- ambiguous permission cases that still need model interpretation
- obvious unsafe permission cases that should never depend on broad prompt
  behavior

## Current Promotion Status

Current live mainline:

- `counterparty_trust.base_trade_v1`

Current second-domain status:

- `protocol_safety.base_erc20_permission_v1`
  - protocol-defined
  - artifact-validated
  - deterministic local matrix proven
  - isolated local LLM path proven
  - live isolated Studionet unsafe-case path proven
  - main live contract sparse-case path proven on a dedicated subject
  - live Base mirror path proven on the same dedicated subject
  - not the main live mirrored benchmark path

## Live Isolated Proof

The domain now also has a successful live isolated Studionet proof on a
separate debug contract:

- isolated contract:
  `0xDF0A84038300368B544eee000583f25f00D074F6`
- config:
  - `evaluation_mode = llm`
  - `prompt_profile = isolated_minimal`
- verified case:
  - subject:
    `0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c`
  - domain:
    `protocol_safety.base_erc20_permission_v1`
  - case id:
    `protocol_safety.base_erc20_permission_v1:0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c:39629295-39629295`
  - outcome:
    `UNSAFE`
  - reason code:
    `UNBOUNDED_APPROVAL`

Live txs:

- deploy:
  `0x846f3d1b2ecf430419487ee3e1c3b0fe6f049098586bccac070bb7629b7a2ef7`
- submit evidence:
  `0x802414b5c16d506e04c69a032934bfdcbd9802043a613b58cd476d610d120a6a`
- evaluate:
  `0xcd4ed0b2c3599efde91a1f02f0b7fe1530b762c9d9258d5879bd73e43283a6ed`

Important boundary:

- this proves the domain can materialize on a separate live isolated contract
- it does not yet justify changing the main live contract path
- promotion should still wait for a deliberate decision

## Main Live Contract Proof

The main live contract now also stores this domain safely on a dedicated
non-demo subject:

- main contract:
  `0x4a099B06141Ca3464318c28C4D2884B85d070D4f`
- subject:
  `0x0000000000000000000000000000000000000b0b`
- case id:
  `protocol_safety.base_erc20_permission_v1:0x0000000000000000000000000000000000000b0b:39629295-39629305`
- submit tx:
  `0x0982810b60704e871f49371d1ef3ad2913bf3649521ede07517b16fda80ddb9f`
- evaluate tx:
  `0xf96a73960058e07ecbe50b610d9e4359dc6d1fca7cc5519c37eeb8927f114c49`
- direct judgment result:
  - outcome:
    `INSUFFICIENT_DATA`
  - reason code:
    `SPARSE_ACTIVITY`

This matters because it upgrades the second domain from:

- protocol-defined only

to:

- protocol-defined
- locally proven
- isolated-live proven
- main-live materialized on a dedicated subject

Important boundary:

- this still does not mean the second domain is the main mirrored benchmark path
- it does mean the second domain now genuinely exists on the main live contract

## Live Base Promotion Proof

The second domain is now also promoted on the live Base mirror without
touching the original clean and risky counterparty-trust subjects:

- live mirror:
  `0x34EBfd4FcC379b14Cdd602485417a5C088228606`
- dedicated subject:
  `0x0000000000000000000000000000000000000b0b`
- publish tx:
  `0x101d8fcc4590c5018acc5c77d7890093fda2fbddf87dbdaa10bdd589cdeeada2`
- mirrored result:
  - outcome:
    `INSUFFICIENT_DATA`
  - claim type:
    `erc20_permission_safety`
  - reason code:
    `SPARSE_ACTIVITY`
- Base `approve` action tx:
  `0x5a4bca063a039b57702bd422b48231b229f082a257ce9529dcbb0ff497c07911`
- Base handshake result:
  - state:
    `INSUFFICIENT_DATA`
  - recommended action:
    `REFRESH`

This matters because the second domain now exists across:

- local deterministic tests
- local isolated LLM tests
- isolated live Studionet proof
- main live GenLayer contract
- live Base mirror consumption

while the first domain still remains the primary live benchmark path.

## How To Re-Run The Safe Path

Deterministic and isolated local contract coverage:

```bash
pytest tests/direct/test_reasoned_judgment_pass.py -q
```

Protocol artifact validation:

```bash
node scripts/validate_protocol_artifacts.js
```

If you want to focus only on the permission-domain safe path:

```bash
pytest tests/direct/test_reasoned_judgment_pass.py -q -k "permission_domain"
```

## Consumption Meaning

For agents, wallets, contracts, and humans:

- read `JudgmentObject` first
- treat domain meaning as first-class
- treat this as a permission posture judgment, not a counterparty judgment

References:

- [protocol/DOMAIN_CONSUMPTION.md](https://github.com/Jaydearcadian/RJP/blob/main/protocol/DOMAIN_CONSUMPTION.md)
- [AGENT_AND_NON_AGENT_DOMAIN_USAGE.md](https://github.com/Jaydearcadian/RJP/blob/main/AGENT_AND_NON_AGENT_DOMAIN_USAGE.md)
- [ARTIFACT_VERIFICATION_STATUS.md](https://github.com/Jaydearcadian/RJP/blob/main/ARTIFACT_VERIFICATION_STATUS.md)
