# Author's Forge — Build History

This file is the durable, chronological engineering history for the repository. It complements the README: the README records the current product truth; this ledger records how the current truth was built.

## Mission 053 — Live Story Map

**Status:** Implemented in `main`; canonical build/regression and browser/device verification required.

### Delivered

- Added deterministic `StoryMap` domain projection from the existing durable manuscript hierarchy.
- Added `StoryMapService` application boundary.
- Added a live Studio Story Map surface derived directly from `window.forgeWorkspaceState`.
- Added visual book → chapter → scene hierarchy with lifecycle status and completion percentages.
- Added project-level book/chapter/scene totals.
- Added direct scene opening from the Story Map into the Writing Desk.
- Added empty-state and refresh behavior.
- Added Story Map PWA shell caching and advanced the service-worker cache version to v5.
- Added `test/story-map-ui.test.js` covering live workspace integration and PWA shell inclusion.

### Competitive rationale

The capability is based on proven visual-planning patterns from Plottr—visual timelines, scene cards, plotlines, filters, story-bible organization, and series planning—but is implemented natively around Forge's authoritative manuscript state rather than introducing a second planning store.

Sudowrite's current Story Bible and localized Rewrite patterns reinforce the same architectural direction: persistent story truth should guide focused AI operations without turning every AI result into authoritative manuscript state.

### Next Story Map increments

1. Scene attributes: POV, location, time, goal, conflict, outcome, emotional beat.
2. Plotlines and character arcs with cross-scene filtering.
3. Drag/reorder with explicit durable mutation and downstream impact analysis.
4. Visual continuity/canon warnings directly on affected scene cards.
5. Series-level map and multi-book progress.

## Mission 052 — Competitive Advantage Research

**Status:** Research integrated; implementation sequence locked in `docs/COMPETITIVE-RESEARCH.md`.

### Research reviewed

- Reedsy Studio — low-friction writing, Boards, collaboration/review, previews, and professional EPUB/PDF production.
- Plottr — visual timelines, scene cards, plotlines, filters, character/place attributes, and series planning.
- Sudowrite — Story Bible as a shared author/AI source of truth, structured worldbuilding/characters, and localized Rewrite actions.
- Atticus — author-focused writing plus production formatting and import.
- KDP Cover Creator — publishing constraints embedded directly into cover creation.
- VeriForge — proactive knowledge-gap highlighting, source-anchored Knowledge Cards, and knowledge organization.
- CraftAlign — feature-grounded narrative evaluation and revision guidance rather than generic quality scores.

### Engineering decision

Forge will not copy proprietary products or import unrelated application stacks. It will implement the underlying successful interaction patterns inside the existing TypeScript/domain/application architecture, then connect them to Forge's durability, provenance, Project Brain, Book Genome, author-control, proposal-review, workflow-gate, production, and delivery-audit boundaries.

### Mission 052 build order

1. Story Map — visual chapter/scene timeline with filters and scene attributes.
2. Author Goals — daily/weekly writing goals and progress history.
3. Knowledge Gap Radar — proactive research signals that can become source-anchored Knowledge Cards.
4. Craft Lens — measurable craft dimensions with multiple revision strategies.
5. Production Preview — visible final-format validation before release.
6. Collaboration Review — comments, suggestions, scoped access, and author-controlled acceptance.

## Mission 051 — Editing proposal review diff

**Status:** Implemented in `main`; canonical build/regression verification required.

### Delivered

- Editing Room deterministic line-level review diff for durable AI manuscript-edit proposals.
- Added/removed/unchanged line records and word-count impact.
- Explicit proposal selection, approval, rejection, and apply controls.
- Preserved server-side source-revision/stale-write protection.
- Added regression coverage and CI syntax verification.

## Mission 049 — Deterministic AI Proposal Review Diff

**Status:** Implemented in `main`; canonical build/regression verification required.

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

## Mission 048 — Source-Bound AI Editing Proposals

**Status:** Implemented in `main`; canonical build/regression and browser acceptance are required evidence for the next Studio integration checkpoint.

### Delivered

- Added `AiEditingProposalService` to turn deterministic editorial findings into durable AI rewrite proposals.
- Validates the exact finding range before any provider call.
- Sends the finding, recommendation, targeted excerpt, author instruction, and complete source scene to the provider.
- Persists the complete proposed scene as a `manuscript-edit` proposal.
- Binds the proposal to the exact source scene revision with SHA-256.
- Reuses the existing author-review and stale-write application boundary.
- Exposed the editing proposal service through the canonical Forge API.
- Added regression tests for proposal creation, source binding, and provider short-circuiting on malformed ranges.

## Mission 047 — Governed Studio AI Writing Loop

**Status:** Implemented in `main`; canonical build/regression and browser acceptance are required evidence for each subsequent integration checkpoint.

### Delivered

- Durable AI writing proposals tied to project/book/chapter/scene state.
- Explicit author review and application.
- Stale proposal protection and idempotent application.
- Studio endpoints and Writing Desk proposal panel.
- UI syntax verification and browser workflow-response fix.

## Mission 046 — Durable AI Proposal Ledger

**Status:** Implemented in `main`; local build/regression verification required.

### Delivered

- Filesystem-backed durable proposal store.
- Snapshot/restore boundaries.
- Versioned persistence validation and integrity checks.
- Atomic writes and recovery/corruption tests.

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

## Mission 044 — Governed Workflow Advancement

Added the application-level workflow advancement service with sequential-stage enforcement, blocker reporting, and explicit author approval.

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
