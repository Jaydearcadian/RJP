# Onchain Judgment Vs Direct Benchmark

This note records the current live Base Sepolia comparison between:

- the judgment-aware Base agent:
  - [BaseAgentActionDemo.sol](https://github.com/Jaydearcadian/RJP/blob/main/evm/BaseAgentActionDemo.sol)
- the direct no-judgment comparison agent:
  - [BaseAgentDirectDemo.sol](https://github.com/Jaydearcadian/RJP/blob/main/evm/BaseAgentDirectDemo.sol)

The benchmark runner is:

- [benchmark_onchain_agents.ts](https://github.com/Jaydearcadian/RJP/blob/main/scripts/benchmark_onchain_agents.ts)

Current live artifact:

- [proof-bundle-20260401-165310Z/comparisons/judgment_vs_direct.json](https://github.com/Jaydearcadian/RJP/blob/main/proof_bundles/proof-bundle-20260401-165310Z/comparisons/judgment_vs_direct.json)

## What Was Tested

Network:

- Base Sepolia

Action type:

- `trade`

Subjects:

1. `0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001`
2. `0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c`

Rounds:

- `1`

Contracts:

- judgment-aware demo:
  - `0x60381D4088B7B2C985B248CE8B64287c13b71434`
- direct comparison demo:
  - `0x90db5f049c98f3fd510d866cb3386e50287b8ade`

## Final Result

The comparison still shows the core RJP claim clearly:

- the judgment-aware agent changes behavior when a mirrored judgment exists
- the direct comparison agent keeps allowing because it has no judgment check

### Safe Subject

Subject:

- `0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001`

Judgment-aware result:

- preview state: `SAFE`
- recommended action: `ALLOW`
- allowed: `true`
- outcome: `SAFE`
- read latency: `574 ms`
- write latency: `1937 ms`
- tx hash:
  - `0x9b60c407196d830e3cad60a7ccbae222ca30638090a5fb12e23292d15e72d763`

Direct no-judgment result:

- preview state: `NO_JUDGMENT`
- recommended action: `ALLOW`
- allowed: `true`
- read latency: `193 ms`
- write latency: `3496 ms`
- tx hash:
  - `0x36094f77e61be86ae2dcd56fd41774aee5e856c21f2f0304a8218262b0e32724`

Interpretation:

- both agents allowed the safe subject
- only the judgment-aware path can explain why in protocol terms:
  - fresh `SAFE` judgment
  - concrete `case_id`
  - revisioned outcome

### Risky Subject

Subject:

- `0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c`

Judgment-aware result:

- preview state: `UNSAFE`
- recommended action: `DENY`
- allowed: `false`
- outcome: `UNSAFE`
- read latency: `187 ms`
- write latency: `2469 ms`
- tx hash:
  - `0x543da4b029780b8a40f8b88678bc048be90803e5014f624b6f1b6092c771b063`

Direct no-judgment result:

- preview state: `NO_JUDGMENT`
- recommended action: `ALLOW`
- allowed: `true`
- read latency: `427 ms`
- write latency: `3972 ms`
- tx hash:
  - `0x6186bcfb4fb8bd82c1eb6f3f369efec874538f28e675ed9f9a0a5706a23afb23`

Interpretation:

- the judgment-aware path denied the risky subject because the mirrored
  judgment was `UNSAFE`
- the no-judgment path still allowed the same subject because it had no trust
  primitive to consult

That difference is the point of the system.

## Why This Matters

This benchmark is not about a better dashboard.

It shows a behavioral difference:

- with mirrored judgment:
  - the consumer can deny unsafe flow
- without mirrored judgment:
  - the consumer allows by default or by incomplete local policy

That is why RJP matters for:

- contracts
- agents
- wallets
- downstream automation

The system is not just producing interpretation. It is changing the action path.

## Practical Conclusion

The live Base benchmark currently supports the strongest practical claim in the
repo:

- judgment-aware consumers behave differently from no-judgment consumers on the
  same subjects
- the difference is visible both in read previews and onchain action writes
- the risky subject is the decisive proof:
  - judgment-aware: `DENY`
  - direct no-judgment: `ALLOW`
