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
Use real workforce/build patterns where Forge needs execution planning, artifact lifecycle, verification, capability gaps, bounded execution, and recoverable handoffs. Forge remains the author product; K.I.N.G.S. remains the general AI workforce/orchestration system.

## External open-source patterns studied

- `YfengJ/novel-studio-ai`: local-first SQLite project memory, story bible, character state, relation graph, retrieval, continuity checks, and the Plan → Context Pack → Draft → Check → Accept → Extract Memory loop.
- `dreamtelligence/EMBER`: scene-card pipeline, canon ledger, character/object/knowledge/promise ledgers, typed StateDiff, continuity guard, quality evaluation, human approval, and project-scoped assistant.
- `abligail/narralume`: manual-first writing studio, project overview, story bible, versioning, review findings, AI candidate workflow, run center, and impact previews.
- `john-paul-ruf/novel-engine`: explicit pitch-to-publish phases, editorial workforce, prioritized revision plans, local model support, command palette, series support, and publication audit.
- `Dirgha-AI/writer-studio`: binder-style nested chapter/scene structure, saved drafts, evaluations, versions, semantic project search, and pluggable AI providers.
- `giapnguyen74/xnovelist`: AI-optional local-first writing, device-owned manuscript state, snapshots, find/replace, Story Bible, and DOCX export.
- `jmorenobl/bookwright`: canonical author documents as source material, provenance-aware research, deterministic continuity validation, and a derived knowledge graph.
- `mushroomfk/long-novel-agent-kit`: local durable continuity infrastructure and safety gates for long-running agent workflows.

These projects are engineering references, not dependencies. Forge must only copy/adapt mechanisms that fit its directive, license, architecture, and author-control requirements.

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
