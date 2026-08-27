# Author's Forge

**Author's Forge** is a local-first author workplace for taking books from idea to finished, edited, illustrated, produced, and publication-ready material.

It is intended to support children's books, memoir, psychological thrillers, guided journals, comic books, training manuals, novels, and future long-form projects without replacing the author's authority.

## Canonical Product Directive — READ THIS FIRST

**`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` is the canonical product contract.** It is checked into this repository and is the engineering source of truth.

The directive defines the complete target: concept → architecture → canon → characters → timeline → research → manuscript → editing → illustrations → cover → formatting → metadata → positioning → marketing → publishing preparation → portable archive/recovery. It explicitly calls for hierarchical memory, anti-drift controls, relationship-aware memory, voice input, five AI collaboration modes, a Book Genome, real provider boundaries, and an author-controlled publishing workflow. fileciteturn723file2L53-L65 fileciteturn723file4L481-L501

The final product standard is not a feature list. It is a complete working path from story concept through architecture, canon, character system, timeline, research, manuscript, editing, illustrations, cover, formatting, metadata, positioning, promotion, publishing preparation, and portable project state. fileciteturn723file8L963-L1001

## Chief engineering standard

The lead engineering responsibility for this repository is to turn the directive into a **real working author workplace**, not a mission gallery or collection of promises.

Non-negotiable rules:

- real implementation only;
- real provider calls only;
- real persistence only;
- no fake AI responses;
- no fake image generation;
- no placeholder controls presented as completed features;
- no dead navigation;
- no silent canon mutation;
- no weakening or deleting tests to make the build green;
- major autonomous actions must be observable, reversible, attributable, and author-controlled.

A green unit-test suite is **not** proof that Forge works. A capability is complete only when it is reachable from Studio, reads/writes durable project state, survives reload/restart, participates in downstream workflows, reports real errors, and has end-to-end regression coverage.

## Current integrated Studio

The Studio is now one static application surface rather than a dynamically injected collection of disconnected screens. Its primary workflow is:

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

The integrated surface includes:

- durable project, book, chapter, and scene creation;
- real scene editor with word counts and persistent save;
- real AI drafting through OpenAI or Ollama when configured;
- AI task modes for drafting, continuation, rewrite, expansion, dialogue, description, outlining, and brainstorming;
- first-class typed and browser-microphone command center;
- original voice transcript preservation before execution;
- Co-pilot, Partner, Director, Autonomous, and Editor collaboration modes;
- structured Character Bible records with history;
- canon, timeline, location, relationship, style, visual, open-thread, and creative-decision memory;
- provenance-aware research storage;
- read-only intelligent editing analysis;
- local author-voice fingerprint analysis;
- real OpenAI image generation with local project asset storage when configured;
- KDP cover geometry planning;
- Book Genome construction and downstream impact analysis;
- real DOCX/PDF/EPUB/KDP production through the existing production engine;
- project health reporting;
- portable project JSON export;
- 13-category delivery audit;
- explicit provider-status reporting.

No button is considered complete merely because it exists in HTML. Every control must terminate in a real state transition, provider operation, calculation, artifact, navigation action, or explicit actionable error.

## Real provider boundaries

### AI writing
Forge supports real provider-backed generation through:

- OpenAI: `OPENAI_API_KEY` + explicit `OPENAI_MODEL`.
- Local Ollama: `OLLAMA_BASE_URL` + explicit `OLLAMA_MODEL`.

If neither provider is configured, generation fails explicitly. Forge does not fabricate an answer.

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
Illustration generation uses the configured OpenAI image provider. Without `OPENAI_API_KEY`, the Studio reports the missing configuration instead of showing fake output.

## Voice as a first-class input

The directive requires voice for idea capture, story planning, editing commands, research requests, character creation, scene direction, and revision instructions while preserving the original transcription. fileciteturn723file4L481-L501

Forge's Chromebook path uses Chrome `SpeechRecognition` / `webkitSpeechRecognition`. The command center keeps the original transcript in an editable command field and routes the instruction through the same real project/AI boundary used by typed commands.

## Engineering references and proven patterns

Forge is not blindly copying unrelated projects. It selectively implements proven patterns while respecting licenses and preserving Forge's architecture.

- urlNovel Studio (MIT)https://github.com/Openapps-free/novel-studio — rich editor, writing modes, story matrix, world codex, timeline, relationships, research, analysis, revision history, and export patterns. citeturn2search0
- urlWriter Studio (Apache-2.0)https://github.com/Dirgha-AI/writer-studio — binder structure, long-form documents, drafts, evaluations, versions, research, transcription, and pluggable AI providers. citeturn2search1
- urlNovel Studio AI (MIT)https://github.com/YfengJ/novel-studio-ai — local-first story bibles, retrieval memory, character state, graph facts, and continuity checks. citeturn2search7
- urlOpen-Write (Apache-2.0)https://github.com/Open-Write/Open-Write — professional writing-room and revision-protocol patterns. citeturn2search3
- urlPikahttps://github.com/bricke/pika — local-first author-controlled editor and non-destructive AI editing pattern. citeturn2search9

License rule: **do not copy code merely because it is useful.** Direct reuse must be compatible with the source license and Forge's architecture. Where license compatibility or provenance is unclear, reproduce the behavior independently.

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

## Verification gate

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

The mission modules remain valuable domain machinery, but they are not separate products. The engineering objective is one coherent ProjectState, one manuscript workflow, one visual workflow, one production path, one memory boundary, and one Studio.

**Mission tests prove domain behavior. End-to-end Studio workflows prove the product. Both are required.**

## Status

`main` remains the production integration baseline. The active engineering line is focused on converting the directive into a dependable private author workplace and eliminating dead-end UI, disconnected mission islands, and unverified feature claims.
