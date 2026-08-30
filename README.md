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

Forge continuously learns from real working applications, current research, and open-source projects that share its capabilities. For each major capability:

**research → architecture → implementation → regression coverage → build/acceptance verification → README/build-history update → next capability.**

Recent benchmarking reinforces several principles: leading author tools emphasize persistent story context and character memory; FireQuill emphasizes scene-versioned character state, voice/arc continuity and author-approved extractor updates; Story Editor emphasizes reviewing newly written material and curating proposed memory before it becomes canon; Novel Studio AI combines structured story state, retrieval memory and continuity checks; and current research emphasizes time-aware story memory rather than relying on a static bible or embeddings alone.

Research is an engineering input, not permission to copy disconnected feature lists. Proven strengths are rebuilt natively around Forge's durable state, provenance, Project Brain, Book Genome, author control, proposal review, workflow gates, production, and recovery.

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
SALIENT CONTEXT + CAPABILITY-ROUTED MODEL
  ↓
AI DRAFT / EDIT → VOICE + CHARACTER + CONTINUITY GATES
  ↓
EDITORIAL ANALYSIS + CRAFT LENS + KNOWLEDGE GAP RADAR
  ↓
VISUAL / ILLUSTRATION / COVER
  ↓
BOOK GENOME + DOWNSTREAM IMPACT
  ↓
KDP PREFLIGHT + PRODUCTION
  ↓
MARKETING + PROMOTION ANALYTICS
  ↓
DELIVERY AUDIT
  ↓
PORTABLE PROJECT PACKAGE
```

## Mission 058 — Saliency-Aware Character Memory Retrieval

Forge's living Character Bible now has an application-integrated retrieval boundary that can supply **only the most relevant character state needed for a drafting task**, instead of dumping every character into every AI request.

`CharacterBibleService.memory()` provides:

- project-scoped character retrieval;
- optional character targeting;
- optional point-in-time historical reconstruction;
- field-scoped context selection;
- query-term relevance scoring;
- deterministic ranking and limits;
- human-readable evidence for why a character was selected;
- current emotional state and location when broad context is requested;
- defensive cloning so retrieval cannot mutate authoritative character state.

`assembleWritingContext()` consumes this saliency layer for the `characters` context section. Character context is restored through the authoritative Character Bible service, queried by task terms, ranked, limited, and emitted with relevance evidence and source IDs.

`AiWritingStudioService.generateWithProjectContext()` is now the governed Studio application boundary for Mission 058. It:

- loads the authoritative project immediately before generation;
- validates the real manuscript target;
- assembles character context from current project state;
- accepts explicit character targeting and historical `characterAsOf` context;
- applies deterministic character-memory limits;
- passes the assembled context and source IDs into the real AI writing coordinator;
- creates the same durable author-reviewable proposal as the existing AI loop;
- computes a fresh base-content hash so stale manuscript protection remains active.

The AI provider therefore receives a **salient character projection derived immediately from authoritative project state**, rather than a caller-supplied static character dump.

Regression coverage verifies the application boundary, including salient character selection, source-ID provenance, historical context, proposal creation, and existing author-approval/stale-content protections.

### Mission 058 completion gate

Mission 058 remains active until the live Studio route/provider execution is wired to this governed application boundary and CI/build verification proves the complete request path. The required final path is:

**Writing Desk request → authoritative project load → character retrieval → assembled context → real model/provider → durable proposal → character continuity evidence before application → author review.**

No subsequent mission is promoted until that path is proven.

## Mission 057 — Versioned Character State Memory

Forge's character system is moving beyond a static character bible toward a **living, scene-aware character memory**. The existing Character Bible stores a complete structured profile, field history, effective timestamps, reasons and actor attribution.

`src/domain/character-state-memory.ts` adds scene-specific snapshots, project/character ownership, sequence-ordered memory history, provenance, point-in-time state resolution, deterministic relevance ranking, changed-field attribution, and validation.

## Mission 056 — Author Voice Memory + Drift Preservation

Forge's voice system maintains an explicit approved author corpus with provenance, genre/purpose metadata, weighting, canonical sample selection, aggregated voice fingerprinting, interpretable voice dimensions, corpus updates, drift detection, reference matching, actionable recommendations, and reusable author-voice context.

**Design rule:** Forge learns from the user's own approved corpus and treats voice preservation as a constraint alongside canon, character state, continuity, meaning, and author intent.

## Mission 055 — Craft Lens Foundation

Forge has a deterministic Craft Lens domain/application boundary for targeted manuscript feedback instead of a single opaque “quality score.” It measures concrete signals and produces evidence plus multiple revision strategies. The lens never rewrites prose or declares stylistic choices objectively wrong.

## Mission 054 — Author Goals Foundation

Forge has a deterministic Author Goals foundation designed around authoritative manuscript progress rather than an isolated counter. It supports word, scene, chapter, daily/weekly/session/project goals and deterministic progress calculations.

## Mission 053 — Live Story Map

The Story Map is a live Studio planning surface derived from the existing durable book/chapter/scene hierarchy. It provides visual hierarchy, lifecycle status, completion, refresh behavior, and direct scene navigation without creating a second planning database.

## Mission 052 — Competitive Advantage Research

Forge converted competitive research into an implementation sequence:

1. Story Map.
2. Author Goals.
3. Knowledge Gap Radar.
4. Craft Lens.
5. Production Preview.
6. Collaboration Review.

## Mission 051 — Editing Room Proposal Review Diff

The Editing Room provides deterministic review of durable AI rewrite proposals. Authors can inspect line-level added/removed/unchanged content and before/after word counts. Approval remains separate from application, with server-side source-revision protection.

## Production, KDP and Promotion Benchmark

Forge is intentionally expanding beyond writing. Current all-in-one publishing products increasingly connect research, writing, editing, illustration, covers, formatting, publishing listings and promotion in one workflow. KDP-focused products emphasize print-ready EPUB/PDF output, full-wrap cover constraints, metadata and listing preparation.

Cover benchmarking reinforces that professional KDP output requires more than attractive artwork: trim, bleed, spine math, typography, barcode space and full-wrap export must be validated as production artifacts.

Forge's product goal is to connect these concerns to the same authoritative Book Genome and production state so metadata, cover, blurb, audience, launch plan, retailer readiness, and promotion evidence remain synchronized rather than becoming separate spreadsheets.

## CI / PWA Integrity

Canonical CI covers installation, build, tests, completion measurement, client syntax checks, browser acceptance, and mobile acceptance. The PWA shell remains separate from durable `/api/` project state.

## Current Build Priorities

1. **Finish Mission 058** — prove the live Studio/provider drafting path consumes saliency-aware character context and exposes character continuity evidence before proposal application.
2. Integrate Author Voice Memory into live AI drafting/proposal generation and make voice drift visible before application.
3. Build saliency-aware retrieval across character memory, canon, timeline, research, and author voice.
4. Integrate Author Goals into durable Studio project state.
5. Integrate Craft Lens into Editing Room and governed proposal review.
6. Build Knowledge Gap Radar from provenance-aware research and project-memory signals.
7. Strengthen Story Map with scene attributes, plotlines, character arcs, and continuity indicators.
8. Build Production Preview/KDP preflight so cover, trim, metadata, manuscript and export problems are caught before release.
9. Build promotion planning and measurement around audience, retailer, launch, discount, preorder and campaign goals.
10. Verify the complete running product on Chromebook and Android with real configured AI providers.

## Definition of Complete

Forge is complete only when a real author can create or restore a project and carry it through the intended Studio journey — concept, architecture, canon, characters, research, manuscript, editing, visual work, cover, production, positioning, marketing, publishing preparation, delivery audit, and portable recovery — with durable state, real provider boundaries, author approval, truthful failures, preserved author voice, coherent scene-versioned character memory, salient context retrieval, and verified Chromebook/Android operation.
