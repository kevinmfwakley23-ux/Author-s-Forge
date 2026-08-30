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

The production stack now exposes a governed context-engine registry with deterministic lossless-first optimization and lossless structured-data compaction. The registry is intentionally extensible while higher-risk semantic and experimental engines remain explicitly catalogued but outside the default production path until their fidelity, latency, device footprint, and economics are benchmarked.

### Current production engine stack

- deterministic lossless-first context optimization;
- lossless JSON/structured-data compaction;
- explicit engine priorities and supported payload kinds;
- inflation guards that preserve the original context when optimization produces no gain;
- capability metadata distinguishing production-safe, derived, optional-model, and experimental engines;
- package-level exports so the optimization layer can be consumed without coupling the core domain to a provider.

### Planned/optional engine families

1. **Session-Dedup** — content-addressed repeated-context elimination across turns.
2. **CCR-style retrieval** — archive large derived blocks and retrieve them on demand through Forge's internal context system.
3. **Lite** — low-latency whitespace/boilerplate cleanup.
4. **RTK-style Tool Output** — command-aware filtering, deduplication, diagnostic extraction, and bounded truncation for shell/test/build/git results.
5. **Lossless Structured Output** — preserve JSON/structured tool results while reducing redundant representation where safe.
6. **Structured Data Compaction** — lossless-first compaction of repetitive arrays/tables when supported.
7. **Relevance Extraction** — query-aware extractive reduction for temporary research/context material.
8. **Conservative Prose Compression** — reduction only for temporary/non-canonical context, never as a silent manuscript rewrite.
9. **Progressive Aging** — summarize/age low-value historical turns when context pressure requires it.
10. **Optional LLMLingua-2 / ONNX** — semantic pruning behind an explicit optional dependency and fail-open boundary.
11. **Optional stronger heuristic/SLM tier** — only when measured savings justify the runtime and quality cost.
12. **Experimental context-as-image encoding** — isolated provider experiment, not part of the production path.

All engines must preserve author-critical data and expose measurable optimization results. Forge does **not** inherit third-party headline savings claims; actual savings are benchmarked on Forge workloads.

### K.I.N.G.S. integration decision

**K.I.N.G.S. is an approved optional intelligence resource for Author's Forge.** Forge may call K.I.N.G.S. whenever a task benefits from its workforce, knowledge, routing, local intelligence, verification, context optimization, or other governed capabilities.

The integration boundary is deliberately explicit:

- `KINGS_AI_ENDPOINT` selects a running K.I.N.G.S. bridge endpoint.
- `KINGS_AI_MODEL` identifies the model/resource exposed through that bridge.
- `KINGS_AI_API_KEY` is optional and only used when the bridge requires authentication.
- The bridge uses an OpenAI-Responses-compatible request/response contract so Forge does not import K.I.N.G.S. internals into its core domain.
- If K.I.N.G.S. is unavailable, Forge can fall back to independently governed OpenAI/Ollama providers rather than becoming unusable.
- Forge must never pretend K.I.N.G.S. is connected merely because the adapter exists; an actual configured endpoint and successful runtime verification are required.

## Real Provider Boundaries

### AI writing
Forge supports real provider-backed generation through K.I.N.G.S., OpenAI, local Ollama, and optional OpenAI-compatible gateways. If no provider is configured, generation fails explicitly. Forge does not fabricate an answer.

### Real image generation
Illustration generation uses the configured OpenAI image provider. Without `OPENAI_API_KEY`, the Studio reports the missing configuration instead of showing fake output.

## Voice as a First-Class Input

Forge's command center supports typed commands and browser `SpeechRecognition` / `webkitSpeechRecognition`. The original transcript remains editable before execution. Voice commands use the same real project and provider boundary as typed commands.

## Token and Cost Observability

Every provider request should ultimately expose an optimization ledger containing, where available: original estimated token count; optimized token count; tokens saved; compression ratio; cache hit/miss; retrieved context count; optimization strategies; provider/model; estimated request cost; optimization latency; and fallback/skip reason.

## Non-Negotiable Optimization Safety Rule

**Never save tokens by losing the author's book.**

The original durable project state remains authoritative. Optimization layers may derive smaller context packs, summaries, retrieval results, caches, or compressed prompts, but the full source material remains unchanged and recoverable.
