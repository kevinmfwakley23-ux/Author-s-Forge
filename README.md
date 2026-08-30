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
SESSION DEDUPLICATION
      ↓
CONTEXT STRATIFIER
      ↓
COMPRESSION ENGINE REGISTRY
      ↓
CONTENT-AWARE COMPRESSION
      ↓
SEMANTIC CACHE
      ↓
TOKEN / COST GUARD
      ↓
PROVIDER ROUTER
      ↓
K.I.N.G.S. / OPENAI / OLLAMA / OPENAI-COMPATIBLE GATEWAY
```

### Required optimization principles

- **Context stratification:** separate essential system rules, project canon, current book/chapter/scene, characters, world/canon memories, research, recent workflow state, and low-value historical material so only relevant context is sent.
- **Retrieval over wholesale replay:** retrieve relevant project knowledge instead of repeatedly sending the entire project to every AI request.
- **Session deduplication:** content-address repeated material across turns so unchanged context does not repeatedly consume input budget.
- **Fetch-once / reuse:** retain normalized context artifacts and reuse unchanged context rather than reconstructing or transmitting them repeatedly.
- **Retrieve-on-demand archival:** large derived context may be archived behind an internal retrieval handle and fetched only when relevant; retrieval handles must never leak into model prompts as fake source content.
- **Deterministic optimization first:** deduplicate repeated material, compact metadata and tool output, remove boilerplate, and use deltas for unchanged state before invoking model-based compression.
- **Content-aware engines:** JSON, code, diffs, logs, structured results, and prose require different compression policies.
- **Semantic caching:** avoid paying for equivalent or sufficiently similar requests when a valid reusable result exists and the cache policy permits it.
- **Optional model-based compression:** support open-source prompt/context compression techniques such as LLMLingua-style compression where they provide a measurable benefit.
- **Compression economics:** do not compress blindly. Estimate whether expected savings justify preprocessing cost and latency.
- **Inflation guard:** if optimized context is not meaningfully smaller, discard the optimization and use the original context.
- **Structured-data protection:** JSON, identifiers, canon facts, constraints, tool arguments, URLs, code blocks, and other machine-critical structures must not be lossy-compressed in ways that can change meaning.
- **Immutable source context:** optimization must never destroy original project information. Compressed context is derived state, never the source of truth.
- **Author authority:** optimization may shorten context sent to a model but may never silently alter canon or author-approved project state.
- **Fail-open behavior:** if an optimization engine cannot safely operate, Forge uses the original context rather than failing the author's workflow.

### Compression Engine Registry

Forge is adopting an **engine-based compression architecture** inspired by the reviewed OmniRoute implementation. Each engine is independently identifiable, configurable, prioritized, validated, target-aware, and replaceable rather than being hard-wired into the provider layer.

Approved engine families include:

1. **Session-Dedup** — content-addressed repeated-context elimination across turns.
2. **CCR-style retrieval** — archive large derived blocks and retrieve them on demand through Forge's internal context system.
3. **Lite** — low-latency whitespace/boilerplate cleanup.
4. **RTK-style Tool Output** — command-aware filtering, deduplication, diagnostic extraction, and bounded truncation for shell/test/build/git results.
5. **Lossless Structured Output** — preserve JSON/structured tool results while reducing redundant representation where safe.
6. **Structured Data Compaction** — lossless-first compaction of repetitive arrays/tables when supported.
7. **Relevance Extraction** — query-aware extractive reduction for temporary research/context material.
8. **Conservative Prose Compression** — Caveman-style reduction only for temporary/non-canonical context, never as a silent manuscript rewrite.
9. **Progressive Aging** — summarize/age low-value historical turns when context pressure requires it.
10. **Optional LLMLingua-2 / ONNX** — semantic pruning behind an explicit optional dependency and fail-open boundary.
11. **Optional stronger heuristic/SLM tier** — only when measured savings justify the runtime and quality cost.
12. **Experimental context-as-image encoding** — not part of the current Forge production path; provider-specific experiments remain isolated until independently verified.

All engines must preserve author-critical data and expose measurable optimization results. Forge does **not** inherit third-party headline savings claims; actual savings are benchmarked on Forge workloads.

### Context Optimization Observability

The context layer now exposes a typed optimization ledger contract for every provider request. Each entry can record the request identifier, original and optimized estimated token counts, tokens saved, compression ratio, cache outcome, retrieved-context count, strategies applied, provider/model, estimated request cost, optimization latency, and any fail-open/fallback reason. The in-memory implementation also provides aggregate totals for requests, token savings, cache hits/misses, fallbacks, estimated cost, and optimization latency.

This makes the README's token/cost observability requirement an explicit application boundary rather than a documentation-only promise. The ledger remains derived telemetry: it never replaces durable project state or author content.

### Open-source compatibility decision

The first production optimization layer is **deterministic and dependency-light**. Forge has an internal context optimizer with token estimation, whitespace normalization, duplicate-line reduction, savings measurement, and an inflation guard. This provides immediate savings without adding a heavy runtime dependency.

Open-source semantic compression remains an optional second stage. LLMLingua/LongLLMLingua is a strong candidate, but adoption requires licensing, runtime footprint, local-device viability, fidelity, latency, and measured savings to be verified for Forge workloads. Semantic caching and tool-output compression are likewise candidates, not automatic dependencies.

### OmniRoute research decision — 2026-08-28

The reviewed `diegosouzapw/OmniRoute` implementation is now an approved architectural reference for Forge's optimization layer. Its useful ideas are adopted selectively and Forge-native: independently registered engines; session deduplication; retrieve-on-demand archival; lightweight cleanup; RTK-style tool-result filtering; lossless-first structured output; structured-data compaction; relevance reduction; conservative prose compression; progressive context aging; optional LLMLingua-2/ONNX semantic pruning; stronger optional heuristic/SLM tiers; stacked presets; cache-aware optimization; and measured savings.

OmniRoute's engine contract/registry is particularly useful because it makes optimization stages independently toggleable and target-aware. Forge adopts that architecture without coupling its domain or provider implementation to OmniRoute.

The OmniRoute repository is an architectural reference, not a promise of universal savings. Open issues and provider-specific behavior reinforce the requirement that Forge benchmark each engine and fail open when an optimization is unsafe or ineffective.

Direct code reuse is limited to components whose license, provenance, security, maintenance, runtime footprint, and Chromebook/Android compatibility are verified. Otherwise Forge reimplements the proven algorithm/interface natively.

### Mission 038 — Provider Cost Guard

The provider boundary now has an optional cost-governance decorator. Forge can estimate request input/output tokens, calculate an estimated USD cost from provider/model policy, enforce a maximum input-token limit, enforce a maximum estimated-cost limit before upstream execution, and record blocked/allowed requests in the existing optimization ledger.

This follows the useful cost-governance pattern seen in current AI gateway projects: enforce budgets before provider execution and expose cost telemetry, while keeping Forge's implementation provider-neutral. Forge does not inherit third-party pricing or savings claims; pricing policy remains explicit and configurable.

The guard is fail-safe for author spending: requests exceeding configured policy are rejected before the real provider call, with an actionable `AI_COST_GUARD_BLOCKED` error. Successful requests remain observable through the existing ledger without changing durable project content.

## Mission 039 — Review-Gated AI Proposals

Forge now has an explicit **AI proposal boundary** for AI-generated changes and findings. AI work is represented as a durable proposal with project identity, action kind, rationale, proposed content, source-memory references, status, and review metadata. Proposals begin as `pending` and cannot become durable accepted state without explicit author review.

Supported proposal kinds currently include manuscript edits, memory candidates, research notes, continuity findings, and creative alternatives. The proposal store is deliberately separate from `ProjectMemoryStore`: an AI suggestion is not canon merely because a model produced it.

The review contract is intentionally strict:

- AI may propose;
- AI may explain its reasoning and cite source memory identifiers;
- the author may accept or reject;
- system-only acceptance is prohibited;
- a reviewed proposal cannot silently be reviewed again;
- proposal state is attributable and timestamped;
- rejected/pending proposals remain separate from authoritative memory.

This follows the strongest pattern identified in current open-source AI writing and agent systems: **draft/propose first, review second, mutate durable knowledge only after approval**. Novel Studio AI similarly separates draft work from accepted canon, while xnovelist exposes AI results as proposals that require explicit acceptance. Vouch applies the same review-gated persistence idea to agent knowledge. Forge adopts the principle while retaining its own domain model, provenance rules, and author authority.

This is the foundation for the next Studio-level Agent/Forge Assistant workflow: model output will become reviewable cards/diffs rather than silently changing manuscript, canon, or memory.

## Mission 040 — Proposal Review Integrity

Forge's proposal boundary now records an **append-only review audit** and provides a deterministic line-level diff contract for manuscript-edit proposals.

The review audit records the proposal, transition, author reviewer, timestamp, sequence number, and optional review note. The store exposes copies of the audit history rather than mutable internal entries. This makes the author decision itself an attributable artifact instead of merely a final status flag.

The diff service is deliberately presentation-only. It compares original and proposed text without mutating manuscript state and reports equal/added/removed lines with old/new line numbers plus aggregate counts. This gives Studio a reliable foundation for a future side-by-side proposal card where the author can inspect exactly what AI wants to change before accepting it.

The design incorporates a useful idea from current review-gated AI systems: **the reviewer must see the actual proposed change and the evidence/audit context, not merely click an approval button**. Forge therefore keeps proposal content, provenance, diff data, and review decisions as separate inspectable artifacts. citeturn0search0turn0search1turn0search6

This remains an enabling layer. Studio integration must still connect these artifacts to the real running writing workflow before the capability is considered product-complete under the Functional-Truth Rule.

## End-to-end release target

The first private release remains governed by the Master Product Directive: a real author must be able to carry a project from concept through manuscript, editing, visual work, production, marketing, publishing preparation, and portable recovery without losing canon, voice, continuity, provenance, or author control. The optimization and proposal layers are enabling subsystems of that larger workflow, not the product itself.
