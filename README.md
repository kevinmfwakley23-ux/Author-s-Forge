# Author's Forge

AI Authoring Studio — a long-form writing, editing, continuity, illustration, publishing, and marketing workspace designed to be powered by K.I.N.G.S.

## Repository Role

Author's Forge is a standalone product repository. K.I.N.G.S. remains the independent intelligence/workforce operating system that may power Author's Forge through defined interfaces.

## Master Product Directive

The **Author's Forge Master Product Directive** is the authoritative product specification for the mission sequence and feature requirements. The canonical directive is currently maintained in the **ChatGPT Library** and is used as the source of truth when defining and auditing missions.

## Chief Engineering Standard

Implementation work is performed against the actual repository architecture as a production engineering task. The acting chief engineering code-writing role is responsible for delivering real-world-ready TypeScript, preserving existing contracts, adding acceptance coverage, and correcting production implementation defects rather than weakening tests.

No placeholder functions, fake integrations, mock behavior presented as production behavior, dead-end scaffolding, or code whose only purpose is to make a file exist is acceptable. Every mission must leave the repository in a coherent, buildable state that can be verified from the Linux terminal.

## Locked Build / Test / Fix Workflow

1. The acting chief engineering code-writing role builds the mission **directly inside the GitHub repository** and completes the implementation before requesting Linux verification.
2. The user runs the completed mission's verification suite from the Linux terminal.
3. If Linux reports any failure, the user pastes the complete failure output into the conversation.
4. The acting chief engineering code-writing role immediately returns to the GitHub repository, reads the actual failing production code and tests, diagnoses the root cause, and **fixes the repository directly**.
5. The acting chief engineering code-writing role does not ask the user to manually edit source files, does not merely describe a proposed fix, and does not declare a failure fixed until the repository implementation has actually been changed.
6. Tests must never be weakened, deleted, skipped, or altered merely to make a failure disappear. Acceptance tests may be corrected only when the test itself contradicts the authoritative product requirement or contains an objectively incorrect assertion; production behavior must otherwise be fixed.
7. After the repository fix is committed, the acting chief engineering code-writing role tells the user that the fix is complete and gives the exact pull/test command needed for the next Linux verification run.
8. This cycle repeats until the **complete verification suite is green**.
9. Only after the mission is fully green does development proceed to the next mission.

The user is the Linux verification operator. The acting chief engineering code-writing role is the repository implementation and failure-resolution authority.

## Development Workflow

We build Author's Forge as explicit, verifiable missions. Inspect existing boundaries, implement production behavior, add acceptance coverage, verify from Linux, fix reported failures directly in GitHub, and only then advance.

## Architecture Principles

Author's Forge owns the creative truth of a project. Intelligence providers, AI models, orchestration systems, research tools, and external services operate through explicit interfaces and must not silently become the source of truth for a manuscript.

Authoritative creative state remains durable, auditable, portable, and recoverable. Analysis and recommendations remain separate from actions that mutate author-controlled state.

## Missions 025–032

### Version Control

Book version control stores immutable snapshots for draft, final, and published states. Authors can compare versions by chapter, restore a previous snapshot, create branches, and perform three-way merges with explicit conflict detection.

### Author Control

Forge distinguishes `AI suggestion`, `AI draft`, `author approved`, `canon locked`, and `author override`. AI recommendations cannot silently supersede author-controlled state.

### Series Engine

A series provides a shared continuity boundary across books for characters, world rules, visual identities, locations, terminology, history, unresolved threads, and cross-book timeline events.

### Voice Preservation

Forge analyzes a writing fingerprint using sentence length, punctuation, dialogue ratio, vocabulary richness, paragraph length, narrative distance, description density, metaphor use, pacing, and emotional intensity, then produces preservation-aware rewrite briefs.

### AI Collaboration Modes

Forge exposes `co-pilot`, `partner`, `director`, `autonomous`, and `editor` policies. Author approval remains required in every mode.

### Project Health Dashboard

Structured health state covers completion, chapters, word count/target, canon conflicts, unresolved plot threads, characters, locations, research, illustrations, cover, marketing, and publishing readiness.

### Relationship-Aware Memory

Memory records can retain subject, predicate, object, context, source identifier/location, and relevance so facts carry their narrative relationships rather than existing as isolated statements.

### Self-Checking Before Delivery

The delivery audit covers canon, continuity, timeline, character, POV, style, grammar, formatting, research, artwork, cover, metadata, and publishing. A project is not ready until all required checks exist and pass.

## Missions 033–042 — Final Product Directive

### 033 — K.I.N.G.S. Relationship

Capability gaps have an explicit escalation boundary. K.I.N.G.S. is the capability escalation authority for research, planning, building, testing, and verification.

### 034 — Security and Ownership

Project-scoped security policy supports explicit permissions, local-first defaults, audit history, consent boundaries, provider disclosure, and denial of silent external uploads.

### 035 — Accessibility and Platforms

The platform-neutral contract covers Android, iPhone/iPad, Windows, macOS, Linux, and Web, with keyboard, mouse, touch, voice, screen-reader, large-text, and high-contrast capabilities.

### 036 — Voice as a First-Class Input

Original transcription is retained while structured intent supports idea capture, story planning, editing commands, research requests, character creation, scene direction, and revision instructions.

### 037 — Creative Safety / IP Boundaries

Provenance distinguishes author-owned, uploaded, generated, public-domain, external research, third-party reference, and unknown content. Uploaded/reference material requires explicit consent before processing.

### 038 — Ultimate User Experience

Forge is a publishing studio rather than a chat-only surface. The durable project boundary encompasses books, series, manuscripts, canon, characters, world information, research, art, covers, marketing, metadata, decisions, publishing state, and archive state.

### 039 — Golden Rules

Author creative authority remains primary. Uncertainty is represented rather than silently invented. Autonomous actions are observable and attributable, and existing version-control mechanisms provide reversibility.

### 040 — Book Genome

The Book Genome is a machine-readable graph spanning premise, theme, genre, voice, **canon**, characters, relationships, locations, timeline, events, scenes, objects, clues, reveals, conflicts, motivations, research, visual identities, art, cover, metadata, and publishing state. Impact analysis identifies connected downstream nodes when a genome fact changes.

### 041 — Final Product Standard

The product lifecycle runs from concept through architecture, canon, characters, timeline, research, manuscript, editing, illustrations, cover, formatting, metadata, positioning, marketing, publishing, and archive. Readiness is false until all required stages are complete.

### 042 — First Private Release Strategy

The first release is private-first, prioritizing long-memory projects, canon/anti-drift, chapter/scene architecture, writing/editing, research, character and illustration continuity, KDP preparation, manuscript production, portability/recovery, marketing, and publishing preparation.

## Integrated Studio UI

The repository now includes a real local web workspace rather than leaving the implemented domain/application layer disconnected from a user interface.

Run:

```bash
npm run studio
```

Then open `http://localhost:4173` in a browser.

The current Studio shell provides navigable workspaces for Dashboard, Manuscript, Characters, World & Canon, Art & Covers, Research, Marketing, Publishing, and Book Genome. The UI is wired to local HTTP endpoints for project creation, collaboration-mode changes, relationship-memory creation, final-product stage tracking, genome creation, and genome impact analysis. Public assets are copied into the build output by the normal build process.

The UI is intentionally local-first and provider-neutral: it does not pretend that an AI provider, speech provider, image generator, cloud storage service, or external research provider exists when one has not been configured.

## Compatibility Fixes

The project format remains **version 2** for compatibility with the established project foundation contract while supporting the additional final-stretch state fields. The Book Genome component contract explicitly includes `canon`, matching the Master Product Directive and downstream impact requirements.

## Verification Standard

A mission is not considered verified because its code compiles or because individual files exist. The complete acceptance suite must pass, including regression coverage for prior missions. Bugs are fixed in production code; tests are not weakened merely to obtain a green result.

## Current Status

Missions **025–032 were verified by the Linux development environment**.

The final-stretch implementation **033–042 is implemented** and the two reported regression defects have been fixed directly in the repository:

- Book Genome now accepts the required `canon` component.
- Project persistence remains compatible with the established `formatVersion: 2` contract.

The integrated local Studio UI is also implemented and wired to the current Author's Forge application/domain boundaries.

**Next checkpoint: run the complete Linux verification suite.**

Final-stretch implementation record: `docs/MISSIONS_033_042_FINAL_STRETCH.md`.

## One-Sentence Mission

> **Build an autonomous, memory-rich AI publishing studio that can help an author conceive, architect, research, write, edit, illustrate, design, market, format, and prepare an entire book or series for publication without losing continuity, style, canon, visual identity, or author control—and call upon K.I.N.G.S. whenever it encounters a capability gap beyond its current abilities.**
