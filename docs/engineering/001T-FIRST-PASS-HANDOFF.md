# First Pass 001T — Governed Package Recovery HTTP Boundary

## Status

IMPLEMENTED — exact-head CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Base: 001S atomic reversible Studio package recovery.
- Branch: `first-pass/001t-governed-package-recovery-http`.
- Pull request: #73.

## Improvement

The recovery mutation is deliberately destructive and therefore must not rely on a UI confirmation alone. `restoreStudioProjectFromHttp()` validates the request boundary and requires explicit `authorApproved: true` before it can invoke `StudioProjectRecoveryService.restoreExisting()`.

It also validates the package container and optional rollback timestamp before delegation, and passes the approved request exactly once to the durable recovery service.

## Regression coverage

Tests prove missing/false author approval cannot call recovery, malformed request/package containers fail closed, malformed rollback timestamps fail before mutation, and valid approved recovery preserves arguments and result.

## Next block

Production Studio route/UI wiring can now remain thin: parse request, call this adapter, return restored project + rollback package. The application layer already owns the governance and durable transaction.
