# Author's Forge

**Author's Forge** is a local-first author workplace for taking books from idea to finished, edited, illustrated, produced, and publication-ready material.

It is intended to support children's books, memoir, psychological thrillers, guided journals, comic books, training manuals, novels, and future long-form projects without replacing the author's authority.

## Canonical Product Directive — READ THIS FIRST

**`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` is the canonical product contract.** It is checked into this repository so engineering work does not depend on conversational memory.

The directive defines the complete target: concept → architecture → canon → characters → timeline → research → manuscript → editing → illustrations → cover → formatting → metadata → positioning → marketing → publishing preparation → portable archive/recovery.

The Book Genome, hierarchical persistent memory, anti-drift/canon controls, relationship-aware memory, provenance, visual continuity, and author authority are core architecture.

## The standard is the working application

A green unit-test suite is **not** proof that Forge works.

A capability is complete only when it:

1. has real production implementation;
2. is reachable from Forge Studio;
3. reads and writes the durable project state;
4. survives browser reload and server restart;
5. participates in downstream workflows where required;
6. has actionable errors;
7. has automated regression coverage; and
8. does not pretend an unavailable provider, API, image, export, or integration succeeded.

No placeholder buttons. No fake AI. No fake APIs. No dead-end mission islands.

## Current product architecture

```text
AUTHOR
  ↓
PROJECT
  ↓
BOOK / CHAPTER / SCENE
  ↓
MANUSCRIPT + PROJECT BRAIN
  ↓
CANON / CHARACTERS / WORLD / TIMELINE / RESEARCH / VOICE
  ↓
WRITING ENGINE
  ↓
EDITORIAL ENGINE
  ↓
VISUAL IDENTITY / ILLUSTRATION ASSETS
  ↓
BOOK GENOME + DOWNSTREAM IMPACT
  ↓
POSITIONING / MARKETING
  ↓
MANUSCRIPT PRODUCTION
  ↓
PUBLISHING READINESS + DELIVERY AUDIT
  ↓
PORTABLE PROJECT STATE
```

The Studio is the product surface. Domain modules are valuable only when they participate in this flow.

## Real provider boundaries

### AI writing
Forge supports real provider-backed generation through:

- OpenAI Responses API: set `OPENAI_API_KEY` and an explicit `OPENAI_MODEL`.
- Local Ollama: set `OLLAMA_BASE_URL` and an explicit `OLLAMA_MODEL`.

If neither is configured, AI generation fails explicitly. Forge does not fabricate an answer.

Example:

```bash
export OPENAI_API_KEY="your-key"
export OPENAI_MODEL="your-enabled-model"
```

or:

```bash
export OLLAMA_BASE_URL="http://127.0.0.1:11434"
export OLLAMA_MODEL="your-installed-model"
```

AI output is a **candidate**. It does not silently become canon or replace manuscript text.

### Real image generation
Illustration generation uses a configured OpenAI image provider. Without `OPENAI_API_KEY`, the Studio reports the missing provider instead of showing fake output.

## Working Studio capabilities

The integrated Studio now provides real paths for:

- project and book creation;
- chapter and scene architecture;
- persistent scene writing and word counts;
- bounded Project Brain context assembly;
- real AI candidate drafting;
- structured Character Bible creation with history;
- durable canon, timeline, relationship, location, and creative memory;
- provenance-aware research records;
- real provider-backed image generation and local asset storage;
- Book Genome construction and downstream impact analysis;
- DOCX/PDF/EPUB production using the existing production engine;
- publishing delivery audit;
- governance and accessibility visibility.

The remaining mission implementations are treated as domain/application building blocks to be wired into these same workflows rather than exposed as disconnected demos.

## Engineering references

### User-owned repositories

**NovelForge** is an engineering reference for kernel lifecycle, dependency boundaries, event history, retry/dead-letter handling, diagnostics, and modular infrastructure.

**K.I.N.G.S.-AI** is the engineering reference for workforce planning, artifact lifecycle, build/test execution, capability acquisition, bounded autonomous execution, and recoverable handoffs.

Forge remains the author product. K.I.N.G.S. remains the independent workforce/orchestration system.

### Open-source writing systems studied

Forge has studied and selectively adapted useful patterns from open-source projects including:

- `YfengJ/novel-studio-ai` — local-first long-form memory, story bible, character state, retrieval, and continuity gates.
- `dreamtelligence/EMBER` — scene cards, canon/object/knowledge/promise ledgers, typed state diffs, continuity guards, and human approval.
- `abligail/narralume` — manual-first writing, story bible, versioning, review findings, AI candidate workflows, and run/impact surfaces.
- `john-paul-ruf/novel-engine` — explicit pitch-to-publish phases, editorial workforce, revision planning, local model support, and publication audit.
- `Dirgha-AI/writer-studio` — binder-style nested chapter/scene structure, drafts, evaluations, versions, and pluggable providers.
- `giapnguyen74/xnovelist` — AI-optional local-first writing, snapshots, Story Bible, and DOCX export.
- `jmorenobl/bookwright` — canonical author documents, provenance-aware research, and deterministic continuity validation.
- `mushroomfk/long-novel-agent-kit` — durable local continuity infrastructure and safety gates.

See `docs/ENGINEERING_INTEGRATION_LEDGER.md` for the integration rules and why each pattern matters.

Foreign repositories are references, not wholesale dependencies. License compatibility and architectural fit are evaluated before reuse.

## Development commands

```bash
npm install
npm run build
npm test
npm run check
npm run studio
```

Then open:

`http://127.0.0.1:4173`

## Verification philosophy

Never weaken or delete tests to make the build green.

The real release gate is:

```text
BUILD
  +
REGRESSION TESTS
  +
STUDIO STARTUP
  +
REAL ROUTE EXECUTION
  +
PERSISTENCE
  +
RESTART RECOVERY
  +
REAL PROVIDER BOUNDARIES
  +
ARTIFACT VALIDATION
  +
AUTHOR APPROVAL
```

## Mission integration rule

The repository contains a large set of mission-level implementations. Those missions are not separate products.

The engineering job is to consolidate the strongest implementations into one coherent ProjectState, one project-memory boundary, one manuscript workflow, one visual workflow, one production path, and one Studio.

**Mission tests prove domain behavior. End-to-end Studio workflows prove the product. Both are required.**

## Status

`main` is the integrated engineering baseline. The next work is systematic hardening and completion of every directive-required author workflow, not another isolated mock screen.
