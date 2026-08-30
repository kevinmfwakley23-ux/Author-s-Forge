# Mission 049 — Deterministic AI Proposal Review Diff

**Status:** Implemented in `main`; canonical build/regression verification required.

## Objective

Strengthen the author-controlled AI editing boundary with a deterministic review artifact. AI proposals must be easy to inspect without allowing the proposal itself to mutate authoritative manuscript state.

## Delivered

- Added `createAiProposalDiff` in `src/application/ai-proposal-diff.ts`.
- Produces deterministic line-level added/removed/unchanged review records.
- Binds the review artifact to SHA-256 hashes of both the exact base content and proposed content.
- Reports character and word counts plus line-change totals.
- Preserves explicit base/proposed line numbers for reviewer tooling.
- Normalizes CRLF/CR line endings for comparison so review output is stable across platforms while still preserving the exact-content hashes.
- Exported the capability from the canonical Forge API.
- Added regression coverage for changed proposals, identical content, line numbering, and cross-platform line endings.

## Governance

This capability is review-only. It does not apply, accept, reject, or otherwise mutate manuscript state. The authoritative source remains the persisted manuscript and the existing author-review/application boundary.

## Next integration target

Expose proposal diffs in the running Writing Desk and Editing Room so an author can inspect exact changes before acceptance/application. The UI must use the hashes and current scene revision to refuse stale or mismatched candidates.
