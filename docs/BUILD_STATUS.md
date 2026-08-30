# Author's Forge — Build Status

**Date:** 2026-08-30  
**Canonical branch:** `main`  
**Latest recorded commit:** `06560bf3` — `ci: establish canonical build and browser regression pipeline`

## Current condition

Author's Forge has moved beyond a UI prototype into a substantial domain/application system with an integrated Studio server, durable project state, AI provider boundaries, author-controlled proposals, manuscript production, publishing readiness, marketing governance, workflow gates, portable project packages, Book Genome/final-product systems, and PWA/mobile surfaces.

The latest local result reported during engineering work was:

> REAL BROWSER ACCEPTANCE PASSED: 18 routes + durable book/chapter/scene + manuscript save/reload + character + canon + honest AI failure.

That result is treated as evidence, not as a blanket completion claim. Fresh build/test execution is required after checkout/integration, and physical Chromebook/Android verification remains a separate release gate.

## Immediate engineering condition

The next priority is functional truth, not feature accumulation. The repository already contains the public API exports required by the manuscript, project foundation, publishing, version-control, collaboration, health, relationship-memory, and delivery-audit regression suites. If an older local checkout reports errors such as `createManuscriptState is not a function`, `createProject is not a function`, or similar export errors, rebuild from current `main` with:

```bash
npm install
npm run build
npm test
```

Do not repair these failures by deleting tests or weakening exports. First eliminate stale build artifacts or branch divergence; then repair the implementation if the current source genuinely fails.

## Completion measurement

Run:

```bash
npm run completion
```

The meter reports engineering capability completion and verification/evidence readiness. It intentionally refuses to treat a source file, route label, or green unit test as proof of a complete user capability. 100% means the full author journey is implemented and verified across the required evidence levels.

## Cross-repository architecture adopted

Forge selectively incorporates the strongest pre-decided architectural principles from the companion K.I.N.G.S. system rather than copying its implementation wholesale:

- human authority above automation;
- requirement → audit → integration → build → test → end-to-end proof;
- provider-neutral, capability-aware intelligence;
- governed context, budgets, cost controls, and fail-open optimization;
- durable continuity and recovery;
- provenance and evidence gates;
- constrained-runtime awareness.

Forge does not fork K.I.N.G.S. internals or require its private runtime for core authoring behavior.

## Build order from here

### Phase A — Canonical baseline
- synchronize `main` and eliminate stale local build artifacts;
- restore the complete regression suite to green;
- verify public API exports and package entry points;
- make build, unit, browser, and mobile commands deterministic.

### Phase B — Core author loop
- project creation/restoration;
- book/chapter/scene editing;
- Project Brain, canon, character, voice, and research context;
- AI assist through the Model Broker;
- proposal review and explicit author approval;
- durable continuation after reload/restart.

### Phase C — Visual production
- visual identity and character continuity;
- reference assets;
- real illustration generation/editing boundaries;
- cover planning and validation;
- durable visual artifacts linked to book state.

### Phase D — Production and release
- DOCX/PDF/EPUB artifacts;
- metadata and positioning;
- evidence-gated marketing;
- publishing readiness;
- delivery audit;
- portable project package and restore.

### Phase E — Device proof
- Chromebook responsive/touch verification;
- Android browser/PWA installation;
- Android persistence and file handling;
- offline shell and recovery;
- long-running project continuity;
- real configured AI provider execution.

### Phase F — After the journey is stable
- additional providers;
- advanced semantic compression;
- richer automation;
- broader promotion/scheduling integrations;
- measured workload optimization.

## Definition of complete

Author's Forge is complete only when a real author can create or restore a project and carry it through the intended Studio journey — concept, architecture, canon, characters, research, manuscript, editing, visual work, cover, production, positioning, marketing, publishing preparation, delivery audit, and portable recovery — with durable state, real provider boundaries, author approval, truthful failures, and verified Chromebook/Android operation.
