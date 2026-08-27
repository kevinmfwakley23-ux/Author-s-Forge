# Author's Forge

AI Authoring Studio — a long-form writing, editing, continuity, illustration, publishing, and marketing workspace designed to be powered by K.I.N.G.S.

## Repository Role

Author's Forge is a standalone product repository. K.I.N.G.S. remains the independent intelligence/workforce operating system that may power Author's Forge through defined interfaces.

## Master Product Directive

The **Author's Forge Master Product Directive** is the authoritative product specification for the mission sequence and feature requirements. The canonical directive is currently maintained in the **ChatGPT Library** and is used as the source of truth when defining and auditing missions.

The directive will be copied into this repository as soon as the ChatGPT Library version is accessible through the available file integration. Until then, no repository document should be treated as a replacement for the canonical Library directive.

## Chief Engineering Standard

Implementation work is performed against the actual repository architecture as a production engineering task. The acting chief engineering code-writing role is responsible for delivering real-world-ready TypeScript, preserving existing contracts, adding acceptance coverage, and correcting production implementation defects rather than weakening tests.

No placeholder functions, fake integrations, mock behavior presented as production behavior, dead-end scaffolding, or code whose only purpose is to make a file exist is acceptable. Every mission must leave the repository in a coherent, buildable state that can be verified from the Linux terminal.

## Locked Build / Test / Fix Workflow

The following workflow is permanently locked for mission development:

1. The acting chief engineering code-writing role builds the mission **directly inside the GitHub repository** and completes the implementation before requesting Linux verification.
2. The user runs the completed mission's verification suite from the Linux terminal.
3. If the Linux test reports any failure, the user pastes the complete failure output into the conversation.
4. The acting chief engineering code-writing role immediately returns to the GitHub repository, reads the actual failing production code and tests, diagnoses the root cause, and **fixes the repository directly**.
5. The acting chief engineering code-writing role does not ask the user to manually edit source files, does not merely describe a proposed fix, and does not declare a failure fixed until the repository implementation has actually been changed.
6. Tests must never be weakened, deleted, skipped, or altered merely to make a failure disappear. Acceptance tests may be corrected only when the test itself contradicts the authoritative product requirement or contains an objectively incorrect assertion; the production behavior must otherwise be fixed.
7. After the repository fix is committed, the acting chief engineering code-writing role tells the user that the fix is complete and gives the exact pull/test command needed for the next Linux verification run.
8. This cycle repeats until the **complete verification suite is green**.
9. Only after the mission is fully green does development proceed to the next mission.

The user is the Linux verification operator. The acting chief engineering code-writing role is the repository implementation and failure-resolution authority. The user should not have to become the code maintainer or manually repair mission failures.

## Development Workflow

We build Author's Forge as a sequence of explicit, verifiable missions. The workflow is:

1. Read the applicable mission requirements from the Master Product Directive.
2. Inspect the current repository and previously completed mission boundaries.
3. Build the mission directly in GitHub using production-quality implementation.
4. Do not use placeholder functions, fake integrations, or code that merely makes a file exist.
5. Add real acceptance coverage for the mission's required behavior.
6. Keep each mission on its own branch until verification is complete.
7. Give the completed mission to the Linux development environment for verification.
8. When Linux reports failures, immediately fix the repository implementation and return a new verification checkpoint; do not instruct the user to make source-code repairs manually.
9. Fix failures in the production implementation rather than weakening tests.
10. Only after the full mission passes verification do we move to the next mission.

The Linux terminal is primarily the local verification environment. GitHub is the canonical repository where mission implementation is built, corrected, and preserved.

## Architecture Principles

Author's Forge owns the creative truth of a project. Intelligence providers, AI models, orchestration systems, research tools, and external services must operate through explicit interfaces and must not silently become the source of truth for a manuscript.

Authoritative creative state must remain durable, auditable, portable, and recoverable. Analysis and recommendations must remain separate from actions that mutate author-controlled state.

## Current Writing, Editing, Research, and Character Boundaries

The Writing Engine distinguishes **content truth** from **style transformation**. A rewrite, POV conversion, tense conversion, style experiment, dialogue enhancement, description enhancement, emotional enhancement, or other transformation must not silently alter canonical facts.

The Intelligent Editing system is analysis-first. Editorial reports produce findings and recommendations but do **not** silently rewrite the manuscript. Manuscript mutation requires explicit author instruction.

The Research Engine is evidence-first and provider-neutral. External research is retained as project-linked `research-memory` with source provenance and working authority. Research does **not** silently become canon and does **not** mutate manuscript content. Research can be retrieved later by project and book/chapter/scene scope without repeating the original provider investigation.

The Character Bible is structured state, not merely prose. Every major character has the complete required profile and a temporal history for every profile field. Character updates are explicit, auditable, project-scoped, portable, and reconstructable at a historical point in time.

The Character Visual Continuity system is the visual counterpart to the Character Bible. Every major character can have canonical face, body, pose, wardrobe, hairstyle, age, distinguishing marks, scars, tattoos, accessories, color palette, and artistic style data. Visual state is versioned by story order so a Chapter 27 package can resolve the same canonical identity established at Chapter 4 while still supporting deliberate age, wardrobe, hairstyle, injury, and other visual progression. A `seriesId` keeps the identity portable across multiple books in the same series.

Visual identity packages are deterministic, portable data packages for downstream illustration generation. The package does not itself claim to generate pixels or silently mutate artwork; it supplies the canonical visual identity that an illustration provider must consume when artwork is generated.

## Code Languages and Tooling

The primary application language is **TypeScript**, compiled with the TypeScript compiler and checked in strict mode. The project uses **Node.js** for the runtime and **JavaScript** with Node's built-in test runner for acceptance tests.

Current core tooling includes:

- TypeScript 5.x
- Node.js 20+
- npm
- Git / GitHub
- Node's `node:test` test runner

The Linux environment is used to install dependencies, compile the TypeScript source, execute the complete test suite, and verify the repository state. GitHub remains the authoritative source repository for the implementation.

## Mission History

Completed mission work is preserved in separate branches and verification checkpoints rather than being overwritten as later missions are developed.

- Mission 004 — Project Brain + Canon Memory
- Mission 005 — Manuscript Foundation / structural manuscript state
- Mission 006 — Manuscript Planning Foundation
- Mission 006.2 — Writing Engine, corresponding to Mission 6 of the Master Product Directive
- Mission 007 — Intelligent Editing
- Mission 008 — Research Engine
- Mission 009 — Research Honesty
- Mission 010 — Character Bible + temporal character state (verified)
- Mission 011 — Character Visual Continuity (implementation branch; awaiting Linux verification)

Mission names and scope are governed by the Master Product Directive. Historical implementation checkpoints remain preserved in the repository.

## Verification Standard

A mission is not considered verified because its code compiles or because individual files exist. The complete acceptance suite must pass, including regression coverage for prior missions. Bugs are fixed in production code; tests are not weakened merely to obtain a green result.

## Status

Author's Forge is under active mission-based development. Mission 011 has been implemented on `mission-011-character-visual-continuity` and is awaiting complete local verification from the Linux development environment.
