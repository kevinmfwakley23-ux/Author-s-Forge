# Author's Forge

**Author's Forge** is a local-first AI authoring and publishing workplace for taking a project from idea → structured book → canon and characters → writing and editing → illustration and cover → production → market research and promotion → delivery and recovery.

This repository is the working product, not a mission gallery. The canonical product contract remains [`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md`](AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md).

## Chief Engineering Standard

Author's Forge is built under one permanent rule: **real working code only**.

### No fake-ass code rule

**No fake-ass code.** If Forge says a feature is built, it must be real, workable, usable, connected to the actual application/state boundary, and verifiable through the real product path.

Production behavior must not use or present any of the following as finished capability:

- fake AI responses, canned provider answers, fabricated research, or simulated success states;
- placeholder buttons, dead navigation, demo-only routes, fake persistence, or fake downloads;
- fake image generation or fabricated art assets;
- fake publishing readiness, market statistics, sales claims, campaign performance, or KDP compliance claims;
- swallowed provider/storage errors that look like success;
- silent canon changes, silent manuscript rewrites, or AI self-approval;
- test weakening or test deletion merely to make CI green.

Mocks and test doubles are permitted only inside clearly identified automated tests. They are never a production fallback and never count as proof that an unavailable provider works.

When a real credential, provider, dependency, browser capability, or external service is missing, Forge must fail honestly, preserve the author's work, and explain what is unavailable.

## Current Product State — September 1, 2026

The cumulative build is now a substantial usable application with durable local project state and separate first-class author workplaces. Recent integration work has brought the following onto the current production line:

- hardened **Project Brain** memory, provenance, point-in-time retrieval, lifecycle attribution, state-conflict detection, context budgeting, retrieval diagnostics, and evaluation;
- durable **project / book / chapter / scene** manuscript structure;
- **Story Architecture**, **Story Map**, **Writing Desk**, and governed AI writing proposals;
- structured **Character Bible** with temporal state and continuity evidence;
- **World, canon, timeline, relationship, voice, research, decision, and production memory**;
- **Author Voice Memory** and provider-facing voice preservation / drift evidence;
- **Intelligent Editing**, Craft Lens findings, durable rewrite proposals, deterministic review diffs, and explicit author approval/apply boundaries;
- durable **book version capture, compare, branch, merge, rollback, project packages, backup vault, and recovery**;
- **Publishing metadata**, edition-scoped readiness, current KDP-oriented validation, KDP preflight history, real DOCX/PDF/EPUB production paths, and cover planning;
- live **KDP market research / keyword / niche evidence** using a real hosted web-search provider when configured;
- durable **Promotion campaigns**, author-gated publication state, and observed promotion-performance records without inventing attribution;
- a durable **Studio Image Lab** with real provider execution, generation/editing, source preservation, derivative lineage, persistent pending assets, and explicit approve/reject review;
- a separate **Guided Journal Office** with durable prompt libraries, generated editions, real PDF interiors, and production-derived cover geometry;
- a separate **Educational Workbook Office** with durable activity banks, AI proposals, reproducible editions, real PDF output, three-tier differentiation packs, teacher guides, weighted rubrics, and performance-assessment evidence;
- a separate **Specialized Creation Office** for exactly six modes: comic books, greeting cards, birthday cards, invitations, flyers, and trading-card-game cards, including durable structured documents and real production artifacts where supported;
- a responsive **PWA / Chromebook / Android web surface** with service-worker shell caching that deliberately does not treat browser cache as durable project state.

### Engineering resume checkpoint — Live Research PR #106

**Checkpoint date:** September 1, 2026 (America/Denver)  
**Base:** `main` at `387e892` — PR #105 is merged and was green through unit/build/completion, desktop browser, and Android acceptance.  
**Active branch:** `completion/live-research-office`  
**Open PR:** #106 — `feat: add governed live source-backed Research office`  
**Last implementation head tested before this documentation-only checkpoint:** `cbd3dac`

PR #106 is the current unfinished engineering block. It contains the first author-facing general live Research path:

- OpenAI Responses `web_search` with the consulted source set requested and validated;
- source-backed claims only — a URL the model mentions but hosted search did not actually return is rejected before persistence;
- durable project `research-memory` stored at `working` authority, never promoted automatically into canon;
- reload-latest-before-save behavior so a long-running research call is designed not to overwrite author work saved while the search is in flight;
- the same durable owner AI control used by the rest of Forge (`ai-runtime-control.json`), including provider/model pinning and spend policy;
- hosted web search blocked under `no-paid-tokens` and `budgeted` because the current request estimator does not safely account for hosted search-tool fees; live hosted Research currently requires deliberate `unrestricted` mode;
- a Live Research panel in the main Studio Research office with domain, question, rationale, source display, confidence, relevance, and persisted-history rendering;
- a dedicated browser acceptance harness that covers successful source-backed persistence/reload, rejection/no-mutation for an unconsulted URL, and a `390×844` Android viewport/touch layout check;
- Live Research added to the canonical desktop browser command and the Forge completion meter.

**Exact verification state at this checkpoint:**

- `npm run build` — ✅ passed;
- `npm run baseline` — ✅ passed;
- `npm test` — ❌ **650/651 passed; one test fixture failed**;
- `npm run completion` — not reached because unit verification stopped first;
- desktop browser acceptance — not reached on this exact head;
- Android/mobile acceptance — not reached on this exact head.

**Known blocker:** `test/studio-live-research.test.js`, test `live research reloads latest project before persistence so concurrent author work survives`, uses the invalid fixture memory class `session-memory`. Canonical memory validation correctly rejects that fixture with `Unsupported memory class "session-memory".` This is a **test-fixture repair**, not a reason to loosen production memory validation or the Research implementation.

**Resume here — do these in order:**

1. On `completion/live-research-office`, replace only the invalid concurrent-author-work fixture class with a valid canonical author-memory class; prefer `creative-note` if it remains semantically appropriate.
2. Do **not** weaken the canonical memory allowlist, source-verification rule, spend policy, or quality gates to make the test pass.
3. Push the repaired exact head and run the full verification chain.
4. Require unit/completion plus the complete desktop browser suite — including `studio-live-research-browser-acceptance.js` — and Android/mobile acceptance to pass on that exact head.
5. Merge PR #106 only after those gates are green.
6. After merge, inspect fresh `main` and open PRs before claiming the next block. The next known unfinished capability is **Knowledge Gap Radar**: proactive research-gap hypotheses layered on the now-source-backed Research office. Radar suggestions must remain hypotheses/research prompts and must never turn AI prose directly into canon.

**Do not regress these invariants when resuming:** No Paid Tokens remains the default fail-closed policy; hosted live Research cannot bypass spend control; Research remains working evidence until deliberate author promotion; only URLs actually returned by hosted search may persist; a long research request must preserve concurrent author changes; test failures must be repaired at their true boundary rather than hidden by weaker validation.

`main` still lacks this general live Research capability until PR #106 is verified and merged. Manual research entry on `main` remains real and durable, but it is not a substitute for the unfinished live Research path above.

## Start Forge

Requirements:

- Node.js **20 or newer**;
- npm;
- Chromium only if you want to run the browser-acceptance suite locally;
- real provider credentials only for the AI/research/image capabilities you intend to use.

Install and launch the complete local workplace:

```bash
git pull origin main
npm ci
npm run forge
```

`npm run forge` builds Forge and launches all four workplaces together:

| Workplace | Default local URL | Purpose |
| --- | --- | --- |
| Main Studio | `http://127.0.0.1:4173` | Books, writing, Brain, editing, image/cover, publishing, market research, promotion, recovery |
| Guided Journal | `http://127.0.0.1:4273` | Guided-journal libraries, editions, interiors, production |
| Educational Workbooks | `http://127.0.0.1:4373` | Activities, AI proposals, editions, differentiation, rubrics, assessment |
| Specialized Creation | `http://127.0.0.1:4473` | Comics, cards, invitations, flyers, TCG cards |

You can also launch an individual workplace:

```bash
npm run studio
npm run studio:journal
npm run studio:workbooks
npm run studio:specialized
```

### Chromebook / Android access

To bind the complete Forge launcher to the device/network interface:

```bash
npm run forge:android
```

Then open the Chromebook/Linux-container host IP from Android using the same ports (`4173`, `4273`, `4373`, `4473`). Only expose `0.0.0.0` on a network you trust.

Forge's Android target is currently the responsive installable web/PWA application. This repository does **not** claim to ship a native Android APK.

## Real AI Provider Configuration

Forge discovers only providers that are actually configured. It does not register imaginary capacity when no provider exists.

Common production environment variables include:

```bash
# OpenAI text / shared provider pool
export OPENAI_API_KEY="..."
export OPENAI_MODEL="..."
# Optional comma-separated model pool
export OPENAI_MODELS="model-a,model-b"

# Local Ollama
export OLLAMA_BASE_URL="http://127.0.0.1:11434"
export OLLAMA_MODEL="..."
# Optional comma-separated model pool
export OLLAMA_MODELS="model-a,model-b"

# Optional OpenAI-compatible routers
export OMNIROUTE_BASE_URL="..."
export OMNIROUTE_MODEL="..."
export ROUTER9_BASE_URL="..."
export ROUTER9_MODEL="..."

# Optional routing preference
export AI_PROVIDER_ORDER="openai,ollama"
```

Current-market KDP research uses a real hosted web-search path and requires a configured OpenAI research model (`OPENAI_MARKET_RESEARCH_MODEL` or the configured `OPENAI_MODEL`) plus the real API key.

Image generation/editing also requires a real image-capable provider configuration. If it is unavailable, Image Lab returns a visible failure and does not fabricate an asset.

Do not commit credentials to this repository.

## Main Studio Workflow

The current Main Studio exposes the real application surfaces for:

1. Dashboard and natural-language / dictated Command Center;
2. manuscript book/chapter/scene binder;
3. Writing Desk and durable AI proposals;
4. Story Architecture;
5. Character Bible;
6. World & Canon;
7. Research;
8. Editing Room;
9. Author Voice;
10. Illustration Studio / Image Lab;
11. Cover Studio;
12. Marketing / Promotion;
13. Production & Publish;
14. Book Genome;
15. Project Health;
16. Versions & Recovery;
17. Provider & Settings;
18. Author Control / governance.

AI output remains candidate material until the applicable author-review boundary says otherwise. Research remains evidence/working knowledge until deliberately promoted. Publishing or promotion state is not permission for Forge to bypass external retailer submission, account, or preview systems.

## Specialized Offices

### Guided Journal Office — port 4273

Built as a separate office rather than being mixed into Specialized Creation. It supports durable prompt libraries, category-aware generation, repeat protection, response-page styles, real PDF interiors, AI prompt proposals with author approval, and production-derived cover planning.

### Educational Workbook Office — port 4373

Supports durable author activity libraries, grade/subject/type/difficulty metadata, answer-truth validation, AI activity proposals, deterministic editions, real PDF generation, answer keys, support/core/extension differentiation packs, teacher-guide PDF production, weighted rubrics, alternate evidence modes, and durable performance assessments.

Standards identifiers and learner-support tiers are evidence/authoring metadata; Forge does not silently convert them into certification, diagnosis, placement, eligibility, or claims about a learner's worth or ability.

### Specialized Creation Office — port 4473

The canonical modes are only:

- comic books;
- greeting cards;
- birthday cards;
- invitations;
- flyers;
- trading-card-game cards.

The office preserves durable project/document revisions, production profiles, artifact lineage, AI proposal/review boundaries, TCG framework and playtest structures, comic panel/lettering semantics, folded-card imposition, duplex TCG sheets, and real SVG/PDF/PNG/JPEG/CBZ/JSON/CSV output paths where the selected workflow supports them.

## Publishing, Market Research, and Promotion Truth

Forge may prepare publishing metadata, production files, preflight evidence, keyword/niche evidence, campaign drafts, and observed post-launch metrics. It must not invent:

- retailer sales or revenue from BSR/review/rating proxies;
- campaign impressions, clicks, spend, orders, revenue, or attribution that were not observed;
- market-source URLs that were not actually returned by the research provider;
- KDP readiness when required production evidence is absent;
- external publication simply because a local asset is marked ready.

Research recommendations cannot silently overwrite publishing keywords. Promotion assets remain draft/reviewable until explicit author action.

## Durable State and Recovery

The server-side Forge data boundary is the source of truth. Browser local storage/cache is not the project database.

Forge currently supports:

- file-backed project persistence;
- project-scoped memory and manuscript state;
- structured versions and rollback checkpoints;
- integrity-checked portable project packages;
- local backup vault creation, preview, restore, and deletion;
- author-approved restore with rollback evidence;
- PWA shell caching while excluding `/api/` project state from durable browser caching.

Back up important projects before major upgrades or migrations.

## Build and Verification

Core commands:

```bash
npm run build
npm test
npm run baseline
npm run completion
npm run verify
```

`npm run verify` is the strongest repository-level gate. It runs the build, all regression tests, baseline/completion checks, complete desktop browser acceptance, and Android/mobile acceptance.

Browser setup if running acceptance locally for the first time:

```bash
npm run browser:install
```

Canonical CI follows the same principle: a green source/unit test is evidence, not blanket proof. Major capabilities are expected to be reachable from the real UI, use durable state, survive restart where applicable, return real artifacts/errors, and pass the strongest available browser/mobile acceptance.

## Engineering Coordination

GitHub `main` is shared truth. Before starting a coherent engineering block, every lane/device should inspect current `main`, open pull requests, and the latest verification state.

Parallel engineering is allowed, but duplicate ownership of the same coherent implementation block is not. Reconcile against current code instead of rebuilding a feature that another lane already merged.

For merge-critical production work:

1. inspect current implementation before editing;
2. make the smallest coherent real fix or feature;
3. add/strengthen regression coverage;
4. run the exact-head verification gate;
5. merge only the SHA that actually passed;
6. update current documentation and move to the next real usability gap.

Historical mission-by-mission details belong in [`docs/BUILD_HISTORY.md`](docs/BUILD_HISTORY.md), engineering handoff documents, and GitHub PR history rather than in a stale wall of status text at the top of this README.

## Important Architecture References

- [`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md`](AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md) — canonical product contract.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — high-level architecture.
- [`docs/AUTHORS_FORGE_CANONICAL_ARCHITECTURE.md`](docs/AUTHORS_FORGE_CANONICAL_ARCHITECTURE.md) — canonical architecture detail.
- [`docs/BUILD_HISTORY.md`](docs/BUILD_HISTORY.md) — historical capability/build record.
- [`docs/FORGE_AI_TRUNK_ROUTING_CONTRACT.md`](docs/FORGE_AI_TRUNK_ROUTING_CONTRACT.md) — shared AI routing contract.
- [`docs/MISSION-059-SPECIALIZED-CREATION-OFFICE.md`](docs/MISSION-059-SPECIALIZED-CREATION-OFFICE.md) — Specialized Creation contract.
- [`docs/EDUCATIONAL_WORKBOOK_OFFICE.md`](docs/EDUCATIONAL_WORKBOOK_OFFICE.md) — Educational Workbook contract.

## Definition of Complete

Author's Forge is not considered complete merely because a completion script reports 100% or because a collection of tests is green.

The product is complete only when a real author can reliably create or restore a project and carry it through the intended author journey—concept, architecture, canon, characters, research, manuscript, editing, visual work, cover, production, market/promotion preparation, publishing readiness, delivery audit, and recovery—using real durable state, real provider boundaries, explicit author authority, truthful failures, and verified Chromebook/Android operation.

Until every user-facing gap meets that standard, engineering continues.
