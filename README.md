# Author's Forge

**Author's Forge** is a local-first author workplace for taking books from idea to finished, edited, illustrated, produced, and publication-ready material.

It is intended to support children's books, memoir, psychological thrillers, guided journals, comic books, training manuals, novels, and future long-form projects without replacing the author's authority.

## Canonical Product Directive — READ THIS FIRST

**`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` is the canonical product contract.** It is checked into this repository so engineering work does not depend on conversational memory.

The directive defines the complete target: concept → architecture → canon → characters → timeline → research → manuscript → editing → illustrations → cover → formatting → metadata → positioning → marketing → publishing preparation → portable archive/recovery.

The Book Genome, hierarchical persistent memory, anti-drift/canon controls, relationship-aware memory, provenance, visual continuity, and author authority are core architecture.

### Directive requirements that must remain visible during engineering

The directive explicitly requires **voice as a first-class input**: idea capture, story planning, editing commands, research requests, character creation, scene direction, and revision instructions, while preserving the original transcription. It also requires five AI collaboration modes — Co-pilot, Partner, Director, Autonomous, and Editor — and an AI environment operating throughout the author workplace. The long-form target assumes projects around 100,000+ words, hundreds of scenes, dozens of characters, extensive chronology, and series-scale continuity rather than a single chat context. fileciteturn657file4L673-L693 fileciteturn657file8L1381-L1403

The directive's final product standard is a complete workflow from story concept through architecture, canon, character system, timeline, research, manuscript, editing, illustrations, cover, formatting, metadata, market positioning, promotion, publishing preparation, and portable archived project. The private release is explicitly expected to be tested against real projects until these workflows are dependable. fileciteturn657file3L553-L614

## Engineering role and non-negotiable standard

The lead engineering responsibility for this repository is to turn the directive into a **real working author workplace**, not a mission gallery. Domain modules and mission implementations are raw product machinery until they are reachable through the Studio, connected to durable ProjectState, and verified through end-to-end workflows.

The engineering standard is:

- real implementation only;
- real provider calls only;
- real persistence only;
- no fake AI responses;
- no fake image generation;
- no placeholder controls presented as completed features;
- no dead navigation;
- no silent canon mutation;
- no deleting or weakening tests to obtain a green build;
- every major autonomous action must be attributable, observable, reversible, and author-controlled.

## Voice and command interface

Forge now includes a first-class **Forge Command Center** surface in the Studio. It provides typed commands and browser microphone input, preserves the original transcript in the command field, supports the five collaboration modes, and routes AI work through the project's existing real provider-backed drafting boundary. Chrome's `SpeechRecognition` / `webkitSpeechRecognition` API is the first local voice path for the Chromebook target.

Voice is not a decorative feature. It is the UI expression of the directive's author-input contract. The next engineering layers must extend the same canonical command contract into project creation, architecture, chapter/scene planning, research, editing, character work, illustration direction, production, and publishing workflows.

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
VOICE / TYPED COMMAND
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

The integrated Studio provides real paths for:

- project and book creation;
- chapter and scene architecture;
- persistent scene writing and word counts;
- bounded Project Brain context assembly;
- real AI candidate drafting;
- typed and voice command entry;
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

- `Openapps-free/novel-studio` — rich writing environment, AI writing modes, story planning, world codex, timeline, research, revision history, and provider configuration. The repository is MIT licensed. urlNovel Studio repositoryhttps://github.com/Openapps-free/novel-studio
- `dreamtelligence/EMBER` — scene cards, memory backbone, canon/object/knowledge/promise ledgers, typed state diffs, continuity guards, and human approval. urlEMBER repositoryhttps://github.com/dreamtelligence/EMBER
- `Dirgha-AI/writer-studio` — binder-style nested chapter/scene structure, drafts, evaluations, versions, research, transcription, export, and pluggable AI providers. It is Apache-2.0 licensed. urlWriter Studio repositoryhttps://github.com/Dirgha-AI/writer-studio
- `Ckokoski/AuthorAgent` — autonomous local-first book-pipeline architecture from research through publish-ready output. urlAuthorAgent repositoryhttps://github.com/Ckokoski/AuthorAgent
- `ilrein/openwrite` — story-map generation, rich editor, chapter management, multi-provider AI, codex, and project workflows. Its AGPL-3.0 license requires architectural/legal review before any code reuse. urlOpenWrite repositoryhttps://github.com/ilrein/openwrite

These repositories are **engineering references, not permission to copy code blindly**. Any direct code reuse must respect the source repository's license, attribution requirements, and compatibility with Forge's architecture. Where licenses are incompatible or unclear, Forge will reproduce the useful behavior independently rather than import the code.

See `docs/ENGINEERING_INTEGRATION_LEDGER.md` for the integration rules and why each pattern matters.

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
VOICE / TYPED COMMAND EXECUTION
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
