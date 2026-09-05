# Mission 034 — Recovery Safety Boundary

## Purpose

Strengthen portable project recovery so restoring an archive cannot silently destroy the author's existing local project state.

## Product contract

Recovery must remain author-controlled, observable, reversible, attributable, and durable. A restore operation must never be presented as safe merely because package validation succeeds.

## Scope

- Provide a recovery planning service that validates a portable package before mutation.
- Detect whether the target project already exists.
- Require an explicit overwrite decision when replacing an existing project.
- Preserve the current target snapshot as a serialized recovery backup before overwrite.
- Restore only after validation and backup preparation succeed.
- Verify the restored project after persistence.
- Keep package/project identity checks and workspace validation intact.

## Non-goals

- Browser/cloud backup.
- Automatic background synchronization.
- Silent overwrite behavior.
- Replacing the durable project source of truth with compressed or derived state.

## Definition of done

1. Domain/application tests cover new-target restore, existing-target refusal, explicit overwrite, backup creation, and post-restore verification.
2. No invalid package can create or overwrite durable state.
3. The pre-restore target state is recoverable from the generated backup artifact.
4. The implementation remains provider-neutral and platform-neutral.
5. README records the new recovery-safety rule and milestone status.
