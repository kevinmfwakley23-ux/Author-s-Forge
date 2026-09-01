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

## Build Progress Tracker — Current Source of Truth

This section is the **living engineering checkpoint** for what is finished, what exists as a foundation, and what is next. Update it whenever a major capability is verified or the active build target changes.

### ✅ Completed / verified major capability areas

- **Core local-first Studio foundation** — durable projects, browser application, Chromebook/Android targets, PWA shell boundary, project package/recovery foundations and CI acceptance gates.
- **Project Brain / canon memory foundation** — durable project memories, governed context assembly, provenance and author-controlled canon boundaries.
- **Manuscript and Writing Desk foundation** — durable book/chapter/scene workspace, real AI provider boundary, durable proposal/review behavior and author-controlled application.
- **Character Bible and living character-state foundation** — structured character profiles, versioned state/history and saliency-aware retrieval services.
- **Research and research-honesty foundations** — provenance-aware research records and explicit fact/inference/creative/uncertain distinctions.
- **Editing / Craft Lens foundations** — deterministic editorial analysis and author-reviewable proposal workflows without silent rewriting.
- **Cover Studio / KDP production foundations** — production geometry, cover planning and KDP preflight infrastructure.
- **Guided Journal Office — COMPLETE** — merged through PR #37 (`fe8125941b09159a57520ac39ecbdac040d322e2`) after build, unit, completion, desktop-browser, Guided Journal browser and Android/mobile acceptance passed.

### ✅ Guided Journal Office capability checklist

The Guided Journal Office now includes:

- six Better Question-compatible categories: **Remember, Discover, Challenge, Create, Become, Hope**;
- durable project-scoped master question and cover-statement libraries;
- author add/revise, enable/disable, remove and JSON import/export controls;
- deterministic single-question randomization;
- category filters, exclusions, reproducible seeds and balanced generation;
- no-repeat protection within an edition and across prior editions by default;
- durable edition ordering and restart-safe history;
- blank, lined, lightly-lined, dot-grid and guided-response page styles;
- trim size, margins, typography, prompt alignment, line/dot spacing, page numbering, category labels, front matter, closing matter and response-page controls;
- real print-PDF rendering with exact page count, byte length, SHA-256 and shared production validation;
- live page preview and PDF download;
- shared Project Brain context and production memory;
- shared AI/provider stack through `generateProjectText` with configured OmniRoute, 9Router, K.I.N.G.S., OpenAI and Ollama routing/failover;
- Brain-aware AI question proposals with explicit author approval before library promotion;
- Brain-aware AI cover direction and back-cover copy;
- direct `BookCoverStudioService` handoff using the journal's actual rendered page count/trim geometry for cover/spine calculations;
- responsive dedicated journal workplace with Chromebook and Android launch paths;
- real-browser regression coverage for durable library, randomizer, edition generation, lined PDF bytes, AI proposal/approval, cover geometry, restart persistence and phone-sized touch/overflow.

### 🟡 Active next build — Specialized Creation Office

**Research lock is complete.** The implementation contract is [`docs/MISSION-059-SPECIALIZED-CREATION-OFFICE.md`](docs/MISSION-059-SPECIALIZED-CREATION-OFFICE.md). Specialized Creation implementation must follow its requirement IDs, phase gates, research adoption ledger, ADR triggers, verification matrix and anti-drift rules. The reusable format for future major work is [`docs/ENGINEERING_MISSION_TEMPLATE.md`](docs/ENGINEERING_MISSION_TEMPLATE.md).

The Specialized Creation Office is **not starting from zero**. Domain/workflow/production foundations already exist for exactly these six canonical modes:

1. **Comic books**
2. **Greeting cards**
3. **Birthday cards**
4. **Invitations**
5. **Flyers**
6. **Trading card game cards**

Existing foundations already define specialized creation identity, production dimensions/bleed, and the shared workflow:

**brief → plan → create → review → production**

The next engineering phase is to turn those foundations into a complete live office. Completion requires:

- durable specialized-project/application services and restart-safe storage;
- Project Brain connection and shared AI-provider access rather than a separate AI silo;
- shared illustration/image-generation integration where appropriate;
- author-controlled AI proposals and revisions;
- real mode-specific editors/workflows for all six creation types;
- comic page/panel/script/lettering/asset workflows;
- greeting/birthday card front/inside/back composition and fold/print handling;
- invitation event-information, hierarchy, layout and production workflows;
- flyer content hierarchy, image/text layout, bleed/safe-area and export workflows;
- trading-card-game template, card data, rules/stat fields, fronts/backs, set/deck consistency and sheet/export workflows;
- real production artifacts rather than preview-only controls;
- integration with shared Brain, visual/illustration capabilities, Cover/production systems where applicable;
- responsive live Studio surface with Chromebook and Android touch support;
- domain, application, browser and mobile acceptance proving every major path.

**Guided journals remain a separate completed office and must not be folded into Specialized Creation.**

#### 🟡 Mission 059D phone lane — comic hardening checkpoint

Phone work is stacked on PR #38 and **reuses its existing Specialized Creation trunk and comic implementation** rather than creating a second comic stack. The phone-owned delta is intentionally isolated to comic-specific application/test/coordination files.

Current verified progress:

- **SC-COMIC-003–011 advanced** — inherited LTR/RTL and stable panel IDs are preserved; comic-only hardening adds renderer-independent normalized panel geometry, page/panel pacing and page-turn intent, semantic lettering linked to structured dialogue/captions/SFX, speaker/tail/read-order validation, comic structural preflight, explicit shared-Brain continuity-context needs, and non-destructive panel art candidates.
- **SC-COMIC-012–014 production proof advanced** — comic physical profiles are versionable without mutating the inherited profile; print PDF and ordered zero-padded CBZ artifacts are proven against the same durable comic document revision and production profile.
- Forge CI #599 verify job passes build, the complete unit suite including the phone comic production tests, completion measurement and client/Termux syntax checks.
- Full Mission 059D completion is **not** claimed. SC-COMIC-015 live comic acceptance and remaining production/device proof still require green browser/mobile gates.

Current cross-lane blockers/findings handed to Chromebook/shared 059B/059I ownership:

- the canonical browser gate currently stops in the shared TCG finishing acceptance because `type-c1` is composed as an empty required text element; phone is not editing that non-comic fixture/composer;
- the shared PNG renderer independently caps both output dimensions at 1800 px, which can distort standard comic aspect ratio and prevents true profile-DPI high-resolution page-image output. This remains an explicit shared production-renderer gap for SC-COMIC-014 rather than a phone-created competing rasterizer.

Phone branch/PR: `office/comic/mission-059d-hardening` / PR #39. Detailed lane evidence is recorded in `docs/MISSION-059D-PHONE-LANE.md`.

### 🟡 Remaining cross-Forge integration / hardening

These areas have foundations or substantial implementation but still require continued integration/hardening before the entire Author's Forge product is considered complete:

- finish the Mission 058 live Writing Desk/provider path so saliency-aware character context is proven end-to-end in ordinary drafting;
- integrate Author Voice Memory and visible drift checks into live AI drafting/proposal application;
- extend saliency-aware retrieval across character memory, canon, timeline, research and author voice;
- continue Author Goals, Craft Lens, Knowledge Gap Radar and Story Map integration/hardening;
- strengthen full-product production preview/KDP, metadata, export and delivery-audit flows;
- complete marketing/promotion planning and measurement workflows;
- complete final cross-office navigation/workflow consolidation;
- perform the planned UI/UX redesign after functional office capability is in place, without weakening durable behavior;
- verify complete end-to-end author journeys on Chromebook and Android with real configured providers.

### Current build order

1. **Execute Mission 059 phases 059B–059J and finish Specialized Creation Office** across all six locked modes.
2. Close remaining cross-Forge live-integration gaps and acceptance gates.
3. Complete production/marketing/delivery hardening.
4. Remodel and polish the overall Studio UI/UX once capability coverage is stable.
5. Run full-product Chromebook + Android release acceptance.

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

Mission 058 remains active as a cross-Forge integration item until the live Studio route/provider execution is wired to this governed application boundary and CI/build verification proves the complete request path. The required final path is:

**Writing Desk request → authoritative project load → character retrieval → assembled context → real model/provider → durable proposal → character continuity evidence before application → author review.**

This no longer blocks completion of independent offices; it remains explicitly tracked above under cross-Forge integration/hardening.

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

## Definition of Complete

Forge is complete only when a real author can create or restore a project and carry it through the intended Studio journey — concept, architecture, canon, characters, research, manuscript, editing, visual work, cover, production, positioning, marketing, publishing preparation, delivery audit, and portable recovery — with durable state, real provider boundaries, author approval, truthful failures, preserved author voice, coherent scene-versioned character memory, salient context retrieval, and verified Chromebook/Android operation.
