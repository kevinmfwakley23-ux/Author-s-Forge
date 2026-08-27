# Author's Forge

AI Authoring Studio — a long-form writing, editing, continuity, illustration, publishing, and marketing workspace designed to be powered by K.I.N.G.S.

## Repository Role

Author's Forge is a standalone product repository. K.I.N.G.S. remains the independent intelligence/workforce operating system that may power Author's Forge through defined interfaces.

## Master Product Directive

The **Author's Forge Master Product Directive** is the authoritative product specification for the mission sequence and feature requirements. The canonical directive is currently maintained in the ChatGPT Library and is used as the source of truth when defining and auditing missions.

## Chief Engineering Standard

Implementation work is performed against the actual repository architecture as a production engineering task. The acting chief engineering code-writing role is responsible for delivering real-world-ready TypeScript, preserving existing contracts, adding acceptance coverage, and correcting production implementation defects rather than weakening tests.

No placeholder functions, fake integrations, mock behavior presented as production behavior, dead-end scaffolding, or code whose only purpose is to make a file exist is acceptable. Every mission must leave the repository in a coherent, buildable state that can be verified from the Linux terminal.

## Locked Build / Test / Fix Workflow

1. The acting chief engineering code-writing role builds the mission directly inside the GitHub repository and completes the implementation before requesting Linux verification.
2. The user runs the completed mission's verification suite from the Linux terminal.
3. If Linux reports any failure, the user pastes the complete failure output into the conversation.
4. The acting chief engineering code-writing role immediately returns to the GitHub repository, reads the actual failing production code and tests, diagnoses the root cause, and fixes the repository directly.
5. The acting chief engineering code-writing role never asks the user to manually edit source files and never declares a failure fixed until the repository implementation has actually been changed.
6. Tests must never be weakened, deleted, skipped, or altered merely to make a failure disappear. Acceptance tests may be corrected only when they contradict the authoritative product requirement or contain an objectively incorrect assertion.
7. After the repository fix is committed, the acting chief engineering code-writing role tells the user the fix is complete and gives the exact pull/test command for the next Linux verification run.
8. This cycle repeats until the complete verification suite is green.
9. Only after the mission is fully green does development proceed to the next mission.

The user is the Linux verification operator. The acting chief engineering code-writing role is the repository implementation and failure-resolution authority.

## Architecture Principles

Author's Forge owns the creative truth of a project. Intelligence providers, AI models, orchestration systems, research tools, image-generation providers, and external services must operate through explicit interfaces and must not silently become the source of truth for a manuscript or visual identity.

Authoritative creative state must remain durable, auditable, portable, and recoverable. Analysis and recommendations must remain separate from actions that mutate author-controlled state.

## Current Writing, Editing, Research, Character, and Illustration Boundaries

The Writing Engine distinguishes content truth from style transformation. Transformations must not silently alter canonical facts.

The Intelligent Editing system is analysis-first. Editorial reports produce findings and recommendations but do not silently rewrite the manuscript.

The Research Engine is evidence-first and provider-neutral. External research is retained as project-linked research memory with source provenance and working authority. Research does not silently become canon.

The Character Bible is structured state, not merely prose. Every major character has the complete required profile and temporal history for every profile field.

The Character Visual Continuity system provides reusable visual identity with canonical references, wardrobe, hairstyle, age progression, marks, scars, tattoos, accessories, palette, artistic style, poses, story-position snapshots, and series continuity.

The Illustration Studio is a provider-neutral creative workspace supporting AI-only, assisted, collaborative, reference-driven, character-consistent, historical/era-aware, and environment-consistent illustration workflows. It supports scene illustrations, character portraits, maps, objects, and environments. Requests retain references, continuity scope, era, location, story position, and revision history. The studio produces validated deterministic illustration briefs for real image-generation providers; it does not fabricate image-generation behavior.

## Image Editing Boundary

Mission 013 adds a provider-neutral Image Editing system. An uploaded image is represented as an immutable `SourceImage`. Editing is append-only: each requested transformation becomes an auditable `ImageEditRevision` and produces a distinct `EditedImage` derived from the original source. Supported operations include face preservation, clothing, background, age, medium, lighting, object removal/addition, pose alteration, crop, restoration, upscaling, and stylization.

The editing system supports project-scoped sessions, portable state, atomic file persistence, explicit output formats, output references, and deterministic edit briefs for a real downstream image-editing provider. It never represents a fake provider as a completed integration and never overwrites or destroys the source image. Multiple edits can therefore branch from the same canonical original while retaining complete provenance.

## Code Languages and Tooling

The primary application language is TypeScript, compiled with the TypeScript compiler and checked in strict mode. The project uses Node.js for the runtime and JavaScript with Node's built-in test runner for acceptance tests.

## Mission History

- Mission 004 — Project Brain + Canon Memory
- Mission 005 — Manuscript Foundation / structural manuscript state
- Mission 006 — Manuscript Planning Foundation
- Mission 006.2 — Writing Engine
- Mission 007 — Intelligent Editing
- Mission 008 — Research Engine
- Mission 009 — Research Honesty
- Mission 010 — Character Bible + temporal character state (verified)
- Mission 011 — Character Visual Continuity (verified)
- Mission 012 — Illustration Studio (verified)
- Mission 013 — Image Editing (implementation branch; awaiting Linux verification)

## Verification Standard

A mission is not considered verified because its code compiles or because individual files exist. The complete acceptance suite must pass, including regression coverage for prior missions. Bugs are fixed in production code; tests are not weakened merely to obtain a green result.

## Status

Author's Forge is under active mission-based development. Mission 013 has been implemented on `mission-013-image-editing` and is awaiting complete local verification from the Linux development environment.
