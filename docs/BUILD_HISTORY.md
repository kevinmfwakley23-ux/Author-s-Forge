# Author's Forge — Build History

This file is the durable, chronological engineering history for the repository. It complements the README: the README records the current product truth; this ledger records how the current truth was built.

## Mission 049 — Deterministic AI Proposal Review Diff

**Status:** Implemented in `main`; canonical build/regression verification required.

### Direction

Strengthen the author-controlled AI editing boundary with a deterministic review artifact. AI proposals must be inspectable without allowing the proposal itself to mutate authoritative manuscript state.

### Delivered

- Added `createAiProposalDiff` in `src/application/ai-proposal-diff.ts`.
- Produces deterministic line-level added/removed/unchanged review records.
- Binds the review artifact to SHA-256 hashes of both the exact base content and proposed content.
- Reports character and word counts plus line-change totals.
- Preserves explicit base/proposed line numbers for reviewer tooling.
- Normalizes CRLF/CR line endings for comparison while retaining exact-content hashes.
- Exported the capability from the canonical Forge API.
- Added regression coverage for changed proposals, identical content, line numbering, and cross-platform line endings.

### Governance

This capability is review-only. It does not apply, accept, reject, or otherwise mutate manuscript state. The persisted manuscript and existing author-review/application boundary remain authoritative.

### Next integration target

Expose proposal diffs in the running Writing Desk and Editing Room so an author can inspect exact changes before acceptance/application. The UI must use the hashes and current scene revision to refuse stale or mismatched candidates.

## Mission 048 — Source-Bound AI Editing Proposals

**Status:** Implemented in `main`; canonical build/regression and browser acceptance are required evidence for the next Studio integration checkpoint.

### Direction

Extend the governed AI proposal boundary from writing into intelligent editing. Editorial findings remain evidence; an AI rewrite remains a candidate; neither can silently mutate manuscript state.

### Delivered

- Added `AiEditingProposalService` to turn deterministic editorial findings into durable AI rewrite proposals.
- Validates the exact finding range before any provider call.
- Sends the finding, recommendation, targeted excerpt, author instruction, and complete source scene to the provider.
- Persists the complete proposed scene as a `manuscript-edit` proposal.
- Binds the proposal to the exact source scene revision with SHA-256.
- Reuses the existing author-review and stale-write application boundary.
- Exposed the editing proposal service through the canonical Forge API.
- Added regression tests for proposal creation, source binding, and provider short-circuiting on malformed ranges.

### Governance

The editing engine is not an autonomous editor. It produces evidence and candidates. Author approval remains mandatory, and stale candidates cannot overwrite newer manuscript work.

### Next integration target

Wire `AiEditingProposalService` into the running Editing Room with explicit "Generate rewrite proposal", "Approve", "Reject", and "Apply" controls tied to selected findings.

## Mission 047 — Governed Studio AI Writing Loop

**Status:** Implemented in `main`; canonical build/regression and browser acceptance are required evidence for each subsequent integration checkpoint.

### Direction

Connect durable AI writing proposals to the manuscript boundary without allowing AI output to silently overwrite author work.

### Delivered

- Added `AiWritingStudioService` as the application boundary between durable AI proposals and Studio project state.
- Generation verifies the project/book/chapter/scene target before invoking the provider.
- Generation records the source scene revision hash on the proposal.
- Author review remains mandatory before manuscript application.
- Accepted proposals can be explicitly applied to their persisted target.
- Application is idempotent when the target already contains the approved proposal.
- Stale proposal protection refuses to overwrite newer author edits.
- Exposed the coordinator and Studio AI writing service through the canonical Forge API.
- Added Studio HTTP endpoints for proposal listing, proposal retrieval, author review, explicit application, and governed AI writing generation.
- Added a first-class Writing Desk proposal panel with durable candidate review, approval/rejection, explicit manuscript application, and visible stale-write protection.
- The existing direct AI-writing button is captured by the governed proposal UI so provider output cannot silently bypass the proposal boundary.
- Added UI syntax verification to CI.
- Corrected the browser acceptance workflow's double-read of the workflow response body so real-browser verification can continue past the workflow gate.

### Governance

AI generation remains advisory. A generated candidate is not manuscript truth, and an accepted proposal is still not applied until the author-controlled application operation is invoked. A stale proposal cannot silently replace newer author work.

### Verification

Run:

```bash
npm test
npm run test:browser
npm run test:browser:mobile
```

The mission is not production-verified until the complete build/regression path and running Studio/device acceptance pass on the current `main` checkpoint.

### Next integration target

Extend the same durable proposal pattern to intelligent editing: AI-generated rewrites should become reviewable editing proposals tied to the exact source revision, then enter manuscript state only through explicit author approval and application.

## Mission 046 — Durable AI Proposal Ledger

**Status:** Implemented in `main`; local build/regression verification required.

### Direction

AI-generated writing and editing output must remain observable, attributable, recoverable, and explicitly author-controlled even when the Studio process restarts.

### Delivered

- Added `FileAiProposalStore` as a filesystem-backed persistence adapter for the existing proposal ledger.
- Added snapshot/restore boundaries to `AiProposalStore`.
- Added versioned persistence validation and duplicate/record integrity checks.
- Added atomic temporary-file writes followed by rename for interruption-safe persistence.
- Added recovery and corruption tests.
- Exported the durable proposal adapter from the canonical Forge API.

### Governance

Durability does not create authority. AI proposals remain pending until an author explicitly accepts or rejects them. System actors cannot accept proposals.

### Next integration target

Bind durable proposals directly into the running Studio AI-writing and editing workflow so provider output is recorded with provenance before it can become manuscript state.

## Mission 045 — Functional-Truth Completion

**Status:** Active — canonical baseline repair and integrated Studio verification are in progress.

### Direction

Mission 045 closes the gap between Forge's domain/application foundation and a genuinely usable author workplace. The priority is integrated product behavior rather than accumulation of disconnected feature contracts.

### Locked execution order

1. Restore a continuously green canonical `main` baseline.
2. Wire existing capabilities into one real Studio workflow with durable persistence and explicit errors.
3. Complete the core author loop: project → book → chapter → scene → write → AI assist → review → approve → continue.
4. Make visual production a durable path across character continuity, references, illustration, asset reuse, and covers.
5. Make production and release a traceable path through artifacts, positioning, marketing, readiness, delivery audit, and recovery.
6. Verify the running application at domain, application, and human/device levels, including Chromebook and Android.
7. Harden recovery, provider failure, interrupted operations, stale state, and offline behavior.
8. Expand breadth only after the integrated author journey is working.

### Repository integrity rule

`main` is the canonical integration baseline. Divergent branches are candidate work, not alternate product truth. Generated build/runtime output must remain out of source control unless explicitly required by the product contract. Candidate changes must be compared against current `main`, selectively integrated, and verified by the full build/regression path.

### Baseline repair

The current `main` snapshot exposed a TypeScript contract mismatch in the context-engine stack and an implicit-typing regression in the workflow-gate validator. The context-engine registry now owns final result metrics through a dedicated result-draft boundary, and workflow-gate checks are explicitly typed. This restores separation of responsibilities: engines produce transformations; the registry measures the complete optimization result.

### Current implementation checkpoint

The canonical public Forge API is now explicitly regression-tested for the major domain/application capabilities used by the manuscript, project, publishing, version-control, series, voice, collaboration, health, memory-relationship, delivery-audit, and workflow layers. A second build-output integrity test verifies that the production `dist` tree preserves the same public API as `.forge-build`, preventing the exact class of runtime-export regression that can otherwise hide behind a successful TypeScript build.

The governed project workflow boundary is now also exposed by the running Studio server. `GET /api/projects/:projectId/workflow` reports the durable workflow stage, while `POST /api/projects/:projectId/workflow/advance` consumes stage checks, enforces sequential advancement, requires explicit author approval, persists successful stage transitions, and returns blocker details on refused advancement. Project health now reports the current workflow stage as well.

The real-browser acceptance harness now exercises this workflow boundary against the running production build and verifies that an unapproved transition is refused, an approved transition advances exactly one stage, and the resulting stage survives a subsequent API read. This is application-level evidence in addition to the domain tests; device-level verification remains open.

### Verification requirement

Mission 045 is not verified by compilation alone. Completion requires successful build/regression tests plus running Studio/browser and supported-device evidence for the integrated author journey.

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
