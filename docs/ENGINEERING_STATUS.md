# Author's Forge — Engineering Status

**Date:** 2026-08-30  
**Baseline:** `main`  
**Purpose:** concise, evidence-oriented status for the active build.

## Current baseline

The repository is in the Functional-Truth completion phase. The domain and application layers cover the major authoring, AI, editorial, visual, production, publishing, governance, recovery, and Studio workflows. The current engineering priority is not adding disconnected feature shells; it is proving that the existing capabilities operate together through the real Studio and supported devices.

Recent main-branch work strengthened the Android/PWA delivery surface:

- real service-worker registration and lifecycle handling;
- install UX in the Studio shell;
- conservative shell caching with `/api/` excluded;
- mobile viewport/touch acceptance;
- live manifest validation;
- service-worker control validation;
- explicit assertion that project API data is never placed in the shell cache;
- one-command full verification via `npm run verify`.

## Verification commands

```bash
npm run build
npm test
npm run completion
npm run test:browser
npm run test:browser:mobile
```

For the complete local verification sequence:

```bash
npm run verify
```

`npm run verify` is intentionally an execution command, not a source-presence check. It builds the application, runs the automated regression suite, reports the completion meter, and exercises both desktop and phone-sized Studio acceptance.

## Completion meter

```bash
npm run completion
```

The meter reports:

1. **Engineering capability completion** — implementation surface plus matching automated evidence.
2. **Verification/evidence readiness** — browser/mobile harnesses, provider boundary evidence, honest-AI behavior, and product documentation.

A meter value must never be interpreted as physical-device proof. Final 100% requires the complete author journey to be demonstrated, including configured real providers where applicable and actual Chromebook/Android verification.

## Active completion work

### P0 — Functional truth

- keep the complete regression suite green;
- continuously verify Studio routes and real state transitions;
- exercise the core author loop from project creation through manuscript editing and AI proposal approval;
- verify generated artifacts are real and recoverable;
- preserve author authority and canon locks throughout AI-assisted workflows.

### P1 — Android / Chromebook production proof

- run the mobile acceptance suite from a clean checkout;
- launch the real Studio on the Android phone through the supported browser;
- install the PWA from the browser install surface;
- verify standalone launch and reload;
- verify durable project data survives browser/PWA restart;
- verify file/artifact handling on the phone;
- verify the same project remains usable from Chromebook;
- record any device-specific defects as implementation work, not as waived evidence.

### P2 — Real provider proof

When credentials are configured, exercise real provider requests for writing and image generation. When credentials are absent or a provider is unavailable, the Studio must report an actionable failure and never fabricate output.

### P3 — Release hardening

After the working journey is proven, harden deployment configuration, security boundaries, artifact download/recovery, observability, and release packaging. Do not use release packaging to hide an unverified product workflow.

## Architectural guardrails

- Project state is durable and authoritative; browser process state is not.
- AI output is a proposal until author approval permits an authoritative mutation.
- Canon and author decisions cannot be silently overwritten by AI.
- Provider credentials do not belong in manuscript/project state.
- `/api/` responses must not be cached as PWA shell data.
- A visible control must terminate in a real result, real operation, real navigation, deterministic calculation, artifact, or explicit actionable error.
- Source-pattern tests are supplementary evidence only; browser/device execution is required for final product claims.

## Android completion gate

Android is complete only when the following are all true:

- [ ] PWA installs from a real Android browser.
- [ ] Standalone launch works.
- [ ] Studio navigation is usable by touch.
- [ ] No blocking horizontal overflow occurs at supported phone widths.
- [ ] Project/book/chapter/scene creation works on-device.
- [ ] Manuscript editing and save work on-device.
- [ ] Reload/restart restores durable project state.
- [ ] Generated/downloaded artifacts can be handled on-device.
- [ ] Offline shell behavior is useful without pretending API/project data is cached.
- [ ] Reconnection returns to the live project without data corruption.

The automated mobile harness proves a substantial subset of this gate. It does not replace the final physical Android run.
