# First Pass 001P — Authority Window and Retrieval Diagnostics

## Status

IMPLEMENTED — exact-head CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Branch: `first-pass/001p-brain-authority-window-diagnostics`.
- Stacked after 001O.
- Android 001J remains isolated in relationship-context files.

## Inspection finding

Project Brain previously ranked proposed/working/verified memories even when `includeWorkingState` was false, then applied the result limit, and only afterward removed those records from the returned working context. Under a tight limit a highly salient unapproved memory could therefore consume the retrieval slot and leave the caller with no authoritative context.

## Forge improvements

- authority eligibility is enforced before ranking and before the result limit;
- default retrieval ranks only authoritative live memory;
- working/proposed/verified memory participates only when the caller explicitly requests working state;
- optional `includeDiagnostics` exposes bounded retrieval-stage counts;
- diagnostics report source/live/class/authority/saliency/selection counts and exclusion counts for inactive, class mismatch, unrequested authority, saliency mismatch, and result-limit trimming;
- diagnostics intentionally contain counts only, never manuscript content or query text;
- diagnostics remain absent by default to preserve legacy response shape;
- runtime validation rejects malformed diagnostic controls.

## Research basis

Current OpenTelemetry GenAI semantic conventions increasingly model retrieval as an observable operation with explicit retrieval documents and scores. Forge adopts the useful observability principle while exposing a more privacy-conservative default: deterministic stage counts are available for evaluation and debugging without copying author content into telemetry-like metadata.

## Regression coverage

Focused tests reproduce the old tight-limit authority leak, prove explicit working-state opt-in remains functional, verify exact diagnostic stage counts, verify diagnostics contain no manuscript content, and prove diagnostics are opt-in and fail closed on malformed runtime input.

## Architecture constraints

- author authority is applied before resource limits;
- no hidden promotion;
- no manuscript/prompt text in diagnostics;
- deterministic and provider-neutral;
- legacy callers retain the same output unless diagnostics are requested.

## Verification requirement

Before merge, exact-head Forge CI must pass TypeScript build, all unit/completion/syntax gates, desktop browser acceptance, and Android/mobile browser acceptance.
