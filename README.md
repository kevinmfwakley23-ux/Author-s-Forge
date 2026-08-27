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

## Forge Studio

The repository now includes a real local-first Studio boundary rather than a decorative UI. `npm run studio` builds the TypeScript application, copies the Studio assets into `dist/public`, starts the local HTTP server, creates the first local project when needed, and exposes project-scoped API operations for project state, relationship-aware memory entry, Book Genome creation/impact analysis, governance policy, and final delivery auditing.

Studio navigation uses real route state and event handlers rather than dead links. Pipeline controls open the corresponding workspaces. The Studio does not claim that an AI provider or external image service exists when one has not been configured; provider integrations remain explicit extension points.

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

The repository is in **final product integration/hardening** rather than being declared feature-complete solely from mission-level tests. The current branch integrates the 029–032 foundation with final-product governance, Book Genome, local Studio, project APIs, and the directive's ownership/accessibility/provenance boundaries. Linux verification is the next checkpoint; any failure is to be fixed directly in the repository before completion is claimed.
