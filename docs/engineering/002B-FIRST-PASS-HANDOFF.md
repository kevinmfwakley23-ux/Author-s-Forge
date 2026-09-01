# First Pass 002B — Durable Book Version Management

## Status

IMPLEMENTED — exact-head Forge CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Base: current `main`, after merged 002A children's story topic discovery.
- Android is working in the separate Specialized Creation lane; this block does not touch that office.
- No external-backup or Project Brain retrieval files are modified.

## Capability

Forge now has a durable application authority over its structured v2 book snapshots rather than only domain helper functions.

`StudioBookVersioningService` supports:

- capture of Draft 1 / Draft 2 / Draft 3 / Final / Published / custom versions from the live WorkspaceBook;
- durable version history in ProjectState/FileProjectStore;
- comparison of any two versions;
- named branches from any stored base version;
- three-way merge with explicit conflict propagation;
- author-approved rollback to a structured version;
- automatic capture of the immediately pre-rollback book as a rollback checkpoint;
- durable Author Control attribution containing restored and rollback version IDs;
- restoration of the rollback checkpoint through the same governed path.

## Authority rules

Capture, compare, branch and merge are non-destructive. A merged result becomes another immutable candidate version and does not silently replace the live manuscript. Restore is destructive and therefore requires `authorApproved: true` plus a non-empty reason.

The restore path writes an `author-approved` decision into the existing project Author Control ledger and persists a structured checkpoint before replacing live book state. This makes rollback observable, reversible and attributable.

## Regression coverage

Tests use the real FileProjectStore and prove restart-safe capture/list/compare; refusal of unapproved restore without mutation; automatic rollback checkpoint creation; durable author attribution; undoing a restore by restoring its checkpoint; branch persistence; non-overlapping three-way merge and merged-version durability.

## Verification gate

Merge only after Forge CI passes the exact current head against merged `main`, including build/tests, completion checks, desktop browser acceptance and Android/mobile acceptance.

## Next block

Wire this application authority into the live Studio HTTP boundary and Versions & Recovery workplace, including real browser/mobile acceptance.