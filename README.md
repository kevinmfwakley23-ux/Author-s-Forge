# Author's Forge

**Author's Forge** is a local-first author workplace for taking books from idea to finished, edited, illustrated, produced, and publication-ready material.

## Canonical Product Directive

**`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` is the canonical product contract and engineering source of truth.** It defines the target author journey: concept → architecture → canon → characters → timeline → research → manuscript → editing → illustrations → cover → formatting → metadata → positioning → marketing → publishing preparation → portable archive/recovery.

## Chief Engineering Standard

Forge must be a **real working author workplace**, not a mission gallery or collection of promises.

Non-negotiable:

- real implementation only;
- real provider calls only;
- real persistence only;
- no fake AI responses;
- no fake image generation;
- no placeholder controls presented as complete;
- no dead navigation;
- no silent canon mutation;
- no weakening/deleting tests to make builds green;
- major autonomous actions observable, reversible, attributable, and author-controlled.

A green unit-test suite is evidence, not proof. Major capabilities must be reachable from Studio, use durable project state, survive reload/restart, participate downstream, report real errors, and have end-to-end evidence.

## Permanent Platform Targets

**Chromebook and Android are first-class product targets.** Forge uses one platform-neutral web architecture with reusable domain/application/API boundaries, responsive desktop/tablet/phone layouts, touch interaction, PWA installability, conservative offline shell behavior, durable persistence independent of browser process state, and portable recovery.

The service worker may cache the application shell but must not cache `/api/` project data as durable state.

## Functional-Truth Rule

Every major capability is verified at three levels:

1. **Domain/contract** — deterministic services, persistence, validation, provider boundaries.
2. **Application** — real server, routes, state transitions, artifacts, errors, recovery.
3. **Human/device** — rendered Studio UI on supported Chromebook and Android environments.

Source-pattern tests alone are never end-to-end proof.

## Competitive-Benchmark Engineering Workflow

Forge continuously learns from real working applications and open-source projects that share its capabilities. For each major capability:

**research → architecture → implementation → regression coverage → build/acceptance verification → README/build-history update → next capability.**

Research is an engineering input, not permission to copy disconnected feature lists. Proven strengths are rebuilt natively around Forge's durable state, provenance, Project Brain, Book Genome, author control, proposal review, workflow gates, production, and recovery.

Recent benchmark signals include visual planning and Story Bible patterns from Plottr/Sudowrite, manuscript-aware continuity from Storybible/Novilot, goal and habit feedback from current writing tools, specialist editorial triage from FireQuill, and propose-only author-control patterns from newer authoring products. Current external behavior must be verified before being treated as evidence.

## Integrated Studio Direction

```text
AUTHOR
  ↓
TYPED / VOICE COMMAND
  ↓
PROJECT + BOOK BINDER
  ↓
ARCHITECTURE
  ↓
CANON / CHARACTERS / WORLD / TIMELINE / RESEARCH / VOICE
  ↓
STORY MAP + WRITING DESK + PROJECT BRAIN
  ↓
EDITORIAL ANALYSIS + CRAFT LENS
  ↓
VISUAL / ILLUSTRATION / COVER
  ↓
BOOK GENOME + DOWNSTREAM IMPACT
  ↓
MARKETING
  ↓
DOCX / PDF / EPUB PRODUCTION
  ↓
DELIVERY AUDIT
  ↓
PORTABLE PROJECT PACKAGE
```

## AI Context and Author-Controlled Mutation

Context efficiency is first-class: hierarchical context assembly, deduplication, protected structured data, deterministic compression before lossy methods, semantic caching where justified, token/cost governance, provider routing boundaries, and measurable optimization telemetry.

AI changes are reviewable durable proposals, never silent manuscript/canon mutation. Proposals carry rationale, provenance, status, review state, and source-revision binding. Writing Desk and Editing Room expose deterministic line-level diffs and word-count impact before explicit author approval/application. Server-side revision protection remains authoritative against stale writes.

Forge never claims a provider/model is available without runtime verification and never fabricates unavailable AI output.

## Mission 054 — Author Goals Foundation

Forge now contains a deterministic Author Goals domain/application foundation designed around the real manuscript rather than an isolated progress counter.

`src/domain/author-goals.ts` provides:

- validated word, scene, and chapter goals;
- daily, weekly, session, and project goal periods;
- deterministic progress percentages;
- remaining-work calculations;
- completion state;
- manuscript progress snapshots.

The application boundary is `AuthorGoalsService` in `src/application/author-goals.ts`.

Word progress is deliberately supplied from the authoritative manuscript/workspace word-count source instead of guessed from incomplete domain records. This prevents the goal system from becoming a second manuscript database.

The next integration step is a durable Studio goal surface backed by project persistence, including session history, streak/progress history, and actionable “what should I work on next?” signals derived from Story Map state.

## Mission 053 — Live Story Map

The Story Map is a live Studio planning surface derived from the existing durable book/chapter/scene hierarchy. It provides visual hierarchy, lifecycle status, chapter/book/project completion, refresh behavior, and direct scene navigation.

The Story Map does **not** create a second planning database. Its deterministic foundation is `src/domain/story-map.ts` and `src/application/story-map.ts`; the live surface is `public/forge-story-map.js`.

A follow-up functional-integrity fix now makes every Story Map scene card a real action: selecting a scene updates the manuscript selectors, switches to the Manuscript/Writing surface, and emits `forge:story-map-open-scene` for integration listeners. Regression coverage lives in `test/story-map-actions.test.js`.

Future Story Map increments remain scene attributes, plotlines/character arcs, durable drag/reorder with impact analysis, continuity/canon warnings, and series-level planning.

## Mission 052 — Competitive Advantage Research

Forge converted competitive research into an implementation sequence:

1. Story Map.
2. Author Goals.
3. Knowledge Gap Radar.
4. Craft Lens.
5. Production Preview.
6. Collaboration Review.

The goal is not to reproduce six separate apps. Forge should integrate their strongest proven workflows into one coherent author operating environment.

## Mission 051 — Editing Room Proposal Review Diff

The Editing Room provides deterministic review of durable AI rewrite proposals. Authors can inspect line-level added/removed/unchanged content and before/after word counts. Approval remains separate from application, with server-side source-revision protection.

## CI / PWA Integrity

Canonical CI covers installation, build, tests, completion measurement, client syntax checks, browser acceptance, and mobile acceptance. The PWA shell remains separate from durable `/api/` project state.

## Current Build Priorities

1. Integrate Author Goals into durable Studio project state.
2. Build Knowledge Gap Radar from provenance-aware research and project-memory signals.
3. Build Craft Lens around measurable narrative/craft dimensions and reviewable revision strategies.
4. Strengthen Story Map with scene attributes, plotlines, character arcs, and continuity indicators.
5. Build Production Preview so formatting/export problems are caught before release.
6. Expand collaboration/review only after the core author journey remains durable and verifiable.
7. Verify the complete running product on Chromebook and Android, including recovery and real configured AI providers.

## Definition of Complete

Forge is complete only when a real author can create or restore a project and carry it through the intended Studio journey — concept, architecture, canon, characters, research, manuscript, editing, visual work, cover, production, positioning, marketing, publishing preparation, delivery audit, and portable recovery — with durable state, real provider boundaries, author approval, truthful failures, and verified Chromebook/Android operation.
