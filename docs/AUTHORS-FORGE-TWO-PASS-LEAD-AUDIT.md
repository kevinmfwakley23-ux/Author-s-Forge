# Author's Forge — Two-Pass Lead Engineering Audit

**Purpose:** permanent engineering ledger for the lead pass (repository research + implementation) followed by Chromebook verification/research/improvement.

**Rule:** never treat an old branch, green unit test, or existing feature name as proof that the user-facing workflow is complete. Preserve working implementations; reconcile rather than duplicate; require real persistence/provider/artifact/browser/device evidence before completion claims.

## Pass protocol

For every trunk capability and office:

1. Read the canonical architecture and current implementation before changing code.
2. Inventory related branches/PRs so existing work is not accidentally rebuilt or overwritten.
3. Research current production patterns, standards, and strong comparable tools.
4. Identify concrete gaps in Author's Forge rather than importing features for their own sake.
5. Implement the smallest coherent production-ready block on an isolated branch.
6. Add regression/contract tests that would fail on the prior defect.
7. Run build + full regression + completion + browser + mobile gates where applicable.
8. Hand the exact branch/PR to the Chromebook pass for independent review, extra research, and improvement.
9. Reconcile the Chromebook findings before merging and advancing to the next office.

## Canonical traversal

### 0. Forge Brain / Core / Trunk — ACTIVE

Audit targets:
- one authoritative Project Brain and durable project-state boundary;
- one authoritative AI model registry/router/executor;
- real health evidence, cooldowns, retry/fallback, quota/cost protection and runtime telemetry;
- hierarchical memory, provenance, authority, saliency and conflict handling;
- author voice and context optimization;
- research/governance/approval boundaries;
- crash-safe persistence, recovery and conflict/version semantics;
- artifacts/versioning/jobs/streaming;
- API/PWA/device foundations and security.

Current lead branch: `core/forge-brain-lead-pass-001`
Current lead PR: #41

Research direction already applied in PR #41:
- unified gateway/router patterns: central model selection with health-aware retry/fallback and cost/quota controls;
- GenAI observability patterns: model, latency, token and retry telemetry while keeping manuscript/prompt content opt-in;
- durable file-state patterns: unique sibling temporary files, sync-before-rename, cleanup and concurrency regression coverage.

Known next trunk gaps:
- production Studio server still constructs/uses persistence outside the ForgeCore composition root;
- live provider execution still has a parallel provider-order path instead of consuming ForgeCore broker selection;
- configured model capability declarations still need a later truthfulness audit against actual model/provider metadata;
- project-level optimistic conflict/version handling remains to be designed after Studio uses the shared trunk;
- core governance/artifact/jobs/device contracts remain incomplete.

### 1. Author Desk / Project Start

Audit targets:
- project creation/open/import/recovery;
- book type and workflow selection;
- author goals/preferences/accessibility;
- clear project health and recovery status;
- no destructive default actions.

Research comparisons: Scrivener binder/project onboarding, Atticus project workflow, modern local-first application recovery and accessible onboarding.

### 2. Idea Office

Audit targets:
- brainstorming without premature canonization;
- premise/theme/audience/genre exploration;
- evidence-aware market/research links;
- alternatives and decision memory;
- clean promotion of approved ideas into Project Brain.

### 3. Story Development Office

Audit targets:
- architecture before prose;
- beat/scene/chapter planning;
- Story Map and Book Genome integration;
- dependency/impact analysis;
- unresolved-question tracking;
- author approval before structural mutation.

### 4. Character Office

Audit targets:
- full structured Character Bible;
- time-versioned state and relationship history;
- continuity evidence and contradiction warnings;
- visual identity/reference images;
- author-controlled canon changes;
- character-aware retrieval without overloading context.

### 5. World / Continuity / Timeline Office

Audit targets:
- locations, rules, objects, factions and world facts;
- explicit chronology and temporal queries;
- relationship/event graph;
- conflict detection with evidence;
- current-vs-historical state separation.

### 6. Research Office

Audit targets:
- governed internet/source intake;
- source/date/URL/claim/confidence/relevance;
- research-honesty classifications;
- source freshness and contradiction handling;
- citations kept separate from creative canon;
- no invented facts or silent conversion of inference to fact.

### 7. Author Voice / Style

Audit targets:
- durable author-voice profile built from author-approved evidence;
- drift detection and explainable style signals;
- per-project/per-series voice inheritance;
- no flattening of intentional stylistic variation;
- live Writing Desk integration.

### 8. Writing Desk / AI Drafting

Audit targets:
- real live provider path through Forge Brain;
- human/co-pilot/autonomous collaboration modes;
- proposal-first generation with attributable context;
- scene/chapter/binder persistence;
- streaming/cancellation/retry;
- no silent manuscript or canon mutation;
- context/token/cost visibility appropriate for authors.

### 9. Editing / Craft / Continuity

Audit targets:
- developmental, continuity, line, copy and proofreading layers;
- Craft Lens and explainable findings;
- scoped diffs/proposals and author review;
- source-content anchoring and stale-proposal detection;
- accepted-change persistence with audit trail;
- voice-preservation checks.

### 10. Visual / Illustration Office

Audit targets:
- upload/reference/edit/generate workflows that use real image assets;
- original preservation and non-destructive versions;
- character visual continuity;
- asset metadata/provenance/approval;
- image edit masks/regions/reference sets where supported;
- usable export formats/resolution/bleed and real device upload flows.

### 11. Specialized Creation Office

Current active work: PR #38 shared Mission 059; PR #39 comic hardening.

Locked specialized feature set for this office:
- comics;
- greeting cards;
- birthday cards;
- invitations;
- flyers;
- trading-card-game cards.

Guided Journals remain a separate office/workflow.

Audit targets after current in-flight reconciliation:
- shared composition/persistence/Brain contracts;
- type-specific authoring semantics;
- deterministic layout/reading order;
- real asset composition;
- preflight and production artifacts;
- browser/mobile authoring acceptance.

### 12. Guided Journal Office

Audit targets:
- prompt/library architecture;
- repeated-page/interior composition;
- deterministic randomization when requested;
- KDP-safe layout and export;
- author-owned templates/series;
- no accidental coupling to Specialized Creation.

### 13. Layout / Interior Production

Audit targets:
- typography/style system;
- trim/bleed/margins/gutter/page numbering/front/back matter;
- image placement and print resolution;
- reflow versus fixed-layout rules;
- deterministic production preview;
- production warnings that reference actual persisted book configuration.

### 14. Cover Studio

Audit targets:
- front/spine/back geometry derived from authoritative publishing config;
- KDP spine calculations and barcode safe area;
- real cover image/reference/edit workflows;
- non-destructive variants and approvals;
- print-resolution PDF generation and preflight.

### 15. Production / KDP / Metadata / Export

Open audit/reconcile candidates: PR #29 and PR #32.

Audit targets:
- authoritative persisted geometry only;
- DOCX/PDF/EPUB and KDP variants as real artifacts;
- font/image/link/TOC/page-count validation;
- metadata/ISBN/barcode responsibilities clearly separated;
- delivery-readiness audit with blocking versus advisory findings;
- exact artifact provenance/version.

### 16. Promotion / Marketing

Open audit/reconcile candidate: PR #11.

Audit targets:
- evidence-aware positioning and market research;
- launch/campaign assets by channel;
- reusable cover/illustration assets;
- no unsupported sales/ranking claims;
- author approval before scheduling/publishing;
- exportable promotional artifacts.

### 17. Publishing / Delivery / Vault / Recovery

Open audit/reconcile candidates: PR #4 and PR #5.

Audit targets:
- portable project packages;
- restore preview and author-controlled overwrite;
- automatic backup before replacement;
- integrity/load-back verification;
- artifact history/versioning;
- external storage boundaries;
- final delivery package manifest.

### 18. Navigation / UI / Accessibility / Device Polish

Audit targets:
- reduce clutter while preserving power;
- office navigation that mirrors canonical workflow;
- clear current-project/current-book context;
- keyboard and touch targets;
- Chromebook/Android first-class behavior;
- screen-reader semantics, focus state and reduced-motion support;
- PWA installation/update/recovery behavior;
- no UI control without a real application action or actionable explanation.

## Existing open PR reconciliation inventory

Do not merge these merely because they exist. Compare each against current `main`, determine whether the capability is already present/superseded, extract only still-useful work, and close or reconcile deliberately.

- #41 — Forge Brain lead pass — ACTIVE lead lane.
- #39 — Mission 059D comic hardening — ACTIVE phone/specialized lane.
- #38 — Mission 059 Specialized Creation — ACTIVE shared/Chromebook reconciliation lane.
- #32 — authoritative KDP preflight — audit when traversal reaches Production.
- #29 — live KDP production preflight — audit when traversal reaches Production.
- #11 — evidence-aware launch campaign — audit when traversal reaches Promotion.
- #10 — AI proposal review integrity — audit when traversal reaches Writing/Editing.
- #8 — governed context stratification/budget controls — audit during Forge Brain/context pass.
- #7 — production context engine stack — audit during Forge Brain/context pass.
- #5 — author-controlled recovery safety — audit during Forge Brain/recovery and final Vault pass.
- #4 — durable project restore boundary — audit during Forge Brain/recovery and final Vault pass.
- #3 — real functional verification/reference-image pipeline — audit during Forge Brain verification and Visual Office pass.

## Completion rule

The lead pass advances only when the current block has honest evidence and a clean handoff. The Chromebook pass may improve, reject, or extend the lead implementation. An office is not complete because its domain objects exist; it is complete only when the real author journey works through persistence, providers, artifacts, browser behavior and target-device acceptance as applicable.
