# Author's Forge — Educational Workbook Office

## Status

The Educational Workbook Office is a first-class creation workplace built on the shared Forge project/data trunk. It does not create a competing Project Brain, AI provider stack, cover calculator, KDP validator, or recovery system.

This office is implemented with real durable storage, deterministic workbook generation, validated answer-key truth, a working browser UI, and real PDF production. It does not use canned production responses or a fake AI fallback.

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
4. select unique activities deterministically from author-controlled pools;
5. balance mixed-subject workbooks without pretending balance is pedagogical certification;
6. preserve learning objectives and directions as edition state;
7. generate an optional answer key from the actual saved answers;
8. preserve reproducible seeds and source activity IDs;
9. persist generated workbook editions across restart;
10. render a real printable PDF interior with title, objectives, directions, activity pages, work space, and answer-key pages.

## Production-truth rules

Educational Workbooks follow the same functional-truth standard as every other Forge office.

- A workbook edition may only draw from activities that actually exist in the durable project-scoped library.
- Multiple-choice answers must exactly match a saved choice.
- True/false answers must actually be `true` or `false`.
- Scored short-answer, fill-in-the-blank, multiple-choice, true/false, and math-practice activities require stored answer truth.
- Standards/framework identifiers are metadata supplied or imported by the author/workflow; Forge does not claim that an activity is standards-aligned merely because an identifier is present.
- The office emits a generic, real PDF artifact. It deliberately does **not** label that artifact KDP-ready by itself. KDP-specific trim, bleed, margin, image-resolution, cover, and final submission checks remain the responsibility of the shared Production + KDP Office.
- If future AI generation is added, it must use the shared real provider boundary, preserve source/provenance, remain a proposal until author approval, and fail honestly when no real provider is configured. Static/canned AI fallback behavior is prohibited.

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
- durable restart persistence;
- validation of wrong/invalid answer structures;
- PDF byte/header/hash validation;
- real browser activity import and workbook creation;
- real browser PDF production/download path;
- Android-sized viewport overflow and touch-target acceptance;
- inclusion in the repository's standard browser verification command.

Mocks may be used only as clearly identified automated-test fixtures. They are never a production fallback or evidence that an unavailable provider/capability is working.
