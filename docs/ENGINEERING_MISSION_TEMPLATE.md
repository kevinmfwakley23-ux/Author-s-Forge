# AUTHOR'S FORGE — ENGINEERING MISSION TEMPLATE

**Purpose:** reusable mission format for major Forge capabilities.  
**Rule:** a major mission is a build contract, not a feature wish list.

Use this template when work is large enough that scope drift, architectural duplication or false completion are realistic risks.

---

# MISSION [NUMBER] — [NAME]

**Status:** RESEARCH / RESEARCH LOCKED / ACTIVE / VERIFIED / COMPLETE  
**Canonical parent:** [architecture/directive path]  
**Progress ledger:** `README.md`  
**Owner/workplace boundary:** [office/core boundary]  

## 1. Mission outcome

Describe what a real user will be able to accomplish when the mission is complete. Avoid implementation language unless the implementation choice is already locked.

## 2. Scope lock

### Included

List the exact capabilities/product types/users/outputs included.

### Excluded / non-goals

List adjacent ideas that are explicitly not authorized by this mission.

## 3. Existing implementation inventory

Before new code, identify:

- existing domain contracts;
- existing application services;
- storage/persistence;
- Studio/API surfaces;
- tests;
- shared Forge Brain/provider/layout/production infrastructure that MUST be reused.

**Rule:** preserve/reconcile working code before replacing it.

## 4. Research method

Record the evidence classes used:

1. formal specifications/platform requirements;
2. official professional documentation;
3. mature open-source systems;
4. established professional workflows;
5. competitive products;
6. secondary material.

State how conflicting evidence will be resolved.

## 5. Research adoption ledger

| Area | Evidence | Decision | Why |
|---|---|---|---|
| [area] | [source] | ADOPT / ADAPT / EVALUATE / REJECT | [reason] |

Do not confuse “found in another product” with “approved for Forge.”

## 6. Architecture constraints

Assign stable requirement IDs.

Example:

### M###-ARCH-001 — Shared Forge Brain

The capability SHALL consume existing shared Brain/provider/governance infrastructure and SHALL NOT create a competing implementation.

Every hard-to-reverse architectural decision should have an ADR.

## 7. Canonical data/domain model

Define conceptual authoritative entities and relationships without tying durable truth to a UI framework.

```text
Project
  └─ CapabilityState
       ├─ Documents
       ├─ Assets
       ├─ Revisions
       ├─ Proposals
       └─ Artifacts
```

## 8. Functional requirements

Use stable IDs and SHALL/MUST language for requirements that determine completion.

### M###-CORE-001 — [Requirement]

[Precise observable behavior.]

### M###-CORE-002 — [Requirement]

[Precise observable behavior.]

Separate requirement families where useful:

- `ARCH` architecture
- `CORE` durable domain/application
- `BRAIN` Project Brain/context
- `AI` providers/proposals
- `UX` live workplace/device behavior
- `PROD` production/artifacts
- mode-specific families
- `GOV` provenance/governance
- `PROC` engineering/process gates

## 9. AI / author-control contract

Explicitly state:

- which shared provider boundary is used;
- which Project Brain context classes are relevant;
- what AI may propose;
- what AI may never silently mutate;
- schema validation requirements;
- provider/model/provenance evidence;
- honest failure behavior;
- approval/application boundaries.

## 10. Production/artifact contract

For user-visible outputs define:

- real artifact formats;
- metadata/dimensions/page counts where relevant;
- deterministic source revision linkage;
- checksums/digests where useful;
- preflight;
- download/restore/reproduction path.

A preview is not a production artifact.

## 11. Accessibility / platform contract

Define Chromebook and Android requirements, touch targets, overflow, keyboard semantics, PWA/offline boundaries and any platform-specific acceptance checks.

## 12. Security / privacy / licensing / provenance

Define asset provenance, permissions, sensitive data boundaries, external links, licensing expectations and generated-content attribution.

## 13. Phased engineering sequence

Break the mission into dependency-aware vertical phases.

### M###A — Research lock

Research + requirements + source register + no-drift fence.

### M###B — Shared foundation

Durable model/services/Brain/provider integration.

### M###C — Live vertical slice

First real end-to-end user path.

### M###D+ — Remaining capabilities

One coherent capability at a time.

### M###Z — Integration/completion

Cross-capability integration, full regression, devices, README and final matrix.

Each phase must define its own completion gate.

## 14. Requirement traceability matrix

| Requirement | Source | Implementation | Unit | Application | Browser | Mobile | Artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
| M###-CORE-001 | [source] | [path/PR] | ⬜ | ⬜ | N/A | N/A | N/A | OPEN |

**Rule:** every SHALL/MUST requirement finishes with evidence or an explicit superseding amendment.

## 15. PR discipline

Every PR must state:

```text
Mission: M### / phase
Requirements: M###-CORE-001, M###-UX-003
Existing systems inspected/reused: ...
Evidence/ADR: ...
Verification: ...
Known remaining requirements: ...
```

Do not mix unrelated missions unless the dependency is unavoidable and documented.

## 16. ADR trigger

Create an ADR before a hard-to-reverse choice involving, for example:

- core runtime/framework dependency;
- authoritative serialization format;
- provider/storage architecture;
- production renderer;
- cross-office state ownership;
- major schema migration;
- security boundary.

ADR structure:

```text
Context
Decision
Consequences
Alternatives considered
Evidence
Status
Supersedes / Superseded by
```

## 17. No-drift rules

1. Do not implement features without a parent requirement or explicit amendment.
2. Do not create duplicate Brain/provider/storage infrastructure.
3. Do not weaken tests to obtain green builds.
4. Do not count source-pattern tests as human/device verification.
5. Do not count preview controls as production artifacts.
6. Do not silently rewrite mission intent after coding begins.
7. Do not mark a phase complete with known blockers hidden in prose.
8. Record useful out-of-scope ideas in future candidates rather than pulling them into the active build.

## 18. Definition of verified

- **Domain:** deterministic contracts validated by tests.
- **Application:** durable real services/routes/state/artifacts/errors proven.
- **Human/device:** real browser interactions proven on required layouts/devices.
- **Production:** artifact bytes/properties/preflight proven.
- **Recovery:** authoritative state survives reload/restart where required.

## 19. Final mission completion gate

Write a numbered checklist of observable conditions that must all be true before `COMPLETE` may be recorded.

## 20. Research source register

Record source name, URL, date checked when freshness matters, evidence category and adopted practice.

## 21. Mission amendment log

| Amendment | Date | Requirement(s) | Reason/evidence | Status |
|---|---|---|---|---|
| Initial lock | YYYY-MM-DD | Mission | Research completed and scope locked | ACTIVE |

Material changes are appended here. Requirements may be superseded explicitly; they should not disappear silently.

## 22. Working loop

At the beginning of each build turn:

1. read `README.md` progress;
2. read the active mission;
3. identify the next unsatisfied requirement IDs;
4. inspect existing implementation;
5. implement the smallest coherent production-ready slice;
6. verify it at the required levels;
7. update traceability/progress;
8. continue without unnecessary checkpoints.

**Fast development is encouraged. Untracked development is not.**
