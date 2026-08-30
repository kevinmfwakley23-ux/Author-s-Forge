# Author's Forge — Build Status

**Date:** 2026-08-30  
**Canonical branch:** `main`  
**Latest engineering baseline:** `ef024b6e08871e9ab5b96f861e92480007dc5e98` — Editing Room deterministic proposal review diff integration and regression coverage.

## Current condition

Author's Forge has moved beyond a UI prototype into a substantial domain/application system with an integrated Studio server, durable project state, AI provider boundaries, author-controlled proposals, manuscript production, publishing readiness, marketing governance, workflow gates, portable project packages, Book Genome/final-product systems, and PWA/mobile surfaces.

The latest local result reported during engineering work was:

> REAL BROWSER ACCEPTANCE PASSED: 18 routes + durable book/chapter/scene + manuscript save/reload + character + canon + honest AI failure.

That result is treated as evidence, not as a blanket completion claim. Fresh build/test execution is required after checkout/integration, and physical Chromebook/Android verification remains a separate release gate.

## Mission 051 — Editing proposal review diff

The Editing Room now exposes the same governed, deterministic review-diff standard already established for Writing Desk AI proposals. A selected manuscript-edit proposal is compared against the currently loaded scene and presented as line-level added/removed/unchanged records with word-count impact. Proposal selection is explicit, approval remains separate from application, and server-side source-revision protection remains authoritative.

Regression coverage now verifies the live Editing Room script contains the durable proposal endpoint, deterministic diff, line-level review, add/remove counts, selection, and explicit apply controls.

This closes the immediate review-integrity gap between the Writing Desk and Editing Room: authors can inspect what an AI rewrite would change before accepting or applying it.

## Mission 049 — Proposal review integrity

The AI proposal boundary now has a deterministic review-diff service. `createAiProposalDiff` produces line-level added/removed/unchanged records, exact base/proposed SHA-256 bindings, character/word counts, and explicit line-number mapping. The capability is review-only and cannot mutate manuscript state. Regression coverage is in `test/ai-proposal-diff.test.js` and the capability is exported from `src/index.ts`.

The Writing Desk exposes this review directly, and Mission 051 extends the same review discipline to Editing Room rewrite proposals.

## Canonical verification

The repository now contains `.github/workflows/canonical-verification.yml`, which runs on pushes to `main` and manual dispatch. It installs dependencies and Chromium, then runs the build/regression suite, completion meter, browser acceptance, and mobile acceptance. This makes the canonical verification path reproducible from the repository itself.

## Current PWA/mobile build

The Android/PWA surface has been strengthened from a manifest-and-harness-only boundary into an explicit install lifecycle:

- real `beforeinstallprompt` handling;
- an install control created in the live Studio when supported;
- explicit standalone/app-installed status;
- service-worker registration from the live browser client;
- service-worker upgrade messaging;
- versioned shell cache (`authors-forge-shell-v4`);
- continued exclusion of `/api/` project data from service-worker caching;
- mobile acceptance coverage for touch navigation, phone viewport, overflow, manuscript persistence, and reload;
- dedicated PWA lifecycle tests covering install, safe storage boundaries, and shell upgrades.

The PWA layer deliberately does not create a second project-state store. Durable project data remains behind the Forge server/domain persistence boundary.

## Portable release bundle

The repository contains `.github/workflows/release-bundle.yml`. It builds the canonical Forge, runs the completion meter and browser-side syntax checks, then packages `dist`, `public`, the Termux launcher, package metadata, README/directive documentation, and Android/Chromebook run instructions into a versioned tarball with SHA-256 checksum.

The workflow runs on demand and on `v*` tags. This establishes a repeatable path from the repository's verified build to a portable package that can be transferred to the Chromebook or Android/Termux environment. It does not pretend to be a native APK; Forge's Android target remains the platform-neutral PWA/web application.

## Immediate engineering condition

The next priority is functional truth, not feature accumulation. The repository already contains the public API exports required by the manuscript, project foundation, publishing, version-control, collaboration, health, relationship-memory, delivery-audit, and workflow regression suites. If an older local checkout reports errors such as `createManuscriptState is not a function`, `createProject is not a function`, or similar export errors, rebuild from current `main` with:

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

The Android/PWA capability now measures the actual `manifest.webmanifest`, service worker, live PWA lifecycle module, and matching automated evidence instead of looking for the obsolete `public/manifest.json` path.

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
- deterministic proposal diffs in the live Writing Desk and Editing Room;
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
- Android browser/PWA installation using the live install control or browser install flow;
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
