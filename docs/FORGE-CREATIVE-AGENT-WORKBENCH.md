# Author's Forge — Creative Agent Workbench

**Engineering block:** competitive creative-AI orchestration pass  
**Date:** 2026-09-04  
**Status:** implementation branch; no completion claim until exact-head verification passes

## Why this block exists

The September 2026 creative-AI market is moving beyond isolated generation buttons. The important product pattern is a combination of persistent context, conversational or agentic planning, reusable workflows, model/provider choice, editable outputs, and evidence that the system actually completed the requested work.

Current product research used for this block includes:

- **Canva AI / Canva AI 2.0:** increasingly conversational and agentic creation, persistent memory, connected tools and editable design outputs rather than one-shot flattened generation.
- **Adobe Firefly:** unified generate/edit workspace, multi-model creative workflows, batch processing and agent-accessible workflow execution.
- **Sudowrite:** fiction-specific persistent story context, selectable models, localized writing tools and user-defined Plugins/workflows.
- **Novelcrafter:** Codex-backed project/series context, customizable prompting, flexible provider/model connections and human-controlled authoring.
- **Kittl:** model-flexible visual creation, reusable workflows and an expanding agentic creation surface.

The lesson is not to imitate those interfaces. Author's Forge should exceed the useful pattern by combining agentic convenience with stronger durable project truth, explicit provenance, local/recoverable project ownership, provider honesty, publishing/production workflows and author-controlled mutation boundaries.

## Gap found in Forge

The existing Main Studio Command Center presents these collaboration modes:

- Co-pilot
- Partner
- Director
- Autonomous
- Editor

The domain policy behind those labels is real, but the Command Center's generic non-navigation path currently sends commands to the same `/ai/draft` endpoint. That makes mode selection much less meaningful at the command-orchestration layer than the underlying Forge architecture permits.

The repository already contains stronger primitives that should be composed instead of bypassed:

- durable Project Brain/project state;
- collaboration policy;
- source-backed live research;
- governed context assembly;
- durable AI writing proposals with separate accept/apply;
- intelligent editorial analysis;
- real manuscript production artifacts;
- working/canon memory authority separation;
- shared provider/model routing with truthful failure.

## Implementation in this branch

`public/forge-agent.html` + `public/forge-agent.js` add a first-class **Forge Agent Workbench**.

The workbench:

1. loads the real durable project, workspace, collaboration policy, health and live-research availability;
2. makes the author choose the exact book/chapter/scene target rather than silently guessing;
3. saves the author-selected collaboration mode through the existing policy route;
4. converts one author goal into a deterministic, transparent operation queue;
5. exposes every operation before execution;
6. requires a fresh **Approve & run this step** action for every real operation;
7. never automatically runs the next step after a success;
8. records provider/state failures as failures instead of inventing fallback output;
9. allows the author to record compact workflow evidence into Project Brain as **working creative memory**, never story canon.

## Real operation mapping

| Agent step | Real Forge boundary | Authority/result |
| --- | --- | --- |
| Project truth | `GET /api/projects/:id`, `/workspace`, `/health`, `/collaboration` | read-only durable truth |
| Collaboration mode | `POST /collaboration` | explicit author-selected policy |
| Source-backed research | `POST /research/live` | persisted working research; not canon |
| Context grounding | `POST /context` | read-only context preview |
| Architecture | `POST /ai/architecture` | candidate only; not silently persisted |
| Writing | `POST /ai/writing/generate` | durable proposal; separate accept/apply still required |
| Editing | `POST /edit` | read-only multi-lens analysis |
| Production | `POST /export` | real returned DOCX/PDF/EPUB bytes downloaded by browser |
| Run evidence | `POST /memory` | working creative memory; not canon |

The Agent Workbench intentionally **does not** call `/ai/draft` for its writing operation because the durable proposal route has the stronger author-review contract.

It also intentionally does not call the proposal review/apply endpoints. Accepting and applying candidate prose remains a separate author decision in the existing AI proposal workplace.

## Creative Tool Registry — implemented in this block

The second slice of this branch adds a server-owned typed capability registry instead of letting future agents discover their abilities from UI code.

`src/application/creative-tool-registry.ts` classifies each currently exposed Agent Workbench capability by:

- stable tool id;
- category;
- title and description;
- HTTP method and project-scoped path template;
- approval class;
- provider requirement (`none`, `configured-ai`, or `hosted-research`);
- state effect;
- required project/book/chapter/scene scope;
- author-reviewability;
- explicit invariants that the registered tool may not directly change canon or manuscript text.

The registry validator refuses tool definitions whose paths target proposal-apply or direct manuscript-content mutation boundaries.

`GET /api/projects/:projectId/agent/tools` exposes the registry as **discovery-only** metadata. It does not add a second executor. Every discovered operation still executes through its existing Forge route and therefore inherits the real provider, Project Brain, proposal, persistence and author-control boundary already implemented for that capability.

The initial registered tools are:

1. `project.context`
2. `research.live`
3. `architecture.generate`
4. `writing.propose`
5. `editing.analyze`
6. `production.export`
7. `memory.record-working`

This moves Forge toward the same useful discoverable-tool idea seen in modern agent systems while retaining stronger authoring-specific authority metadata than a generic tool list normally provides.

## Mode behavior

This first pass turns collaboration mode into orchestration policy rather than prompt decoration:

- **Editor** will not plan new prose. Drafting is visibly blocked until the author changes mode.
- **Co-pilot** remains explicit step-by-step author-directed operation and does not introduce bulk auto-run.
- **Partner / Director / Autonomous** may express larger missions in one plan, but consequential steps still require explicit author execution because Forge's domain policy requires author approval for major creative decisions.

Future expansion can add bounded run-group approvals for non-consequential operations, but it must not redefine `autonomous` as permission to silently alter author-owned canon or manuscript state.

## Production truth

The production step consumes the existing real production artifact response (`contentBase64`, MIME type, filename, byte length and SHA-256) and downloads those exact bytes.

It does not claim:

- retailer submission;
- KDP acceptance;
- publication;
- sales availability;
- external campaign execution.

Those remain separate Forge publishing/readiness/external-service boundaries.

## PWA / device integration

`public/forge-pwa.js` now exposes Agent Workbench from both the Main Studio navigation and dashboard workspace launcher.

`public/sw.js` shell version 17 caches:

- `/forge-agent.html`
- `/forge-agent.js`

This keeps the workbench UI available as part of the existing installable Forge shell while continuing to exclude `/api/` project data from service-worker persistence.

## Regression contract

`test/forge-agent-workbench.test.js` verifies that:

- the target selectors and collaboration mode are present;
- the workbench references real Forge API boundaries;
- writing uses `/ai/writing/generate` rather than `/ai/draft`;
- it does not contain direct scene-content writes;
- it does not contain automatic proposal-apply calls;
- Editor-mode drafting protection is present;
- each operation uses explicit author approval language;
- no next operation auto-runs after a successful step;
- PWA navigation and shell caching include the workbench;
- the client script parses as JavaScript.

`test/creative-tool-registry.test.js` verifies registry ids, scope, provider classification, state effects, proposal-only writing behavior, unsafe-path exclusion and project-id routing.

`scripts/studio-agent-workbench-browser-acceptance.js` now also requires the running Studio server to expose the seven-tool discovery registry before it proceeds through the Android-sized Agent Workbench acceptance path.

## Competitive advantage target

This block is meant to establish a Forge-specific advantage rather than merely reach parity:

**one goal → visible governed plan → Project Brain grounding → discoverable governed tools → real provider/tool operations → durable proposals/evidence/artifacts → explicit author decisions**

That connects capabilities competitors often split across writing assistants, research tools, design tools, production tools and automation platforms.

## Next engineering blocks

1. Add a governed **agent planner** that can propose typed tool plans from natural language through the shared Forge AI trunk, with strict schema validation against the Creative Tool Registry before any execution.
2. Add **bounded run groups** for safe/read-only steps while retaining one-shot approvals for manuscript/canon/publishing mutations.
3. Add model/resource visibility and per-mission routing preferences backed by the existing broker rather than direct provider calls.
4. Extend the registry across Image Lab, Cover Studio, Story Map/Chapter Cards, marketing and the specialized offices so one mission can coordinate text + image + production assets.
5. Move the current Agent Workbench's operation endpoint resolution onto registry descriptors so client routing is discovery-backed rather than duplicated.
6. Add live-provider acceptance for proposal generation where secrets are intentionally available, while preserving deterministic provider-unavailable tests for ordinary CI.
7. Run exact-head `npm run verify`; merge only the SHA that actually passes the repository's strongest gate.

## Permanent rule

Agentic convenience is never authority.

Forge may plan more, execute more and coordinate more than ordinary authoring tools, but the author remains the owner of creative truth. A capability is not considered complete because an AI can describe it; it is complete only when the real application executes it, preserves durable state correctly, returns truthful evidence and passes the relevant verification path.
