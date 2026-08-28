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

## AI Context Optimization & Token Efficiency

Author's Forge treats **context efficiency as a first-class AI architecture concern**. The goal is to reduce unnecessary model input, latency, and operating cost without sacrificing canon, author intent, reasoning quality, or recoverability.

This capability explicitly reuses compatible K.I.N.G.S. architecture and open-source research where appropriate while remaining provider-neutral and independently deployable inside Forge. Forge receives reusable optimization capabilities; it does not become structurally dependent on K.I.N.G.S.

### Context Optimization Pipeline

```text
AUTHOR REQUEST
      ↓
AI REQUEST PLANNER
      ↓
CONTEXT BUDGET MANAGER
      ↓
PROJECT CONTEXT RETRIEVER
      ↓
CONTEXT STRATIFIER
      ↓
DETERMINISTIC OPTIMIZER
      ↓
SEMANTIC CACHE
      ↓
OPTIONAL SEMANTIC COMPRESSOR
      ↓
TOKEN / COST GUARD
      ↓
PROVIDER ROUTER
      ↓
K.I.N.G.S. / OPENAI / OLLAMA / FUTURE PROVIDERS
```

### Required optimization principles

- **Context stratification:** separate essential system rules, project canon, current book/chapter/scene, characters, world/canon memories, research, recent workflow state, and low-value historical material so only relevant context is sent.
- **Retrieval over wholesale replay:** retrieve relevant project knowledge instead of repeatedly sending the entire project to every AI request.
- **Fetch-once / reuse:** retain normalized context artifacts and reuse unchanged context rather than reconstructing or transmitting it repeatedly.
- **Deterministic optimization first:** deduplicate repeated material, compact metadata and tool output, remove boilerplate, and use deltas for unchanged state before invoking model-based compression.
- **Semantic caching:** avoid paying for equivalent or sufficiently similar requests when a valid reusable result exists and the cache policy permits it.
- **Optional model-based compression:** support open-source prompt/context compression techniques such as LLMLingua-style compression where they provide a measurable benefit.
- **Compression economics:** do not compress blindly. Estimate whether expected savings justify preprocessing cost and latency.
- **Inflation guard:** if optimized context is not meaningfully smaller, discard the optimization and use the original context.
- **Structured-data protection:** JSON, identifiers, canon facts, constraints, tool arguments, and other machine-critical structures must not be lossy-compressed in ways that can change meaning.
- **Immutable source context:** optimization must never destroy original project information. Compressed context is derived state, never the source of truth.
- **Author authority:** optimization may shorten context sent to a model but may never silently alter canon or author-approved project state.

### Open-source compatibility decision

The first production optimization layer is **deterministic and dependency-light**. Forge has an internal context optimizer with token estimation, whitespace normalization, duplicate-line reduction, savings measurement, and an inflation guard. This provides immediate savings without adding a heavy runtime dependency.

Open-source semantic compression remains an optional second stage. LLMLingua/LongLLMLingua is a strong candidate, but adoption requires licensing, runtime footprint, local-device viability, fidelity, latency, and measured savings to be verified for Forge workloads. Semantic caching and tool-output compression are likewise candidates, not automatic dependencies.

### K.I.N.G.S. integration decision

**K.I.N.G.S. is an approved optional intelligence resource for Author's Forge.** Forge must be able to call K.I.N.G.S. whenever a task benefits from its workforce, knowledge, routing, local intelligence, verification, or other governed capabilities.

The integration boundary is deliberately explicit:

- `KINGS_AI_ENDPOINT` selects a running K.I.N.G.S. bridge endpoint.
- `KINGS_AI_MODEL` identifies the model/resource exposed through that bridge.
- `KINGS_AI_API_KEY` is optional and only used when the bridge requires authentication.
- The bridge uses an OpenAI-Responses-compatible request/response contract so Forge does not import K.I.N.G.S. internals into its core domain.
- If K.I.N.G.S. is unavailable, Forge can fall back to independently governed OpenAI/Ollama providers rather than becoming unusable.
- Forge must never pretend K.I.N.G.S. is connected merely because the adapter exists; an actual configured endpoint and successful runtime verification are required.

K.I.N.G.S. remains the source of reusable architecture for context building, knowledge selection, task-state selection, safe compression, checkpointing, context budgets, provider/model routing, and cost/quality policy. Forge adopts compatible capabilities at explicit boundaries rather than forking K.I.N.G.S. internals.

### OpenAI-compatible gateway decision

**OpenAI-compatible gateways are an approved optional provider boundary for Forge.** The reviewed `andeya/token-free-gateway` project demonstrates useful, reusable protocol infrastructure including OpenAI-compatible request/response types, SSE streaming, tool-call normalization, provider adapters, and routing concepts.

Forge may selectively reuse compatible, license-approved protocol components or reproduce their proven interface patterns behind its own provider contract.

The gateway architecture is:

```text
FORGE PROVIDER ROUTER
        ↓
OPENAI-COMPATIBLE GATEWAY ADAPTER
        ↓
LOCAL / EXTERNAL GATEWAY
        ↓
UNDERLYING PROVIDER(S)
```

The gateway is an **execution option, not the token-optimization system**. Context optimization remains above the provider layer.

Forge will **not** import browser credential interception, browser-session automation, or provider-session storage into the core product. Those mechanisms create unnecessary security, policy, browser-runtime, and maintenance coupling.

Third-party code is never copied blindly. License compatibility, security, maintenance health, runtime footprint, Chromebook/Android viability, and architectural fit must be reviewed before direct reuse.

### Token and cost observability

Every provider request should ultimately expose an optimization ledger containing, where available:

- original estimated token count;
- optimized token count;
- tokens saved;
- compression ratio;
- cache hit/miss;
- retrieved context count;
- optimization strategy used;
- provider and model;
- estimated request cost;
- whether compression was skipped by the cost/benefit guard.

The system must **measure actual savings rather than promise a fixed percentage**. Compression quality is workload- and model-dependent, and aggressive compression must be rejected when it damages critical information or reasoning quality.

### Non-negotiable safety rule for optimization

**Never save tokens by losing the author's book.**

The original durable project state remains authoritative. Optimization layers may derive smaller context packs, summaries, retrieval results, caches, or compressed prompts, but the full source material remains recoverable and unchanged.

## Real Provider Boundaries

### AI writing
Forge supports real provider-backed generation through:

- K.I.N.G.S. bridge: `KINGS_AI_ENDPOINT` + `KINGS_AI_MODEL` when a governed K.I.N.G.S. bridge is running.
- OpenAI: `OPENAI_API_KEY` + explicit `OPENAI_MODEL`.
- Local Ollama: `OLLAMA_BASE_URL` + explicit `OLLAMA_MODEL`.
- Optional OpenAI-compatible gateway through the provider abstraction.

If no provider is configured, generation fails explicitly. Forge does not fabricate an answer.

### Real image generation
Illustration generation uses the configured OpenAI image provider. Without `OPENAI_API_KEY`, the Studio reports the missing configuration instead of showing fake output.

## Voice as a First-Class Input

Forge's command center supports typed commands and browser `SpeechRecognition` / `webkitSpeechRecognition`. The original transcript remains editable before execution. Voice commands use the same real project and provider boundary as typed commands.

AI candidates are explicitly non-canon until the author approves them. The command-center approval boundary is enforced in the UI and protected by regression tests.

## Functional Verification Roadmap

The verification layer includes an actual **application-level acceptance harness** in addition to domain and source-contract tests.

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

### 2026-08-28 — OpenAI-compatible gateway decision locked

- Reviewed `andeya/token-free-gateway` as a candidate source of proven gateway infrastructure.
- OpenAI-compatible protocol types, SSE streaming, tool-call normalization, provider adapters, and routing patterns are approved for selective reuse after license/security/runtime review.
- Browser credential interception, browser-session automation, and provider-session storage are explicitly excluded from Forge's core architecture.
- Gateway infrastructure remains below Forge's context-optimization layer and must not replace Project Brain retrieval, budgeting, compression, caching, or cost controls.
- Forge remains provider-neutral and can operate without a gateway.

### 2026-08-28 — Context intelligence and K.I.N.G.S. integration locked

- Author's Forge will reuse compatible K.I.N.G.S. context, memory, routing, local-intelligence, cost-control, and verification capabilities instead of creating competing subsystems.
- K.I.N.G.S. remains an optional governed intelligence resource; Forge remains independently deployable and functional without it.
- Added a K.I.N.G.S. bridge adapter using an explicit `KINGS_AI_ENDPOINT` contract rather than guessing at or importing K.I.N.G.S. runtime internals.
- Added deterministic context optimization directly to Forge so immediate token reduction does not depend on a large external runtime.
- Added a context budget manager and Project Brain context pipeline so AI requests can select relevant context before optimization.
- Added a project-aware AI generation boundary that retrieves and budgets project memory before provider dispatch.
- Added token estimation, savings measurement, compression ratio reporting, duplicate-line reduction, whitespace compaction, and an inflation guard.
- Open-source semantic compression such as LLMLingua/LongLLMLingua remains a candidate second-stage optimizer pending measured fidelity, latency, licensing, and Chromebook viability.
- The original project state remains immutable and authoritative; no optimization may silently discard canon.

### 2026-08-28 — Context optimization and token-efficiency architecture identified

- Context/token efficiency is an explicit Author's Forge architectural requirement.
- The intended design is provider-neutral and layered: request planning, context budgeting, retrieval, stratification, deterministic optimization, semantic caching, optional model-based compression, token/cost guarding, and provider routing.
- Compression must preserve the immutable original project state and must never trade canon fidelity for token savings.
- The implementation must measure actual savings, cost, latency, and quality rather than advertise a fixed compression percentage.

### 2026-08-28 — Validated project snapshot restore boundary added

- Added an application-level restore boundary to `ProjectPackageService` for canonical v2 packages.
- Restore requires a validated UTF-8 `project-state.json` snapshot and can enforce a target project id before state is returned to persistence code.
- Added regression coverage for successful restore, wrong-target rejection, and missing snapshot rejection.
- The live Studio restore route/UI is still a separate integration step; no restore capability is claimed merely from this service boundary.

### 2026-08-28 — Portable package integrity binding strengthened

- Canonical version-2 packages now bind `manifest.projectId` to `projectState.metadata.id` when project metadata declares an id.
- `project-state.json`, when present as a UTF-8 package file, must exactly match the canonical serialized `projectState`, in addition to its SHA-256 integrity check.
- Added regression coverage for identity mismatch, semantic state-file mismatch, and strengthened round-trip behavior.

### 2026-08-28 — Live Studio command surface added to application acceptance

- Extended the real server acceptance harness beyond API workflow persistence.
- The harness now fetches the served Studio root and verifies the actual command-center/workbench scripts plus every declared Studio view.
- It fetches the real command-center script and verifies the microphone surface, browser speech APIs, and explicit non-canon approval boundary are present in the served application.

### 2026-08-28 — Canonical v2 package route integration

- Integrated `ProjectPackageService` into the live Studio server.
- `/api/projects/{projectId}/package` now returns the canonical version-2 Forge project package rather than the legacy version-1 application snapshot envelope.
- The route packages the complete durable project plus validated Studio workspace inside `projectState` and emits the integrity-checked `project-state.json` package file.

### 2026-08-28 — Portable package application foundation

- Added `ProjectPackageService.exportSnapshot(...)` as the application-level entry point for creating a canonical version-2 Forge package from durable project state.
- Snapshot exports include an integrity-checked `project-state.json` package file using SHA-256 and the versioned package manifest.

### 2026-08-28 — Portable package contract verification

- The repository already contains the version-2 portable project package domain contract with manifest metadata, traversal-safe relative paths, SHA-256 file integrity, deterministic serialization, and validation on deserialization.
- Added dedicated contract coverage for successful round-trip serialization plus rejection of traversal, tampering, and unsupported package versions.

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
