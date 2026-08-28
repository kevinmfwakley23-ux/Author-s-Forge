# Author's Forge

**Author's Forge** is a local-first author workplace for taking books from idea to finished, edited, illustrated, produced, and publication-ready material.

It is intended to support children's books, memoir, psychological thrillers, guided journals, comic books, training manuals, novels, and future long-form projects without replacing the author's authority.

## Canonical Product Directive — READ THIS FIRST

**`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` is the canonical product contract.** It is checked into this repository and is the engineering source of truth.

The directive defines the complete target: concept → architecture → canon → characters → timeline → research → manuscript → editing → illustrations → cover → formatting → metadata → positioning → marketing → publishing preparation → portable archive/recovery. It explicitly calls for hierarchical memory, anti-drift controls, relationship-aware memory, voice input, five AI collaboration modes, a Book Genome, real provider boundaries, and an author-controlled publishing workflow.

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
