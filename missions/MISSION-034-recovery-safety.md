# Mission 034 — Author-Controlled Recovery Safety

## Objective

Make durable project recovery safe for existing projects by separating inspection from mutation, requiring explicit overwrite approval, and preserving the pre-restore project as a durable backup before replacement.

## Scope

- inspect whether the requested restore target already exists;
- require explicit overwrite approval when it does;
- refuse overwrite without approval and leave the target unchanged;
- create a durable backup immediately before an approved replacement;
- preserve the original project identity and full persisted state in the backup artifact;
- perform the existing validated restore only after safety checks succeed;
- verify the replacement through the existing restore load-back check;
- provide a recovery result identifying whether an overwrite occurred and which backup was created.

## Non-goals

- browser recovery UI;
- cloud backup;
- automatic conflict merging;
- automatic restore without author intent;
- deletion of the previous project state.

## Acceptance

1. Existing targets produce a recovery plan requiring overwrite approval.
2. An unapproved overwrite is rejected without mutating the target.
3. An approved overwrite creates a durable backup before replacement.
4. The backup preserves the original project identity and state.
5. The replacement passes the existing persistence/load-back verification.
6. Regression tests cover refusal and approved overwrite paths.

## Engineering boundary

Recovery is an author-controlled state transition. Inspection must occur before mutation. Existing project data is never silently discarded. The canonical project package and durable project store remain authoritative; recovery backups are protective derived artifacts and never become a substitute source of truth.
