# Author's Forge Competitive Product Research

**Date:** 2026-08-30
**Purpose:** Study proven author products, identify why their features work in practice, and convert the strongest patterns into a better Forge implementation without blindly copying products or code.

## Executive conclusion

Forge should not try to become a pile of every feature found in author software. The products that work best have a clear center of gravity:

- **Reedsy Studio:** low-friction author workspace, clean chapter navigation, collaboration, revision/comments, previews, and professional EPUB/PDF output.
- **Plottr:** visual planning that makes scenes, plotlines, characters, places, filters, and timelines easy to see and rearrange.
- **Sudowrite:** Story Bible as an explicit source of truth for both author and AI, plus localized rewrite tools rather than forcing every task through one giant generation command.
- **Atticus:** author-focused writing plus production formatting, with the ability to move an existing manuscript into a publishing workflow.
- **KDP Cover Creator:** production constraints are built into the workflow rather than discovered after the design is finished.
- **Recent research:** proactive knowledge-gap detection and source-anchored knowledge cards can help authors discover missing domain knowledge while preserving author control; feature-grounded story evaluation can make revision more specific than generic "make it better" prompts.

Forge's advantage should be the combination these products generally keep separate: **durable project truth + visual planning + grounded research + AI assistance + governed review + production + publishing readiness**, all under author authority.

## What makes the proven products work

### 1. Reedsy Studio — frictionless author workplace

Reedsy emphasizes a clean editor, chapter sidebar, writing goals, import, flexible Boards, real-time collaboration, tracked changes/comments, previews, and direct EPUB/PDF production. Its core product succeeds because the author does not have to assemble multiple tools just to move from manuscript to publishable artifact. Reedsy also keeps the interface approachable rather than exposing every advanced capability at once.

**Forge import/adaptation:**

- add a first-class writing-progress surface with daily/weekly goals and history;
- make chapter navigation and scene navigation extremely fast;
- strengthen collaborator/editor review with explicit suggestions/comments rather than unrestricted mutation;
- provide a read-only manuscript preview mode with scoped/expiring access when collaboration infrastructure is ready;
- make production preview part of the writing workflow, not a final afterthought.

**Forge improvement:** unlike a simple editor, every change remains connected to Project Brain, canon, provenance, workflow stage, and the proposal/review ledger. A collaborator suggestion should be evidence and a candidate, not silent truth.

Sources: Reedsy Studio public product pages and 2026 comparison material.

### 2. Plottr — visual cognition

Plottr's strength is not merely having a timeline. It makes story structure spatial: scene cards, plotlines, character arcs, chapter stacks, filters, custom attributes, tags, images, and series views can be rearranged and inspected at a glance.

**Forge import/adaptation:**

- build a real visual Story Map over the existing chapter/scene model;
- filter scenes by character, location, plotline, POV, timeline, status, and unresolved thread;
- drag/reorder scenes while preserving authoritative manuscript identity;
- surface continuity conflicts and downstream impacts directly on scene cards;
- give series writers one visual view above individual books.

**Forge improvement:** Plottr is primarily an organization/visualization layer. Forge can connect the visual map to Project Brain, canon, research evidence, AI context selection, workflow gates, and impact analysis.

### 3. Sudowrite — AI grounded in a story source of truth

Sudowrite's Story Bible explicitly exists to keep both author and AI organized and on track. It supports structured story elements, worldbuilding, characters, visibility controls, and importing character information from existing material. Its Rewrite tool operates on highlighted text and offers targeted transformations such as rephrase, shorter, more descriptive, and show-not-tell.

**Forge import/adaptation:**

- make Project Brain/Book Genome behave as a true source-of-truth layer for AI context;
- expose localized AI actions on selected text/scene rather than only whole-scene generation;
- add reusable rewrite intents with explicit scope and constraints;
- allow authors to control which canon/memory elements an AI action can see;
- retain every AI candidate as a durable proposal with a deterministic diff.

**Forge improvement:** Forge should go further on provenance, stale-write protection, proposal review, canon locking, and evidence. AI can suggest; it cannot silently become canon.

### 4. Atticus — production quality close to the writing surface

Atticus combines writing with book formatting and emphasizes importing existing work and producing professional publication layouts. Its strength is reducing the gap between "manuscript complete" and "book ready."

**Forge import/adaptation:**

- production preview directly beside manuscript workflow;
- stronger import normalization for existing drafts;
- persistent front/back matter and publishing metadata;
- format validation before export;
- format-specific warnings before a book reaches the delivery gate.

**Forge improvement:** use Forge's Book Genome and Delivery Audit to make production requirements traceable to the exact book state, cover, metadata, and manuscript revision.

### 5. KDP Cover Creator — constraints first

Amazon KDP's Cover Creator takes book details, layouts, fonts, and uploaded/gallery imagery and incorporates publishing information such as ISBN/barcode areas. The important lesson is that output constraints are part of the design workflow.

**Forge import/adaptation:**

- calculate dimensions from trim size, binding, interior type, paper, and page count;
- keep safe zones and required publishing areas visible during design;
- validate the actual cover artifact before release;
- connect cover state to publishing metadata and delivery audit.

**Forge improvement:** Forge can make cover validation part of the same governed Book Genome rather than a disconnected design utility.

## New research worth building into Forge

### Proactive knowledge-gap detection

A 2026 research system, VeriForge, explores proactive inline highlighting of potential knowledge gaps, paired with source-anchored Knowledge Cards and a spatial Knowledge Canvas. The important product lesson is that authors often do not know what they need to ask until the system points out a missing detail.

**Forge implementation direction:**

1. detect candidate factual/domain knowledge gaps while drafting;
2. mark them as review signals, never as automatic corrections;
3. retrieve sources through the existing governed research boundary;
4. create a Knowledge Card containing claim, source, evidence strength, and project relevance;
5. let the author pin/promote useful knowledge into durable project memory;
6. allow AI writing to consume only approved/appropriate research context.

This should become a first-class Forge research workflow, not an AI hallucination layer.

### Feature-grounded narrative revision

The 2026 CraftAlign research argues for evaluating explicit writing/narrative features and using those features to guide revision instead of relying only on generic holistic scores. It highlights problems such as cliché, over-explanation, formulaic progression, and stereotyped endings.

**Forge implementation direction:**

- expand editorial findings into measurable craft dimensions;
- show authors why a passage was flagged;
- offer multiple revision strategies rather than one authoritative rewrite;
- compare proposed revisions against the selected craft objective;
- keep the author in control of the final choice.

Forge already has a deterministic intelligent-editing foundation and governed AI editing proposals. This research strengthens the direction: **specific editorial evidence → targeted candidate → deterministic diff → author decision**.

## Competitive gap matrix

| Capability | Proven product strength | Forge target | Better Forge version |
|---|---|---|---|
| Writing | Reedsy clean editor | Existing Studio | Focus mode + scene context + goals + durable project truth |
| Planning | Plottr visual timeline | Book/scene model exists | Interactive Story Map connected to canon and impact |
| Story Bible | Sudowrite source of truth | Project Brain/Book Genome | Author-controlled context visibility + provenance |
| AI rewrite | Sudowrite localized Rewrite | Governed proposal system | Multiple craft strategies + diff + stale protection |
| Research | Research tools vary | Research Engine exists | Proactive knowledge gaps + source-anchored Knowledge Cards |
| Editing | AI/editorial tools | Intelligent Editing exists | Feature-grounded craft analysis + evidence-backed proposals |
| Collaboration | Reedsy real-time editing | Collaboration domain exists | Suggestion/comment/review authority model |
| Production | Reedsy/Atticus | Production domain exists | Live preview + validation + delivery audit |
| Covers | KDP constraints/templates | Cover Studio exists | Constraint-aware design + artifact validation |
| Import | Reedsy/Atticus | Project package/import work exists | DOCX/ODT/project import with canonical normalization |
| Mobile | Reedsy mobile web / Plottr web | PWA exists | Offline shell + durable state + Android/Chromebook acceptance |
| Continuity | Plottr/Sudowrite organization | Project Brain/Genome | Cross-book impact + canon-aware AI routing |

## Mission 052 — Competitive Advantage Build

The next competitive build order is deliberately limited to improvements that strengthen the core author loop:

1. **Story Map:** visual chapter/scene timeline with filters and scene attributes.
2. **Author Goals:** daily/weekly writing goals, progress history, and manuscript momentum without replacing the manuscript as source of truth.
3. **Knowledge Gap Radar:** author-visible research signals that can become source-anchored Knowledge Cards.
4. **Craft Lens:** feature-grounded editorial dimensions and multi-strategy rewrite proposals.
5. **Production Preview:** make final-format validation visible before release.
6. **Collaboration Review:** comments, suggestions, scoped access, and author-controlled acceptance.

The implementation order is not "copy the competitors." It is to take the interaction patterns that reduce friction and connect them to Forge's stronger architecture.

## Design rule

Do not import a feature merely because another product has it. Import the **reason it works**:

- reduce cognitive load;
- keep the next useful action obvious;
- preserve direct manipulation where visualization helps;
- keep AI local to the author's current intent;
- make source truth explicit;
- make review reversible;
- make production constraints visible early;
- make persistence and recovery invisible but dependable.

## Sources

- Reedsy Studio: https://reedsy.com/studio/
- Reedsy Studio formatting: https://reedsy.com/studio/format-a-book/
- Reedsy Studio collaboration: https://reedsy.com/studio/resources/collaborative-writing-tools/
- Plottr features: https://plottr.com/features/
- Plottr timeline: https://docs.plottr.com/article/54-timeline-overview
- Sudowrite Story Bible: https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC
- Sudowrite Rewrite: https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/rewrite/9hkeezeUsCiUCG4dRdEqjS
- Atticus: https://www.atticus.io/
- KDP Cover Creator: https://kdp.amazon.com/en_US/help/topic/G201113520
- CraftAlign: https://arxiv.org/abs/2608.01377
- VeriForge: https://arxiv.org/abs/2608.09698

External product names and research are references only. Forge does not copy proprietary code or assets.
