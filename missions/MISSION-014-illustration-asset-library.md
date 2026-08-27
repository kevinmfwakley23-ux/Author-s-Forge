# Mission 014 — Illustration Asset Library

## Purpose

Provide a durable, project-scoped library for every generated illustration and a canonical reuse mechanism for artwork and character designs.

## Canonical asset metadata

Every illustration asset records Project, Book, Chapter, Scene, Character, Location, Prompt, References, Style, Generation settings, Version, Date, Approval status, and the produced asset URI.

## Reuse

An existing asset can be reused as a new library record without mutating the source. The new record preserves provenance through `reusedFromAssetId` and increments the version.

## Character design continuity

A character design lock records the character, series, canonical asset, effective timestamp, and author/system reason. Resolution is temporal and returns the most recent active lock effective at the requested time. This provides the durable implementation for an instruction such as `Use this character design everywhere going forward.`

## Persistence

Library state is validated and persisted atomically under the project directory. Project state can also carry the library through `withProjectIllustrationAssetLibrary`.

## Provider boundary

The asset library stores canonical metadata and references. It does not pretend to perform image generation or pixel editing. Downstream providers consume these records through explicit integration boundaries.

## Verification

Mission 014 acceptance tests cover the complete metadata contract, immutable revisions, reuse, character-design locking, temporal resolution, project attachment, and validation.
