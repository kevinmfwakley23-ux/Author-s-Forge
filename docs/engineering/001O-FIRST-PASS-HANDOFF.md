# First Pass 001O — Explicit State Claim Conflict Safety

## Status

IMPLEMENTED — exact-head CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Branch: `first-pass/001o-brain-state-claim-conflict-safety`.
- Stacked after 001N.
- Android 001J remains in separate relationship-context files.

## Research finding

The 2026 STALE benchmark and related state-aware memory work show that simply retrieving a newer observation does not guarantee that an agent will reject an obsolete premise. Forge should therefore never ask an LLM to infer which of two live canonical facts is the real one when the application can represent that conflict explicitly.

## Forge improvements

- `MemoryRecord` can carry optional explicit `stateKey` / `stateValue` metadata;
- state keys are Unicode-normalized, whitespace-normalized, case-folded stable identifiers;
- state key/value must be supplied together and are validated at the canonical memory boundary;
- current and historical Project Brain reads inspect all live authoritative state claims before task-class filtering;
- two live authoritative memories claiming different normalized values for the same state key cause a fail-closed retrieval error;
- equivalent values do not create false conflicts;
- working/proposed alternatives remain reviewable and cannot silently override authoritative state;
- author supersession remains the mechanism that resolves a canonical conflict without deleting the historical memory.

## Regression coverage

Focused tests cover state-key normalization, incomplete state claims, conflicting authoritative values, equivalent-value deduplication, author supersession resolution, and non-authoritative alternatives.

## Architecture constraints

- no LLM conflict arbitration;
- no hidden overwrite;
- no deletion of superseded history;
- deterministic and provider-neutral;
- backward compatible for existing memories with no explicit state claim;
- compatible with 001N point-in-time reconstruction.

## Verification requirement

Before merge, exact-head Forge CI must pass TypeScript build, all unit/completion/syntax gates, desktop browser acceptance, and Android/mobile browser acceptance.
