# Author's Forge — Build History

This file is the durable, chronological engineering history for the repository. It complements the README: the README records the current product truth; this ledger records how the current truth was built.

## Mission 044 — Governed Workflow Advancement

**Status:** Implemented in `main`; CI verification remains required before calling the capability production-verified.

### Added

- `src/application/workflow-advance.ts`
- `test/workflow-advance.test.js`
- public API exports in `src/index.ts`

### Capability

The workflow quality-gate domain can now be consumed through an application-level advancement service. It derives the next canonical stage, refuses non-sequential jumps, refuses advancement when the current stage has failed checks, returns explicit blocker IDs, and preserves the gate report that justified the decision.

### Product path

`current stage → gate evaluation → blocker/remediation or approved advancement → next canonical stage`

### Author-control rule

Advancement is deterministic and governed. AI does not silently move a book through production stages.

### Verification

Automated regression coverage was added for successful advancement, blocked advancement, and non-sequential stage jumps. Remote CI must still be observed before this milestone is marked verified.

## Mission 043 — Workflow Quality Gates

Added the versioned lifecycle quality-gate contract spanning concept, architecture, canon, manuscript, editing, visuals, production, positioning, marketing, and release.

## Mission 042 — Evidence-Gated Marketing Campaigns

Added evidence-aware campaign and marketing-asset contracts with explicit approval and scheduling safety rules.

## Mission 041 — Cross-Workflow Release Gate

Connected publishing readiness and marketing safety into a release-gate boundary.

## Mission 040 — Proposal Review Integrity

Added append-only proposal review audit history and deterministic proposal diffing.

## Mission 039 — Review-Gated AI Proposals

Added author-controlled AI proposal lifecycle with provenance and explicit acceptance/rejection.

## Mission 038 — Context Pipeline Integration

Integrated governed context optimization into the Project Brain → AI context path and added provider-aware cost governance.

## Mission 037 — Context Governance

Added context stratification, canonical-first prioritization, deterministic token budgeting, session deduplication, and optimization-ledger accounting.

## Mission 036 — Context Engine Foundation

Established the production context-engine registry and deterministic lossless-first optimization stack.

---

## Engineering rule

Every future major mission must append an entry here, update the README's current-state summary, add or update tests, and leave a durable Git checkpoint. A milestone is not marked **verified** until repository CI and, where applicable, Studio/device verification provide evidence.
