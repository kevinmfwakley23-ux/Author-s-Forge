# Mission 013 — Image Editing

## Objective

Provide a durable, provider-neutral image editing foundation in which uploaded source images remain immutable and every modification produces an auditable derived output.

## Delivered

- Immutable `SourceImage` records for uploaded/reference images.
- Project-scoped editing sessions.
- Explicit operation vocabulary for all requested editing controls:
  - preserve face
  - change clothing
  - change background
  - change age
  - change artistic medium
  - change lighting
  - remove objects
  - add objects
  - alter pose
  - crop
  - restore
  - upscale
  - stylize
- Auditable edit revisions with actor, reason, timestamp, source-image identity, instructions, and output identity.
- Distinct derived `EditedImage` records for every edit.
- Output format and output URI support.
- Deterministic provider-facing edit briefs.
- Project isolation and portable state restoration.
- Atomic JSON persistence through `FileImageEditingStore`.
- Validation at domain and persistence boundaries.
- Acceptance coverage proving the original source is retained after editing.

## Architectural boundary

Author's Forge owns the source-image identity, edit instructions, provenance, and resulting artifact references. Actual pixel transformation belongs behind a future real image-editing provider interface. This mission does not fabricate image transformation behavior or claim that metadata generation is pixel generation.

## Non-destructive invariant

An edit never mutates or replaces `SourceImage`. Every successful edit appends one `ImageEditRevision` and one `EditedImage`, both retaining the original source image ID. Multiple revisions can therefore be created from the same source without destructive overwrite.

## Verification

Linux verification is required before Mission 013 is marked verified. The complete repository check must pass, including all prior mission regression tests.
