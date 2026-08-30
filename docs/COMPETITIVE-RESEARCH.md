# Author's Forge Competitive Product Research

**Date:** 2026-08-30
**Purpose:** Study proven author products, identify why their features work in practice, and convert the strongest patterns into a better Forge implementation without blindly copying products or code.

## Executive conclusion

Forge should not become a pile of every feature found in author software. The strongest products have a clear center of gravity:

- **Reedsy Studio:** low-friction author workspace, clean chapter navigation, collaboration, revision/comments, previews, goals, and professional EPUB/PDF output. citeturn0search0turn0search1
- **Plottr:** visual planning that makes scenes, plotlines, characters, places, filters, and timelines easy to see and rearrange.
- **Sudowrite:** Story Bible as an explicit source of truth for author and AI, plus localized rewrite tools rather than one giant generation command.
- **Atticus:** author-focused writing plus production formatting, preview, publishing exports, and recovery. citeturn0search14
- **KDP Cover Creator:** production constraints are built into the workflow rather than discovered after design. KDP publishes explicit cover requirements and currently identifies 2,560 × 1,600 pixels as ideal Kindle eBook dimensions. citeturn0search12turn0search8
- **BookBub:** promotion succeeds through audience-aware targeting, creative testing, budget/bid control, performance reporting, and iterative optimization; Featured Deals add editorial selection and retailer coordination. citeturn0search4turn0search6turn0search9

Forge's advantage should be the combination these products generally keep separate: **durable project truth + visual planning + grounded research + AI assistance + governed review + production + publishing readiness + measurable promotion**, all under author authority.

## What makes the proven products work

### Reedsy Studio — frictionless author workplace

Reedsy combines writing, planning Boards, goals/stats, collaboration, previews, version history, and PDF/EPUB production. Its strength is that an author does not have to assemble several tools merely to move from manuscript to publishable artifact. It also emphasizes automatic saving/sync and device flexibility. citeturn0search0turn0search1

**Forge response:** integrate goals, planning, review, preview, and production into the same durable project rather than creating disconnected counters or utilities. Forge should add canon/continuity impact, provenance, governed AI, and recovery.

### Plottr — visual cognition

The key pattern is spatial story reasoning: scenes, chapters, plotlines, characters, locations, timelines, filters, and relationships should be visible together.

**Forge response:** Story Map must grow from the authoritative chapter/scene model into scene attributes, plotlines, character arcs, continuity indicators, and durable reorder operations with impact analysis.

### Sudowrite — contextual AI

The important lesson is not merely AI generation. Story context and localized rewriting keep AI aligned with author intent.

**Forge response:** Project Brain/Book Genome should supply controlled context; selected text/scene actions should be local and constrained; consequential AI output remains a durable proposal with rationale, provenance, deterministic diff, review state, and explicit application.

### Atticus — production quality and recovery

Atticus combines writing with formatting and publishing output, and supports DOCX export and downloadable JSON snapshots for additional recovery. citeturn0search14

**Forge response:** Production Preview becomes a preflight layer: validate trim, pagination, front/back matter, headings, images, metadata, and output artifacts before delivery. Portable project packages remain restorable.

### Amazon KDP / Cover Creator — constraints first

KDP Cover Creator supports eBook, paperback, and hardcover covers with layouts, fonts, supplied/gallery images, and ISBN/barcode handling. KDP also publishes explicit file and dimension requirements. citeturn0search12turn0search8

**Forge response:** Cover Studio must calculate edition-aware dimensions, preserve title/author/series metadata, distinguish front-only from full-wrap designs, expose safe areas, and validate the actual artifact before release.

### BookBub — measurable promotion

BookBub provides Featured Deals plus self-serve Ads. Ads support author/category/retailer/region targeting, budget/bid controls, creative customization, and iterative performance optimization. citeturn0search4turn0search6

**Forge response:** Marketing should become a measurable campaign system: positioning → audience hypothesis → retailer/category evidence → creative variants → campaign plan → approval → performance capture → iteration. Forge must never invent sales, audience, or ad results; external integrations require real configured providers.

## Research directions

### Proactive knowledge-gap detection

Recent research explores inline knowledge-gap detection, source-anchored Knowledge Cards, and spatial knowledge canvases. The product lesson is that authors often do not know what they need to research until the system exposes a missing detail.

**Forge implementation:** detect candidate gaps → show author-visible signals → retrieve through governed research → create source/evidence/relevance cards → author promotes useful knowledge into durable memory → approved context becomes available to writing/AI.

### Feature-grounded narrative revision

Recent narrative-evaluation research argues for explicit writing/craft dimensions instead of generic holistic scores.

**Forge implementation:** measurable craft dimensions → concrete evidence → multiple revision strategies → proposal → deterministic diff → author decision.

## Promotion intelligence target

Forge should go beyond a generic marketing copy generator. A complete promotion workspace should connect:

- book positioning and audience promise;
- genre/category and comparable-author evidence;
- retailer metadata and keyword hypotheses;
- cover/creative variants;
- launch, preorder, discount, and backlist campaign plans;
- channel-specific copy;
- budget and bid assumptions;
- UTM/link attribution where configured;
- actual campaign metrics;
- experiment history and next-test recommendations.

BookBub demonstrates why targeting, testing, and feedback loops matter. citeturn0search6 Forge should make those loops project-aware and connect them back to the book's actual metadata, creative assets, and author-approved positioning.

## Competitive gap matrix

| Capability | Proven product strength | Forge target | Better Forge version |
|---|---|---|---|
| Writing | Reedsy clean editor | Existing Studio | Focus mode + scene context + goals + durable project truth |
| Planning | Plottr visual timeline | Story Map | Interactive map connected to canon and impact |
| Story Bible | Sudowrite | Project Brain/Book Genome | Controlled context visibility + provenance |
| AI rewrite | Sudowrite localized Rewrite | Governed proposals | Multiple craft strategies + diff + stale protection |
| Research | Research tools | Research Engine | Proactive gaps + source-anchored Knowledge Cards |
| Editing | AI/editorial tools | Craft Lens | Evidence-backed craft findings + proposals |
| Collaboration | Reedsy review | Collaboration domain | Suggestions/comments + authority model |
| Production | Reedsy/Atticus | Production domain | Live preview + preflight + delivery audit |
| Covers | KDP Cover Creator | Cover Studio | Edition constraints + artifact validation |
| KDP | Retailer requirements | Publishing readiness | Edition-aware metadata + preflight + evidence |
| Promotion | BookBub | Marketing domain | Targeting hypotheses + creative tests + measured feedback |
| Import | Reedsy/Atticus | Project package/import | Canonical normalization + provenance |
| Mobile | Browser/PWA tools | PWA | Offline shell + durable state + Android/Chromebook acceptance |
| Continuity | Plottr/Sudowrite organization | Project Brain/Genome | Cross-book impact + canon-aware routing |

## Build order

1. Author Goals durable Studio integration.
2. Craft Lens → Editing Room proposal workflow.
3. Knowledge Gap Radar → provenance-aware research workflow.
4. Story Map attributes/plotlines/arcs/continuity.
5. Production Preview / KDP-oriented preflight.
6. Cover Studio generation + edition validation.
7. Marketing intelligence and campaign planning.
8. Collaboration/review expansion.
9. End-to-end Chromebook/Android and real-provider verification.

**Rule:** research informs implementation; it never substitutes for functional proof.

External product names and research are references only. Forge does not copy proprietary code or assets.
