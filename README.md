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

Recent benchmark signals include visual planning and Story Bible patterns from Plottr/Sudowrite, manuscript-aware continuity from Storybible/Novilot, goal and habit feedback from current writing tools, specialist editorial triage from FireQuill, manuscript-level developmental analysis from ProWritingAid, and propose-only author-control patterns from newer authoring products. Current external behavior must be verified before being treated as evidence.

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
CANON / CHARACTERS / WORLD / TIMELINE / RESEARCH / VOICE MEMORY
  ↓
STORY MAP + WRITING DESK + PROJECT BRAIN
  ↓
EDITORIAL ANALYSIS + CRAFT LENS + VOICE DRIFT CHECK
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

## Mission 056 — Author Voice Memory + Drift Preservation

Forge now has a dedicated author-voice memory layer designed to solve a harder problem than generic style prompting: preserving the **author's own established voice across AI-assisted drafting**.

The competitive research showed that leading fiction systems treat character cards, voice samples, story memory, POV/tense controls, and persistent story context as active generation constraints. Sudowrite's Story Bible is explicitly a source of truth for both author and AI, while its character system uses personality, physical detail, dialogue style, and samples to maintain consistency across long manuscripts. ProWritingAid demonstrates the complementary value of manuscript-wide character/plot/style analysis and targeted evidence rather than opaque quality scores. citeturn0search11turn0search3turn0search8turn0search5

Forge's implementation goes further by separating the author's **approved reference corpus** from generated prose. `src/domain/author-voice-memory.ts` provides:

- multiple approved writing samples instead of one style prompt;
- weighted samples and canonical sample selection;
- an aggregated voice fingerprint;
- corpus updates without losing sample provenance;
- deterministic voice-drift assessment;
- nearest-reference sample matching;
- actionable drift warnings for narrative distance and sentence-pattern divergence;
- a reusable author-voice context block for governed AI generation.

`src/application/author-voice-memory.ts` provides the project/author ownership boundary so a voice corpus cannot accidentally be applied across projects or authors.

The existing `voice-preservation` capability remains the lower-level measurement layer. The new memory corpus turns that measurement into a durable multi-sample reference system.

**Design rule:** Forge must never tell an AI to imitate another named author. It learns from the user's own approved corpus and treats voice preservation as a constraint alongside canon, character, continuity, and author intent.

The next integration step is to connect this memory directly to the live Writing Desk/AI drafting pipeline so every generated proposal can be scored for voice drift before the author sees the diff, with an optional author-controlled “voice preservation” gate.

## Mission 055 — Craft Lens Foundation

Forge now has a deterministic Craft Lens domain/application boundary for targeted manuscript feedback instead of a single opaque “quality score.”

`src/domain/craft-lens.ts` measures concrete signals including:

- sentence length and unusually long sentences;
- possible passive constructions;
- dialogue presence and dialogue-heavy passages;
- concentrated vocabulary/repetition signals;
- sensory-anchor signals;
- sentence-rhythm uniformity.

Each finding includes a craft dimension, severity, concrete evidence, and multiple possible revision strategies. The lens never rewrites the author's prose and does not declare stylistic choices objectively wrong.

`CraftLensService` in `src/application/craft-lens.ts` provides the application boundary, with deterministic regression coverage in `test/craft-lens.test.js`.

The next integration step is to run Craft Lens against a selected manuscript passage in the Editing Room and turn findings into the existing governed AI proposal/diff/review/apply workflow.

## Mission 054 — Author Goals Foundation

Forge now contains a deterministic Author Goals domain/application foundation designed around the real manuscript rather than an isolated progress counter.

`src/domain/author-goals.ts` provides validated word, scene, and chapter goals; daily/weekly/session/project periods; deterministic progress percentages; remaining-work calculations; completion state; and manuscript progress snapshots.

The application boundary is `AuthorGoalsService` in `src/application/author-goals.ts`.

Word progress is deliberately supplied from the authoritative manuscript/workspace word-count source instead of guessed from incomplete domain records. This prevents the goal system from becoming a second manuscript database.

The next integration step is a durable Studio goal surface backed by project persistence, including session history, streak/progress history, and actionable “what should I work on next?” signals derived from Story Map state.

## Mission 053 — Live Story Map

The Story Map is a live Studio planning surface derived from the existing durable book/chapter/scene hierarchy. It provides visual hierarchy, lifecycle status, chapter/book/project completion, refresh behavior, and direct scene navigation.

The Story Map does **not** create a second planning database. Its deterministic foundation is `src/domain/story-map.ts` and `src/application/story-map.ts`; the live surface is `public/forge-story-map.js`.

A functional-integrity fix now makes every Story Map scene card a real action: selecting a scene updates the manuscript selectors, switches to the Manuscript/Writing surface, and emits `forge:story-map-open-scene` for integration listeners. Regression coverage lives in `test/story-map-actions.test.js`.

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

1. Integrate Author Voice Memory into the live AI drafting/proposal pipeline and make voice drift visible before application.
2. Integrate Character Bible + relationship memory + voice memory into context assembly with saliency-aware retrieval.
3. Integrate Author Goals into durable Studio project state.
4. Integrate Craft Lens into Editing Room and governed proposal review.
5. Build Knowledge Gap Radar from provenance-aware research and project-memory signals.
6. Strengthen Story Map with scene attributes, plotlines, character arcs, and continuity indicators.
7. Build Production Preview so formatting/export problems are caught before release.
8. Verify the complete running product on Chromebook and Android, including recovery and real configured AI providers.

## Definition of Complete

Forge is complete only when a real author can create or restore a project and carry it through the intended Studio journey — concept, architecture, canon, characters, research, manuscript, editing, visual work, cover, production, positioning, marketing, publishing preparation, delivery audit, and portable recovery — with durable state, real provider boundaries, author approval, truthful failures, and verified Chromebook/Android operation.
