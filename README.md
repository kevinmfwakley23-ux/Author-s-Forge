# Author's Forge

**Author's Forge** is a local-first author workplace for taking books from idea to finished, edited, illustrated, produced, and publication-ready material.

It is intended to support children's books, memoir, psychological thrillers, guided journals, comic books, training manuals, novels, and future long-form projects without replacing the author's authority.

## Canonical Product Directive — READ THIS FIRST

**`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` is the canonical product contract.** It is checked into this repository and is the engineering source of truth.

The directive defines the complete target: concept → architecture → canon → characters → timeline → research → manuscript → editing → illustrations → cover → formatting → metadata → positioning → marketing → publishing preparation → portable archive/recovery. It explicitly calls for hierarchical memory, anti-drift controls, relationship-aware memory, voice input, five AI collaboration modes, a Book Genome, real provider boundaries, and an author-controlled publishing workflow.

The final product standard is not a feature list. It is a complete working path from story concept through architecture, canon, character system, timeline, research, manuscript, editing, illustrations, cover, formatting, metadata, positioning, promotion, publishing preparation, and portable project state.

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

A green test suite is evidence, not proof of product completion. Source-pattern assertions can prove that a route, handler, or label exists without proving that a user can actually operate the rendered application and obtain the promised result.

Therefore every major capability must ultimately be verified at three levels:

1. **Domain/contract level** — deterministic services, persistence rules, validation, and provider boundaries.
2. **Application level** — the real running server, routes, state transitions, artifacts, errors, and recovery behavior.
3. **Human/device level** — the actual Studio UI on the supported Chromebook and Android environments.

Never weaken or remove a test simply to make the build green. When a regression is exposed, repair the implementation or deliberately revise the contract with architectural justification.

## Permanent Platform Targets

**Chromebook and Android are first-class Author's Forge product targets.** They are not later compatibility work.

The primary architecture is one platform-neutral web application first. Chromebook and Android use the same product through browser/PWA surfaces while the domain, application, and API boundaries remain reusable for future dedicated shells.

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

The integrated surface includes durable project/book/chapter/scene state, real scene editing and persistence, real provider-backed AI drafting, typed and browser-microphone commands, five collaboration modes, structured Character Bible records, provenance-aware memory/research, intelligent editing analysis, voice fingerprinting, real image generation when configured, KDP cover planning, Book Genome and impact analysis, document production, health reporting, portable export, and delivery audit.

No button is considered complete merely because it exists in HTML. Every control must terminate in a real state transition, provider operation, calculation, artifact, navigation action, or explicit actionable error.

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

Forge's command center supports typed commands and browser `SpeechRecognition` / `webkitSpeechRecognition`. The original transcript remains editable before execution. Voice commands use the same real project and provider boundary as typed commands.

AI candidates are explicitly non-canon until the author approves them. The command-center approval boundary is enforced in the UI and protected by regression tests.

## Functional Verification Roadmap

The verification layer now includes an actual **application-level acceptance harness** in addition to domain and source-contract tests.

It exercises the real running Studio server and verifies:

- Studio HTTP startup;
- the integrated command-center and workbench scripts are actually served;
- every declared Studio view exists in the served application;
- the live command surface exposes microphone support and the author approval boundary;
- project, book, chapter, and scene creation reaches durable persistence;
- manuscript content saves and survives server restart;
- memory/context, editing, Book Genome, and downstream-impact operations execute;
- health reflects actual project state;
- the canonical version-2 project package contains durable state and `project-state.json`;
- AI fails honestly when no provider is configured.

Browser/device acceptance remains a separate layer. The current Linux development container has no installed Chrome/Chromium executable, so browser automation must not be falsely represented as completed there. The Chromebook's real Chrome environment remains the authoritative target for final device-level verification.

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

### 2026-08-28 — Live Studio command surface added to application acceptance

- Extended the real server acceptance harness beyond API workflow persistence.
- The harness now fetches the served Studio root and verifies the actual command-center/workbench scripts plus every declared Studio view.
- It fetches the real command-center script and verifies the microphone surface, browser speech APIs, and explicit non-canon approval boundary are present in the served application.
- This closes a verification gap where source-pattern tests could pass while the running server served an incomplete Studio surface.

### 2026-08-28 — Canonical v2 package route integration

- Integrated `ProjectPackageService` into the live Studio server.
- `/api/projects/{projectId}/package` now returns the canonical version-2 Forge project package rather than the legacy version-1 application snapshot envelope.
- The route packages the complete durable project plus validated Studio workspace inside `projectState` and emits the integrity-checked `project-state.json` package file.
- Application integration coverage now verifies the v2 manifest, package name, state preservation, file path/media type, SHA-256 shape, and persistence across server restart.

### 2026-08-28 — Portable package application foundation

- Added `ProjectPackageService.exportSnapshot(...)` as the application-level entry point for creating a canonical version-2 Forge package from durable project state.
- Snapshot exports include an integrity-checked `project-state.json` package file using SHA-256 and the versioned package manifest.
- The Studio `/api/projects/{projectId}/package` route is now wired to this service and no longer returns the older application snapshot envelope.

### 2026-08-28 — Portable package contract verification

- The repository already contains the version-2 portable project package domain contract with manifest metadata, traversal-safe relative paths, SHA-256 file integrity, deterministic serialization, and validation on deserialization.
- Added dedicated contract coverage for successful round-trip serialization plus rejection of traversal, tampering, and unsupported package versions.

### 2026-08-28 — Command-center regression hardening

- GitHub access to the private `kevinmfwakley23-ux/Author-s-Forge` repository is operational again.
- The first-class command center already uses real `SpeechRecognition` / `webkitSpeechRecognition`, preserves the original transcript, and routes non-navigation commands through the real `/api/projects/{projectId}/ai/draft` provider boundary.
- A regression hardening commit added an explicit approval-boundary marker so the source contract unambiguously states that AI candidate output **has NOT been saved as canon**.
- This does not substitute for runtime acceptance testing; it only hardens the existing contract while the application-level verification layer is built.

### 2026-08-27 — Functional verification gap identified

- Automated/source tests are useful evidence but are not proof of a usable Studio.
- The next engineering priority is real HTTP/application-level acceptance testing followed by browser/device acceptance on Chromebook and Android.
- The project must distinguish **implemented**, **contract-tested**, **application-tested**, and **device-verified** capabilities.

### 2026-08-27 — Platform support reaffirmed

- Chromebook and Android are permanent first-class targets.
- The product remains one platform-neutral web application first, with shared domain/application/API boundaries.
- PWA support is a foundation, not completion evidence.
- Mobile interaction, installation, persistence, file handling, offline behavior, and real-device verification remain required.

### Workflow rule

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

The goal is speedy completion without sacrificing functional truth.

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
