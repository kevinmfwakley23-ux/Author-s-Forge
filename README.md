# Author's Forge

**Author's Forge** is a local-first author workplace for taking books from idea to finished, edited, illustrated, produced, and publication-ready material.

It is intended to support children's books, memoir, psychological thrillers, guided journals, comic books, training manuals, novels, and future long-form projects without replacing the author's authority.

## Canonical Product Directive — READ THIS FIRST

**`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` is the canonical product contract.** It is checked into this repository and is the engineering source of truth.

The directive defines the complete target: concept → architecture → canon → characters → timeline → research → manuscript → editing → illustrations → cover → formatting → metadata → positioning → marketing → publishing preparation → portable archive/recovery. It explicitly calls for hierarchical memory, anti-drift controls, relationship-aware memory, voice input, five AI collaboration modes, a Book Genome, real provider boundaries, and an author-controlled publishing workflow.

## Locked Product-Build Direction — 2026-08-30

The Forge will now be developed as a **single integrated professional authoring and publishing studio**, not as a collection of disconnected feature screens. Competitive research across open-source projects, web authoring applications, AI writing products, ebook/publishing tools, and Android writing applications establishes the following product direction.

### Competitive synthesis — use concepts, never copy implementations

Forge will deliberately study and learn from strong products and projects in these areas:

- deep manuscript/project organization and durable writing workflows;
- visual story planning, timelines, cards, arcs, and structural navigation;
- AI-assisted drafting, rewriting, brainstorming, and editorial collaboration;
- connected notes, knowledge graphs, references, and project research;
- professional ebook/print production and export;
- distraction-free and mobile-first writing;
- publishing metadata, positioning, market research, and promotion workflows.

The engineering rule is **conceptual synthesis, not code transplantation**. Third-party implementations are reference material unless their licenses and compatibility explicitly permit reuse. Forge's architecture, contracts, project state, and author-control rules remain authoritative.

### The target experience

Forge is being built to combine the strongest useful characteristics of specialist tools into one coherent workflow:

```text
Scrivener-class project structure
        +
Plot/tracks-class story architecture
        +
Professional book-production/export
        +
AI writing/editorial assistance
        +
Connected project knowledge
        +
Fast Chromebook/Android writing
        +
Forge Canon + Book Genome + Project Brain
        +
K.I.N.G.S. capability escalation
        +
OmniRoute/resource routing and token optimization
        ↓
ONE AUTHOR'S FORGE WORKPLACE
```

Forge must not merely imitate any competitor. It must eliminate the need for an author to stitch together separate applications for planning, writing, research, editing, visual continuity, illustration, cover design, production, marketing, and publishing preparation.

### Locked build sequence

All major implementation work should converge on this sequence:

```text
AUTHOR
  ↓
UNIFIED WRITING COCKPIT
  ↓
PROJECT BRAIN + MINIMAL RELEVANT CONTEXT
  ↓
CONTEXT OPTIMIZATION / TOKEN CONTROL
  ↓
AI RESOURCE DISCOVERY
  ↓
CAPABILITY + HEALTH + COST + QUOTA ROUTING
  ↓
K.I.N.G.S. / OMNIROUTE / LOCAL / DIRECT PROVIDER
  ↓
REAL AI RESULT
  ↓
AUTHOR-CONTROLLED PROPOSAL / EDIT / ARTIFACT
  ↓
CANON + BOOK GENOME + MEMORY UPDATE
  ↓
DOWNSTREAM IMPACT ANALYSIS
  ↓
VISUAL / COVER / PRODUCTION
  ↓
MARKETING + POSITIONING
  ↓
PUBLICATION AUDIT
  ↓
PORTABLE PROJECT PACKAGE
```

The immediate engineering priorities are:

1. **Unified writing cockpit** — manuscript, outline, relevant canon, characters, research, and unresolved threads available together without losing the writing surface.
2. **Visual story architecture** — timeline, scenes, arcs, POV, characters, conflicts, dependencies, and story navigation.
3. **Context-aware AI** — retrieve only task-relevant project knowledge while preserving provenance and author control.
4. **AI resource intelligence** — discover, verify, score, route, execute, observe, and safely fall back across K.I.N.G.S., OmniRoute, local models, and direct providers.
5. **Token/cost efficiency** — deduplication, retrieval markers, safe compression, tool-output filtering, relevance selection, progressive aging, and other proven optimization concepts while preserving code, URLs, structured data, and canonical text byte-perfect where required.
6. **Author-grade editorial intelligence** — developmental, continuity, line, copy, proofreading, dialogue, pacing, character, genre, and structural analysis with evidence-backed proposals rather than destructive automatic edits.
7. **Visual continuity** — reference images, character identity, age progression, wardrobe, environment, scene art, and reusable canonical assets.
8. **Professional production** — validated DOCX, PDF, EPUB, KDP-ready covers, metadata, and publication audits.
9. **Promotion pipeline** — evidence-backed positioning and reusable promotional material derived from the actual project.
10. **Chromebook/Android excellence** — responsive, touch-friendly, keyboard-friendly, voice-capable, resilient writing with the same platform-independent project state.
11. **Offline resilience and recovery** — local-first persistence, safe project packages, restart recovery, explicit sync/storage boundaries, and no cloud service becoming the source of truth.
12. **End-to-end completion** — continuously test a real project through idea → book → edited manuscript → artwork → cover → production → publishing preparation.

### AI architecture target

The AI subsystem must mature from a provider selector into a real resource broker:

```text
TASK
 ↓
TASK REQUIREMENTS
 ↓
PROJECT BRAIN
 ↓
MINIMAL RELEVANT CONTEXT
 ↓
CONTEXT OPTIMIZER
 ↓
RESOURCE DISCOVERY
 ↓
CAPABILITY NORMALIZATION
 ↓
HEALTH / LATENCY / QUOTA / COST
 ↓
ROUTING SCORE
 ↓
REAL PROVIDER OR EXTERNAL AI RESOURCE
 ↓
STREAM / TOOL / RESULT NORMALIZATION
 ↓
TELEMETRY
 ↓
AUTHOR APPROVAL BOUNDARY
```

No fake models, fake quotas, fake free tokens, fabricated provider responses, or unsupported availability claims are permitted. Free/low-cost routing is valuable only when the connected resource actually reports that capability or the configured user-owned service makes it available.

### Continuous competitive engineering

Competitive discovery is now an ongoing engineering input. Before major milestones, investigate relevant GitHub repositories and current web/Android products for proven concepts in authoring, planning, AI assistance, editing, memory, visual workflows, publishing, mobile UX, and production. Record useful findings in this README, then adapt them to Forge's canonical architecture and verify the resulting behavior.

The goal is not to win a feature checklist. The goal is to make **the complete author workflow materially better because the systems work together**.

## Current Engineering Discoveries — 2026-08-28

- **Real browser acceptance is the product gate.** The Studio acceptance harness uses Playwright-managed Chromium and exercises the rendered application rather than merely checking source files.
- **Navigation acceptance is correctly scoped.** The branded AUTHOR'S FORGE link also carries `data-route="dashboard"`; route enumeration and route clicks are therefore scoped to `nav a[data-route]` so the acceptance contract represents the actual navigation menu.
- **The Chromebook browser gate has passed the core Studio workflow.** The verified run covered all 18 routes, project/book/chapter/scene creation, manuscript save/reload, honest AI-provider failure, and health checks.
- **Character Bible and canon-memory acceptance is wired into the real browser harness.** The harness creates a structured character through the visible Character Bible form, creates an authoritative story-canon memory through the visible World/memory form, saves manuscript content, reloads the application, and verifies persistence. The next required Chromebook execution gate is the expanded harness run.
- **Character records now have explicit historical semantics.** The domain supports attributable field versions, effective timestamps, reasons, author/system actors, historical reconstruction, and complete change enumeration. A new regression suite locks these rules so future changes cannot silently destroy character continuity.
- **Character update behavior is already available through the real Studio server boundary.** `PUT /api/projects/:projectId/characters/:characterId` applies validated changes to the durable project record. The next product-level step is exposing that editing/history capability through the visible Character Bible workflow and proving it through Chromium.
- **Reference-image generation has a real provider boundary.** Selected PNG/JPEG/WebP references are uploaded to the durable project reference path and passed to the real image-edit provider boundary. Missing provider credentials fail honestly. A configured-provider browser run remains required to prove an actual edited-image artifact.
- **Generated output is not product proof.** `dist/` is build output; `.forge-data/` is local runtime state. Neither replaces source implementation or browser acceptance evidence.

## Chief engineering standard

Forge is being built as a real author workplace, not a mission gallery or collection of promises. Real implementation, real persistence, real provider boundaries, honest failures, author control, and end-to-end verification are non-negotiable.

A capability is complete only when it is reachable from Studio, performs the promised operation, persists where durability is promised, survives reload/restart where applicable, reports real errors, and has regression coverage.

## Required functional verification levels

Every meaningful Studio capability is verified at the strongest applicable level:

1. Static wiring
2. Unit/domain behavior
3. Server/HTTP behavior
4. Browser/UI behavior
5. Persistence
6. Reload/restart recovery
7. Provider behavior
8. Artifact validity
9. End-to-end workflow participation

The acceptance rule is the lowest failed level, not the highest passed level.

## Continuous Discovery & README Ledger

Whenever a meaningful discovery is made about repository state, product progress, environment capability, verification gaps, integration needs, or an observed failure mode, record it here before the checkpoint is considered complete.

The mandatory cycle is:

```text
DISCOVERY / CHANGE
      ↓
EVIDENCE
      ↓
README LEDGER UPDATE
      ↓
IMPLEMENTATION
      ↓
FUNCTIONAL VERIFICATION
      ↓
RECORD REMAINING GAPS
      ↓
COMMIT
```

## Integrated Studio workflow

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

## Real provider boundaries

### AI writing
Forge supports real provider-backed generation through OpenAI and local Ollama. If neither provider is configured, generation fails explicitly; Forge does not fabricate an answer.

```bash
export OPENAI_API_KEY="your-key"
export OPENAI_MODEL="your-enabled-model"
```

or:

```bash
export OLLAMA_BASE_URL="http://127.0.0.1:11434"
export OLLAMA_MODEL="your-installed-model"
```

### Real image generation
Illustration generation uses the configured OpenAI image provider. Without `OPENAI_API_KEY`, the Studio reports missing configuration instead of showing fake output.

## Real-browser development workflow

Chromium is the primary browser target for Studio development and acceptance testing on the Chromebook Linux environment. Playwright is the browser acquisition and automation tool.

Install the browser once:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Run the deterministic suite:

```bash
npm test
```

Run real rendered Studio acceptance:

```bash
npm run test:browser
```

The browser command intentionally fails when Chromium is unavailable; browser verification is never silently skipped.
