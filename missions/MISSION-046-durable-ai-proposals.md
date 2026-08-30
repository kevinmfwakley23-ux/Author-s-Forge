# Mission 046 — Durable AI Proposal Ledger

**Status:** Implemented in `main`; local build/regression verification required.

## Objective

Make AI-generated proposals durable across process restarts without weakening author control.

## Delivered

- Added `FileAiProposalStore`, a filesystem-backed adapter around the existing author-controlled proposal store.
- Added explicit proposal snapshot/restore boundaries to `AiProposalStore`.
- Added format-versioned persistence validation.
- Added atomic sibling-temp-file writes followed by rename to avoid leaving a partially-written canonical ledger after interruption.
- Added recovery tests for a fresh store instance, corrupt/unsupported state, and refusal to restore into a populated ledger.
- Exported the durable adapter and persistence format version from the canonical Forge API.

## Governance

Persistence does not grant AI authority. Proposals remain `pending` until an author explicitly reviews them. The existing rule that system actors cannot accept proposals remains intact.

## Verification

Run:

```bash
npm test
npm run test:browser
npm run test:browser:mobile
```

The mission is not considered production-verified until the repository's build/regression path and running Studio/device acceptance pass.

## Next integration target

Bind durable proposals to the running Studio AI-writing/editing workflow so generated candidates are recorded with provenance and can be explicitly accepted or rejected without silently mutating manuscript state.
