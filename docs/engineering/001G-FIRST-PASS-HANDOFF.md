# First Pass 001G — Brain Canonical Memory Runtime Contract

## Status

READY FOR ANDROID SECOND PASS after merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Second-pass owner: Android.
- Branch: `first-pass/001g-brain-canonical-memory-contract`.
- Pull request: #56.
- Base includes Android second-pass 001F merge commit `67b6bd6439c99e9c341fdc75cb03df6f87b58d12`.
- The 001G implementation was rebased after Android completed 001F so neither lane overwrote the other.

## Inspection finding

`src/domain/memory.ts` owns the canonical runtime allowlists `MEMORY_CLASSES` and `MEMORY_AUTHORITIES`, while the live Studio HTTP server had maintained separate hand-copied class and authority arrays. That duplication allowed a future domain change to drift from API validation without a compiler error.

## Improvements

- `src/studio-server.ts` imports `MEMORY_CLASSES` and `MEMORY_AUTHORITIES` directly from `src/domain/memory.ts`.
- Duplicate Studio memory class and authority allowlists are removed.
- The live `/api/projects/:projectId/memory` boundary therefore validates against the same runtime contract used by the Brain domain.
- `test/studio-memory-contract.test.js` starts the real Studio server and sends every canonical class and authority through the HTTP route.
- The regression also proves unknown class and authority values fail closed with HTTP 400.
- The application test uses an ephemeral port and startup-exit detection to reduce false startup failures.

## Previous verification

Before the Android 001F merge, Forge CI #674 / run `33481829657` passed on the original 001G implementation head:

- TypeScript build;
- 398/398 tests;
- completion report at 100%;
- syntax gates;
- full desktop browser acceptance;
- Android/mobile acceptance.

The rebased PR must receive a fresh complete CI run before merge. Previous green status is evidence, not a substitute for post-rebase verification.

## Android handoff

After PR #56 is merged, Android should review the actual merged 001G diff against current `main`, verify that the live Studio memory route remains aligned with the canonical domain contract, and record either `SECOND PASS CLEAR` or the exact remaining blocker. Android should not duplicate the next first-pass block while ChatGPT advances ahead.

## Next first-pass block

001H — Brain literal runtime/type contract and public API parity. The intended inspection target is the remaining duplicate definition between TypeScript memory union types and runtime arrays inside `src/domain/memory.ts`, plus root-package runtime exports in `src/index.ts`.
