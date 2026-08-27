# Mission 012 — Illustration Studio

## Scope

Author's Forge now has a provider-neutral Illustration Studio domain for planning, refining, validating, persisting, and packaging illustration work without pretending that a local test fixture is an image-generation provider.

## Supported modes

- AI-only generation
- Assisted generation
- Collaborative generation
- Reference-driven generation
- Character-consistent generation
- Historical/era-aware generation
- Environment-consistent generation

## Supported illustration types

- Scene
- Character portrait
- Map
- Object
- Environment

## Continuity contract

Every request can carry character visual identity IDs, environment identity IDs, series/book/chapter/scene scope, story position, era, location, and durable references. This lets a future image-generation provider receive a deterministic, reusable illustration brief rather than reconstructing continuity from prose.

## Provider boundary

The studio deliberately does not fabricate an AI image provider. `generateIllustrationBrief` creates the validated provider input. A real image-generation integration must be implemented behind an explicit provider interface when a supported provider is selected. This keeps creative truth inside Author's Forge and prevents fake production behavior.

## Persistence

`FileIllustrationStudioStore` provides atomic JSON persistence with project isolation, validation, duplicate detection, and reload support.

## Verification

Acceptance coverage verifies all modes and types, references, continuity metadata, collaborative revisions, immutability, project scoping, portable restoration, and file persistence.
