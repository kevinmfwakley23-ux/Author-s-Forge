# Author's Forge — Mission 009

## Research Honesty

### Objective
Ensure research-derived knowledge is explicitly classified and never presented with greater certainty than its evidence supports.

### Required classifications
- `known-fact`
- `source-supported`
- `likely-inference`
- `creative-fiction`
- `uncertain`

### Governance rules
- Known facts require direct source-backed evidence.
- Source-supported claims require direct source-backed evidence.
- Likely inferences require at least indirect evidence and remain distinct from facts.
- Creative fiction is intentionally invented and cannot be represented as source-backed research.
- Uncertain information cannot be represented as directly established evidence.
- Classification is explicit; it is never derived from an AI confidence score alone.
- Research honesty assessments retain claim identity, project ownership, evidence strength, explanation, timestamp, and canon eligibility.
- Research honesty is persisted as working `research-memory` with provenance.
- Honesty classification never mutates manuscript text or silently promotes canon.
- Project retrieval is isolated and supports classification/claim/canon-eligibility filtering.

### Acceptance criteria
- All five honesty classifications are representable.
- Invalid evidence/classification combinations are rejected.
- Honest records can be persisted and retrieved through the project memory boundary.
- Research honesty remains project-scoped.
- Canon eligibility is explicit and never equivalent to automatic canon promotion.
- Existing Missions 001–008 contracts remain intact.
- Acceptance tests cover classification, dishonest-state rejection, persistence, filtering, isolation, summary, provenance, and working-memory authority.
