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

Recent research reinforces several principles: leading author tools emphasize persistent story context and character memory; current research shows heavy AI rewriting can erase measurable authorship signals; new mixed-initiative systems show the value of proactive knowledge-gap discovery while keeping narrative synthesis with the author; and interpretable author-personalization research suggests steering across explicit stylistic dimensions rather than relying on an opaque “write like me” prompt. citeturn0news36turn0academia65turn0academia67turn0academia68

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

## Mission 056 — Author Voice Memory + Drift Preservation

Forge's voice system is designed around a critical product promise: **AI assistance must not gradually erase the author's authorship signals.** Recent research found that heavy AI rewriting can substantially reduce measurable authorship attribution, making voice preservation a real engineering problem rather than a cosmetic prompt feature. citeturn0academia65

Forge now maintains an explicit approved author corpus rather than a single style prompt. `src/domain/author-voice-memory.ts` provides:

- multiple approved writing samples;
- sample provenance (`author` or `approved-manuscript`);
- optional genre and purpose metadata;
- weighted samples and canonical sample selection;
- an aggregated voice fingerprint;
- interpretable voice dimensions for sentence rhythm, vocabulary, dialogue, description, emotional intensity, and narrative distance;
- corpus updates without losing sample provenance;
- deterministic voice-drift assessment;
- nearest-reference sample matching;
- actionable drift warnings and revision recommendations;
- reusable author-voice context for governed AI generation.

`src/application/author-voice-memory.ts` enforces the project/author ownership boundary so one author's voice corpus cannot accidentally be applied to another project or author.

**Design rule:** Forge never tells an AI to imitate another named author. It learns from the user's own approved corpus and treats voice preservation as a constraint alongside canon, character state, continuity, meaning, and author intent.

The next integration target is the live AI drafting pipeline: retrieve the most relevant voice references, generate a proposal through a capability-appropriate model, assess voice drift before application, and surface a transparent voice report alongside the manuscript diff.

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

Forge is intentionally expanding beyond writing. Current KDP guidance emphasizes cover quality at thumbnail size, manuscript quality, production constraints, and platform-specific publishing resources. KDP also provides Author Central, advertising, promotions, preorders, gifting, expanded distribution, A+ content and other marketing mechanisms. citeturn0search1turn0search2turn0search5turn0search15

BookBub demonstrates the value of goal-specific promotion, targeted advertising, reader-following infrastructure, new-release alerts, and curated promotional opportunities. Reedsy's current author-marketing guidance similarly emphasizes building author identity and reader relationships before launch and stacking complementary promotion channels. citeturn0search4turn0search6turn0search0

Forge's product goal is to connect these concerns to the same authoritative Book Genome and production state so metadata, cover, blurb, audience, launch plan, retailer readiness, and promotion evidence remain synchronized rather than becoming separate spreadsheets.

## CI / PWA Integrity

Canonical CI covers installation, build, tests, completion measurement, client syntax checks, browser acceptance, and mobile acceptance. The PWA shell remains separate from durable `/api/` project state.

## Current Build Priorities

1. Integrate Author Voice Memory into live AI drafting/proposal generation and make voice drift visible before application.
2. Build a versioned Character Engine with scene-by-scene state, relationships, goals, knowledge, arc trajectory, and author-approved state changes.
3. Build saliency-aware retrieval across character memory, canon, timeline, research, and author voice.
4. Integrate Author Goals into durable Studio project state.
5. Integrate Craft Lens into Editing Room and governed proposal review.
6. Build Knowledge Gap Radar from provenance-aware research and project-memory signals.
7. Strengthen Story Map with scene attributes, plotlines, character arcs, and continuity indicators.
8. Build Production Preview/KDP preflight so cover, trim, metadata, manuscript and export problems are caught before release.
9. Build promotion planning and measurement around audience, retailer, launch, discount, preorder and campaign goals.
10. Verify the complete running product on Chromebook and Android with real configured AI providers.

## Definition of Complete

Forge is complete only when a real author can create or restore a project and carry it through the intended Studio journey — concept, architecture, canon, characters, research, manuscript, editing, visual work, cover, production, positioning, marketing, publishing preparation, delivery audit, and portable recovery — with durable state, real provider boundaries, author approval, truthful failures, preserved author voice, coherent character memory, and verified Chromebook/Android operation.
