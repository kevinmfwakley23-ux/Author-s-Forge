# Author's Forge — Mission 004

## Project Brain + Canon Memory

### Objective
Establish the production-grade memory contract for Author's Forge by adapting the proven K.I.N.G.S. memory principles—identity, provenance, authority, relevance, lifecycle, promotion, and durable state—to the authoring domain.

### Design principle
Forge owns the creative truth of a project. K.I.N.G.S. may provide intelligence, research, orchestration, tools, or escalation, but it does not become the hidden source of truth for a book.

### Memory classes
- author-memory
- project-memory
- story-canon
- character-memory
- relationship-memory
- location-memory
- timeline-memory
- style-memory
- research-memory
- creative-note
- working-draft
- hypothesis
- open-thread
- visual-identity
- production-memory
- publishing-memory
- marketing-memory
- generated-alternative

### Authority states
- proposed
- working
- verified
- authoritative
- superseded
- archived

Authority is distinct from relevance. Relevance controls context priority; authority controls what may be treated as project truth.

### Required record properties
Every memory record must support stable identity, project ownership, class/type, authority state, summary/content, timestamps, provenance references, and relationships to related project objects where applicable.

Authoritative records require provenance or an explicit author-origin marker. Promotion must be governed. Superseded truth must remain auditable rather than silently disappearing.

### Retrieval requirements
The memory layer must support filtered retrieval by project, book/series scope, memory class, authority state, relationship, and task relevance. Retrieval must return enough provenance for downstream context assembly and verification.

### Project brain boundary
The Project Brain is the orchestration-facing retrieval boundary for authoring. It must be able to answer:
- What is currently true?
- What is locked by the author?
- What is still uncertain?
- What changed?
- Where did this information come from?
- What does the current writing/editing/research task need?

### Durability
Memory belongs to the portable project state and cannot depend on hidden process memory. Project snapshots must be able to preserve the brain so work can resume on another authorized runtime.

### Deferred
Vector indexes, graph indexes, browser UI, external databases, embeddings, and provider-specific retrieval engines are deferred until the domain/application contracts and acceptance tests prove what those adapters actually need.

### Acceptance criteria
- Strict TypeScript build passes.
- Memory records have stable identity and lifecycle state.
- Authoritative memories require provenance or explicit author-origin provenance.
- Duplicate memory IDs are rejected.
- Working/proposed memories can be promoted only through explicit authority logic.
- Superseded memories remain auditable.
- Retrieval can filter by project, type/class, authority, and relevance inputs.
- A Project Brain service can retrieve an authoritative task context without exposing unrelated project state.
- Memory can be serialized into portable project state without device-local paths.
- Snapshot/restore preserves memory identity, authority, provenance, and lifecycle state.
- Tests cover promotion, provenance, duplicate protection, retrieval, supersession, and snapshot/restore.
