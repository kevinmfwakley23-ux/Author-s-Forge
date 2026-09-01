# Author's Forge — Educational Workbook Office

## Status

The Educational Workbook Office is a first-class creation workplace built on the shared Forge project/data trunk. It does not create a competing Project Brain, AI provider stack, cover calculator, KDP validator, or recovery system.

This office is implemented with real durable storage, deterministic workbook generation, validated answer-key truth, a working browser UI, Project Brain-aware AI proposals, shared Forge Core model routing, and real PDF production. It does not use canned production responses or a fake AI fallback.

The mandatory shared routing contract is [`FORGE_AI_TRUNK_ROUTING_CONTRACT.md`](FORGE_AI_TRUNK_ROUTING_CONTRACT.md).

## Launch

Desktop/local:

```bash
npm run studio:workbooks
```

Android/LAN:

```bash
npm run studio:workbooks:android
```

Default local URL: `http://127.0.0.1:4373`

## Canonical responsibility

The office owns the educational-content workflow between approved project intent and shared downstream Book Design / Production + KDP work:

1. create or import reusable activity banks;
2. classify activities by grade band, subject, activity type, difficulty, standards/framework identifiers, tags, points, and answer truth;
3. validate scored activity structures before they enter the durable library;
4. assemble Project Brain context for AI-assisted activity creation;
5. dispatch AI work through the shared Forge Core model broker with context optimization, quota protection, usage balancing, cooldown and failover;
6. preserve generated activities as durable pending proposals until explicit author approval;
7. select unique approved activities deterministically from author-controlled pools;
8. balance mixed-subject workbooks without pretending balance is pedagogical certification;
9. preserve learning objectives and directions as edition state;
10. generate an optional answer key from the actual saved answers;
11. preserve reproducible seeds and source activity IDs;
12. persist generated workbook editions across restart and record edition state in Project Brain production memory;
13. render a real printable PDF interior with title, objectives, directions, activity pages, work space, and answer-key pages.

## Project Brain + shared AI

The **Brain + AI** workplace is not an office-local AI silo. Production startup uses the canonical `ForgeStudioRuntime`, and that runtime binds the live provider boundary to the exact `ForgeCore.ai` model broker and `ForgeCore.routing` state objects.

Workbook AI activity generation therefore inherits the shared trunk behavior:

- Project Brain retrieval and provenance-aware context;
- context optimization before provider dispatch;
- capability-aware model eligibility;
- input + expected-output quota reserve;
- accumulated token-usage balancing across eligible models;
- provider/model preference as a soft preference rather than an exhaustion command;
- cooldown after retryable failures;
- real model/provider failover;
- provider-reported token usage where available;
- explicitly labeled estimated accounting where provider usage is unavailable;
- real failure when no eligible configured provider exists.

The browser exposes configured provider/model resources, current routing usage/failure evidence, estimated context savings, and provider usage when the provider returns it.

### AI proposal authority boundary

AI-generated workbook activities are never automatically inserted into the reusable activity library.

The server stores the exact generated activities and provider evidence in a durable **pending proposal** record. The author can then approve or reject that server-owned proposal. Approval promotes those exact stored activities into the library; a client cannot manufacture an arbitrary approval payload and have it treated as prior AI output.

Proposal history stores:

- project identity;
- pending / approved / rejected status;
- creation and decision timestamps;
- generated activities;
- provider and model;
- request/attempt evidence when available;
- context-optimization evidence;
- provider token usage when available;
- routing accounting and whether that accounting was provider-reported or estimated.

## Production-truth rules

Educational Workbooks follow the same functional-truth standard as every other Forge office.

- A workbook edition may only draw from activities that actually exist in the durable project-scoped library.
- Pending AI proposals are **not** library activities and cannot appear in generated editions before approval.
- Multiple-choice answers must exactly match a saved choice.
- True/false answers must actually be `true` or `false`.
- Scored short-answer, fill-in-the-blank, multiple-choice, true/false, and math-practice activities require stored answer truth.
- AI output passes the same activity validators as author-entered/imported activities.
- Author-required standards identifiers may not disappear from an AI proposal. Standards/framework identifiers remain metadata supplied or imported by the author/workflow; Forge does not claim that an activity is independently standards-aligned merely because an identifier is present.
- `optimization.tokensSaved` is an estimated context-reduction metric. It is never presented as provider-billed token usage.
- Provider-reported usage is recorded when returned. If a provider does not return usage, runtime accounting is explicitly marked estimated.
- The office emits a generic, real PDF artifact. It deliberately does **not** label that artifact KDP-ready by itself. KDP-specific trim, bleed, margin, image-resolution, cover, and final submission checks remain the responsibility of the shared Production + KDP Office.
- If no real eligible AI provider/model is configured, the AI Activity Builder fails honestly. Static/canned AI fallback behavior is prohibited.

## Current activity model

Supported grade bands:

- Pre-K
- K–2
- 3–5
- 6–8
- 9–12
- Adult

Supported subjects:

- Literacy
- Math
- Science
- Social studies
- Handwriting
- Social-emotional learning
- Language learning
- Test prep
- Custom

Supported activity types:

- Multiple choice
- Short answer
- Fill in the blank
- True / false
- Writing prompt
- Math practice

The data model is intentionally extensible. Additional activity types should be added only with real rendering/validation behavior and regression coverage.

## Research basis

The office design follows current authoritative guidance without claiming certifications that Forge has not earned:

- CAST Universal Design for Learning Guidelines 3.0 emphasize designing learning experiences that reduce barriers and support multiple forms of engagement, representation, and action/expression. Forge therefore keeps activity type, difficulty, and content pools explicit rather than forcing one worksheet pattern. See: https://udlguidelines.cast.org/
- Common Core State Standards are treated as externally defined identifiers that authors can attach to activities for organization and later review; Forge does not fabricate alignment findings. See: https://www.thecorestandards.org/ELA-Literacy/
- Amazon KDP print guidance requires concrete production checks such as page size, margins, bleed handling, font sizing, image resolution, and PDF requirements for bleed interiors. Those checks remain downstream in Forge's shared Production + KDP Office instead of being faked inside this creation office. See: https://kdp.amazon.com/en_US/help/topic/G201857950

## Verification contract

This office is not complete based on source inspection alone. Its release gate includes:

- TypeScript build;
- domain/application regression tests;
- durable activity/edition/proposal restart persistence;
- validation of wrong/invalid answer structures;
- validation that AI cannot invent required standards or bypass activity truth rules;
- proof that AI proposal generation does not mutate the library before approval;
- proof that production Studio AI usage writes into the exact Forge Core routing state;
- quota-reserve and model-rotation regression coverage;
- provider failover and real/estimated usage accounting coverage;
- PDF byte/header/hash validation;
- real browser activity import and workbook creation;
- real browser Project Brain AI proposal → author approval → library promotion;
- real browser PDF production/download path;
- Android-sized viewport overflow and touch-target acceptance;
- inclusion in the repository's standard browser verification command.

Mocks may be used only as clearly identified automated-test fixtures. They are never a production fallback or evidence that an unavailable provider/capability is working.
