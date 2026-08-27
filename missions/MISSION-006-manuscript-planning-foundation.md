# Author's Forge — Mission 006

## Manuscript Planning Foundation

### Objective
Establish the durable planning contract consumed by future drafting, chapter workflow, revision, context assembly, and continuity verification. Planning is explicit project state, separate from manuscript text and separate from generated alternatives.

### Dependencies
- Mission 001 — project foundation.
- Mission 002 — author input foundation.
- Mission 004 — Project Brain and canon memory.
- Mission 005 — manuscript structure foundation.

### Scope
- Canonical plan records for books, chapters, and scenes.
- Explicit plan lifecycle and version identity.
- Structured purpose, summary, beats, constraints, and open questions.
- Exact ownership and target-parent validation against manuscript structure.
- Deterministic plan ordering.
- Safe plan creation and replacement without silent target reassignment.
- Public API exports and acceptance coverage.

### Required invariants
1. Every plan has a stable non-empty identifier and positive integer version.
2. Every plan belongs to exactly one project and targets exactly one existing book, chapter, or scene.
3. A chapter plan must target a chapter whose book belongs to the plan's project; a scene plan must target a scene whose chapter belongs to the plan's project.
4. Plan lifecycle is explicit and restricted to planned, working, locked, superseded, or archived.
5. Plan content is structured as authoring intent: purpose, summary, ordered beats, constraints, and open questions.
6. Empty optional collections are represented deterministically; collection ordering is preserved exactly as supplied and validated for meaningful entries.
7. Replacing a plan creates a new version for the same target and explicitly supersedes the prior version; prior plan state remains auditable.
8. A plan cannot silently move to another project or manuscript target during replacement.
9. Planning records contain no filesystem paths, UI authority, provider-specific state, or generated manuscript text.
10. Planning state is provider-neutral and serializable as portable project state.

### Acceptance criteria
- Strict TypeScript build passes.
- Book, chapter, and scene plans can be created through canonical contracts.
- Invalid identifiers, versions, lifecycle values, and empty meaningful content are rejected.
- Target existence and project/parent ownership are enforced.
- Duplicate plan identifiers are rejected.
- Only one current plan version exists for a target; replacement preserves the prior plan as superseded.
- Replacement cannot change the project or target identity.
- Plan retrieval is deterministic by project, target, lifecycle, and relevance to the requested target.
- Public API exports the planning contracts and service.
- Tests cover creation, validation, target integrity, duplicate protection, version replacement, supersession, deterministic retrieval, and portable serialization.

### Explicitly deferred
Actual manuscript text, rich-text editing, AI drafting, generation orchestration, revision operations, automatic beat generation, vector retrieval, browser UI, and provider-specific planning adapters remain separate missions.
