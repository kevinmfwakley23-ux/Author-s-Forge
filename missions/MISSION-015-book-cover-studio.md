# Mission 015 — Book Cover Studio

## Status

Implemented; awaiting Linux verification.

## Scope

Mission 015 establishes a production-oriented book cover planning and validation boundary for ebook, paperback, hardcover, series, boxed-set, promotional, and audiobook cover formats.

## Production contract

The Studio separates creative artwork from publishing geometry. A publishing configuration determines trim dimensions, page count, binding, paper/interior type, bleed, spine calculation, wrap requirements, and production zones. The resulting plan is deterministic and auditable.

For KDP paperback covers, the implementation uses the published 0.125-inch bleed and paper/interior-specific spine factors. The full cover width is back + spine + front + bleed on both sides; height is trim height plus bleed on both sides.

For KDP hardcover, the implementation models wrap and spine planning while treating the provider-generated cover template as authoritative for final production geometry. This prevents Forge from pretending that a simplified local formula is equivalent to KDP's exact template generator.

## Validation

The resulting artifact validator checks:

- output format
- exact planned dimensions
- minimum 300 DPI
- maximum file size
- front/back/spine presence
- crop/trim marks
- template text
- flattened artwork
- embedded fonts
- encryption/locking

The validator reports deterministic errors and warnings. It does not claim to replace KDP's final previewer or publishing review.

## Acceptance coverage

Acceptance tests cover:

1. KDP paperback spine and exterior calculations.
2. Complete cover plan creation.
3. Front/spine/back production zones.
4. Barcode-safe area.
5. Safe margins and bleed.
6. Valid artifact acceptance.
7. Invalid artifact rejection.

## Provider boundary

The Studio does not fabricate artwork or pretend to perform PDF/image rendering. It produces and validates the publishing specification consumed by real downstream cover-rendering/export tooling. This keeps publishing truth separate from creative generation while providing the exact geometry required for production.
