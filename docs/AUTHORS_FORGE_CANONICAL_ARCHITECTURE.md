# AUTHOR'S FORGE — CANONICAL ARCHITECTURE

**Status: LOCKED**

This document defines the canonical product/workplace architecture for Author's Forge. It refines the master product directive into the author's natural production journey. Existing working implementations must be preserved and reconciled into this structure; the architecture is not permission to rebuild functioning systems.

## Core Principle

The **Forge Brain is the trunk**. It is not an office the author visits and it must never be duplicated inside feature offices.

The shared trunk provides:

- Project Brain and durable project state
- hierarchical project, canon, story, character, timeline, location, style, series, decision, artifact and research memory
- author voice memory
- context assembly and token optimization
- AI provider/model registry and capability-aware routing
- quota/token protection, health, cooldown, reliability, latency and automatic failover
- agent/workforce orchestration
- research/knowledge infrastructure
- governance, provenance, approval and recovery
- shared document/layout/production contracts
- authentication/authorization
- shared API, jobs, streaming, PWA and device foundations

Every office consumes this same trunk. **Branches are product/workplace boundaries, not separate brains.**

## Author Journey

```text
FORGE BRAIN / CORE / TRUNK
          |
          v
AUTHOR DESK / PROJECT START / RESUME
          |
          v
01 IDEA OFFICE
   idea, genre, audience, format, premise, theme, goals
          |
          v
02 STORY DEVELOPMENT OFFICE
   concept, plot, structure, acts, storyline cards,
   chapter cards, scene cards, outline
          |
          +-----------------------+
          |                       |
          v                       v
03 CHARACTER OFFICE       04 WORLD + CONTINUITY OFFICE
   bios, relationships,       timeline, dates, locations,
   motivations, arcs,         technology, rules, canon,
   voice, visual identity    continuity
          |                       |
          +-----------+-----------+
                      v
05 WRITING OFFICE
   manuscript, chapters, scenes, drafting, rewrites,
   voice preservation, genre-aware writing
                      |
                      v
06 WORK TYPE / CREATION MODE
   novel | children's book | illustrated book | poetry |
   letter | self-help | educational workbook | journal |
   other supported book/product types
                      |
                      v
07 EDITOR'S OFFICE
   developmental | structural | line | copy | proof |
   dialogue | pacing | character | genre | continuity
                      |
              +-------+-------+
              |               |
              v               v
08 ART + ILLUSTRATION   09 SPECIALIZED CREATION
   characters, scenes,     COMIC BOOK ARTIST
   environments, maps,     greeting cards, birthday cards,
   references, styles,     invitations and future product modes
   visual continuity
              |               |
              +-------+-------+
                      |
             +--------+--------+
             |                 |
             v                 v
09B EDUCATIONAL        OTHER WORK TYPES
    WORKBOOK OFFICE
   activity banks,
   grade/subject/standards,
   exercises, answer keys,
   reproducible editions
             |                 |
             +--------+--------+
                      v
10 BOOK DESIGN / LAYOUT OFFICE
   interior layout, typography, page styles, margins,
   bleed, numbering, blank/lines/dot-grid/guided pages
                      |
                      v
11 COVER STUDIO
   front/back/spine, typography, artwork, genre direction,
   ebook/paperback/hardcover/series/boxed-set variants
                      |
                      v
12 PRODUCTION + KDP OFFICE
   trim-size profiles, paperback, hardcover, children's,
   comic, journal, workbook, EPUB/PDF, spine math, preflight
                      |
                      v
13 PROMOTION OFFICE
   positioning, description, blurb, keywords, categories,
   marketing plans, social/launch assets
                      |
                      v
14 PUBLISHING OFFICE
   metadata, platform requirements, final validation,
   release readiness
                      |
                      v
15 LIBRARY / VAULT / PROJECT STORAGE
   project, manuscripts, versions, assets, covers,
   production packages, metadata, backups, recovery
```

## Guided Journal Placement

Guided journals are a first-class creation mode and use the shared document/layout and production trunk. The Better Question series is supported by:

- Remember
- Discover
- Challenge
- Create
- Become
- Hope
- master prompt library
- cover-statement library
- deterministic/smart randomization
- no-repeat protection
- balanced category selection
- author-controlled pools
- reproducible seeds
- blank, lined, lightly lined, dot-grid and guided-response page styles
- durable page ordering and regeneration

## Educational Workbook Placement

Educational workbooks are a first-class creation mode with their own office while still consuming the shared Forge project, Brain, document/layout, production, publishing, promotion and recovery trunk.

The Educational Workbook Office owns:

- durable project-scoped activity banks;
- grade-band, subject, activity-kind, difficulty, standards/framework-id and tag metadata;
- validated answer truth for scored exercises;
- multiple-choice, short-answer, fill-in-the-blank, true/false, writing-prompt and math-practice workflows;
- author-defined learning objectives and directions;
- deterministic/reproducible seeded workbook editions;
- author-controlled source pools, filters and exclusions;
- balanced mixed-subject selection without claiming pedagogical certification;
- answer-key generation from actual stored answers;
- durable source-activity provenance and edition history;
- real printable PDF interior production before downstream KDP preflight.

Standards identifiers are organizational/review metadata, not automatic proof of standards alignment. The office must never invent an answer, alignment finding, provider result or production-readiness status. AI-generated educational content, if added, must flow through the shared real provider boundary and remain author-reviewable before it enters the durable activity library.

## Workflow Navigation Rule

The Studio should present the author with a **guided next step** so the normal path is sequential rather than forcing the author to jump between unrelated offices. Side trips remain possible for correction, research, continuity repair, asset changes or author-directed revisions, but the Forge must remember the return point and preserve workflow state.

A downstream office must consume upstream approved state rather than creating competing copies. Examples:

- Writing consumes approved story, character, world, timeline and voice state.
- Art consumes approved character/world/story state and visual identities.
- Educational Workbooks consume approved project intent and durable activity-bank state, then hand real edition/layout artifacts downstream.
- Covers consume project metadata, genre, positioning and approved visual direction.
- Layout consumes the manuscript or product interior and production profile.
- KDP production consumes the finalized layout, cover and metadata.
- Publishing consumes validated production artifacts.
- Vault stores the complete portable project state and recovery package.

## Git Organization Rule

Do not mechanically split every office into an isolated implementation. Use cohesive feature/office branches and integration branches while keeping `main` as the integration trunk.

```text
main
|
+-- core/*                 shared brain/trunk capabilities
+-- office/idea/*
+-- office/story/*
+-- office/characters/*
+-- office/world/*
+-- office/writing/*
+-- office/editor/*
+-- office/art/*
+-- office/comic/*
+-- office/cards/*
+-- office/journal/*
+-- office/workbooks/*
+-- office/layout/*
+-- office/cover/*
+-- office/production/*
+-- office/promotion/*
+-- office/publishing/*
+-- office/vault/*
+|
+`-- integration/*
```

The existing `mission-*` branches are source material for reconciliation. Do not delete or rewrite working capabilities merely to make branch names match this diagram. First compare, verify, preserve, then integrate.

## Engineering Sequence

Work **one capability at a time**, in canonical order. A capability is not considered complete until its existing implementation has been inspected, missing pieces are implemented, regression tests pass, build passes, and the live Studio/device path is verified where applicable. Then move to the next capability.

### Current priority: FORGE BRAIN / CORE / TRUNK

The first feature to complete under this locked architecture is the shared Forge Brain. It must establish and verify the durable infrastructure every later office depends upon before downstream offices are reorganized.

The core completion gate includes:

1. durable project state and recovery;
2. hierarchical memory and retrieval;
3. canon/provenance/approval boundaries;
4. author voice memory;
5. context assembly and token optimization;
6. AI provider/model registry;
7. capability-aware routing;
8. quota and token-limit protection;
9. health/cooldown/reliability/latency tracking;
10. truthful multi-provider/model failover;
11. agent/workforce orchestration;
12. research/knowledge integration;
13. governance and author authority;
14. shared artifact/version infrastructure;
15. shared API/job/streaming/device foundations;
16. production/layout contracts used by downstream offices.

**No downstream office is allowed to create a competing implementation of these core services.**

## Definition of Architectural Success

An author should be able to start at the Forge Brain, create an idea, proceed naturally through story development and supporting character/world systems, write and edit, create the appropriate visual/product assets — including first-class Educational Workbooks when that is the selected work type — format the finished work, prepare production files, promote and publish it, and finally restore the complete project from the Vault without losing context, provenance, decisions, assets or author control.
