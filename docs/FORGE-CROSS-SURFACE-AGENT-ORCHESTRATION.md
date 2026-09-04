# Author's Forge — Cross-Surface Creative Agent Orchestration

**Date:** 2026-09-04  
**Branch:** `chief/competitive-creative-agent-workflows`  
**Status:** implemented on the branch; merge remains gated by exact-head verification.

## Competitive engineering target

Current leading AI coding and creative systems increasingly combine agentic tool loops, persistent project context, model/provider flexibility, reusable workflows, and reviewable outputs. Author's Forge adopts those useful patterns through its existing Project Brain, provider router, proposal ledgers, Image Lab, publishing/market/promotion systems, production engines, and author-governance boundaries rather than creating an ungoverned second AI stack.

The Forge-specific target is:

**one author goal → server-owned governed plan → registered real tools → explicit approvals / bounded safe groups → durable proposals, evidence and artifacts → reusable Recipe**

## One planning authority

The production Workbench now loads only `public/forge-agent-v3.js`. The superseded browser-local Agent planner clients were removed.

The browser no longer invents its own tool sequence. It:

1. discovers `/agent/tools` from the server-owned Creative Tool Registry;
2. asks `/agent/plan` for the governed plan;
3. resolves each planned operation from its registry descriptor;
4. displays scope/provider/state/approval truth before execution;
5. executes only after the applicable author approval.

The browser still owns tool-specific request-form adaptation because each real Forge operation has a different validated application input. It does **not** own tool discovery, route identity, planning authority, state classification, or mutation authority.

## Registry v2 — eleven real operations

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

## Deterministic planner — default and free

Forge's deterministic planner remains the default. It uses no model call and therefore does not consume provider tokens simply to decide which Forge tools match a goal.

It recognizes missions spanning research, KDP market intelligence, architecture, Chapter Cards, writing proposals, editing, image generation, production, and promotion. Missing book/chapter/scene scope is surfaced as blocked instead of guessed.

Example:

> Research the KDP niche and keywords, create chapter cards, generate an illustration, and build a promotion campaign.

Deterministic plan:

1. `market.kdp.research`
2. `story.chapter-cards.propose`
3. `visual.image.generate`
4. `promotion.campaign.propose`
5. `memory.record-working`

## Optional AI-enhanced planner

The Workbench now offers an explicit **AI-enhanced · routed model** planner option alongside **Deterministic · free/default**.

AI-enhanced planning uses the same Project Brain context and shared routed provider boundary as other Forge AI work. It therefore inherits the owner's current model pin, provider order, routing mode, spend policy, quota/cost safeguards, failover telemetry, and real-provider honesty.

The model never receives execution authority. It may return only:

```json
{"steps":[{"toolId":"registered.tool.id","reason":"brief reason"}]}
```

Forge then validates and recompiles that selection through the same governance compiler used for deterministic plans. The validator rejects:

- unknown or invented tool ids;
- `memory.record-working` supplied by the model, because Forge owns final audit ordering;
- extra model-invented fields such as `autoExecute`;
- malformed or commentary-wrapped non-JSON responses that cannot be parsed safely;
- more than twenty selected operations;
- direct apply/content routes indirectly, because those routes are absent from the registry.

If the model selects writing without Project Brain grounding, Forge inserts `project.context` before `writing.propose`. Forge then appends exactly one final `memory.record-working` step.

If provider execution fails or model output violates the schema/registry contract, the API returns `plannerUsed: "deterministic-fallback"` plus `plannerFallbackReason`. The Workbench displays that fact. It never labels the deterministic fallback as an AI-generated plan.

This compatibility layer deliberately uses strict application-side validation because Forge supports many provider/router implementations; it does not falsely claim that every connected provider supports one native structured-output API.

## Forge Recipes — durable reusable governed workflows

Forge Recipes provide an author-defined reusable workflow layer over the registry rather than an unrestricted plugin execution surface.

API:

- `GET /api/projects/:projectId/agent/recipes` — list active Recipes;
- `POST /api/projects/:projectId/agent/recipes` — create a Recipe;
- `PUT /api/projects/:projectId/agent/recipes/:recipeId` — append a new Recipe version;
- `DELETE /api/projects/:projectId/agent/recipes/:recipeId` — append a tombstone without erasing history;
- `POST /api/projects/:projectId/agent/recipes/:recipeId/plan` — compile to a visible governed plan without executing anything.

A Recipe stores only registered tool ids plus optional author instructions. Recipes persist inside the existing project memory/package boundary as versioned `creative-note` records with `agent-recipe` relevance tags and author provenance. Updating or deleting appends history instead of rewriting it.

Compilation strips any author-positioned audit-memory step and forces exactly one `memory.record-working` operation at the end. This prevents a Recipe from recording apparent completion and then performing additional operations afterward.

## Bounded safe run groups

In Director/Autonomous modes, Forge may offer one group approval only for steps whose server plan explicitly marks them `eligibleForApprovedRunGroup`.

Eligibility requires all of the following:

- no blocked scope/mode reason;
- collaboration policy permits bulk work;
- registry approval class is `read-only`;
- registry state effect is `none`.

The Workbench executes eligible steps sequentially and stops on the first failure. Writing proposals, Chapter Cards, research state, market reports, images, promotion drafts, production artifacts, and workflow-memory records remain outside the group and require their individual approval path.

## Provider truth

Tool metadata distinguishes provider requirements rather than pretending every operation is available:

- `none` — deterministic/local Forge capability;
- `configured-ai` — real text-generation provider required;
- `configured-image` — real image-capable provider required;
- `hosted-research` — real hosted research provider required.

When a provider is unavailable, its executing route fails honestly. Registry discovery and planning do not fabricate provider availability or operation success.

## Verification coverage

The branch regression/acceptance contract now covers:

- all eleven registered tool ids and provider/state classifications;
- one canonical Workbench client and PWA shell cache;
- server-owned planning rather than browser-local `buildPlan` logic;
- Editor-mode writing restrictions;
- bounded Autonomous read-only run groups and stop-on-failure behavior;
- cross-surface planning order and missing-scope honesty;
- durable Recipe create/reload/version/update/delete/compile behavior;
- forced final Recipe audit-memory ordering;
- strict AI planner JSON/tool validation;
- unknown/apply-tool and hidden-field rejection;
- AI selection of writing being forced through Project Brain grounding;
- real provider-unavailable AI planning falling back visibly to deterministic planning;
- Android-sized Workbench behavior;
- exact real PDF artifact download with SHA evidence.

## Next engineering blocks

1. Expand the Creative Tool Registry and Workbench adapters into Cover Studio and the remaining Specialized Creation workflows.
2. Add richer server-owned execution schemas so more request-payload construction can become registry/discovery driven instead of client adapter code.
3. Add live-provider AI-planner acceptance where credentials are intentionally available while retaining deterministic no-provider fallback coverage in ordinary CI.
4. Continue closing device/release gaps, especially hosted Android/PS5 acceptance and exact-head release verification.
5. Merge only after a real runner executes the canonical verification gates successfully.
