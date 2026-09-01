# First Pass 001R — Authority Window and Retrieval Diagnostics

## Status

IMPLEMENTED — exact-head CI required after reconciliation with current `main`.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Branch: `first-pass/001r-brain-authority-window-diagnostics`.
- Stacked after corrected 001Q state-conflict safety.
- 001O remains the merged lifecycle-snapshot block; 001P remains the parallel project-package block.
- This capability was initially labeled 001P during concurrent work and was relabeled before integration to avoid duplicate handoffs.

## Inspection finding

Project Brain previously ranked proposed/working/verified memories even when `includeWorkingState` was false, applied the result limit, and only afterward removed those records from returned working context. Under a tight limit, a highly salient unapproved memory could consume the retrieval slot and leave no authoritative context.

## Forge improvements

- authority eligibility is enforced before ranking and before the result limit;
- default retrieval ranks only authoritative live memory;
- working/proposed/verified memory participates only when explicitly requested;
- optional `includeDiagnostics` exposes bounded retrieval-stage counts;
- diagnostics report source/live/class/authority/saliency/selection counts and exclusion counts for inactive, class mismatch, unrequested authority, saliency mismatch, and result-limit trimming;
- diagnostics contain counts only, never manuscript content or query text;
- diagnostics remain absent by default to preserve legacy response shape;
- runtime validation rejects malformed diagnostic controls.

## Research basis

Current OpenTelemetry GenAI semantic conventions increasingly model retrieval as an observable operation with explicit retrieval evidence. Forge adopts the observability principle while using privacy-conservative content-free stage counts as its default debugging/evaluation signal.

## Regression coverage

Focused tests reproduce the tight-limit authority crowd-out, prove explicit working-state opt-in remains functional, verify exact diagnostic counts, verify diagnostics contain no manuscript content, and prove diagnostics are opt-in and fail closed on malformed input.

## Verification requirement

Reconcile onto current `main`, then require exact-head Forge CI: TypeScript build, full unit/completion/syntax gates, desktop browser acceptance, and Android/mobile browser acceptance.
