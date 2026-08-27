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

## Mission 025–028 Boundaries

### Version Control

Book version control stores immutable snapshots for draft, final, and published states. Authors can compare versions by chapter, restore a previous snapshot, create branches, and perform three-way merges with explicit conflict detection. Version operations never mutate the source snapshots.

### Author Control

Forge distinguishes `AI suggestion`, `AI draft`, `author approved`, `canon locked`, and `author override`. Author override and canon lock are explicit durable decisions. An AI recommendation can never silently supersede an author-controlled state. The author can explicitly say **this is canon**, and the project state records that authority.

### Series Engine

A series provides a shared continuity boundary across books. Shared state includes characters, world rules, visual identities, locations, terminology, history, unresolved threads, and cross-book timeline events. Book membership and timeline references are validated against the series.

### Voice Preservation

Forge can analyze an author's writing fingerprint without replacing it. The voice profile measures sentence length, punctuation, dialogue ratio, vocabulary richness, paragraph length, narrative distance, description density, metaphor use, pacing, and emotional intensity. Profiles can be compared with new text and converted into provider-facing rewrite briefs. Voice preservation does not claim to reproduce an author from insufficient evidence and does not request imitation of named living authors.

## Missions 029–032 Boundaries

### Mission 029 — AI Collaboration Modes

Forge exposes five explicit collaboration modes: `co-pilot`, `partner`, `director`, `autonomous`, and `editor`. Each mode has a deterministic collaboration policy describing expected AI work share and editing focus. Author approval remains required in every mode; autonomous operation does not grant the AI authority to silently change author-controlled state.

### Mission 030 — Project Health Dashboard

Forge maintains a structured project-health snapshot containing book completion, chapter completion, word count and target, critical/minor canon conflicts, unresolved plot threads, character and location counts, research-source count, illustration count, cover status, marketing completion, and publishing readiness. Percentages are bounded to 0–100 and completion counts cannot exceed their targets.

### Mission 031 — Relationship-Aware Memory

Forge memory can retain not only a fact but its subject, predicate, object, context, source identifier, source location, and relevance. This supports relationships such as **Sarah lives in Denver because it was established in Chapter 3 and affects her ability to reach the hospital in Chapter 18**. Relationship memories are project-scoped, durable, and retrievable by either subject or object.

### Mission 032 — Self-Checking Before Delivery

Forge defines a mandatory delivery audit covering canon, continuity, timeline, character, POV, style, grammar, formatting, research, artwork, cover, metadata, and publishing. A project cannot receive `readyForAuthorApproval` until every required audit category has a result and every result passes without a critical failure. The system therefore cannot truthfully declare a project ready merely because a chat response says it is finished.

## Final Product Directive — Missions 033–042

### Mission 033 — K.I.N.G.S. Relationship

Forge has an explicit capability-gap boundary. When Forge encounters a capability it cannot responsibly provide, it can create an attributable capability gap and escalate it through the K.I.N.G.S. gateway for research, planning, building, testing, and verification. K.I.N.G.S. is the capability escalation authority; Forge remains the customer product and does not become a dependent chat shell.

### Mission 034 — Security and Ownership

Project state is project-scoped and supports explicit permissions, local-first defaults, security audit history, export/delete authorization boundaries, research consent, image-processing consent, provider disclosure, and external-upload denial by default. External storage is a destination rather than the source of truth. Sensitive project actions are attributable to an actor and target.

### Mission 035 — Accessibility and Platforms

The platform-neutral contract covers Android, iPhone/iPad, Windows, macOS, Linux, and Web. Input/accessibility capabilities explicitly include keyboard, mouse, touch, voice, screen readers, large text, and high contrast. Platform-specific UI implementations can sit above the stable project model without changing project portability.

### Mission 036 — Voice as a First-Class Input

Voice input preserves the original transcription and derives structured intent for idea capture, story planning, editing commands, research requests, character creation, scene direction, and revision instructions. Speech-to-text providers remain adapter boundaries; the core never pretends that an unavailable provider processed audio.

### Mission 037 — Creative Safety / IP Boundaries

Project provenance distinguishes author-owned, user-uploaded, generated, public-domain, external-research, third-party-reference, and unknown material. Uploaded/reference material requires explicit consent before processing, while external research must identify its source. Provenance is retained as project state so the author can distinguish what Forge knows, what it generated, and what originated externally.

### Mission 038 — Ultimate User Experience

Forge is architected as a publishing studio rather than a chat-only surface. The durable project boundary encompasses books, series, manuscripts, canon, characters, world information, research, art, covers, marketing, metadata, decisions, publishing state, and archival state. Intelligence operates throughout that environment through explicit service boundaries.

### Mission 039 — Golden Rules

Author creative authority remains primary. Uncertainty is represented rather than silently invented. Autonomous actions are designed to be observable and attributable, and existing version-control mechanisms provide reversibility. Canon changes can be represented in the Book Genome so downstream dependencies can be identified before affected state is changed.

### Mission 040 — Book Genome

The Book Genome is a machine-readable graph spanning premise, theme, genre, voice, characters, relationships, locations, timeline, events, scenes, objects, clues, reveals, conflicts, motivations, research, visual identities, art, cover, metadata, and publishing state. Graph impact analysis identifies connected downstream nodes and components affected by a change, enabling questions such as what else is affected when a Chapter 6 fact changes.

### Mission 041 — Final Product Standard

The complete product lifecycle is represented from concept through architecture, canon, characters, timeline, research, manuscript, editing, illustrations, cover, formatting, metadata, positioning, marketing, publishing, and archive. Final readiness remains false until every required stage is complete.

### Mission 042 — First Private Release Strategy

The first release is private-first. The architecture prioritizes long-memory projects, canon and anti-drift, chapter/scene architecture, writing/editing, research, character and illustration continuity, KDP preparation, manuscript production, portability/recovery, marketing, and publishing preparation. Public-scale distribution, billing, and multi-user infrastructure are not prerequisites for the private product milestone.

## Final Product Standard

Author's Forge is successful when an author can move from story concept through story architecture, canon, character system, timeline, research, manuscript, editing, illustrations, cover, formatting, metadata, market positioning, promotion, publishing preparation, and portable archival without losing continuity, style, canon, visual identity, or author control.

The intended product experience is an **AI publishing company in a box** while preserving the author as the ultimate creative authority.

## One-Sentence Mission

> **Build an autonomous, memory-rich AI publishing studio that can help an author conceive, architect, research, write, edit, illustrate, design, market, format, and prepare an entire book or series for publication without losing continuity, style, canon, visual identity, or author control—and call upon K.I.N.G.S. whenever it encounters a capability gap beyond its current abilities.**

## Verification Standard

A mission is not considered verified because its code compiles or because individual files exist. The complete acceptance suite must pass, including regression coverage for prior missions. Bugs are fixed in production code; tests are not weakened merely to obtain a green result.

## Current Status

Missions **025–032 have been verified by the Linux development environment**.

Missions **033–042 have been implemented and are awaiting complete Linux verification**.

Final-stretch implementation record: `docs/MISSIONS_033_042_FINAL_STRETCH.md`.
