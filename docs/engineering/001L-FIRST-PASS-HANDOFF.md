# First Pass 001L — Brain Memory Creation Runtime Boundary

## Status

IMPLEMENTED — exact-head CI pending.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Android currently owns 001H–001J; this block does not modify those files.
- Branch: `first-pass/001l-memory-create-runtime-boundary`.
- Pull request: #62.
- Base: merged 001K `main` commit `84c3ef50febcaa34f8c0f5d8bded65da4d07c925`.
- Implementation/research head before this handoff commit: `21e74234ec489f99f6cc52d9cf54381b0a6835b1`.

## Inspection finding

`createMemoryRecord` was statically typed but remained a runtime trust gap. JavaScript, JSON, persisted state, tests, or future HTTP callers could provide malformed values that reached `.trim()` or `.map()` before Forge validation and produced accidental runtime exceptions instead of stable fail-closed errors.

## Improvements

- validates the top-level creation input before field access;
- validates required strings before normalization;
- validates class and authority through canonical runtime guards;
- validates provenance shape, kind, reference, and timestamp before normalization;
- validates related-memory/tag collections before mapping;
- validates optional supersession values and creation timestamps;
- preserves intentional trimming, deduplication, and sorting for valid records;
- introduces a named `CreateMemoryRecordInput` typing surface;
- adds focused malformed-runtime-input regression coverage.

## Continuous research integration

The user-directed competitive intelligence requirement is now durable repository policy:

- `docs/COMPETITIVE-RESEARCH.md` contains a 2026-09-01 update covering Graphiti/Zep, Mem0, Novelcrafter, Sudowrite Plugins, Plottr, Yjs/Tiptap, and Automerge patterns.
- `docs/ENGINEERING_INTEGRATION_LEDGER.md` now requires competitive/technical research before substantial new blocks when external evidence can materially improve the design.
- Research findings are classified and adapted to Forge; competitor popularity never substitutes for Forge-native verification.

## Next candidate

001M is being researched as **entity-aware Project Brain matching policy**: author-controlled aliases, case-sensitive matching, excluded phrases, and explainable selection evidence. This directly addresses real false-positive matching problems seen in current authoring products while preserving Forge's stronger canon/authority controls.

## Verification requirement

Before merge, exact-head Forge CI must pass TypeScript build, complete tests/completion/syntax gates, desktop browser acceptance, and Android/mobile acceptance.
