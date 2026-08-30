# Mission 043 — Workflow Quality Gates

Author's Forge now has a canonical lifecycle-gate contract spanning concept, architecture, canon, manuscript, editing, visuals, production, positioning, marketing, and release.

## Why

Long-form book systems benefit from explicit stage deliverables and quality gates instead of allowing an agent to run ahead of unresolved work. The design was informed by current open-source publishing workflows such as Velith's phase gates, Novel Engine's explicit human-confirmed pipeline, and CanonLoom's deterministic stage boundaries. Forge keeps the stronger domain/persistence/author-control architecture already established in this repository.

## Contract

`src/domain/workflow-gate.ts` provides:

- canonical lifecycle ordering;
- per-stage deterministic checks;
- remediation text for failed checks;
- readiness status derived from checks rather than caller-supplied labels;
- explicit `canAdvanceWorkflow` decisions;
- versioned, validated reports.

This is intentionally a domain contract first. It does not claim Studio integration until an actual route and rendered workflow consume it.

## Verification

`test/workflow-gate.test.js` covers lifecycle shape, blocked progression, successful progression, and inconsistent-report rejection.
