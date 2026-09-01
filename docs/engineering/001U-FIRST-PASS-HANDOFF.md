# First Pass 001U — Live Governed Package Recovery Route

## Status

IMPLEMENTED — exact-head CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Base: 001T governed package recovery HTTP boundary.
- Branch: `first-pass/001u-live-package-recovery-route`.
- Pull request: #75.
- Android second pass should consume this only after the preceding recovery blocks are merged and handed off.

## Inspection finding

Forge already exposed a live Studio package export route, while the new recovery service and approval-gated HTTP adapter were application-level only. That left project restore technically implemented but unreachable through the real Studio server, which does not satisfy Forge's functional-truth rule.

## Improvements

- composes `StudioProjectRecoveryService` with the existing `FileProjectStore` and `ProjectPackageService` in the production Studio server;
- adds `POST /api/projects/:projectId/package/restore` as the single live restore entry point;
- delegates runtime request validation and explicit author approval to `restoreStudioProjectFromHttp()`;
- delegates package validation, rollback snapshot generation, canonical save and persisted reload verification to `StudioProjectRecoveryService`;
- preserves the existing GET package-export route and creates no second persistence or recovery authority.

## Research applied

OWASP transaction-authorization, authorization and business-logic guidance supports enforcing sensitive state transitions at the server boundary, failing closed and applying the same authorization invariant at every entry point. RFC 9110 semantics also reinforce treating restore as a POST-style state-changing operation rather than assuming idempotent transparent retries.

## Regression coverage

`test/studio-project-recovery-route.test.js` starts the real built Studio server against an isolated durable data directory and proves the complete reversible flow:

1. create a project and baseline state;
2. export its live Forge package;
3. mutate durable state;
4. attempt restore without approval and prove state remains unchanged;
5. restore the baseline package with explicit author approval;
6. reload the project and prove the restored state persisted;
7. restore the returned rollback package through the same HTTP route;
8. reload again and prove the later state returned.

## Next block

After exact-head CI and merge, 001V should make recovery author-visible in the Studio UI with explicit destructive-action confirmation, package selection/import handling, rollback-package preservation/download, and browser/mobile acceptance without bypassing this route.
