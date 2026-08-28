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

## Permanent Functional-Truth Rule

A green test suite is evidence, not proof of product completion. The project recently reached **125/125 automated tests passing**, but that result must not be treated as evidence that every visible Studio feature is usable by a human.

The current suite proves many valuable domain contracts and some Studio/source contracts. However, source-pattern assertions can prove that a route, handler, or label exists without proving that a user can actually operate the rendered application and obtain the promised result.

Therefore every major capability must ultimately be verified at three levels:

1. **Domain/contract level** — deterministic services, persistence rules, validation, and provider boundaries.
2. **Application level** — the real running server, routes, state transitions, artifacts, errors, and recovery behavior.
3. **Human/device level** — the actual Studio UI on the supported Chromebook and Android environments.

Never weaken or remove a test simply to make the build green. When a regression is exposed, repair the implementation or deliberately revise the contract with architectural justification.

## Permanent Platform Targets

**Chromebook and Android are first-class Author's Forge product targets.** They are not later compatibility work.

The primary architecture is one platform-neutral web application first. Chromebook and Android use the same product through browser/PWA surfaces while the domain, application, and API boundaries remain reusable for future dedicated shells.

```text
ONE PLATFORM-NEUTRAL WEB APPLICATION
              │
       ┌──────┴──────┐
       │             │
   Chromebook      Android
   Browser/PWA    Browser/PWA
              │
       Shared Application
       + Domain + API
              │
       Future native shells
 Windows / macOS / Linux / iOS / Android
```

Permanent platform requirements include:

- Asus Chromebook support;
- Android phone support;
- responsive desktop/tablet/phone layouts;
- touch-friendly interaction;
- browser-standard device APIs;
- PWA installability and offline shell behavior;
- durable project persistence independent of browser process state;
- portable project export/recovery;
- shared API/domain boundaries so future shells do not require rewriting Forge's core behavior.

The PWA is **not considered complete merely because a manifest and service worker exist**. Actual installation, mobile interaction, persistent data behavior, file handling, offline/recovery behavior, and device-level testing remain verification requirements.

The service worker must remain deliberately conservative: it may cache the application shell, but it must **not cache `/api/` project data as if it were durable application state**.

## Functional Reality Standard

Every visible Studio control must terminate in a real result:

- durable state transition;
- real provider/service operation;
- deterministic calculation;
- real artifact creation;
- real navigation;
- or an explicit actionable error.

The following are prohibited:

- buttons that only look active;
- navigation that changes labels but does not change the actual view;
- forms that accept input without persisting it;
- AI controls that produce fabricated text;
- image controls that display fake/generated-looking placeholders;
- export controls that claim success without a real artifact;
- settings that have no downstream effect;
- feature descriptions mistaken for implemented functionality;
- tests that inspect source code and call that end-to-end proof.

The target is the **Forge a real author can use**, not the Forge a test suite can describe.

## Current Integrated Studio

The Studio is one coherent application surface rather than a mission gallery or collection of disconnected screens. Its intended workflow is:

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

The current Studio source inventory contains **37 buttons, 11 forms, and 19 route links** in `public/index.html`. Their existence is not completion evidence. They must be functionally exercised.

## Real Provider Boundaries

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

## Voice as a First-Class Input

The directive requires voice for idea capture, story planning, editing commands, research requests, character creation, scene direction, and revision instructions while preserving the original transcription. fileciteturn723file4L481-L501

Forge's Chromebook path uses Chrome `SpeechRecognition` / `webkitSpeechRecognition`. The command center keeps the original transcript in an editable command field and routes the instruction through the same real project/AI boundary used by typed commands.

## Functional Verification Roadmap

The next verification layer is an actual **end-to-end application acceptance harness**, not another collection of source-pattern assertions.

It must exercise the real running application and verify at minimum:

- Studio startup and HTTP availability;
- every declared Studio view is reachable;
- navigation changes the visible view;
- project creation reaches the server;
- book/chapter/scene creation reaches durable persistence;
- manuscript content saves and survives reload/restart;
- AI reaches a configured provider or fails honestly when none is configured;
- editing reaches the real editing service;
- memory and research records persist;
- Book Genome and downstream-impact operations work;
- cover planning reaches its real service;
- production export creates a real artifact;
- project package export creates a real portable package;
- health reflects actual project state;
- controls that claim to modify state actually modify the intended state.

Browser/device acceptance remains a separate layer. The current Linux development container has **no installed Chrome/Chromium executable**, so browser automation must not be falsely represented as completed there. The Chromebook's real Chrome environment remains the authoritative target for final device-level verification.

## Verification Gate

```text
BUILD
  +
REGRESSION TESTS
  +
APPLICATION STARTUP
  +
REAL ROUTE EXECUTION
  +
REAL STUDIO CONTROL EXECUTION
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
  +
CHROMEBOOK / ANDROID DEVICE VERIFICATION
```

**Mission tests prove domain behavior. End-to-end Studio workflows prove the product. Real-device verification proves the intended platform experience. All three are required.**

## Engineering Memory / Discovery Log

This section is permanent engineering memory. **Whenever a material discovery is made about progress, a missing capability, an architectural constraint, a platform requirement, a verification weakness, or unfinished work, record it here.** This is mandatory restart context.

### 2026-08-27 — Functional verification gap identified

- The automated suite reached **125 passing tests**, but the green result was correctly challenged as insufficient evidence of a usable Studio.
- Source inspection showed **37 buttons, 11 forms, and 19 route links** in the current Studio HTML.
- The JavaScript contains real event handlers and API/provider boundaries, but handler existence alone does not prove successful user workflows.
- A browser executable is not installed inside the current Linux development container. Browser-level acceptance must not be claimed there.
- The next engineering priority is real HTTP/application-level acceptance testing followed by browser/device acceptance on Chromebook and Android.
- The project must distinguish **implemented**, **contract-tested**, **application-tested**, and **device-verified** capabilities.

### 2026-08-27 — Platform support reaffirmed

- Chromebook and Android are permanent first-class targets.
- The product remains one platform-neutral web application first, with shared domain/application/API boundaries.
- PWA support is a foundation, not completion evidence.
- Mobile interaction, installation, persistence, file handling, offline behavior, and real-device verification remain required.

### 2026-08-27 — Working-tree integrity requirement

- Local development currently contains changes outside the README and current Studio fix, including `src/application/illustration-reference-pipeline.ts`, `.forge-data/`, `dist/`, and `package-lock.json`.
- Do not blindly overwrite, reset, or commit unrelated working-tree changes while repairing Studio behavior.
- Generated/runtime data must be distinguished from intentional source changes before commits.

### 2026-08-27 — Workflow rule established

The chief-engineering workflow is continuous repository work:

```text
INSPECT
  ↓
IMPLEMENT
  ↓
TEST
  ↓
INSPECT REAL BEHAVIOR
  ↓
FIX
  ↓
VERIFY
  ↓
DOCUMENT DISCOVERY IN README
  ↓
COMMIT COHESIVE MILESTONE
  ↓
IMMEDIATELY CONTINUE
```

The assistant should stop and request Linux commands from the author only when the local environment is required for a verification or operation unavailable through repository tooling. The goal is speedy completion without sacrificing functional truth.

## Engineering References and Proven Patterns

Forge selectively implements proven patterns while respecting licenses and preserving Forge's architecture.

- Novel Studio (MIT) — rich editor, writing modes, story matrix, world codex, timeline, relationships, research, analysis, revision history, and export patterns.
- Writer Studio (Apache-2.0) — binder structure, long-form documents, drafts, evaluations, versions, research, transcription, and pluggable AI providers.
- Novel Studio AI (MIT) — local-first story bibles, retrieval memory, character state, graph facts, and continuity checks.
- Open-Write (Apache-2.0) — professional writing-room and revision-protocol patterns.
- Pika — local-first author-controlled editor and non-destructive AI editing patterns.

License rule: **do not copy code merely because it is useful.** Direct reuse must be compatible with the source license and Forge's architecture. Where license compatibility or provenance is unclear, reproduce the behavior independently.

## Development Commands

```bash
npm install
npm run build
npm test
npm run check
npm run studio
```

Then open:

`http://127.0.0.1:4173`

## Status

`main` remains the production integration baseline. The active engineering line is focused on converting the directive into a dependable private author workplace and eliminating dead-end UI, disconnected mission islands, and unverified feature claims.

**The README is a living engineering memory. If we learn something important, we record it here. If a capability is not actually usable, we say so here. If a requirement changes, we record the decision here.**
