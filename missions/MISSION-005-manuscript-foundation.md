# Author's Forge — Mission 005

## Manuscript Structure Foundation

### Objective
Establish the canonical domain model for the long-form manuscript hierarchy: book, chapter, and scene. This creates the stable structural boundary that future planning, drafting, revision, context assembly, and verification workflows will consume.

### Dependencies
- Mission 001 — project foundation.
- Mission 002 — author input foundation.
- Mission 004 — Project Brain and canon memory.

### Scope
- Canonical book, chapter, and scene records.
- Explicit lifecycle states for books, chapters, and scenes.
- Deterministic ordering for chapters and scenes.
- Stable identifiers and parent relationships.
- Safe creation and insertion helpers.
- Structural invariant validation.
- Public exports and acceptance coverage.

### Required invariants
1. Every manuscript object has a stable non-empty identifier.
2. A book belongs to exactly one project, a chapter belongs to exactly one book, and a scene belongs to exactly one chapter.
3. Chapter numbers are positive integers and unique within a book.
4. Scene order is a positive integer and unique within a chapter.
5. Creation and insertion helpers reject invalid or duplicate structural identifiers.
6. Structural operations never silently rewrite existing manuscript content; this mission stores structure only.
7. Domain records remain provider-neutral and contain no filesystem or UI authority.
8. Ordering is explicit and deterministic rather than inferred from object insertion order.
9. Lifecycle state is explicit and restricted to the canonical state set for each manuscript object.
10. A manuscript state cannot contain orphaned chapters/scenes, cross-parent references, or duplicate identifiers.

### Acceptance criteria
- Strict TypeScript build passes.
- Books, chapters, and scenes can be created through canonical contracts.
- Invalid identifiers and structural values are rejected.
- Duplicate chapter numbers and scene orders are rejected within their parent.
- Chapter and scene parent relationships are preserved.
- Lifecycle state is explicit and validated.
- Public API exports the manuscript domain contracts.
- Structural state can be validated after construction and insertion.
- Tests cover creation, validation, duplicate protection, deterministic ordering, and parent relationships.

### Explicitly deferred
Actual editor UI, manuscript text persistence, AI drafting, chapter generation, revision workflows, rich-text representation, and generation orchestration remain separate missions. This mission establishes the durable structural contract those systems will consume.
