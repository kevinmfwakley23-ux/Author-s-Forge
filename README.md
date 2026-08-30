# Author's Forge

**Author's Forge** is a local-first author workplace for taking books from idea to finished, edited, illustrated, produced, and publication-ready material.

## Locked Competitive-Benchmark Engineering Workflow

**Permanent rule:** Forge continuously learns from real, working applications and open-source projects that share its capabilities, then builds the strongest applicable ideas into Forge as better native implementations.

For every major capability the chief-engineering workflow is:

1. Identify the strongest working products, open-source projects, libraries, and proven UX patterns.
2. Study their actual workflow, UX, architecture, data model, persistence, provider boundaries, failure handling, recovery, accessibility, performance, and device behavior.
3. Compare those proven approaches against Forge's implementation and `AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md`.
4. Preserve proven strengths, reject weak patterns, and improve useful ideas rather than copying competitors blindly.
5. Implement the capability natively inside Forge's governed architecture.
6. Add deterministic, application/integration, and human/device regression coverage.
7. Run the canonical build and acceptance gates.
8. Immediately advance to the next highest-value capability.

Benchmarking is an engineering input, not permission to dilute Forge's architecture. Author authority, durable project state, real provider boundaries, proposal/review/apply safety, portability, Chromebook/Android targets, and the Master Product Directive remain authoritative.

The benchmark set should include direct competitors and adjacent best-in-class tools for long-form writing, outlining, research, knowledge retrieval, editing, versioning, visual planning, publishing, collaboration, accessibility, PWA/mobile behavior, and AI agent workflows. Current or future examples may include Novalist, Linetta, OpenWriter, xnovelist, Writer Studio, Scrivener, Atticus, Plottr, Sudowrite, and other relevant systems discovered during implementation. Their current behavior must be verified before being treated as evidence.

**Engineering objective:** make Forge better than the individual tools it learns from by integrating their strongest proven capabilities into one coherent author operating environment.

## Canonical Product Directive — READ THIS FIRST

**`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` is the canonical product contract and engineering source of truth.** It defines the complete target: concept → architecture → canon → characters → timeline → research → manuscript → editing → illustrations → cover → formatting → metadata → positioning → marketing → publishing preparation → portable archive/recovery.

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

A green unit-test suite is evidence, not proof. Every major capability must be reachable from Studio, read/write durable project state, survive reload/restart, participate downstream, report real errors, and have end-to-end coverage.

## Permanent Functional-Truth Rule

Every major capability is verified at three levels:

1. **Domain/contract** — deterministic services, persistence, validation, provider boundaries.
2. **Application** — real server, routes, state transitions, artifacts, errors, recovery.
3. **Human/device** — rendered Studio UI on supported Chromebook and Android environments.

Source-pattern tests alone are never end-to-end proof.

## Permanent Platform Targets

**Chromebook and Android are first-class product targets.** The primary architecture is one platform-neutral web application with reusable domain/application/API boundaries.

Requirements include responsive desktop/tablet/phone layouts, touch interaction, browser device APIs, PWA installability, conservative offline shell behavior, durable persistence independent of browser process state, portable recovery, and future-shell reuse.

The service worker may cache the application shell but must not cache `/api/` project data as durable state.

## Functional Reality Standard

Every visible Studio control must terminate in a durable state transition, real provider/service operation, deterministic calculation, real artifact, real navigation, or explicit actionable error. Buttons, forms, AI controls, image controls, exports, settings, and navigation may never merely appear functional.

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
WRITING DESK + PROJECT BRAIN
  ↓
EDITORIAL ANALYSIS
  ↓
VISUAL / ILLUSTRATION / COVER
  ↓
BOOK GENOME + DOWNSTREAM IMPACT
  ↓
MARKETING
  ↓
DOCX / PDF / EPUB PRODUCTION
  ↓
13-CATEGORY DELIVERY AUDIT
  ↓
PORTABLE PROJECT PACKAGE
```

The integrated product is expected to connect durable manuscript state, provider-backed AI writing/editing, typed and voice commands, collaboration modes, Character Bible, provenance-aware memory/research, editing analysis, voice fingerprinting, real image generation when configured, cover planning, Book Genome/impact analysis, document production, health reporting, portable export, and delivery audit.

## AI Context Optimization & Model Intelligence

Context efficiency is a first-class AI concern. Forge uses hierarchical context assembly, deduplication, protected structured data, deterministic compression before lossy methods, semantic caching where justified, token/cost governance, provider routing boundaries, and measurable optimization telemetry. Optimization fails open to authoritative context.

Forge's AI Model Broker direction is to discover actual model capability, context/output capacity, reasoning/vision/tool support, health, latency, quota/cost, and task requirements before selecting a real resource. Provider credentials never belong in manuscript/project state.

Approved optional intelligence boundaries include K.I.N.G.S., OmniRoute/OpenAI-compatible gateways, direct OpenAI, and local Ollama where configured and verified. Forge never claims a provider/model is available without runtime verification and never fabricates unavailable AI output.

## AI Proposal and Author-Controlled Mutation

AI changes are reviewable durable proposals, never silent manuscript/canon mutation. Proposals carry rationale, provenance, status, review state, and source-revision binding. Writing Desk and Editing Room expose deterministic line-level diffs and word-count impact before explicit author approval/application. Server-side revision protection remains authoritative against stale writes.

## Mission 052 — Competitive Advantage Research

Forge now treats competitive research as an active engineering input. Research compared proven patterns from products including Plottr and Sudowrite: Plottr's visual timelines, scene cards, scene stacks, plotlines, filters, story bibles, and series planning; Sudowrite's Story Bible source-of-truth model, localized rewrite workflow, outline/scene generation, and context-aware character/worldbuilding. citeturn0search0turn0search5turn0search3

The implementation rule is to import **capabilities and lessons, not disconnected feature copies**. Forge combines visual planning and Story Bible-like context with its durable project truth, canon controls, Project Brain, provenance, downstream impact, governed AI proposals, production, publishing, and recovery.

## Mission 053 — Story Map

The first competitive capability has been converted into a live Studio surface. The new `public/forge-story-map.js` creates a **Story Map** directly from `window.forgeWorkspaceState`, so the visual plan is derived from the same durable books, chapters, and scenes used by the manuscript editor. There is deliberately no second planning database.

The Story Map provides:

- visual book → chapter → scene hierarchy;
- scene lifecycle status;
- chapter completion percentage;
- book completion percentage;
- project totals for books, chapters, scenes, and completed-scene percentage;
- direct scene opening from the map into the Writing Desk;
- empty-state guidance when structure does not exist;
- live refresh when the workspace is refreshed;
- PWA shell inclusion for Chromebook/Android continuity.

This is the beginning of Forge's visual planning layer: future iterations will add richer scene attributes, plotlines, character arcs, filters, drag/reorder operations, and downstream canon/impact indicators while keeping the manuscript state authoritative.

The underlying deterministic domain/application foundation is `src/domain/story-map.ts` and `src/application/story-map.ts`, with regression coverage in `test/story-map.test.js` and `test/story-map-ui.test.js`.

## Mission 051 — Editing Room Proposal Review Diff

The Editing Room provides deterministic review of durable AI rewrite proposals. Authors can inspect line-level added/removed/unchanged content and before/after word counts. Approval remains separate from application, and server-side source-revision checks remain authoritative.

## CI and PWA Integrity

The canonical CI path includes build, tests, completion measurement, client syntax checks, browser acceptance, and mobile acceptance. The service worker is now `authors-forge-shell-v5` and includes the Story Map client while continuing to exclude `/api/` project data from caching.

## Delivery Standard

The goal is not to maximize the number of feature labels. The goal is to deliver the **best dependable author operating environment we can build**, using verified lessons from working products while preserving Forge's architecture and author-first principles.

## Current Build Rule

After every major capability:

**research → architecture → implementation → regression coverage → build/acceptance verification → README/build-history update → next capability.**

A capability is not declared complete merely because code was committed. The repository must prove the running behavior at domain, application, and human/device levels before the capability is considered production-ready.
