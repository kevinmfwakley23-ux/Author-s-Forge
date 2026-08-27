# Author's Forge — Mission 010

## Character Bible

### Objective
Establish the canonical structured Character Bible as durable project state with complete temporal continuity. Every major character is represented as structured data rather than an unversioned text description.

### Required profile fields
- Name
- Age
- Birth date
- Physical appearance
- Height
- Build
- Hair
- Eyes
- Skin
- Clothing
- Voice
- Speech patterns
- Personality
- Values
- Fears
- Secrets
- Goals
- Motivations
- Relationships
- History
- Knowledge
- Skills
- Weaknesses
- Character arc
- Important objects
- Current emotional state
- Current location
- Current injuries

### Temporal requirements
- Every required field receives an initial version at character creation.
- Field changes are recorded with effective timestamp, sequence, previous/next value derivation, reason, and actor.
- Historical character state can be reconstructed for any valid point after character creation.
- Current character state is retained as a deterministic projection of the latest accepted updates.
- Changes do not mutate prior versions.
- Array and relationship values are defensively cloned so callers cannot mutate canonical state through returned references.

### Domain requirements
- Character identity is stable and project-scoped.
- Duplicate character identifiers are rejected.
- Required scalar fields are validated.
- Age must be a non-negative integer.
- Collection fields reject non-string entries and empty entries.
- Relationships are structured records containing character id, relationship, status, and notes.
- Unsupported update fields are rejected.
- Empty or no-op updates are rejected.
- Character records can be validated before persistence or restoration.

### Application requirements
- Provide create, get, require, update, list, remove, historical lookup, change history, portable export, and restore operations.
- Support project-scoped character queries.
- Prevent cross-project character restoration.

### Persistence requirements
- Character records are part of portable project state when present.
- Existing project format 2 remains compatible; characters are optional project state so earlier projects remain loadable.
- File project persistence validates character records rather than accepting arbitrary JSON.

### Engineering requirements
- TypeScript strict mode.
- No placeholder implementations.
- No fake integrations.
- No silent data mutation.
- Existing Mission 001–009 contracts remain intact.
- Acceptance tests must cover the complete profile, temporal updates, point-in-time reconstruction, isolation, portable persistence, and invalid-state rejection.

### Acceptance command

```text
npm run check
```

Mission 010 is not verified until the complete local regression and acceptance suite passes in the Linux development environment.
