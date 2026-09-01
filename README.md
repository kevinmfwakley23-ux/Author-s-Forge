# Author's Forge

**Author's Forge** is a local-first author workplace for taking books from idea to finished, edited, illustrated, produced, and publication-ready material.

## Canonical Product Directive

**`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` is the canonical product contract and engineering source of truth.** It defines the target author journey: concept → architecture → canon → characters → timeline → research → manuscript → editing → illustrations → cover → formatting → metadata → positioning → marketing → publishing preparation → portable archive/recovery.

## Chief Engineering Standard

Forge must be a **real working author workplace**, not a mission gallery or collection of promises.

Non-negotiable:

- real implementation only;
- real provider calls only;
- real persistence only;
- no fake AI responses;
- no fake image generation;
- no placeholder controls presented as complete;
- no dead navigation;
- no silent canon mutation;
- no weakening/deleting tests to make builds green;
- major autonomous actions observable, reversible, attributable, and author-controlled.

A green unit-test suite is evidence, not proof. Major capabilities must be reachable from Studio, use durable project state, survive reload/restart, participate downstream, report real errors, and have end-to-end evidence.

## Permanent Platform Targets

**Chromebook and Android are first-class product targets.** Forge uses one platform-neutral web architecture with reusable domain/application/API boundaries, responsive desktop/tablet/phone layouts, touch interaction, PWA installability, conservative offline shell behavior, durable persistence independent of browser process state, and portable recovery.

The service worker may cache the application shell but must not cache `/api/` project data as durable state.

## Functional-Truth Rule

Every major capability is verified at three levels:

1. **Domain/contract** — deterministic services, persistence, validation, provider boundaries.
2. **Application** — real server, routes, state transitions, artifacts, errors, recovery.
3. **Human/device** — rendered Studio UI on supported Chromebook and Android environments.

Source-pattern tests alone are never end-to-end proof.

## Competitive-Benchmark Engineering Workflow

Forge continuously learns from real working applications, current research, and open-source projects that share its capabilities. For each major capability:

**research → architecture → implementation → regression coverage → build/acceptance verification → README/build-history update → next capability.**

Recent benchmarking reinforces several principles: leading author tools emphasize persistent story context and character memory; FireQuill emphasizes scene-versioned character state, voice/arc continuity and author-approved extractor updates; Story Editor emphasizes reviewing newly written material and curating proposed memory before it becomes canon; Novel Studio AI combines structured story state, retrieval memory and continuity checks; and current research emphasizes time-aware story memory rather than relying on a static bible or embeddings alone.

Research is an engineering input, not permission to copy disconnected feature lists. Proven strengths are rebuilt natively around Forge's durable state, provenance, Project Brain, Book Genome, author control, proposal review, workflow gates, production, and recovery.

## Integrated Studio Direction

```text
AUTHOR
  ↓
TYPED / VOICE COMMAND
  ↓
PROJECT + BOOK BINDER
  ↓
ARCHITECTURE
  ↓
CANON / CHARACTERS / WORLD / TIMELINE / RESEARCH / VOICE MEMORY
  ↓
STORY MAP + WRITING DESK + PROJECT BRAIN
  ↓
SALIENT CONTEXT + CAPABILITY-ROUTED MODEL
  ↓
AI DRAFT / EDIT → VOICE + CHARACTER + CONTINUITY GATES
  ↓
EDITORIAL ANALYSIS + CRAFT LENS + KNOWLEDGE GAP RADAR
  ↓
VISUAL / ILLUSTRATION / COVER
  ↓
BOOK GENOME + DOWNSTREAM IMPACT
  ↓
KDP PREFLIGHT + PRODUCTION
  ↓
MARKETING + PROMOTION ANALYTICS
  ↓
DELIVERY AUDIT
  ↓
PORTABLE PROJECT PACKAGE
```

## Build Progress Tracker — Current Source of Truth

This section is the **living engineering checkpoint** for what is finished, what exists as a foundation, and what is next. Update it whenever a major capability is verified or the active build target changes.

### Permanent Chromebook ↔ Phone two-pass completion workflow

This README is the shared coordination board for the two engineering lanes. Both lanes must read current `main` and this README before beginning a new coherent write phase and after the other lane reports a completed block. GitHub `main` is shared truth; neither lane assumes the other lane's state without checking the repository first.

The project is now worked from the beginning of the author journey forward, office by office, using a **lead pass + verification/improvement pass**:

1. **Phone lead pass** — open the next office/capability in product order, inspect the existing implementation first, research current best practices, relevant open-source repositories and authoritative web sources, identify concrete improvements that fit Forge's architecture, implement those improvements without creating parallel infrastructure, add or strengthen tests, verify the work, and record the completed block plus branch/PR/commit/tests in this README.
2. **Chromebook follow-behind pass** — after the phone marks that block ready for review, inspect the actual phone diff and current `main`, independently research the same office/capability for additional proven improvements, reconcile rather than rebuild, strengthen implementation/architecture/tests where justified, run the required verification gates, and record either **PASS — MOVE FORWARD** or the remaining blocker in this README.
3. **Advance rule** — the phone does not treat an office as finally cleared until the Chromebook follow-behind pass is complete. Once Chromebook marks **PASS — MOVE FORWARD**, both lanes move to the next office/capability in product order. The Chromebook therefore stays one verified block behind the phone rather than competing in the same files.
4. **Research rule** — both passes actively inspect authoritative documentation, current web research and useful open-source implementations. Adopt ideas and proven patterns, not disconnected feature lists or copied proprietary code. Improvements must preserve Forge's Project Brain, durable state, author authority, provider boundaries, production truth and platform-neutral architecture.
5. **Overlap rule** — only one lane owns a coherent implementation block at a time. A shared-contract change needed by the lead lane must be written here before crossing into the follow-behind lane's active files. The follow-behind pass may modify the lead work after that lead block is explicitly handed off, because review/reconciliation is its assigned job.
6. **Verification rule** — no block is cleared by source inspection alone. Required evidence is the strongest applicable combination of domain/application tests, build/completion checks, real browser acceptance, restart persistence, artifact inspection, Chromebook fit and Android/mobile acceptance. Tests are never weakened to manufacture green status.
7. **README handoff rule** — every completed verified block updates this section with: active office/capability; lead owner; follow-behind owner; branch/PR/commit; research/improvements made; verification status; unresolved blockers; and whether the next office is cleared to begin.

**Traversal starts at the Forge Brain / Project Brain and proceeds through the product journey until the whole application has received both passes.** The intended progression is Brain/project memory and governance → project/binder architecture and canon → characters/world/timeline/research/voice memory → Story Map/Writing Desk/AI drafting → editing/craft/continuity → visual/illustration/cover → Specialized Creation and Guided Journal offices → production/KDP/metadata/export → marketing/promotion → delivery/recovery → cross-office navigation/UI polish → final Chromebook + Android release acceptance. Existing completed areas are inspected rather than blindly rebuilt.

**Current handoff state:** The owner removed the former Chromebook ownership lock on Mission 059. Mission 059 remains open with its known shared TCG finishing-browser and raster-production defects recorded; it will be completed when the first-pass traversal reaches Specialized Creation. The permanent traversal has started at **Forge Brain / Project Brain**, with Codex owning the lead pass and Chromebook following completed blocks.

### ✅ First pass 001A — Project Brain context authority — READY FOR CHROMEBOOK REVIEW

- **Active office/capability:** Forge Brain / Project Brain retrieval authority.
- **Lead owner:** Codex co-chief engineer.
- **Follow-behind owner:** Chromebook after this handoff.
- **Branch / PR / commits:** `first-pass/001-forge-brain`; PR #42; code `96422ce43f77f97c23a9142e6b8a1dda4ce6b45c`; regression coverage `caf7e123c0b6864e48afa1a28d158726662358d9`.
- **Inspection finding:** archived and superseded records could re-enter live AI prompts through the `changed` projection, including requests with no `changedSince` intent. This could revive obsolete canon during drafting.
- **Improvement:** historical records remain durable and auditable, but Project Brain now excludes archived/superseded authority from live context and emits changed-state context only for explicit `changedSince` queries.
- **Regression coverage:** verifies normal retrieval and changed-since retrieval exclude obsolete history while preserving current authoritative canon.
- **Verification:** Forge CI #638 / run `33471875890` passed TypeScript build, full unit suite, completion checks, client/shell syntax checks, desktop browser acceptance, and Android/mobile acceptance on code head `caf7e123c0b6864e48afa1a28d158726662358d9`.
- **Unresolved blockers:** none in this coherent block.
- **Handoff:** ready for Chromebook independent review. Codex advances to the next Forge Brain block after the documentation head is green and PR #42 is merged.

### ✅ First pass 001B — Brain memory integrity and atomic recovery — READY FOR CHROMEBOOK REVIEW

- **Active office/capability:** Forge Brain durable memory validation and recovery.
- **Lead owner:** Codex co-chief engineer.
- **Follow-behind owner:** Chromebook after this handoff.
- **Branch / PR / commits:** `first-pass/001b-brain-memory-integrity`; PR #45; runtime validation `6b8383279187a6adf32b2c1c37aaa2f00dff57c5`; atomic store `be60f92f58caa4160196921b818e20d2e8d5a3df`; tests/fix head `8e3f738d77f8bb7aab4114f6b2a19f0a6e6f6acf`.
- **Inspection finding:** recovery cleared valid memory before validating the complete imported payload, so a malformed or duplicate record could leave a partially restored Brain.
- **Improvements:** runtime validation now covers memory class, authority, required content, lifecycle/provenance timestamps, relationship/tag shape and self-supersession; registration and lifecycle mutations validate records; restore stages and validates every record before atomically replacing current state.
- **Regression coverage:** proves duplicate IDs, malformed records, invalid authority and invalid timestamps fail without changing the valid store; snapshot project isolation remains enforced.
- **Verification:** Forge CI #646 / run `33475774626` passed TypeScript build, all 383 unit tests, completion and syntax checks, desktop browser acceptance, and Android/mobile acceptance on code head `8e3f738d77f8bb7aab4114f6b2a19f0a6e6f6acf`.
- **Unresolved blockers:** none in this coherent block.
- **Handoff:** ready for Chromebook independent review. Codex advances to Brain lifecycle-transition integrity after the documentation head is green and PR #45 is merged.

### ✅ First pass 001C — Brain canon lifecycle-transition integrity — READY FOR CHROMEBOOK REVIEW

- **Active office/capability:** Forge Brain promotion/supersession integrity.
- **Lead owner:** Codex co-chief engineer.
- **Follow-behind owner:** Chromebook after completing 001A and 001B reviews.
- **Branch / PR / commits:** `first-pass/001c-brain-lifecycle-integrity`; PR #48; transition guard `786b09b6967805d594af2c0bfb631b8c21cd8eb9`; regression head `357af6618a30f441ea1573b40baefcaedc2235f7`.
- **Inspection finding:** supersession allowed cross-class replacement, inactive source/replacement reuse, repeated replacement and ambiguous reuse of a replacement already linked to another source. Those paths could create non-reciprocal canon history.
- **Improvements:** replacements must share project and memory class; both records must be active; existing replacement links cannot be silently reused; transition time cannot predate either record; both reciprocal records validate before either mutation commits.
- **Regression coverage:** proves cross-class, archived, ambiguous, repeated and nonchronological transitions fail atomically, while a valid transition creates exactly one reciprocal `supersededBy` / `supersedes` relationship.
- **Verification:** Forge CI #649 / run `33476955533` passed TypeScript build, all 387 unit tests, completion and syntax checks, desktop browser acceptance, and Android/mobile acceptance on code head `357af6618a30f441ea1573b40baefcaedc2235f7`.
- **Unresolved blockers:** none in this coherent block.
- **Handoff:** ready for Chromebook independent review after 001A and 001B. Codex advances to the next Forge Brain block after the documentation head is green and PR #48 is merged.

### ✅ First pass 001D — Brain lifecycle attribution ledger — READY FOR CHROMEBOOK REVIEW

- **Active office/capability:** Forge Brain durable promotion/supersession attribution and recovery.
- **Lead owner:** Codex co-chief engineer.
- **Follow-behind owner:** Chromebook after 001A–001C reviews.
- **Branch / PR / commits:** `first-pass/001d-brain-lifecycle-ledger`; PR #50; ledger `39c2061bd696bda78dedf113dc2b2667f559b624`; regression coverage `c8a652cd1f94148f9c96e702e3262bbec705db49`; public contracts `67fe49031b1b73541e72a0c12e9183903e8f60b2`.
- **Inspection finding:** promotion and supersession changed durable canon, but actor, reason, transition time and replacement evidence existed only as transient call results and disappeared across snapshot/export/restart.
- **Improvements:** project-scoped lifecycle events persist promotion/supersession actor, reason, time, prior/new authority and replacement link; supersession requires explicit attribution; events commit only after transition validation; snapshots preserve and restore the ledger while older snapshots without events remain compatible.
- **Recovery safety:** event IDs, projects, referenced memories, replacements, actors, reasons and timestamps validate before any restore mutation; duplicate/malformed/cross-project events fail atomically.
- **Regression coverage:** proves restart persistence, snapshot round-trip, defensive cloning, project isolation, malformed-event rollback and required attribution.
- **Verification:** Forge CI #653 / run `33477853720` passed TypeScript build, all 391 unit tests, completion and syntax checks, desktop browser acceptance, and Android/mobile acceptance on code head `67fe49031b1b73541e72a0c12e9183903e8f60b2`.
- **Unresolved blockers:** none in this coherent block.
- **Handoff:** ready for Chromebook independent review after 001A–001C. Codex advances to the next Forge Brain block after the documentation head is green and PR #50 is merged.

### ✅ First pass 001E — Brain context provenance and budget integrity — READY FOR CHROMEBOOK REVIEW

- **Active office/capability:** Forge Brain context assembly, provenance and context-budget reporting.
- **Lead owner:** Codex co-chief engineer.
- **Follow-behind owner:** Chromebook after the 001D review.
- **Branch / PR / commits:** `first-pass/001e-brain-context-integrity`; PR #51; pipeline fix `413506accc07ae3983e9f2b4e8f34ad866584604`; regression head `79fd330d9c73448c4f6547798644ad1191235e63`.
- **Inspection finding:** the pipeline calculated `originalEstimatedTokens` after budget trimming while adding pre-budget savings separately, making token metrics internally inconsistent; provider-facing context also omitted memory provenance.
- **Improvements:** every assembled memory section now carries explicit provenance; savings and compression ratio use one complete pre-budget baseline; selected/omitted IDs remain visible; provenance is reported as a strategy signal.
- **Regression coverage:** proves provenance reaches context, budget omissions remain honest, and `tokensSaved === originalEstimatedTokens - optimizedEstimatedTokens`.
- **Verification:** Forge CI #656 / run `33478534682` passed TypeScript build, all 392 unit tests, completion and syntax checks, desktop browser acceptance, and Android/mobile acceptance on code head `79fd330d9c73448c4f6547798644ad1191235e63`.
- **Unresolved blockers:** none in this coherent block.
- **Handoff:** ready for Chromebook independent review after 001D. Codex advances to the next Brain capability after the documentation head is green and PR #51 is merged.

### Mission 059 parallel engineering coordination

- **Chromebook lane currently owns 059B shared Specialized Creation reconciliation/verification**: shared durable project/workspace/revision/proposal storage, project-scoped application facade, Project Brain/provider/asset bridges, renderer-independent composition contract, shared production-profile/preflight foundation, and shared integration/CI fixes required by those contracts.
- **Phone lane currently owns 059D comic-specific implementation and hardening**, inheriting PR #38's comic implementation and reconciling/hardening it instead of creating a parallel comic stack.
- **Boundary rule:** Chromebook must not take over comic-specific scripting, page/panel, reading-order, lettering, comic export, or comic-editor behavior while the phone's 059D block is active. Phone must not duplicate shared Brain/provider/storage/composition/production infrastructure.
- **PR #38 (`office/specialized/mission-059-complete`) is the current Mission 059 integration branch.** Both lanes inspect its current head and CI state before writing overlapping files.
- **Current shared verification focus:** get PR #38 fully green across build, unit, completion, browser and Android/mobile gates while preserving the ownership boundary above. Only then should a Mission 059 phase-completion claim be recorded.

### ✅ Completed / verified major capability areas

- **Core local-first Studio foundation** — durable projects, browser application, Chromebook/Android targets, PWA shell boundary, project package/recovery foundations and CI acceptance gates.
- **Project Brain / canon memory foundation** — durable project memories, governed context assembly, provenance and author-controlled canon boundaries.
- **Manuscript and Writing Desk foundation** — durable book/chapter/scene workspace, real AI provider boundary, durable proposal/review behavior and author-controlled application.
- **Character Bible and living character-state foundation** — structured character profiles, versioned state/history and saliency-aware retrieval services.
- **Research and research-honesty foundations** — provenance-aware research records and explicit fact/inference/creative/uncertain distinctions.
- **Editing / Craft Lens foundations** — deterministic editorial analysis and author-reviewable proposal workflows without silent rewriting.
- **Cover Studio / KDP production foundations** — production geometry, cover planning and KDP preflight infrastructure.
- **Guided Journal Office — COMPLETE** — merged through PR #37 (`fe8125941b09159a57520ac39ecbdac040d322e2`) after build, unit, completion, desktop-browser, Guided Journal browser and Android/mobile acceptance passed.

### ✅ Guided Journal Office capability checklist

The Guided Journal Office now includes:

- six Better Question-compatible categories: **Remember, Discover, Challenge, Create, Become, Hope**;
- durable project-scoped master question and cover-statement libraries;
- author add/revise, enable/disable, remove and JSON import/export controls;
- deterministic single-question randomization;
- category filters, exclusions, reproducible seeds and balanced generation;
- no-repeat protection within an edition and across prior editions by default;
- durable edition ordering and restart-safe history;
- blank, lined, lightly-lined, dot-grid and guided-response page styles;
- trim size, margins, typography, prompt alignment, line/dot spacing, page numbering, category labels, front matter, closing matter and response-page controls;
- real print-PDF rendering with exact page count, byte length, SHA-256 and shared production validation;
- live page preview and PDF download;
- shared Project Brain context and production memory;
- shared AI/provider stack through `generateProjectText` with configured OmniRoute, 9Router, K.I.N.G.S., OpenAI and Ollama routing/failover;
- Brain-aware AI question proposals with explicit author approval before library promotion;
- Brain-aware AI cover direction and back-cover copy;
- direct `BookCoverStudioService` handoff using the journal's actual rendered page count/trim geometry for cover/spine calculations;
- responsive dedicated journal workplace with Chromebook and Android launch paths;
- real-browser regression coverage for durable library, randomizer, edition generation, lined PDF bytes, AI proposal/approval, cover geometry, restart persistence and phone-sized touch/overflow.

### 🟡 Active next build — Specialized Creation Office

**Research lock is complete.** The implementation contract is [`docs/MISSION-059-SPECIALIZED-CREATION-OFFICE.md`](docs/MISSION-059-SPECIALIZED-CREATION-OFFICE.md). Specialized Creation implementation must follow its requirement IDs, phase gates, research adoption ledger, ADR triggers, verification matrix and anti-drift rules. The reusable format for future major work is [`docs/ENGINEERING_MISSION_TEMPLATE.md`](docs/ENGINEERING_MISSION_TEMPLATE.md).

The Specialized Creation Office is **not starting from zero**. Domain/workflow/production foundations already exist for exactly these six canonical modes:

1. **Comic books**
2. **Greeting cards**
3. **Birthday cards**
4. **Invitations**
5. **Flyers**
6. **Trading card game cards**

Existing foundations already define specialized creation identity, production dimensions/bleed, and the shared workflow:

**brief → plan → create → review → production**

The next engineering phase is to turn those foundations into a complete live office. Completion requires:

- durable specialized-project/application services and restart-safe storage;
- Project Brain connection and shared AI-provider access rather than a separate AI silo;
- shared illustration/image-generation integration where appropriate;
- author-controlled AI proposals and revisions;
- real mode-specific editors/workflows for all six creation types;
- comic page/panel/script/lettering/asset workflows;
- greeting/birthday card front/inside/back composition and fold/print handling;
- invitation event-information, hierarchy, layout and production workflows;
- flyer content hierarchy, image/text layout, bleed/safe-area and export workflows;
- trading-card-game template, card data, rules/stat fields, fronts/backs, set/deck consistency and sheet/export workflows;
- real production artifacts rather than preview-only controls;
- integration with shared Brain, visual/illustration capabilities, Cover/production systems where applicable;
- responsive live Studio surface with Chromebook and Android touch support;
- domain, application, browser and mobile acceptance proving every major path.

**Guided journals remain a separate completed office and must not be folded into Specialized Creation.**

### 🟡 Remaining cross-Forge integration / hardening

These areas have foundations or substantial implementation but still require continued integration/hardening before the entire Author's Forge product is considered complete:

- finish the Mission 058 live Writing Desk/provider path so saliency-aware character context is proven end-to-end in ordinary drafting;
- integrate Author Voice Memory and visible drift checks into live AI drafting/proposal application;
- extend saliency-aware retrieval across character memory, canon, timeline, research and author voice;
- continue Author Goals, Craft Lens, Knowledge Gap Radar and Story Map integration/hardening;
- strengthen full-product production preview/KDP, metadata, export and delivery-audit flows;
- complete marketing/promotion planning and measurement workflows;
- complete final cross-office navigation/workflow consolidation;
- perform the planned UI/UX redesign after functional office capability is in place, without weakening durable behavior;
- verify complete end-to-end author journeys on Chromebook and Android with real configured providers.

### Current build order

1. Bring the current Mission 059 parallel handoff to a clean verified checkpoint without discarding in-flight work.
2. Begin the permanent two-pass traversal at **Forge Brain / Project Brain**: phone lead pass, Chromebook follow-behind pass.
3. Continue office-by-office through the integrated author journey until every major capability has received both passes.
4. Complete production/marketing/delivery hardening and cross-office integration discovered during traversal.
5. Remodel and polish the overall Studio UI/UX once functional coverage is stable.
6. Run full-product Chromebook + Android release acceptance and clear the final Definition of Complete gate.

## Mission 058 — Saliency-Aware Character Memory Retrieval

Forge's living Character Bible now has an application-integrated retrieval boundary that can supply **only the most relevant character state needed for a drafting task**, instead of dumping every character into every AI request.

`CharacterBibleService.memory()` provides:

- project-scoped character retrieval;
- optional character targeting;
- optional point-in-time historical reconstruction;
- field-scoped context selection;
- query-term relevance scoring;
- deterministic ranking and limits;
- human-readable evidence for why a character was selected;
- current emotional state and location when broad context is requested;
- defensive cloning so retrieval cannot mutate authoritative character state.

`assembleWritingContext()` consumes this saliency layer for the `characters` context section. Character context is restored through the authoritative Character Bible service, queried by task terms, ranked, limited, and emitted with relevance evidence and source IDs.

`AiWritingStudioService.generateWithProjectContext()` is now the governed Studio application boundary for Mission 058. It:

- loads the authoritative project immediately before generation;
- validates the real manuscript target;
- assembles character context from current project state;
- accepts explicit character targeting and historical `characterAsOf` context;
- applies deterministic character-memory limits;
- passes the assembled context and source IDs into the real AI writing coordinator;
- creates the same durable author-reviewable proposal as the existing AI loop;
- computes a fresh base-content hash so stale manuscript protection remains active.

The AI provider therefore receives a **salient character projection derived immediately from authoritative project state**, rather than a caller-supplied static character dump.

Regression coverage verifies the application boundary, including salient character selection, source-ID provenance, historical context, proposal creation, and existing author-approval/stale-content protections.

### Mission 058 completion gate

Mission 058 remains active as a cross-Forge integration item until the live Studio route/provider execution is wired to this governed application boundary and CI/build verification proves the complete request path. The required final path is:

**Writing Desk request → authoritative project load → character retrieval → assembled context → real model/provider → durable proposal → character continuity evidence before application → author review.**

This no longer blocks completion of independent offices; it remains explicitly tracked above under cross-Forge integration/hardening.

## Mission 057 — Versioned Character State Memory

Forge's character system is moving beyond a static character bible toward a **living, scene-aware character memory**. The existing Character Bible stores a complete structured profile, field history, effective timestamps, reasons and actor attribution.

`src/domain/character-state-memory.ts` adds scene-specific snapshots, project/character ownership, sequence-ordered memory history, provenance, point-in-time state resolution, deterministic relevance ranking, changed-field attribution, and validation.

## Mission 056 — Author Voice Memory + Drift Preservation

Forge's voice system maintains an explicit approved author corpus with provenance, genre/purpose metadata, weighting, canonical sample selection, aggregated voice fingerprinting, interpretable voice dimensions, corpus updates, drift detection, reference matching, actionable recommendations, and reusable author-voice context.

**Design rule:** Forge learns from the user's own approved corpus and treats voice preservation as a constraint alongside canon, character state, continuity, meaning, and author intent.

## Mission 055 — Craft Lens Foundation

Forge has a deterministic Craft Lens domain/application boundary for targeted manuscript feedback instead of a single opaque “quality score.” It measures concrete signals and produces evidence plus multiple revision strategies. The lens never rewrites prose or declares stylistic choices objectively wrong.

## Mission 054 — Author Goals Foundation

Forge has a deterministic Author Goals foundation designed around authoritative manuscript progress rather than an isolated counter. It supports word, scene, chapter, daily/weekly/session/project goals and deterministic progress calculations.

## Mission 053 — Live Story Map

The Story Map is a live Studio planning surface derived from the existing durable book/chapter/scene hierarchy. It provides visual hierarchy, lifecycle status, completion, refresh behavior, and direct scene navigation without creating a second planning database.

## Mission 052 — Competitive Advantage Research

Forge converted competitive research into an implementation sequence:

1. Story Map.
2. Author Goals.
3. Knowledge Gap Radar.
4. Craft Lens.
5. Production Preview.
6. Collaboration Review.

## Mission 051 — Editing Room Proposal Review Diff

The Editing Room provides deterministic review of durable AI rewrite proposals. Authors can inspect line-level added/removed/unchanged content and before/after word counts. Approval remains separate from application, with server-side source-revision protection.

## Production, KDP and Promotion Benchmark

Forge is intentionally expanding beyond writing. Current all-in-one publishing products increasingly connect research, writing, editing, illustration, covers, formatting, publishing listings and promotion in one workflow. KDP-focused products emphasize print-ready EPUB/PDF output, full-wrap cover constraints, metadata and listing preparation.

Cover benchmarking reinforces that professional KDP output requires more than attractive artwork: trim, bleed, spine math, typography, barcode space and full-wrap export must be validated as production artifacts.

Forge's product goal is to connect these concerns to the same authoritative Book Genome and production state so metadata, cover, blurb, audience, launch plan, retailer readiness, and promotion evidence remain synchronized rather than becoming separate spreadsheets.

## CI / PWA Integrity

Canonical CI covers installation, build, tests, completion measurement, client syntax checks, browser acceptance, and mobile acceptance. The PWA shell remains separate from durable `/api/` project state.

## Definition of Complete

Forge is complete only when a real author can create or restore a project and carry it through the intended Studio journey — concept, architecture, canon, characters, research, manuscript, editing, visual work, cover, production, positioning, marketing, publishing preparation, delivery audit, and portable recovery — with durable state, real provider boundaries, author approval, truthful failures, preserved author voice, coherent scene-versioned character memory, salient context retrieval, and verified Chromebook/Android operation.