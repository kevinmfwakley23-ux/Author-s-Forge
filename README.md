# Author's Forge

AI Authoring Studio — a long-form writing, editing, continuity, illustration, publishing, and marketing workspace designed to be powered by K.I.N.G.S.

## Canonical Product Directive — READ THIS FIRST

**`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` is now checked into this repository as the canonical copy of the AUTHOR'S FORGE Master Product Directive.** It was copied from the authoritative ChatGPT Library document and must be treated as the product contract for all future engineering work. Do not invent a competing product definition or silently reduce its requirements.

The directive defines the goal as a real AI publishing studio: an author must be able to move from idea through architecture, canon, characters, timeline, research, manuscript, editing, illustrations, cover, formatting, metadata, marketing, publishing preparation, and portable archival while preserving author control, continuity, provenance, visual identity, and project memory. fileciteturn569file0L11-L23 fileciteturn569file4L735-L796

The Book Genome, hierarchical persistent memory, anti-drift/canon controls, relationship-aware memory, and author authority are core architecture—not decorative future features. fileciteturn569file7L1288-L1390 fileciteturn569file3L680-L731

### Engineering consequence

A green unit-test suite is **not** proof that Author's Forge works. A feature is complete only when its real implementation is reachable from Forge Studio, operates on the durable project state, persists its changes, survives restart/reload, participates in downstream dependencies where required, and can be exercised through a real author workflow.

No placeholder functions, fake integrations, mock behavior presented as production behavior, dead-end scaffolding, or code whose only purpose is to make a file exist is acceptable.

## Repository Role

Author's Forge is a standalone product repository. K.I.N.G.S. remains the independent intelligence/workforce operating system that may power Author's Forge through defined interfaces.

**K.I.N.G.S. is the builder and ultimate engineering authority for Forge.** Forge must be capable of normal author workflows independently and may escalate genuine capability gaps to K.I.N.G.S. through explicit interfaces.

## Master Product Directive

The complete directive is stored at `AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` so the engineering agent, Codex, CI, and future maintainers have a repository-local canonical reference rather than relying on conversational memory.

Key product requirements include:

- hierarchical persistent memory rather than whole-manuscript context dumping
- canon lock and anti-drift checking
- first-class chapter and scene architecture
- real writing modes with separation of content truth from style transformation
- intelligent editorial analysis without silent manuscript mutation
- governed research with provenance and honesty classifications
- complete Character Bible with temporal state
- reusable Visual Character Identity and illustration continuity
- serious Illustration Studio and immutable image revisions
- production-aware Book Cover Studio
- DOCX/PDF/EPUB manuscript production
- publishing readiness and 13-category delivery auditing
- evidence-backed KDP market intelligence and book positioning
- import/export and durable project recovery
- versioning, compare, rollback, branch, and merge
- explicit author approval, canon lock, and override authority
- shared Series Engine
- voice preservation
- Co-pilot / Partner / Director / Autonomous / Editor collaboration modes
- project health reporting
- relationship-aware memory
- self-checking before delivery
- K.I.N.G.S. capability escalation
- security, ownership, provenance, consent, and accessibility boundaries
- Book Genome dependency graph and downstream impact analysis

## Locked Build / Test / Fix Workflow

1. The acting chief engineering code-writing role works from the canonical directive and the actual repository.
2. Production code is integrated into the existing architecture; isolated mission code is not considered complete until connected to the product surface.
3. The user runs the verification suite from Linux.
4. If Linux reports a failure, the complete failure output is used to diagnose the actual production root cause.
5. Tests are never weakened, deleted, skipped, or changed merely to make failures disappear.
6. Production defects are fixed in production code.
7. End-to-end Studio workflows must be covered in addition to domain/unit tests.
8. The complete verification suite must remain green.

## Reference Engineering Integration

Reference repositories may be inspected for **working implementation patterns**, not merely copied as documentation. Useful, compatible components should be adapted into Forge when they solve an actual integration gap and when their license permits use.

### Reviewed references

- **ildrm/google-book-writer** — MIT. Useful patterns include staged long-form generation, persistent book/character/timeline state, resumable checkpoints, quality review, and publication-oriented exports.
- **edwarddumi/ai-book-studio** — MIT. Useful patterns include explicit Plan → Write → Save flow, approved-outline gates, chapter-level continuity, session persistence, and separated review/packaging stages.
- **kevinmfwakley23-ux/NovelForge** — user-owned reference repository. Useful engineering patterns include Result/Option/Either primitives, domain errors and guards, dependency injection/service registration, lifecycle/boot pipeline, event bus/event history, retry/dead-letter infrastructure, diagnostics, and modular kernel boundaries.
- **kevinmfwakley23-ux/-KINGS-AI** — user-owned K.I.N.G.S. engineering authority. Useful patterns include workforce planning, artifact lifecycle/registry/promotion, build/test execution, capability acquisition, autonomous execution bridges, and Builder V1 infrastructure.

Reference code must be evaluated before integration. Do not transplant foreign application frameworks wholesale, duplicate domain models, or create parallel sources of truth. Prefer extracting a proven implementation pattern and adapting it to Forge's existing TypeScript domain/application/infrastructure boundaries.

## Integration-First Rule

The repository has accumulated many successful mission-level domain implementations. They are valuable foundations, but **domain completeness without application integration is not product completeness**.

The integration target is:

```text
AUTHOR
  ↓
PROJECT
  ↓
BOOK
  ↓
CHAPTER
  ↓
SCENE
  ↓
MANUSCRIPT
  ↓
PROJECT BRAIN / MEMORY / CANON
  ↓
CHARACTERS / WORLD / TIMELINE / RESEARCH / VOICE
  ↓
WRITING ENGINE
  ↓
EDITORIAL ENGINE
  ↓
VISUAL IDENTITY / ILLUSTRATION LIBRARY
  ↓
BOOK GENOME
  ↓
POSITIONING / MARKETING
  ↓
PUBLISHING
  ↓
PRODUCTION ARTIFACTS
  ↓
FINAL DELIVERY AUDIT
```

Every boundary must have real data flow, persistence, validation, and user-visible behavior where applicable.

## Forge Studio Standard

Forge Studio is not a mock dashboard. Navigation must open real workspaces. Workspace controls must invoke real application services or explicit provider boundaries. Forms must read/write durable project state. Reloading the page must not erase work. Restarting the server must not erase work. Buttons must never silently do nothing.

If a capability requires an external AI, image, storage, or research provider that is not configured, the Studio must show the actual configuration state and provide a safe, explicit path to configure it; it must not pretend the capability succeeded.

## Current Engineering Objective

The immediate objective is **full-system integration and product hardening**, not adding another isolated mission. Audit the entire repository, identify disconnected implementations, consolidate duplicate/obsolete paths, wire the strongest existing implementations into one ProjectState and one Studio application surface, and build missing application/infrastructure adapters where necessary.

The result must be an application the author can actually use to develop books, not a collection of passing mission tests.

## Verification Standard

A mission or integration checkpoint is verified only when:

- TypeScript builds cleanly.
- The complete regression suite passes.
- Studio starts successfully.
- The relevant Studio route is reachable.
- The route's controls actually execute.
- Data is persisted in the project store.
- Data survives reload/restart.
- Downstream consumers see the updated state where required.
- Errors are visible and actionable.
- No test has been weakened to obtain the result.

## Linux Verification

```bash
cd ~/Author-s-Forge
git fetch origin
git checkout forge-integration-all-recent
git pull --ff-only origin forge-integration-all-recent
npm install
npm run check
npm run studio
```

Then open `http://127.0.0.1:4173`.

## Status

This branch is an integration/hardening line. It contains the canonical Master Product Directive and is the working line for turning the mission implementations into one usable Author's Forge product.
