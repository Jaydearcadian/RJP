# Domain Consumption

This file explains how agents, wallets, contracts, and humans should consume
RJP judgments by domain.

The rule is:

- machines should primarily read protocol objects
- humans can use this document as the interpretation guide

The hot path remains:

- read `JudgmentObject`
- check freshness
- apply the domain meaning

The cold path remains:

- read `AssessmentArtifact`
- inspect richer payload and evidence linkage

## Shared Consumption Rule

For every domain:

1. read `domain_id`
2. read `claim_type`
3. read `outcome` or `outcome_enum`
4. check freshness or handshake state
5. inspect `risk_flags` when present
6. only then decide whether to allow, review, deny, or refresh

`JudgmentObject` is the compact consumption primitive.

`AssessmentArtifact` is the richer audit and explanation record.

## Domain: `counterparty_trust.base_trade_v1`

Primary question:

- should this wallet be trusted as a trading counterparty in this observation window?

Subject meaning:

- the subject is the wallet being judged

Target meaning:

- a wallet-contract pair in a Base trade flow

Primary consumer:

- agents
- wallets
- routing systems
- contract middleware deciding whether to proceed with trade-like interactions

What the outcome means:

- `SAFE`: acceptable counterparty behavior for the declared trade context
- `CAUTION`: mixed counterparty behavior; requires review or tighter policy
- `UNSAFE`: counterparty behavior should block or deny the interaction
- `INSUFFICIENT_DATA`: not enough admissible evidence for a reliable judgment

What agents should focus on:

- freshness first
- `outcome`
- `risk_flags`
- the fact that this is a counterparty judgment, not a protocol judgment

Typical hot-path policy:

- allow when `SAFE` and fresh
- review when `CAUTION`
- refresh when `INSUFFICIENT_DATA`
- deny when `UNSAFE`
- refresh when the handshake state is `STALE`

## Domain: `protocol_safety.base_erc20_permission_v1`

Primary question:

- is this ERC-20 approval posture safe for the wallet and spender in this observation window?

Subject meaning:

- the subject is still the wallet being judged

Target meaning:

- the wallet-contract permission relationship, especially approval posture

Primary consumer:

- wallets
- approval managers
- agents that request or react to token approvals
- middleware that wants to block risky spender permissions

What the outcome means:

- `SAFE`: observed approval posture is bounded enough for normal use
- `CAUTION`: approval posture is mixed and should be reviewed
- `UNSAFE`: approvals are too broad or unsafe for normal use
- `INSUFFICIENT_DATA`: not enough admissible evidence for a reliable permission judgment

What agents should focus on:

- approval breadth
- spender-specific risk
- `UNBOUNDED_APPROVAL` and related flags
- whether the judgment is fresh enough to enforce approval-sensitive actions

Typical hot-path policy:

- allow when `SAFE` and fresh
- review when `CAUTION`
- refresh when `INSUFFICIENT_DATA`
- deny when `UNSAFE`
- refresh when the handshake state is `STALE`

Deterministic safe-path matrix already proven locally:

- sparse permission window -> `INSUFFICIENT_DATA` -> `REFRESH`
- one failed approval-related action -> `CAUTION` -> `REVIEW`
- bounded clean approval posture -> `SAFE` -> `ALLOW`
- unbounded approval posture -> `UNSAFE` -> `DENY`

## Why This Split Matters

These two domains should not be consumed the same way.

`counterparty_trust.base_trade_v1` answers:

- should I trust this counterparty for trade?

`protocol_safety.base_erc20_permission_v1` answers:

- should I trust this approval posture or permission relationship?

If a consumer ignores that difference, the protocol becomes too generic and the
judgment meaning becomes weak.

That is why consumers should treat domain meaning as first-class, not as a
metadata string on an otherwise generic record.
