# Eliza Evidence Vs Judgment Benchmark

This note records the current benchmark result for Eliza-style agent
consumption across 3 surfaces:

- evidence-injected agent context
- judgment-injected agent context
- deterministic baseline

Canonical artifact:

- benchmark runner:
  - [benchmark_evidence_vs_judgment.ts](https://github.com/Jaydearcadian/RJP/blob/main/integrations/elizaos/testbed/src/benchmark_evidence_vs_judgment.ts)

## What Was Tested

Three benchmark cases:

1. `counterparty-safe-trade`
2. `counterparty-risky-trade`
3. `permission-sparse-approve`

For each case, the benchmark recorded:

- evidence fetch latency from the local API
- mirror and handshake fetch latency from live Base reads
- provider injection latency
- model decision text
- parsed decision
- fallback usage
- deterministic expected decision

## Final Result

The final benchmark artifact aligned across all 3 decision surfaces.

### Case Results

- `counterparty-safe-trade`
  - evidence-mode: `ALLOW`
  - judgment-mode: `ALLOW`
  - deterministic baseline: `ALLOW`
- `counterparty-risky-trade`
  - evidence-mode: `DENY`
  - judgment-mode: `DENY`
  - deterministic baseline: `DENY`
- `permission-sparse-approve`
  - evidence-mode: `REFRESH`
  - judgment-mode: `REFRESH`
  - deterministic baseline: `REFRESH`

### Fallback Usage

All 6 model responses completed without fallback on the final aligned run.

## Why This Matters

Earlier evidence-mode runs over-allowed the risky and sparse cases.

The fix was not a contract change. The fix was tightening the
[rjpEvidenceProvider.ts](https://github.com/Jaydearcadian/RJP/blob/main/integrations/elizaos/src/providers/rjpEvidenceProvider.ts)
surface so it now emits:

- domain-specific evidence rules
- `evidence_decision_hint`
- `primary_reason_code`
- explicit binding guidance for the model

That means:

- the judgment layer remains the strongest compact consumption primitive
- but evidence-mode agents can now be disciplined enough to agree with the
  deterministic and judgment-driven path on the benchmark cases

## Measured Timing

Final aligned run:

- `counterparty-safe-trade`
  - evidence fetch: `113.312 ms`
  - mirror fetch: `5708.157 ms`
  - handshake fetch: `6102.406 ms`
  - evidence provider injection: `14.633 ms`
  - judgment provider injection: `5214.541 ms`
  - evidence agent response: `2924.812 ms`
  - judgment agent response: `791.067 ms`
- `counterparty-risky-trade`
  - evidence fetch: `19.235 ms`
  - mirror fetch: `5427.329 ms`
  - handshake fetch: `5685.566 ms`
  - evidence provider injection: `16.275 ms`
  - judgment provider injection: `5181.314 ms`
  - evidence agent response: `1849.728 ms`
  - judgment agent response: `902.056 ms`
- `permission-sparse-approve`
  - evidence fetch: `19.785 ms`
  - mirror fetch: `5569.914 ms`
  - handshake fetch: `5344.689 ms`
  - evidence provider injection: `9.681 ms`
  - judgment provider injection: `5269.147 ms`
  - evidence agent response: `1352.713 ms`
  - judgment agent response: `1112.47 ms`

## Practical Conclusion

The benchmark now supports a stronger claim:

- evidence-mode Eliza agents can be constrained to agree with the protocol
  baseline on the tested cases
- judgment-mode Eliza agents still remain the cleaner hot path because they read
  the compact mirrored trust primitive directly

That is the correct story to present:

- evidence is reproducible and machine-usable
- judgment is still the preferred compact consumption layer

## Current Status

As of 2026-04-03, the Eliza judgment-aware path has been rechecked against the
current live stack with a fresh direct test run:

- [test_judgments.ts](https://github.com/Jaydearcadian/RJP/blob/main/integrations/elizaos/testbed/src/test_judgments.ts)

That current run confirms:

- the safe subject `0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001` is still read as
  `SAFE` with `ALLOW`
- the risky subject `0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c` is still read
  as `UNSAFE` with `DENY`
- the Eliza provider block still injects authoritative judgment context and the
  action check path still resolves to the same allow/deny outcome

Important qualifier:

- the full evidence-vs-judgment benchmark was not rerun on 2026-04-03 because
  the current shell did not have `OPENROUTER_API_KEY`
- the canonical repo-tracked references for that aligned benchmark remain:
  - [benchmark_evidence_vs_judgment.ts](https://github.com/Jaydearcadian/RJP/blob/main/integrations/elizaos/testbed/src/benchmark_evidence_vs_judgment.ts)
  - [rjpEvidenceProvider.ts](https://github.com/Jaydearcadian/RJP/blob/main/integrations/elizaos/src/providers/rjpEvidenceProvider.ts)

So the current honest reading is:

- the judgment-aware Eliza path is freshly revalidated
- the full evidence-vs-judgment alignment remains supported by the canonical
  artifact above
