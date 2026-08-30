# Mission 047 — Governed Studio AI Writing Loop

**Status:** Implemented in `main`; local build/regression and running Studio verification required.

## Objective

Connect durable AI writing proposals to the manuscript boundary without allowing AI output to silently overwrite author work.

## Delivered

- Added `AiWritingStudioService` as the application boundary between durable AI proposals and Studio project state.
- Generation verifies the project/book/chapter/scene target before invoking the provider.
- Generation records the source scene revision hash on the proposal.
- Author review remains mandatory before manuscript application.
- Accepted proposals can be explicitly applied to their persisted target.
- Application is idempotent when the target already contains the approved proposal.
- Stale proposal protection refuses to overwrite newer author edits.
- Exposed the coordinator and Studio AI writing service through the canonical Forge API.
- Added application tests for pending generation, author approval, durable application, and stale-write rejection.

## Governance

AI generation remains advisory. A generated candidate is not manuscript truth, and an accepted proposal is still not applied until the author-controlled application operation is invoked. A stale proposal cannot silently replace newer author work.

## Verification

Run:

```bash
npm test
npm run test:browser
npm run test:browser:mobile
```

The mission is not production-verified until the complete build/regression path and running Studio/device acceptance pass.

## Next integration target

Wire `AiWritingStudioService` directly into the Studio HTTP/UI workflow, replacing direct candidate insertion with durable proposal review and explicit apply actions. Extend the same governed pattern to intelligent editing proposals.
