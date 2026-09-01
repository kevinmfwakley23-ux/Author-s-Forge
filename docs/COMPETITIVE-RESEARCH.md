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

---

## Intelligence update — 2026-09-01

This update establishes a standing engineering rule: **every substantial Author's Forge block should begin with a targeted competitive/technical research pass when current external patterns can materially improve the design.** Research should cover both production author applications and relevant open-source infrastructure. Findings must be classified as adopt now, adapt later, monitor, or reject; implementation still requires Forge-native design, tests, author-control review, and platform verification.

### Memory and context systems

**Graphiti / Zep temporal context graphs**
- Current pattern: temporal entities and facts retain validity windows and provenance instead of overwriting history.
- Retrieval combines semantic, keyword/BM25, and graph traversal signals.
- Incremental graph updates avoid full recomputation after every change.
- **Forge adaptation:** Project Brain should continue toward hybrid retrieval while preserving Forge's stronger explicit authority/lifecycle model. Relationship expansion must remain bounded, project-scoped, explainable, and provenance-backed.
- **Do not copy:** external graph-database dependence for the core product. Forge remains local/recoverable and must not require Neo4j or a managed cloud graph to write a book.

**Mem0 current memory architecture**
- Current pattern: durable fact extraction plus multi-signal retrieval using semantic, keyword, entity, and temporal signals; entity graph links boost retrieval rather than forcing graph-specific output shapes.
- Current managed graph memory automatically links memories through shared entities.
- **Forge adaptation:** add entity/alias-aware ranking and temporal intent as scoring signals, but keep author-promoted canon and explicit memory authority separate from inferred/project-working memory.
- **Do not copy:** silent inference that can become project truth. Forge's canon boundary remains author-controlled.

### Author-app intelligence

**Novelcrafter Codex — 2026 tracking controls**
- Novelcrafter added case-sensitive entry matching and excluded-phrase controls to reduce false positives for ambiguous names such as ordinary words or common modal verbs.
- It also supports cross-book Codex sharing, flexible context injection, custom prompt presets/components, personas, and local/external model providers.
- **Forge adaptation:** add per-entity matching policy (aliases, case sensitivity, excluded phrases, perhaps exact-only mode) to Project Brain/Character/World retrieval rather than relying only on generic lexical saliency.
- **Forge advantage target:** every match should expose why it was selected and which author-controlled entity/canon rule caused the match.

**Sudowrite Plugins**
- Current product pattern: composable custom AI tools can write, edit, analyze, consume Story Bible context, choose models, and run multi-stage workflows.
- **Forge adaptation:** long-term Forge extension architecture should expose governed capability modules/prompt recipes with explicit input context, provider policy, output type, approval requirement, and artifact destination.
- **Do not copy:** unrestricted prompt macros that can bypass canon or durable proposal review.

**Plottr 2026 direction**
- Plottr is deliberately emphasizing human-crafted planning rather than embedding AI, while continuing visual timelines, story/series bibles, family trees, offline use, cross-device access, synchronization, and collaboration.
- **Forge lesson:** AI is not the product center. The manual author workflow must remain first-class even when no AI provider is configured.
- **Forge adaptation:** keep visual planning and story-bible manipulation fully usable without AI; AI augments those workflows under author control.

### Local-first / collaboration infrastructure

**Yjs + y-indexeddb / Tiptap collaboration**
- Current pattern: local browser persistence can keep document state available offline, then synchronize only changes when network service returns.
- Yjs providers can be composed with local persistence and network synchronization; Tiptap builds collaborative editing/version features over Yjs.
- **Forge adaptation candidate:** evaluate a CRDT-backed manuscript editing layer for eventual multi-device/collaborative editing while retaining the canonical durable project store and explicit revision/audit boundaries.
- **Risk:** do not introduce a second hidden source of truth. Any CRDT layer must reconcile deterministically into Forge project state and preserve author-control/version evidence.

**Automerge local-first model**
- Current pattern: device-local application state remains primary, works offline, merges concurrent changes automatically, and retains change history/branching possibilities.
- **Forge adaptation candidate:** useful reference for future Chromebook ↔ Android multi-device continuity, especially when both devices edit while offline.
- **Decision:** monitor until the current single-author durable workflow is fully stable; collaboration must not destabilize the canonical manuscript/persistence model.

### Near-term engineering consequences

1. **001K:** runtime/type memory contracts become a single immutable source of truth.
2. **001L:** `createMemoryRecord` becomes a deliberate runtime trust boundary instead of assuming TypeScript-perfect callers.
3. **Next Brain candidate after Android's 001J:** entity-aware matching policy inspired by real Codex false-positive controls: aliases, case-sensitive matching, excluded phrases, and explainable evidence.
4. **Following retrieval candidate:** evaluate hybrid lexical/entity/temporal scoring without requiring an external graph or vector service.
5. **Later Studio architecture:** evaluate local-first CRDT collaboration only behind the existing durable project state and version-control contracts.
6. **Later extension architecture:** define safe composable Forge capabilities/prompt recipes that cannot mutate canon without explicit author approval.

### Research discipline

For each future substantial block:

1. inspect the current Forge implementation and tests first;
2. search current relevant author products and open-source systems;
3. record what works, what fails in practice, and what is changing;
4. prefer mechanisms with evidence over feature-count imitation;
5. check licensing and dependency cost before adopting code;
6. adapt the idea to Forge's author-control, local/recoverable, provider-neutral architecture;
7. prove the adaptation with focused tests plus full desktop/mobile acceptance;
8. update this research file when the finding changes product direction materially.

**Standing rule:** competitive intelligence is continuous input to engineering, not a one-time research phase and not permission to chase every trend.