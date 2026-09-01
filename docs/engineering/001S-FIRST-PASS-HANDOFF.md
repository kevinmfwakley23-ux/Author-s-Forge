# First Pass 001S — Atomic Reversible Studio Package Recovery

## Status

IMPLEMENTED — exact-head CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Base: merged 001R Studio package-envelope integrity.
- Branch: `first-pass/001s-atomic-studio-package-recovery`.
- Pull request: #72.
- Isolated from the active Project Brain retrieval/state-conflict lane.

## Inspection finding

A validated package and envelope are not enough to make recovery safe. Restore must compose with the canonical durable ProjectState validator, must not implicitly create a project, and should be reversible rather than a one-way destructive overwrite.

## Improvements

- `StudioProjectRecoveryService` requires an existing target project;
- incoming package is validated through `restoreStudioSnapshot()` before mutation;
- current durable project is exported as a validated rollback package before replacement;
- restored ProjectState is written only through `FileProjectStore.save()`, preserving its validation-before-write and atomic replacement boundary;
- state is reloaded after save as durable evidence;
- cross-project/corrupt packages fail without replacing the current project.

## Regression coverage

Tests prove prior-package restore, rollback-package restore, canonical invalid ProjectState rejection with no mutation, cross-project rejection with no mutation, and refusal to create missing projects through restore.

## Next block

001T adds the route-ready HTTP adapter and requires explicit author approval before the recovery mutation service can execute.
