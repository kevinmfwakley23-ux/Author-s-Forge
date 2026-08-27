# Author's Forge

AI Authoring Studio — a long-form writing, editing, continuity, illustration, publishing, and marketing workspace designed to be powered by K.I.N.G.S.

## Repository Role

Author's Forge is a standalone product repository. K.I.N.G.S. remains the independent intelligence/workforce operating system that may power Author's Forge through defined interfaces.

## Master Product Directive

The **Author's Forge Master Product Directive** is the authoritative product specification for the mission sequence and feature requirements. The canonical directive is currently maintained in the **ChatGPT Library** and is used as the source of truth when defining and auditing missions.

The directive will be copied into this repository as soon as the ChatGPT Library version is accessible through the available file integration. Until then, no repository document should be treated as a replacement for the canonical Library directive.

## Development Workflow

We build Author's Forge as a sequence of explicit, verifiable missions. The workflow is:

1. Read the applicable mission requirements from the Master Product Directive.
2. Inspect the current repository and previously completed mission boundaries.
3. Build the mission directly in GitHub using production-quality implementation.
4. Do not use placeholder functions, fake integrations, or code that merely makes a file exist.
5. Add real acceptance coverage for the mission's required behavior.
6. Keep each mission on its own branch until verification is complete.
7. Run the complete local verification suite from the Linux development environment when the mission is ready.
8. Fix failures in the production implementation rather than weakening tests to force a pass.
9. Only after the full mission passes verification do we move to the next mission.

The Linux terminal is primarily the local verification environment. GitHub is the canonical repository where mission implementation is built and preserved.

## Architecture Principles

Author's Forge owns the creative truth of a project. Intelligence providers, AI models, orchestration systems, research tools, and external services must operate through explicit interfaces and must not silently become the source of truth for a manuscript.

Authoritative creative state must remain durable, auditable, portable, and recoverable. Analysis and recommendations must remain separate from actions that mutate author-controlled state.

## Current Writing, Editing, and Research Boundaries

The Writing Engine distinguishes **content truth** from **style transformation**. A rewrite, POV conversion, tense conversion, style experiment, dialogue enhancement, description enhancement, emotional enhancement, or other transformation must not silently alter canonical facts.

The Intelligent Editing system is analysis-first. Editorial reports produce findings and recommendations but do **not** silently rewrite the manuscript. Manuscript mutation requires explicit author instruction.

The Research Engine is evidence-first and provider-neutral. External research is retained as project-linked `research-memory` with source provenance and working authority. Research does **not** silently become canon and does **not** mutate manuscript content. Research can be retrieved later by project and book/chapter/scene scope without repeating the original provider investigation.

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

Mission names and scope are governed by the Master Product Directive. Historical implementation checkpoints remain preserved in the repository.

## Verification Standard

A mission is not considered verified because its code compiles or because individual files exist. The complete acceptance suite must pass, including regression coverage for prior missions. Bugs are fixed in production code; tests are not weakened merely to obtain a green result.

## Status

Author's Forge is under active mission-based development. The next mission is not started until the current mission has been fully verified against its directive requirements.
