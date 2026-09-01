# 002E — Publishing + Promotion Office completion handoff

**Office:** Publishing / Market Intelligence / Promotion  
**Pass:** Codex first-pass completion and hardening  
**Branch:** `first-pass/002e-market-statistics-workbench`  
**PR:** #87  
**Completion rule:** merge only after exact-head Forge CI passes build, regression/completion checks, desktop browser acceptance, Promotion-performance browser acceptance, and Android/mobile acceptance.

## Product contract

This block completes the author-facing release-preparation and promotion workflow without pretending Author's Forge can bypass retailer/publishing-platform submission systems or fabricate market/campaign results.

The supported journey is:

```text
BOOK + PRODUCTION EVIDENCE
  ↓
PUBLISHING METADATA
  ↓
EDITION-SCOPED PUBLISHING READINESS
  ↓
CURRENT MARKET RESEARCH + OBSERVABLE STATISTICS
  ↓
AUTHOR-APPROVED KEYWORD APPLICATION
  ↓
AI PROMOTION DRAFT CAMPAIGN
  ↓
AUTHOR REVIEW / APPROVAL / SCHEDULE / EXTERNAL-PUBLISH CONFIRMATION
  ↓
PROMOTION READINESS
  ↓
CROSS-OFFICE RELEASE GATE
  ↓
OBSERVED CAMPAIGN PERFORMANCE
  ↓
EVIDENCE-AWARE NEXT TESTS
```

## Publishing Office

### Durable metadata

Publishing metadata is durable per book and revisioned in project memory. It covers:

- title/subtitle/series/edition information;
- author/contributors/publisher;
- retail description;
- up to seven KDP keyword phrases;
- up to three categories;
- audience and reading age;
- marketplace/language;
- enabled release formats (`ebook`, `paperback`, `hardcover`);
- ISBN strategy;
- publication date;
- AI-content disclosure state.

KDP-oriented compliance checks reject or warn on unsupported/misleading metadata patterns rather than silently passing them.

### Edition-scoped readiness

Publishing readiness is bound to the exact release edition. An eBook audit cannot inherit paperback/hardcover cover evidence, and a print audit cannot borrow another format's cover plan.

The server, not the browser, owns illustration-library counts/resolution references/approval status. The readiness report includes manuscript, metadata, cover, formatting, images, pagination and production checks with error/warning severity.

A new regression exercises the actual route + durable store and proves an approved paperback cover does **not** satisfy an eBook cover-file/front/validation audit.

### Stale-audit protection

A previously ready Publishing audit is not permanent release truth. The Release Gate checks whether Publishing metadata or the matching edition cover changed after the audit. If so, it adds a `publishing-readiness-stale` blocker and requires a fresh readiness run for the exact edition.

The freshness check is deliberately edition-specific; unrelated Promotion activity does not make a Publishing audit stale.

### Honest external handoff

Forge prepares publication metadata, production/readiness evidence and release-gate truth. It does not claim to publish directly to KDP when no supported configured retailer API exists. The author remains responsible for the retailer/platform submission and preview steps required by the external platform.

## Market Intelligence

Market research uses the configured real web-research provider and fails honestly when no provider credentials/model are configured.

Reports persist:

- current evidence URLs and observation timestamps;
- comparable title price/category/BSR/review/rating/publication fields only when actually observed;
- deterministic sample statistics such as medians and recency;
- evidence-linked keyword recommendations;
- evidence-linked niche opportunities;
- limitations and confidence language.

Forge does **not** turn BSR, reviews or ratings into invented unit-sales/revenue estimates. Research evidence can inform a decision but is not a sales guarantee.

Applying researched keywords to Publishing metadata requires explicit author approval and remains capped by the KDP seven-keyword contract.

## Promotion Office

### Campaign planning and author authority

The Promotion planner uses real book metadata, saved research and the shared configured AI provider pool to draft complete campaign assets for supported channels including social, email, author site, reader communities, press, retailer surfaces, Amazon Ads and A+ content.

Generated assets begin as drafts. AI cannot self-approve, self-schedule or self-publish them.

Campaign revisions persist in `marketing-memory`. Asset lifecycle supports:

- draft;
- approved/rejected;
- scheduled;
- externally published only after explicit author confirmation.

Compliance checks prevent evidence-poor or unsupported Amazon Ads/A+ claims from silently reaching release-ready state.

### Promotion readiness

Promotion readiness evaluates the selected campaign and exposes blockers for unfinished review/approval/compliance work. The cross-office Release Gate requires both current Publishing readiness and Promotion readiness before reporting release-ready status.

## Measured Promotion performance

The Promotion Office now contains a post-launch performance ledger backed by durable `marketing-memory` records.

Each observation is immutable and stores:

- project/book/campaign and optional asset identity;
- source (`amazon-ads`, `bookbub-ads`, email, social, author site, retailer, press, reader community, other);
- reporting period;
- observation timestamp;
- source reference and optional source URL;
- currency where money is present;
- optional notes;
- only the metrics actually observed.

Supported observed metrics include impressions, clicks, spend, attributed orders, attributed units, attributed revenue, delivered emails and opens.

Forge derives metrics only when the required inputs exist:

- CTR;
- cost per click;
- CPM;
- attributed conversion rate;
- cost per attributed order;
- ACOS;
- ROAS;
- email open rate.

If spend exists without platform-attributed revenue, Forge explicitly leaves ROAS/ACOS unknown instead of substituting unrelated retailer sales. If clicks exist without attributed orders, conversion remains unknown.

When two asset observations share the same source and reporting period, Forge can identify the higher observed CTR and recommend another controlled test. That recommendation is evidence-aware and is not a promise that the apparent winner will generalize.

## Studio / device surface

Publishing, Market Research, Keyword Finder, Promotion campaign review, Release Gate and Promotion Performance all live inside the canonical Studio rather than a parallel demo surface.

Automated browser acceptance verifies the live Studio server and durable project data. Promotion-performance browser acceptance records a real observation through the UI/API, checks derived CTR/CPC/ACOS/ROAS, verifies durable memory, and checks Android-size touch target and overflow behavior.

## Regression coverage added/hardened

Key coverage includes:

- Publishing metadata validation/persistence and monotonic revision timestamps;
- Publishing readiness warnings vs release-blocking errors;
- exact release-format filtering;
- cross-edition cover isolation through the real Publishing route;
- stale Publishing readiness blocking after metadata mutation;
- Promotion campaign lifecycle and author publication authority;
- Promotion readiness and cross-office Release Gate;
- market-statistics honesty and keyword approval;
- Promotion-performance snapshot validation, provenance, restart persistence and immutable IDs;
- derived metric correctness and missing-attribution behavior;
- campaign-asset performance comparison / next-test insight;
- Studio source/client integration;
- full Publishing/Promotion desktop browser acceptance;
- measured Promotion-performance desktop + Android-fit acceptance.

## Handoff rule

This block is **not** cleared by this document alone. PR #87 may be merged only when the exact PR head has a fully green Forge CI run, including desktop browser acceptance and Android/mobile acceptance. After merge, `main` becomes the shared source of truth for the Android second pass and the next forward engineering block.
