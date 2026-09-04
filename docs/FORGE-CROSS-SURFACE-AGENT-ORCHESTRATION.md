# Author's Forge — Cross-Surface Creative Agent Orchestration

**Date:** 2026-09-04  
**Branch:** `chief/competitive-creative-agent-workflows`  
**Status:** implemented on the branch; merge remains gated by exact-head verification.

## Competitive engineering target

Current leading AI coding and creative systems increasingly combine four ideas:

1. an agent that can decompose a goal into multiple tool operations;
2. persistent project context rather than isolated prompts;
3. model/provider flexibility;
4. reusable cross-tool workflows that produce editable or reviewable outputs instead of silently replacing source material.

Author's Forge already has unusually strong author-specific primitives: Project Brain, durable manuscript structure, Chapter Cards, Image Lab, live research, KDP market intelligence, promotion planning, proposal review boundaries, real production artifacts, provider routing and explicit author governance. The gap was orchestration: those capabilities were implemented as separate offices but were not all discoverable by one governed agent plan.

## Registry v2

The Creative Tool Registry now exposes eleven real project-scoped operations:

| Tool | Real Forge boundary | State/authority |
| --- | --- | --- |
| `project.context` | `/context` | read-only Project Brain grounding |
| `research.live` | `/research/live` | source-backed working research |
| `market.kdp.research` | `/market-research` | dated market-intelligence report |
| `architecture.generate` | `/ai/architecture` | reviewable architecture candidate |
| `story.chapter-cards.propose` | `/story-map/chapter-card-workflow/generate` | durable Chapter Card candidate ledger |
| `writing.propose` | `/ai/writing/generate` | durable manuscript proposal ledger |
| `editing.analyze` | `/edit` | read-only multi-lens editing evidence |
| `visual.image.generate` | `/ai/image` | Image Lab asset with provenance/review state |
| `promotion.campaign.propose` | `/promotion/generate` | draft campaign/assets requiring author review |
| `production.export` | `/export` | real production artifact bytes |
| `memory.record-working` | `/memory` | author-approved working workflow evidence |

The registry does not expose proposal-apply routes, direct scene-content mutation, canon mutation, publishing claims, or external campaign publication as agent tools.

## Provider truth

Tool metadata distinguishes provider requirements rather than pretending every operation is available:

- `none` — deterministic/local Forge capability;
- `configured-ai` — real text generation provider required;
- `configured-image` — real image-capable provider required;
- `hosted-research` — real hosted research provider required.

When a provider is unavailable, the executing Forge route remains responsible for failing honestly. Registry discovery never fabricates provider success.

## Planner v2

The deterministic governed planner now recognizes missions that combine:

- general factual research;
- KDP market/niche/keyword research;
- architecture/outline work;
- Chapter Card generation;
- manuscript drafting;
- editorial analysis;
- illustration/image creation;
- production exports;
- marketing/promotion campaigns.

Example mission:

> Research the KDP niche and keywords, create chapter cards, generate an illustration, and build a promotion campaign.

The resulting plan is ordered as:

1. `market.kdp.research`
2. `story.chapter-cards.propose`
3. `visual.image.generate`
4. `promotion.campaign.propose`
5. `memory.record-working`

A missing book target blocks Chapter Card and campaign operations instead of guessing a book. Provider-backed/state-changing operations are never silently included in an Autonomous read-only run group.

## Governance invariant

`autonomous` means Forge may plan a larger amount of work. It does **not** mean Forge may silently change author-owned creative truth.

Only operations classified `read-only` with `stateEffect: none` can be eligible for a bounded author-approved run group. Writing, Chapter Cards, images, market reports, production artifacts, promotion drafts and memory records remain explicit operations with their existing review/state boundaries.

## Verification added

The branch regression suite now covers:

- all eleven registered tool ids and their provider/state classifications;
- proposal-only Chapter Card and manuscript-writing paths;
- Image Lab provider classification and asset-library state effect;
- market-intelligence and promotion-draft effects;
- cross-surface planning order;
- missing-book blocking for Chapter Cards and promotion;
- live Studio planner API discovery of all eleven tools;
- Android-sized Agent Workbench acceptance against registry format v2.

## Next block

The next highest-value step is to make the Agent Workbench render and execute these expanded tools directly from server registry descriptors instead of keeping operation-specific endpoint knowledge in client code. After that, add author-defined reusable Forge Recipes/workflows that compile into the same governed tool-plan format.
