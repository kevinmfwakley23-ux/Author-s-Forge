# Author's Forge — Guided Journal Office

## Status

This office is a first-class creation workplace that consumes the shared Forge Brain/trunk. It does not create a journal-specific memory system, AI gateway, cover calculator, or production truth.

## Launch

```bash
npm run studio:journal
```

Android / Chromebook LAN access:

```bash
npm run studio:journal:android
```

Default journal-office port: `4273`. The office uses the same `FORGE_DATA_DIR` as the main Studio, so project memory and Cover Studio plans remain shared durable project state.

## Capability contract

### Master question library

- durable project-scoped question library;
- categories: Remember, Discover, Challenge, Create, Become, Hope;
- add/revise questions;
- enable/disable questions without deleting them;
- remove questions;
- JSON import/export;
- tags;
- durable cover-statement library;
- author approval required before AI-proposed questions enter the active library.

### Question randomizer

- deterministic seeded selection;
- category filter;
- exclusion list;
- enabled-question filtering;
- reproducible results for the same pool + seed.

### Edition builder

- deterministic seeded edition generation;
- balanced category selection;
- no duplicate prompt inside an edition;
- no-repeat-across-editions protection by default;
- optional author override for intentional reuse;
- author-selected categories and prompt pools;
- durable ordering;
- durable history and restart recovery;
- optional deterministic cover-statement selection.

### Page and interior formatting

Supported response-page styles:

- blank;
- lined;
- lightly lined;
- dot grid;
- guided response.

Production controls include:

- trim width / height;
- response pages per prompt;
- prompt and response typography;
- prompt alignment;
- line spacing;
- dot spacing;
- top, bottom, inside, outside margins;
- page numbers;
- category labels;
- prompt starts on new page;
- title page;
- copyright page;
- introduction pages;
- closing pages.

### Real production PDF

The office generates a real KDP-PDF production artifact rather than a visual-only preview. The artifact includes:

- PDF bytes;
- exact rendered page count;
- MIME / file name;
- byte length;
- SHA-256;
- project / book identity;
- existing Author's Forge production-artifact validation.

The page renderer physically draws the selected writing surface (lines, light lines, dots, blank response space, or guided response lines) at the configured trim and margins.

### Forge Brain integration

Journal generation and production state use the shared `ProjectMemoryStore` / Project Brain contracts. Journal AI requests consume relevant shared memory classes including author, project, style, research, decision, visual, marketing, and production memory as appropriate.

The live journal runtime loads the project's durable memories from the same project package used by the main Studio and writes generated journal / cover production memory back into that same state.

### Shared AI capability

The Guided Journal Office calls the existing `generateProjectText` provider boundary. It therefore inherits the Forge provider order, token/context optimization, caching rules, evidence, fail-soft provider attempts, and configured resources:

- OmniRoute;
- 9Router;
- K.I.N.G.S.;
- OpenAI;
- Ollama.

Forge never fabricates AI output when no real provider is configured.

AI-assisted journal capabilities include:

- new question proposals using Project Brain context;
- duplicate-aware prompt generation;
- provider/model evidence;
- token/context optimization evidence;
- cover visual direction;
- back-cover copy;
- optional cover-statement proposals.

AI questions remain proposals until explicit author approval.

### Cover Studio handoff

Cover planning consumes the actual journal production layout. Trim width, trim height, and page count are derived from the same layout used for the interior PDF. The shared `BookCoverStudioService` then calculates front/back/spine geometry.

The resulting cover plan is written back to the project's ordinary `bookCoverPlans` durable state, making it available to the existing Author's Forge Cover Studio rather than trapping it inside the Journal Office.

### Author authority

- AI output is candidate material;
- AI prompt proposals require explicit approval before entering the active library;
- the author can disable/remove library entries;
- randomization is reproducible and author-controlled;
- repeat protection can be deliberately overridden;
- production settings are explicit;
- no silent AI rewrite or silent canon promotion occurs.

## Acceptance gates

The office is covered by domain/application regression tests plus `scripts/guided-journal-browser-acceptance.js`, which exercises a real browser and real HTTP runtime for:

1. durable library loading;
2. question randomizer;
3. edition generation;
4. lined production PDF rendering;
5. shared AI provider request + evidence;
6. explicit AI-question approval;
7. AI Cover Studio direction;
8. durable cover plan with spine/page geometry;
9. reload/restart persistence;
10. phone-sized Android viewport fit and touch interaction.

The script is part of `npm run test:browser` and therefore part of `npm run verify`.
