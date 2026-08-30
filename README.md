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

The production pipeline includes hierarchical context assembly, session deduplication, content-aware compression boundaries, semantic caching, token/cost governance, provider routing boundaries, and measurable optimization telemetry. Deterministic optimization is preferred before model-based compression, structured/canonical data is protected from lossy transformations, and optimization always fails open to the original context.

### Compression implementation status

Forge now has a governed `ContextEngineRegistry` with explicit engine identity, priority, enablement, supported payload kinds, capability checks, composable stages, and an inflation guard. The production stack includes deterministic lossless-first normalization, lossless JSON compaction, and an integrated RTK-style tool-output engine. The RTK-style layer is command-aware, removes safe repeated diagnostic noise, preserves important error/test/failure lines, bounds oversized derived output, and refuses to replace output when it does not produce measurable savings.

Structured JSON, code, and diffs remain protected from lossy rewriting. Tool-result compression operates only on derived output and is fail-open. The original tool result and all canonical project state remain authoritative.

### Open-source research decision

Forge will selectively adopt proven open-source techniques rather than import an entire gateway or agent stack. Current research confirms LLMLingua-2 as a credible optional semantic-compression candidate, with published work describing substantially faster compression than the original LLMLingua and practical prompt-reduction use cases. Adoption remains gated on fidelity, local runtime footprint, latency, licensing, and measured Forge workload savings rather than headline percentages. citeturn0search0

The reviewed OmniRoute architecture remains the principal reference for composable compression engines, session deduplication, retrieve-on-demand context, RTK-style tool reduction, structured-data compaction, relevance reduction, optional LLMLingua-2, adaptive compression, and measured stacked pipelines. OmniRoute itself identifies RTK, Caveman, Headroom, LLMLingua, and related projects as architectural lineage rather than treating the whole stack as original code. Forge therefore reimplements interfaces and algorithms natively when direct code reuse is not independently justified. citeturn0search1turn0search5

Forge does **not** copy third-party savings claims. Every optimization stage must report actual input/output estimates, savings, strategy, cache behavior where applicable, and fallback reason. Lossy compression remains prohibited for manuscript canon, author-approved prose, structured machine data, URLs, identifiers, constraints, and other machine-critical material.

## AI Proposal and Author-Controlled Mutation

AI-generated changes are represented as reviewable proposals rather than silent manuscript/canon mutation. Proposals carry rationale, provenance, status, and review state; only explicit author approval can move an AI suggestion into an authoritative workflow.

## Mission 042 — Evidence-Gated Marketing Campaigns

Author's Forge now has a Forge-native marketing campaign contract designed to connect **Book Positioning → campaign planning → channel assets → author approval → scheduling** without turning unsupported claims into published marketing copy.

Marketing campaigns contain a project/book identity, objective, audience, reader promise, and reusable assets. Assets support author-site, email, social, reader-community, advertising, press, and retailer channels. Each asset carries evidence records with an explicit confidence class: known, source-supported, inference, or creative.

The campaign boundary enforces two critical rules:

- inference-only claims cannot be scheduled or published;
- only explicitly approved assets can be scheduled.

This creates the foundation for the full promotion workflow while keeping commercial claims evidence-aware and author-controlled. It deliberately does not promise sales, rankings, revenue, or platform acceptance.

## Mission 043 — Workflow Quality Gates

Forge now has a versioned **lifecycle quality-gate contract** spanning `concept → architecture → canon → manuscript → editing → visuals → production → positioning → marketing → release`.

Each stage derives its readiness from explicit checks and optional remediation instructions. `canAdvanceWorkflow` prevents a workflow from being considered ready for the next stage when its current gate is blocked, and report validation rejects inconsistent or out-of-order gate state.

This architecture incorporates a useful idea from current open-source book-production systems: long-form AI workflows benefit from explicit phase gates and human-confirmed progression rather than allowing an autonomous agent to run through unresolved stages. Forge keeps that idea inside its existing durable-state, provenance, and author-control architecture rather than adopting another repository's agent model.

The domain contract is tested in `test/workflow-gate.test.js`. It is intentionally documented as a domain capability until an actual Studio route and rendered workflow consume it; this preserves the repository's Functional-Truth Rule.

## End-to-end release target

The first private release remains governed by the Master Product Directive: a real author must be able to carry a project from concept through manuscript, editing, visual work, production, marketing, publishing preparation, and portable recovery without losing canon, voice, continuity, provenance, or author control. Optimization, proposal review, publishing readiness, marketing, and workflow gates are enabling subsystems of that larger workflow, not the product itself.