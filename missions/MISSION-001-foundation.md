# Author's Forge — Mission 001

## Mission

Establish the real application foundation for Author's Forge: canonical project identity, durable local persistence, portable project state, and a verifiable recovery path.

## Scope

This mission establishes the first production-facing domain and persistence boundary. It does not attempt to build the editor, manuscript engine, research system, illustration studio, publishing pipeline, or K.I.N.G.S. integration yet.

## Required Outcomes

1. A versioned canonical project model exists.
2. Project creation validates required identity fields.
3. Projects persist to an explicit filesystem-backed store.
4. Saves use a temporary file followed by atomic rename so an interrupted write does not intentionally replace the last complete project file.
5. Project identifiers cannot escape the configured project root.
6. A project can be loaded into a fresh process from its persisted package.
7. The foundation exposes a clean persistence interface so storage can later be replaced by another local or external provider without changing domain code.
8. Automated acceptance tests verify creation, persistence, restoration, update, and path-safety behavior.

## Acceptance Criteria

- `npm run build` completes with strict TypeScript checking.
- `npm test` completes with all foundation tests passing.
- A persisted project contains its format version and canonical metadata.
- Loading the same project after the original in-memory object is gone reproduces the persisted state.
- Unsafe project identifiers are rejected before filesystem access.
- No capability in this mission depends on K.I.N.G.S. being available.

## Verification

The acceptance tests in `test/project-foundation.test.js` are the executable verification artifact for this mission.

## Checkpoint

The mission is complete only when the repository contains the implementation and tests above and the local verification commands pass from a clean checkout.

## Next Dependency

Mission 002 may build the durable project package structure and lifecycle services only after Mission 001 is verified green.
