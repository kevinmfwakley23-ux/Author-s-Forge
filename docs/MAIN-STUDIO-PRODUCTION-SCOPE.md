# K.I.N.G.S. Author's Forge — Core Production Scope

## Production target

The production target is the **Author's Forge core: Main AI Writing/Publishing Studio + Guided Journal Office**. A core release is evaluated on the author's real creative journey:

1. create/open/recover a project;
2. develop an idea, story architecture, canon, characters, series state, and author voice;
3. import or create manuscript structure;
4. draft/continue/rewrite with real configured AI providers and Project Brain context;
5. review AI proposals before manuscript mutation;
6. edit with continuity/voice/craft safeguards;
7. create, edit, randomize, and produce guided-journal prompt libraries and durable editions inside the same Forge project system;
8. create/manage visual assets and cover direction;
9. render real manuscript/journal production artifacts and run KDP-oriented preflight;
10. prepare publishing metadata and promotion/marketing assets;
11. preserve durable project/recovery state across restart and device access.

## Guided Journal is part of Forge core

Guided Journal is not an optional side application anymore. Normal Forge startup must attach:

- Main Studio;
- Guided Journal Office.

The Journal Office uses the Forge project data root, Project Brain memories/context, Forge AI provider layer, Cover Studio production contracts, and durable journal stores. A missing Journal build/runtime/UI artifact is therefore a **Forge core baseline failure**, not an ignorable optional-office failure.

The separate `K.I.N.G.S.-GUIDED-JOURNALS` repository is the migration source for newer Journal capabilities. Product features from that repository should be moved into Author's Forge when compatible, but its standalone-brain assumption must not replace the shared Forge core AI/project boundary.

## Separate office lanes

The following remain separate lanes and are **not release blockers for the Forge core** unless a later product directive promotes them:

- Educational Workbooks;
- Specialized Creation (comics/cards/invitations/flyers/TCG and related tools);
- NFT / digital collectible creation.

## Commands

### Forge core — production path

- `npm run forge` — build and launch Main Studio + Guided Journal.
- `npm run forge:android` — expose Main Studio + Guided Journal through the protected LAN launcher for phone/tablet browser use.
- `npm run forge:web` — launch the authenticated hosted gateway with Studio `/` and Guided Journal `/journal/` enabled.
- `npm run test:main` — core unit/integration tests selected by the main test runner.
- `npm run baseline` — core build artifact baseline; Journal artifacts are required.
- `npm run completion` — core capability/evidence gate; Journal implementation and acceptance harness are required.
- `npm run test:browser` — core browser acceptance, including Guided Journal acceptance.
- `npm run test:browser:mobile` — main mobile/WebKit acceptance against the core hosted runtime.
- `npm run verify` — Forge core release gate.

### Explicit all-office / development path

- `npm run forge:all`
- `npm run forge:android:all`
- `npm run forge:web:all`
- `npm run baseline:all`
- `npm run completion:all`
- `npm run test:browser:offices`
- `npm run test:browser:mobile:offices`
- `npm run verify:all`

These commands add Workbooks, Specialized Creation, and NFT to the core Studio + Journal runtime.

## AI runtime contract

Author's Forge never fabricates provider output. The Main Studio and Guided Journal use the Forge provider/broker layer and can use the K.I.N.G.S. app router through the Responses-compatible bridge.

The Guided Journal intelligence service already calls the shared Forge `generateProjectText` provider boundary; it must not be replaced with a fake journal-only response generator. Valid provider credentials are loaded from runtime environment variables/secrets and are never committed to the repository.

`configured` AI is not treated as the same thing as `operational` AI. Source code, a route, or the presence of an environment variable is not proof of a working model call. Live certification requires an actual successful provider request and evidence from the configured runtime.

## Author-control rule

Removing fake blockers does **not** mean removing author ownership. The Forge core keeps protections that prevent silent destructive mutation:

- AI writing creates proposals;
- Journal-generated questions remain proposals until author approval;
- review/acceptance is distinct from apply;
- stale target checks remain;
- continuity evidence remains;
- workflow stage changes still require the author's explicit approval;
- external publication/paid-provider success is never claimed without real evidence.

These are data-integrity and author-control safeguards, not artificial completion blockers.

## Completion truth

Passing the core gate means the implemented Studio + Guided Journal journey and automated acceptance evidence are green. It does **not** mean Amazon KDP, a retailer, a social network, or a paid AI vendor completed an external action unless that action was actually executed with valid credentials and verified.

Use evidence words precisely: source can be **present**, **built**, **integrated**, and **automated-tested** before it is **live-verified**. No API-powered feature is called live-verified until a real provider response succeeds with the user's configured credentials.
