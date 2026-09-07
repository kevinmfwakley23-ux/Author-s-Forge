# K.I.N.G.S. Author's Forge — Main Studio Production Scope

## Production target

The production target is the **main AI writing and publishing Studio**. A main-Studio release is evaluated on the author's real book journey:

1. create/open/recover a project;
2. develop an idea, story architecture, canon, characters, series state, and author voice;
3. import or create manuscript structure;
4. draft/continue/rewrite with real configured AI providers and Project Brain context;
5. review AI proposals before manuscript mutation;
6. edit with continuity/voice/craft safeguards;
7. create/manage visual assets and cover direction;
8. render real manuscript/production artifacts and run KDP-oriented preflight;
9. prepare publishing metadata and promotion/marketing assets;
10. preserve durable project/recovery state across restart and device access.

## Optional offices are separate products/lane

The following are **not release blockers for the main Studio**:

- Guided Journal;
- Educational Workbooks;
- Specialized Creation (comics/cards/invitations/flyers/TCG and related tools);
- NFT / digital collectible creation.

They remain in the repository while they are separated and improved, but a failure in one of those servers or acceptance suites must not prevent the main writing Studio from starting, deploying, or passing its production gate.

## Commands

### Main Studio — production path

- `npm run forge` — build and launch only the main Studio.
- `npm run forge:android` — expose only the main Studio through the protected LAN launcher for phone/tablet use.
- `npm run forge:web` — launch the authenticated hosted gateway with only the main Studio enabled.
- `npm run test:main` — main-Studio unit/integration tests.
- `npm run baseline` — main-Studio build artifact baseline.
- `npm run completion` — main-Studio capability/evidence gate.
- `npm run test:browser` — main-Studio browser acceptance.
- `npm run test:browser:mobile` — main-Studio Android/WebKit acceptance.
- `npm run verify` — the main-Studio release gate.

### Explicit all-office / development path

- `npm run forge:all`
- `npm run forge:android:all`
- `npm run forge:web:all`
- `npm run baseline:all`
- `npm run completion:all`
- `npm run test:browser:offices`
- `npm run test:browser:mobile:offices`
- `npm run verify:all`

These commands are intentionally separate from the main release gate.

## AI runtime contract

Author's Forge never fabricates provider output. The main Studio can route through its independent Forge broker/failover layer and can use the K.I.N.G.S. app router through the Responses-compatible bridge.

Hosted preference order is K.I.N.G.S. first, followed by configured direct fallbacks. A K.I.N.G.S. hosted router still requires at least one real upstream model gateway/provider. The Render Blueprint exposes secret slots for K.I.N.G.S. OmniRoute/9Router upstreams and an optional direct Forge OmniRoute fallback; secrets are never committed to the repository.

`configured` AI is not treated as the same thing as `operational` AI. A model explicitly marked unhealthy or still in cooldown does not satisfy Forge Core readiness.

## Author-control rule

Removing fake blockers does **not** mean removing author ownership. The main Studio keeps protections that prevent silent destructive mutation:

- AI writing creates proposals;
- review/acceptance is distinct from apply;
- stale target checks remain;
- continuity evidence remains;
- workflow stage changes still require the author's explicit approval;
- external publication/paid-provider success is never claimed without real evidence.

These are data-integrity and author-control safeguards, not artificial completion blockers.

## Completion truth

The main production gate is allowed to pass independently of optional offices. Passing the gate means the main Studio's implemented journey and automated acceptance evidence are green. It does **not** mean Amazon KDP, a retailer, a social network, or a paid AI vendor completed an external action unless that action was actually executed with valid credentials and verified.
