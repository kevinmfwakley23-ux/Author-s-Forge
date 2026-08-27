# Mission 011 — Character Visual Continuity

## Objective

Create a durable Visual Character Identity system that preserves a major character's canonical appearance across chapters and books in a series.

## Delivered

- Structured visual identity domain model.
- Canonical face references.
- Canonical body references.
- Wardrobe state.
- Hairstyle state.
- Age progression through story-ordered snapshots.
- Distinguishing marks.
- Scars.
- Tattoos.
- Accessories.
- Color palette.
- Artistic style.
- Pose references.
- Explicit project and series ownership.
- Immutable visual snapshots with effective timestamps, sequence, reason, and actor.
- Deterministic resolution of visual identity at any story order.
- Reusable visual identity package generation for downstream illustration systems.
- In-memory application service with project-scoped querying and portable restore.
- Portable project integration through `withProjectVisualIdentities`.
- Durable atomic file persistence through `FileVisualIdentityStore`.
- Validation and defensive cloning at persistence boundaries.
- Acceptance coverage for Chapter 4 → Chapter 27 continuity, age progression, package generation, project isolation, immutability, ordering, and file persistence.

## Continuity Contract

A visual identity is keyed by `characterId` and `seriesId`. The same identity can therefore remain the canonical source across multiple books in a series. Story-ordered snapshots represent deliberate changes. Resolving the identity at Chapter 27 uses the latest snapshot at or before story order 27, so a Chapter 4 visual anchor remains active until a later visual change is explicitly recorded.

## Illustration Boundary

Mission 011 generates a deterministic, reusable visual identity data package. It does not fabricate image-provider behavior or pretend to generate pixels. Future illustration integrations must consume this canonical package rather than independently reconstructing a character from prose.

## Verification

The Linux development environment must run the complete repository verification suite. Mission 011 is not considered verified until `npm run check` passes with all regression and Mission 011 acceptance tests green.
