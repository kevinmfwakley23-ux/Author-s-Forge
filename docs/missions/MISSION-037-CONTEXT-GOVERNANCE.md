# Mission 037 — Context Governance

## Objective

Extend the context-engine registry into explicit context stratification, budget selection, session deduplication, and measurable optimization-ledger primitives while preserving fail-open behavior and author authority.

## Delivered

- Added governed context tiers: essential, project, active, supporting, and historical.
- Added deterministic budget-aware fragment selection that prioritizes canonical and higher-value context.
- Added normalized session-fragment deduplication without mutating source fragments.
- Added an immutable optimization-ledger entry contract that derives savings and savings ratio safely.
- Exported the new primitives from the public package boundary.
- Added regression coverage for prioritization, budget omission, duplicate handling, and ledger accounting.

## Safety

These primitives operate on derived context selection. They do not mutate canonical project state. The original source fragments remain available to the caller, and optimization accounting never reports negative savings.

## Verification

Repository CI must complete TypeScript/build/test verification before this mission is considered production-complete.

## Next

Integrate governance into the actual context assembly/request path, then add provider-aware cost guards and durable optimization telemetry before enabling higher-risk semantic compression engines.
