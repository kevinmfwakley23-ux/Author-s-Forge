# Author's Forge — Engineering Integration Ledger

This document is part of the product engineering contract. Forge is not a collection of mission demos. A capability is complete only when it is reachable from the Studio, persists into the project, participates in downstream context, and can be recovered or exported.

## Canonical product direction

`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` is the authoritative product contract.

## Internal systems to reuse

### Author's Forge mission implementation
- Project Brain and durable memory are the source of truth for project context.
- Character Bible records are immutable/auditable and temporally reconstructable.
- Visual identities and illustration assets preserve continuity rather than treating every image as an isolated generation.
- Manuscript planning, production, publishing readiness, positioning, market intelligence, version control, author control, series canon, voice preservation, and delivery audit remain domain boundaries.

### NovelForge
Use the repository as a reference source for kernel/lifecycle ideas, boot boundaries, event history, retry/recovery, diagnostics, and durable execution patterns. Do not import its artifact wholesale.

### K.I.N.G.S.-AI
Use the repository as a reference source for workforce planning, artifact lifecycle, artifact promotion, build/test execution, capability acquisition, bounded autonomous execution, and recoverable handoffs. Forge remains the author product; K.I.N.G.S. remains the general AI workforce/orchestration system.

## External open-source patterns studied

### Long-form authoring
- `YfengJ/novel-studio-ai`: local-first SQLite project memory, story bible, character state, relation graph, retrieval, continuity checks, and the Plan → Context Pack → Draft → Check → Accept → Extract Memory loop.
- `dreamtelligence/EMBER`: scene-card pipeline, canon ledger, character/object/knowledge/promise ledgers, typed StateDiff, continuity guard, quality evaluation, human approval, and project-scoped assistant.
- `abligail/narralume`: manual-first writing studio, story bible, versioning, review findings, AI candidate workflow, run center, and impact previews.
- `john-paul-ruf/novel-engine`: explicit pitch-to-publish phases, editorial workforce, prioritized revision plans, local model support, command palette, series support, and publication audit.
- `Dirgha-AI/writer-studio`: binder-style nested chapter/scene structure, saved drafts, evaluations, versions, semantic project search, and pluggable AI providers.
- `giapnguyen74/xnovelist`: AI-optional local-first writing, device-owned manuscript state, snapshots, find/replace, Story Bible, and DOCX export.
- `jmorenobl/bookwright`: canonical author documents as source material, provenance-aware research, deterministic continuity validation, and a derived knowledge graph.
- `mushroomfk/long-novel-agent-kit`: local durable continuity infrastructure and safety gates for long-running agent workflows.

### Memory, retrieval, and local-first infrastructure
- `mem0ai/mem0`: multi-signal memory retrieval that combines semantic, keyword, entity, and temporal signals; useful as a retrieval reference, not a canon-authority model.
- `getzep/graphiti`: temporal context graphs with provenance, validity windows, incremental updates, and hybrid semantic/keyword/graph retrieval; useful for historical truth and relationship-aware retrieval patterns.
- `yjs/yjs` + `yjs/y-indexeddb`: CRDT and local browser persistence patterns for offline-first editing and later synchronization.
- `automerge/automerge`: local-first document/state synchronization with concurrent merge and change history; a future reference for Chromebook/Android multi-device editing.
- Tiptap/Yjs collaboration patterns: rich-text collaboration, presence, snapshots/version history, and offline persistence; evaluate only if the CRDT layer can remain subordinate to Forge's canonical durable project state.

### Children's books and illustration
- `The-Reading-Club/reading-club-ai`: rich editor + text/image AI integration for collaborative children's stories.
- `MultiTales/childbook-adk`: bounded writer/editor/reviewer/reader/illustrator roles and a closed-loop children's-book production path.
- `buildfastwithai/storybook`: page-based story generation, consistent character illustration, and interactive storybook organization.
- `abidlabs/drawbook`: programmatic illustrated children's-book generation patterns.
- `ayushnagvanshi101098-ship-it/book-illustration-engine`: style locking, recurring-character consistency, quality judging, retries, and resumable illustration production.
- `zilogo/ai-storybook-studio`: local-first storybook production with explicit plans, reviews, approval boundaries, manifests, fixed image workflows, and local media artifacts.

### Comics
- `AskAillex/comic-maker`: structured script → character looks → pages/panels → image generation → deterministic composition → CBZ output.
- `GA10d/AI-Manga-AI-Comics`: multi-provider text/image workflow, persistent references, style switching, page manifests, continuity memory, and local artifacts.
- `wenn-id/comicsol`: planning, character consistency, visual QA, selective repair, deterministic lettering/composition, and PDF export.
- `jbilcke-hf/ai-comic-factory`: explicit LLM/rendering provider boundaries and multi-stage comic generation.

These projects are engineering references, not dependencies. Forge must only copy/adapt mechanisms that fit its directive, license, architecture, and author-control requirements.

## Standing competitive-intelligence contract

Competitive and technical research is continuous engineering input, not a one-time discovery phase.

Before a substantial new block or when entering a new office/capability, the engineering owner should:

1. inspect the current Forge implementation and automated evidence;
2. check current production author applications for proven UX/workflow patterns and newly surfaced failure modes;
3. check active open-source repositories for architectural mechanisms relevant to the block;
4. classify findings as **adopt now**, **adapt later**, **monitor**, or **reject**;
5. record materially important findings in `docs/COMPETITIVE-RESEARCH.md`;
6. prefer Forge-native implementations over dependency accumulation;
7. verify licensing, maintenance health, platform cost, privacy impact, and offline/recovery implications before importing any dependency;
8. preserve author authority, provider neutrality, project isolation, provenance, and local recoverability even when competitor systems do not;
9. add focused regression tests for the adopted mechanism and run full desktop + Android/mobile acceptance;
10. never treat market popularity, star counts, demos, or benchmark claims as a substitute for Forge's own functional proof.

The goal is not to clone competitors. The goal is to know what currently works, what fails, and what is emerging so Forge can combine the strongest mechanisms into a more coherent author-controlled product.

## Non-negotiable integration rules

1. No placeholder controls. Every button must navigate, persist, execute a real operation, or be deliberately disabled with an explanation.
2. No fake AI. AI calls require a configured provider and return a real provider response or an explicit configuration/provider error.
3. No fake image generation. Image generation requires a real configured provider and stores the returned asset locally.
4. No hidden canon mutation. Generated material remains a candidate until author acceptance.
5. No isolated mission islands. Every major capability must connect to the project state and downstream workflow.
6. No cloud-only dependency for the core writing workspace. Project data must remain recoverable on the author's machine.
7. No publication claim without a real artifact and audit boundary.
8. Every new subsystem requires at least one end-to-end Studio path, persistence path, and automated acceptance test.
9. The Studio is the product. Passing domain tests while the Studio cannot reach the capability does not count as completion.
10. The final release target is the complete author workflow: project → concept → architecture → canon → characters → manuscript → editing → research → illustration → cover → production → positioning → marketing → publishing → archive/recovery.
