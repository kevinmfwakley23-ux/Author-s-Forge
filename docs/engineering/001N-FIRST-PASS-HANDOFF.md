# First Pass 001N — Point-in-Time Project Brain Context

## Status

IMPLEMENTED — exact-head CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Branch: `first-pass/001n-brain-point-in-time-context`.
- Stacked after 001M; Android 001J modifies separate relationship-context files.
- This block modifies `project-memory-store.ts`, `project-brain.ts`, and focused regression coverage only.

## Research finding

Current 2026 memory research increasingly separates **temporal validity** from ordinary semantic similarity. Mem0 v3 exposes temporal reasoning and keeps historical memories rather than destroying them, while MemStrata reports that stale and current facts are often too semantically similar for embedding similarity alone to arbitrate safely. The STALE benchmark likewise shows that retrieving updated evidence does not guarantee that an agent will reject obsolete state.

Forge already owns explicit author promotion and supersession events, so the safest adaptation is not a generic recency boost. It is deterministic reconstruction of the memory state that was valid at an explicitly requested instant.

## Forge improvements

- `ProjectMemoryStore.queryAt(...)` reconstructs project memory at an ISO timestamp.
- memories created after the requested instant are excluded;
- later promotions are reversed to their previous authority;
- later supersessions are reversed so the previously valid record can participate again;
- supersession links created by a later transition are removed during historical reconstruction when the ledger proves they were introduced by that transition;
- lifecycle-derived `updatedAt` values are rolled back to the latest known prior transition;
- unexplained post-time updates fail closed instead of inventing historical state;
- historical queries remain project-scoped and preserve ordinary class/authority/tag/query limits;
- Project Brain accepts explicit `asOf` and records it in context/evidence;
- `asOf` and `changedSince` are intentionally mutually exclusive to avoid ambiguous retrieval semantics;
- historical retrieval does not grant a recency score bonus and does not mutate canon.

## Regression coverage

Focused tests cover promotion rollback, supersession rollback, link rollback, future-memory exclusion, project isolation, incomplete-history refusal, historical Brain saliency, stale-current exclusion, timestamp validation, and incompatible query controls.

## Architecture constraints

- deterministic and local-first;
- no external vector/graph service required;
- author promotion/supersession ledger remains authoritative;
- current canon is unchanged by historical reads;
- provider-neutral and explainable;
- legacy callers are unchanged unless they explicitly request `asOf`.

## Verification requirement

Before merge, exact-head Forge CI must pass TypeScript build, all unit/completion/syntax gates, desktop browser acceptance, and Android/mobile browser acceptance.
