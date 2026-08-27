# Author's Forge

AI Authoring Studio — a long-form writing, editing, continuity, illustration, publishing, and marketing workspace designed to be powered by K.I.N.G.S.

## Repository Role

Author's Forge is a standalone product repository. K.I.N.G.S. remains the independent intelligence/workforce operating system that may power Author's Forge through defined interfaces.

## Master Product Directive

The **Author's Forge Master Product Directive** is the authoritative product specification for the mission sequence and feature requirements. The canonical directive is maintained in the ChatGPT Library and is used as the source of truth when defining and auditing missions.

## Chief Engineering Standard

Implementation work is performed against the actual repository architecture as a production engineering task. The acting chief engineering code-writing role is responsible for delivering real-world-ready TypeScript, preserving existing contracts, adding acceptance coverage, and correcting production implementation defects rather than weakening tests.

No placeholder functions, fake integrations, mock behavior presented as production behavior, dead-end scaffolding, or code whose only purpose is to make a file exist is acceptable. Every mission must leave the repository in a coherent, buildable state that can be verified from the Linux terminal.

## Locked Build / Test / Fix Workflow

1. The acting chief engineering code-writing role builds the mission **directly inside the GitHub repository** and completes the implementation before requesting Linux verification.
2. The user runs the completed mission's verification suite from the Linux terminal.
3. If Linux reports any failure, the user pastes the complete failure output into the conversation.
4. The acting chief engineering code-writing role immediately returns to the GitHub repository, reads the actual failing production code and tests, diagnoses the root cause, and **fixes the repository directly**.
5. The acting chief engineering code-writing role does not ask the user to manually edit source files or merely describe a proposed fix.
6. Tests must never be weakened, deleted, skipped, or altered merely to make a failure disappear.
7. After the repository fix is committed, the user receives the exact pull/test checkpoint.
8. The cycle repeats until the **complete verification suite is green**.
9. Only after the mission is fully green does development proceed.

## Architecture Principles

Author's Forge owns the creative truth of a project. Intelligence providers, AI models, orchestration systems, research tools, and external services operate through explicit interfaces and must not silently become the source of truth for a manuscript.

Authoritative creative state must remain durable, auditable, portable, recoverable, attributable, and reversible where the product contract requires it. Analysis and recommendations remain separate from actions that mutate author-controlled state.

## Final Product Hardening

Missions 029–032 establish collaboration modes, project health, relationship-aware memory, and pre-delivery self-checking. The final product systems now extend that foundation toward the remaining Master Product Directive requirements:

- **K.I.N.G.S. capability escalation:** capability gaps are explicit, project-scoped, attributable to K.I.N.G.S., and progress through a controlled requested → research → plan → build → test → verified lifecycle.
- **Security and ownership boundary:** the Studio exposes an explicit ownership policy with project isolation, export/delete controls, audit history, provider transparency, consent requirements, no-silent-upload policy, and local-first behavior.
- **Accessibility contract:** keyboard, mouse, touch, voice, screen-reader, large-text, and high-contrast capabilities are represented as explicit preferences rather than being left implicit.
- **Voice input:** original voice transcription is preserved as a first-class project command record rather than discarded after intent extraction.
- **Creative/IP provenance:** uploaded, author-owned, generated, researched, public-domain, licensed, real-person, and trademarked material are distinguishable; consent is required before governed real-person/user-uploaded processing.
- **Book Genome:** premise, theme, genre, voice, canon, characters, relationships, locations, timeline, events, scenes, objects, clues, reveals, conflicts, motivations, research, visual identities, art, cover, metadata, and publishing state are represented as a dependency graph. Canon changes can be analyzed for downstream impact before author approval.
- **Final delivery audit:** the product recognizes the full 13-category audit boundary: canon, continuity, timeline, characters, POV, style, grammar, formatting, research, artwork, cover, metadata, and publishing.

## Reference Engineering Integration

The project was reviewed against three public reference implementations supplied for engineering research:

- **The Novelist's Atelier** — Apache-2.0 licensed. Useful patterns included hierarchical Series/Book/Chapter context, selectable Full/Brief/Extended/Custom/Off context inclusion, pipeline-oriented editing, autosave/backup thinking, global search, Style DNA, local text analysis, and multi-provider boundaries.
- **BOOKGEN-AI / google-book-writer** — MIT licensed. Useful patterns included staged long-form generation, persistent Book Bible/character/timeline memory, resumable checkpoints, per-chapter memory compression, quality review, and publication exports.
- **ai-book-studio** — MIT licensed. Useful patterns included explicit Plan → Write → Save workflow, approved-outline gates, chapter-level continuity, session persistence, and separated reviewing/packaging/cover stages.

These repositories are **reference material, not the Author's Forge architecture**. No foreign application framework was transplanted wholesale. The useful workflow principles are being reimplemented inside Forge's existing TypeScript domain/application/persistence boundaries so that Book Genome, Project Brain, author authority, provenance, portability, and K.I.N.G.S. escalation remain first-class rather than becoming bolt-on behavior.

The first concrete integration is the **bounded Writing Context engine**. It implements the strongest shared idea from the reference projects: context should be hierarchical and selectable instead of dumping an entire book into every AI request. Supported modes are `full`, `brief`, `extended`, `custom`, and `off`; context is assembled from project canon, characters, relationships, timeline, research, voice, and unresolved threads; selected records remain attributable through source IDs; and character context carries the structured Character Bible profile rather than a lossy name-only summary.

## Project Persistence Hardening

The file project store now preserves the complete known ProjectState rather than reconstructing only a small subset on reload. Optional mission state is validated where domain validators exist and retained across persistence. This prevents project data such as positioning, marketing, author control, series, voice, health, relationship memory, delivery audits, and other mission outputs from silently disappearing after a restart.

## Forge Studio

The repository includes a real local-first Studio boundary rather than a decorative UI. `npm run studio` builds the TypeScript application, copies the Studio assets into `dist/public`, starts the local HTTP server, creates the first local project when needed, and exposes project-scoped API operations for project state, relationship-aware memory entry, bounded writing-context assembly, Book Genome creation/impact analysis, governance policy, and final delivery auditing.

Studio navigation uses real route state and event handlers. Pipeline controls open corresponding workspaces, and the Writing Desk can assemble an actual bounded context package from durable project data. The Studio does not claim that an AI provider or external image service exists when one has not been configured; provider integrations remain explicit extension points.

The local project store remains the source of truth. Browser state is a view over durable project state, not the project itself.

## Verification Standard

A mission is not considered verified because its code compiles or because individual files exist. The complete acceptance suite must pass, including regression coverage for prior missions. Bugs are fixed in production code; tests are not weakened merely to obtain a green result.

## Linux Verification Checkpoint

From a clean checkout of the current implementation branch:

```bash
npm install
npm run check
npm run studio
```

Then open `http://127.0.0.1:4173`.

If port 4173 is already occupied, inspect the existing process before starting another Studio instance. The server also accepts `PORT=<number>` for an alternate local port.

## Status

**Branch: `integration-reference-hardened`**

This branch is the dedicated integration/hardening line built from the verified 029–032 foundation. It incorporates the strongest applicable workflow patterns from the reviewed open-source book-writing projects, hardens complete ProjectState persistence, adds bounded hierarchical writing context, exposes that capability through the local Studio API, and gives the UI a functional Writing Desk and stronger route handling.

This checkpoint is **ready for Linux verification**. It is not being declared production-complete until the full repository verification suite is run from Linux and any failures are corrected directly in the repository.
