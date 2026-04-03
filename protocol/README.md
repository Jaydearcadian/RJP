## Protocol Artifacts

This directory now serves two purposes:

- it freezes the protocol objects for the RJP rebuild
- it anchors the local-first implementation path that the builder, verifier,
  and contract are now converging around

Primary protocol objects:

- `DomainSpec`
- `CaseObject`
- `AssessmentArtifact`
- `JudgmentObject`

Layout:

- `schemas/`: JSON Schemas for the protocol objects
- `domains/`: concrete domain drafts
- `examples/`: example objects for the current concrete domains
- `DOMAIN_CONSUMPTION.md`: human-readable guide for domain-aware consumption

Current domain drafts:

- `counterparty_trust.base_trade_v1`
- `protocol_safety.base_erc20_permission_v1`

These files are no longer only documentation. Locally:

- the Base builder now defaults to `CaseObject`
- the offline verifier validates `CaseObject` semantics against the domain
- the GenLayer contract now validates protocol case fields for the supported
  domain, stores explicit `AssessmentArtifact` records, and exposes compact
  `JudgmentObject` getters alongside the older MVP judgment views

The remaining work is mainly live migration and wider adoption of these objects
across the rest of the stack.
