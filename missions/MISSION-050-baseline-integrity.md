# Mission 050 — Canonical Baseline Integrity

## Objective

Prevent stale generated artifacts from masquerading as current Forge source state during local verification.

## Delivered

- Added `test/public-api-runtime-integrity.test.js`.
- The regression suite now has a dedicated runtime-level contract for the canonical public API surface used by the existing domain/application tests.
- Added `scripts/forge-baseline-check.js` as a dependency-free checkout sanity check.
- The check distinguishes missing generated/runtime artifacts from implementation failures and directs the engineer to the canonical `npm run build` path.

## Why this matters

The Functional-Truth program has repeatedly exposed a dangerous class of failure in which a checkout contains current source exports but stale or missing `dist/` output. Symptoms such as `createProject is not a function`, `createManuscriptState is not a function`, or missing service constructors can then be misdiagnosed as domain regressions.

Mission 050 makes that boundary explicit: build artifacts are derived, the TypeScript source remains canonical, and runtime public-API integrity is verified after compilation.

## Verification contract

The canonical sequence remains:

```text
npm run build
↓
node scripts/forge-baseline-check.js
↓
npm test
↓
npm run test:browser
↓
npm run test:browser:mobile
```

This mission does not weaken tests, manufacture provider output, or claim physical-device verification. It is a release-engineering guardrail for maintaining one trustworthy baseline while Mission 045 Functional-Truth completion continues.
