# First Pass 001T — Governed Package Recovery HTTP Boundary

## Status

IMPLEMENTED — exact-head CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Base: 001S atomic reversible Studio package recovery, merged to `main` as `b71c8f25e87e133cc2d5ddedce34ec1bb2ad5eee` after Forge CI #725 passed.
- Branch: `first-pass/001t-governed-package-recovery-http`.
- Pull request: #73, retargeted to current `main` after the 001S merge.

## Improvement

The recovery mutation is deliberately destructive and therefore must not rely on a UI confirmation alone. `restoreStudioProjectFromHttp()` validates the request boundary and requires explicit `authorApproved: true` before it can invoke `StudioProjectRecoveryService.restoreExisting()`.

It also validates the package container and optional rollback timestamp before delegation, and passes the approved request exactly once to the durable recovery service.

## Research applied

Current OWASP transaction-authorization and authorization guidance reinforces the Forge rule already used here: sensitive state transitions must be authorized and enforced server-side, fail closed, and not depend on a client/UI-only confirmation. OWASP business-logic guidance likewise calls for every sensitive entry point to enforce the same invariants. The adapter therefore owns the approval gate before mutation is delegated.

## Regression coverage

Tests prove missing/false author approval cannot call recovery, malformed request/package containers fail closed, malformed rollback timestamps fail before mutation, and valid approved recovery preserves arguments and result.

## Next block

001U owns live Studio route integration on PR #75. Production UI wiring can then call the same governed route without creating a second recovery authority.
